/**
 * worker/src/adapters/index.ts — ATS adapter framework + shared toolkit.
 *
 * Each adapter knows how to fill() and submit() one ATS family. The generic
 * adapter is the fallback for unknown forms. All adapters share the toolkit
 * below: label-based field matching against the packet's answers, file upload
 * for the resume, and a field report describing exactly what happened.
 */
import type { Page, Frame } from 'playwright';

/** Where form elements live — the page itself or an embedded iframe. */
type FormScope = Page | Frame;

export interface FillContext {
  resumePath: string | null;
  config: {
    unknownQuestionMode?: string | null;
    attachCoverLetter?: boolean | null;
  } | null;
}

export interface FieldReport {
  filled: Array<{ label: string; value: string; via: string }>;
  skippedOptional: string[];
  unanswered: string[];      // required fields we could not answer
  guessed: string[];         // ai_guess mode: fields filled with flagged guesses
  resumeAttached: boolean;
  coverLetterAttached: boolean;
}

export interface FillResult { ok: boolean; error?: string; report: FieldReport }
export interface SubmitResult { ok: boolean; error?: string; externalId?: string }

export interface TaskLike {
  id: string;
  applyUrl: string | null;
  packet: unknown;
  mode: string;
}

export interface AtsAdapter {
  name: string;
  matches(atsType: string, url: string): boolean;
  fill(page: Page, task: TaskLike, ctx: FillContext): Promise<FillResult>;
  submit(page: Page, task: TaskLike): Promise<SubmitResult>;
}

// ─── Packet helpers ────────────────────────────────────────────────────────────

export interface Packet {
  answers: Record<string, string>;
  coverLetter?: string;
  resumeKey?: string;
  identity: { firstName: string; lastName: string; fullName: string; email: string; phone?: string; linkedinUrl?: string; githubUrl?: string; portfolioUrl?: string; location?: string };
}

export function getPacket(task: TaskLike): Packet {
  const p = (task.packet || {}) as Partial<Packet>;
  return {
    answers: p.answers || {},
    coverLetter: p.coverLetter,
    resumeKey: p.resumeKey,
    identity: p.identity || ({} as Packet['identity']),
  };
}

// ─── Label → answer matching ───────────────────────────────────────────────────
// Order matters: identity first (exact intent), then canonical answer keys.

type Matcher = { test: RegExp; value: (p: Packet) => string | undefined; key: string };

export function buildMatchers(p: Packet): Matcher[] {
  const a = p.answers;
  const id = p.identity;
  return [
    { key: 'first_name', test: /first\s*name/i, value: () => id.firstName },
    { key: 'last_name', test: /last\s*name|surname|family\s*name/i, value: () => id.lastName },
    { key: 'full_name', test: /^(full\s*)?name$|your\s*name/i, value: () => id.fullName },
    { key: 'email', test: /e-?mail/i, value: () => id.email },
    { key: 'phone', test: /phone|mobile|cell/i, value: () => id.phone || a['phone'] },
    { key: 'location', test: /location|city|current\s+address|where.*based|state\s+or\s+province|which\s+state|state\s*\/\s*province/i, value: () => id.location || a['address'] },
    { key: 'linkedin_url', test: /linked\s*in/i, value: () => id.linkedinUrl || a['linkedin_url'] },
    { key: 'github_url', test: /github/i, value: () => id.githubUrl || a['github_url'] },
    { key: 'portfolio_url', test: /portfolio|personal\s+(web)?site|website/i, value: () => id.portfolioUrl || a['portfolio_url'] },
    { key: 'work_authorization_us', test: /authorized\s+to\s+work|work\s+authorization|legally\s+(able|authorized)|right\s+to\s+work/i, value: () => a['work_authorization_us'] },
    { key: 'requires_sponsorship', test: /sponsorship|require.*visa|now\s+or\s+in\s+the\s+future/i, value: () => a['requires_sponsorship'] },
    { key: 'salary_expectation', test: /salary|compensation|pay\s+expectation/i, value: () => a['salary_expectation'] },
    { key: 'start_date', test: /start\s*date|when\s+can\s+you\s+start|notice\s+period|available/i, value: () => a['start_date'] },
    { key: 'willing_to_relocate', test: /relocat/i, value: () => a['willing_to_relocate'] },
    { key: 'remote_preference', test: /remote|work\s+arrangement|hybrid/i, value: () => a['remote_preference'] },
    { key: 'years_experience', test: /years\s+of\s+(relevant\s+)?experience|how\s+many\s+years/i, value: () => a['years_experience'] },
    { key: 'why_company', test: /why\s+(do\s+you\s+want|are\s+you\s+interested|us|join)/i, value: () => a['why_this_company'] },
    { key: 'why_role', test: /why\s+this\s+(role|position)|interest\s+in\s+this\s+(role|position)/i, value: () => a['why_this_role'] },
    { key: 'cover_letter', test: /cover\s*letter|additional\s+information|anything\s+else/i, value: () => p.coverLetter },
    { key: 'how_heard', test: /how\s+did\s+you\s+hear/i, value: () => a['how_heard'] || 'Company careers page' },
    { key: 'pronouns', test: /pronoun/i, value: () => a['pronouns'] },
  ];
}

const EEO_PATTERN = /gender|race|ethnic|veteran|disabilit|sexual\s+orientation|transgender/i;

// ─── Overlay/consent dismissal ─────────────────────────────────────────────────
// Cookie banners (OneTrust et al.) intercept pointer events and silently block
// every fill. Clear them before touching the form.

export async function dismissOverlays(page: Page): Promise<void> {
  const candidates = [
    '#onetrust-accept-btn-handler',
    '#onetrust-reject-all-handler',
    'button:has-text("Accept All")',
    'button:has-text("Accept all")',
    'button:has-text("Reject All")',
    'button:has-text("I Accept")',
    'button:has-text("Got it")',
    '[id*="cookie"] button:has-text("Accept")',
    '[class*="cookie"] button:has-text("Accept")',
    '[aria-label="Close"], [aria-label="close"], [aria-label="Dismiss"]',
  ];
  for (const selector of candidates) {
    try {
      const btn = page.locator(selector).first();
      if (await btn.isVisible({ timeout: 400 }).catch(() => false)) {
        await btn.click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(400);
      }
    } catch { /* overlay heuristics are best-effort */ }
  }
}

// ─── Frame discovery ───────────────────────────────────────────────────────────
// Many career sites embed the real application form in an iframe. Fill inside
// whichever frame holds the most form fields.

async function pickFormScope(page: Page): Promise<FormScope> {
  const countIn = async (scope: FormScope) =>
    scope
      .locator('input[type="text"], input[type="email"], input[type="tel"], input:not([type]), textarea, input[type="file"]')
      .count()
      .catch(() => 0);

  let best: FormScope = page;
  let bestCount = await countIn(page);
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    const count = await countIn(frame);
    if (count > bestCount) {
      best = frame;
      bestCount = count;
    }
  }
  return best;
}

// ─── Shared form filler ────────────────────────────────────────────────────────
// Walks every visible input/textarea/select on the page, resolves its label,
// matches an answer, and fills it. EEO fields use stored answers only, else
// "Decline to self-identify" when offered, else left alone.

export async function fillVisibleForm(
  page: Page,
  task: TaskLike,
  ctx: FillContext,
  opts: { formSelector?: string } = {}
): Promise<FillResult> {
  const packet = getPacket(task);
  const matchers = buildMatchers(packet);
  const report: FieldReport = {
    filled: [], skippedOptional: [], unanswered: [], guessed: [],
    resumeAttached: false, coverLetterAttached: false,
  };

  // Consent banners intercept pointer events and silently break every fill.
  await dismissOverlays(page);

  // The form may live in an embedded iframe — fill where the fields are.
  const root = await pickFormScope(page);
  const scope = root === page ? (opts.formSelector || 'body') : 'body';

  // Every fill is VERIFIED by reading the value back. A fill that didn't
  // stick is reported as failed — the report must never claim success the
  // screenshot can't corroborate.
  const verifiedFill = async (el: ReturnType<FormScope['locator']>, value: string): Promise<boolean> => {
    await el.fill(value, { timeout: 8000 }).catch(() => {});
    let after = await el.inputValue().catch(() => '');
    if (!after.trim()) {
      // Some custom widgets need keyboard-style input
      await el.click({ timeout: 3000 }).catch(() => {});
      await el.pressSequentially(value.slice(0, 500), { timeout: 10000 }).catch(() => {});
      after = await el.inputValue().catch(() => '');
    }
    return !!after.trim();
  };

  // 1) Resume file input(s)
  if (ctx.resumePath) {
    const fileInputs = root.locator(`${scope} input[type="file"]`);
    const n = await fileInputs.count();
    for (let i = 0; i < n; i++) {
      const input = fileInputs.nth(i);
      const label = (await labelFor(root, input)) || '';
      if (i === 0 || /resume|cv/i.test(label)) {
        try {
          await input.setInputFiles(ctx.resumePath);
          report.resumeAttached = true;
          report.filled.push({ label: label || 'Resume', value: '[file]', via: 'file' });
          await page.waitForTimeout(1500); // many ATSes parse the file client-side
          break;
        } catch { /* keep trying others */ }
      }
    }
  }

  // 2) Text inputs + textareas
  const textInputs = root.locator(
    `${scope} input[type="text"], ${scope} input[type="email"], ${scope} input[type="tel"], ${scope} input[type="url"], ${scope} input:not([type]), ${scope} textarea`
  );
  const count = await textInputs.count();
  for (let i = 0; i < count; i++) {
    const el = textInputs.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const existing = await el.inputValue().catch(() => '');
    if (existing) continue; // never clobber prefilled values
    const label = (await labelFor(root, el)) || (await el.getAttribute('placeholder')) || (await el.getAttribute('name')) || '';
    if (!label) continue;
    const required = (await el.getAttribute('required')) !== null || (await el.getAttribute('aria-required')) === 'true' || /\*/.test(label);

    if (EEO_PATTERN.test(label)) {
      // Only fill EEO from explicit stored answers (never guess)
      const eeoVal = packet.answers['gender'] && /gender/i.test(label) ? packet.answers['gender']
        : packet.answers['ethnicity'] && /race|ethnic/i.test(label) ? packet.answers['ethnicity']
        : packet.answers['veteran_status'] && /veteran/i.test(label) ? packet.answers['veteran_status']
        : packet.answers['disability_status'] && /disabilit/i.test(label) ? packet.answers['disability_status']
        : undefined;
      if (eeoVal) {
        if (await verifiedFill(el, eeoVal)) {
          report.filled.push({ label, value: eeoVal, via: 'eeo_stored' });
        } else {
          report.skippedOptional.push(label + ' (EEO — fill failed)');
        }
      } else {
        report.skippedOptional.push(label + ' (EEO — not auto-answered)');
      }
      continue;
    }

    const m = matchers.find((mm) => mm.test.test(label));
    // Canonical matcher first, then the user's taught answer bank (answers the
    // user provided for this exact question on a previous application).
    const value = m?.value(packet) ?? packet.answers[slug(label)];
    const via = m?.value(packet) ? m!.key : 'answer_bank';
    if (value) {
      if (await verifiedFill(el, value)) {
        report.filled.push({ label, value: value.slice(0, 60), via });
        if (m?.key === 'cover_letter') report.coverLetterAttached = true;
      } else if (required) {
        report.unanswered.push(label + ' (fill did not stick)');
      } else {
        report.skippedOptional.push(label + ' (fill did not stick)');
      }
    } else if (required) {
      if (ctx.config?.unknownQuestionMode === 'ai_guess' && packet.answers['__ai_fallback_' + slug(label)]) {
        const guess = packet.answers['__ai_fallback_' + slug(label)];
        if (await verifiedFill(el, guess)) {
          report.guessed.push(label);
          report.filled.push({ label, value: guess.slice(0, 60), via: 'ai_guess' });
        } else {
          report.unanswered.push(label);
        }
      } else {
        report.unanswered.push(label);
      }
    } else {
      report.skippedOptional.push(label);
    }
  }

  // 3) Selects: match by label, choose option whose text matches the answer;
  //    EEO selects pick a "decline" option when present and no stored answer.
  const selects = root.locator(`${scope} select`);
  const sCount = await selects.count();
  for (let i = 0; i < sCount; i++) {
    const el = selects.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const label = (await labelFor(root, el)) || (await el.getAttribute('name')) || '';
    const m = matchers.find((mm) => mm.test.test(label));
    const value = m?.value(packet) ?? packet.answers[slug(label)];
    const optionTexts: string[] = await el.locator('option').allTextContents();
    const verifiedSelect = async (optionLabel: string): Promise<boolean> => {
      await el.selectOption({ label: optionLabel }, { timeout: 5000 }).catch(() => {});
      const after = await el.inputValue().catch(() => '');
      return !!after;
    };
    if (EEO_PATTERN.test(label) && !value) {
      const decline = optionTexts.find((o) => /decline|prefer not|don.t wish/i.test(o));
      if (decline && (await verifiedSelect(decline))) {
        report.filled.push({ label, value: decline, via: 'eeo_decline' });
      }
      continue;
    }
    if (value) {
      const target = optionTexts.find((o) => o.toLowerCase().includes(value.toLowerCase().slice(0, 20)))
        || (/^yes$/i.test(value) ? optionTexts.find((o) => /^yes/i.test(o)) : undefined)
        || (/^no$/i.test(value) ? optionTexts.find((o) => /^no/i.test(o)) : undefined)
        // "Which state/province do you live in?" — expand abbreviations from
        // the user's location ("Hawthorne, NJ" -> "New Jersey").
        || expandedStateOption(value, optionTexts);
      if (target && (await verifiedSelect(target))) {
        report.filled.push({ label, value: target, via: m?.key || 'answer_bank' });
      } else {
        report.unanswered.push(label + ` (no option matched "${value.slice(0, 30)}")`);
      }
    }
  }

  const ok = report.unanswered.length === 0;
  return {
    ok,
    error: ok ? undefined : `Required questions without answers: ${report.unanswered.slice(0, 5).join(' | ')}`,
    report,
  };
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 50);
}

// US state + Canadian province abbreviation expansion for location dropdowns.
const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
  IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon',
  PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia',
  ON: 'Ontario', QC: 'Quebec', BC: 'British Columbia', AB: 'Alberta', NS: 'Nova Scotia',
};

function expandedStateOption(value: string, optionTexts: string[]): string | undefined {
  for (const token of value.toUpperCase().split(/[^A-Z]+/)) {
    const full = STATE_NAMES[token];
    if (full) {
      const hit = optionTexts.find((o) => o.toLowerCase().includes(full.toLowerCase()));
      if (hit) return hit;
    }
  }
  // Also try full state names already present in the value
  const low = value.toLowerCase();
  for (const full of Object.values(STATE_NAMES)) {
    if (low.includes(full.toLowerCase())) {
      const hit = optionTexts.find((o) => o.toLowerCase().includes(full.toLowerCase()));
      if (hit) return hit;
    }
  }
  return undefined;
}

async function labelFor(scope: FormScope, el: ReturnType<FormScope['locator']>): Promise<string | null> {
  // aria-label → <label for=id> → closest label wrapper → aria-labelledby
  const aria = await el.getAttribute('aria-label');
  if (aria) return aria.trim();
  const id = await el.getAttribute('id');
  if (id) {
    const lbl = scope.locator(`label[for="${id}"]`).first();
    if (await lbl.count()) {
      const t = (await lbl.textContent()) || '';
      if (t.trim()) return t.trim();
    }
  }
  const wrapped = await el.evaluate((node: Element) => {
    const l = node.closest('label');
    if (l) return l.textContent || '';
    // common ATS pattern: label sibling above the input's container
    const container = node.closest('div, li, fieldset');
    const prev = container?.querySelector('label, legend, .label, [class*="label"]');
    return prev?.textContent || '';
  }).catch(() => '');
  return wrapped ? wrapped.trim().slice(0, 200) : null;
}

// ─── Registry ──────────────────────────────────────────────────────────────────

import { greenhouseAdapter } from './greenhouse';
import { leverAdapter } from './lever';
import { ashbyAdapter } from './ashby';
import { workdayAdapter } from './workday';
import { genericAdapter } from './generic';

const ADAPTERS: AtsAdapter[] = [greenhouseAdapter, leverAdapter, ashbyAdapter, workdayAdapter];

export function getAdapterFor(atsType: string, url: string): AtsAdapter | null {
  const exact = ADAPTERS.find((a) => a.matches(atsType, url));
  if (exact) return exact;
  if (url) return genericAdapter; // best-effort fallback for any form
  return null;
}
