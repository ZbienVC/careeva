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
  /** Diagnostics: which worker build ran, where the form was, what it saw. */
  diag?: {
    workerBuild: string;
    browser?: string;
    scope: 'main' | 'iframe';
    textInputs: number;
    selects: number;
    comboboxes: number;
    fileInputs: number;
  };
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
  identity: { firstName: string; lastName: string; fullName: string; email: string; phone?: string; linkedinUrl?: string; githubUrl?: string; portfolioUrl?: string; location?: string; country?: string };
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

type Matcher = { test: RegExp; notTest?: RegExp; value: (p: Packet) => string | undefined; key: string };

/** A matcher matches a label only if `test` hits AND `notTest` (the
 * false-positive guard) misses. */
export function matchesLabel(m: { test: RegExp; notTest?: RegExp }, label: string): boolean {
  return m.test.test(label) && !(m.notTest && m.notTest.test(label));
}

export function findMatcher(matchers: Matcher[], label: string): Matcher | undefined {
  return matchers.find((m) => matchesLabel(m, label));
}

// ─── Canonical question normalization ──────────────────────────────────────────
// Forms phrase the SAME question many ways ("Are you authorized to work in the
// US?" vs "...legally authorized..." vs "...in the country for which you
// applied?"). The matcher maps a label → canonical key, but the user's saved
// answers are stored under exact-question slugs. We bridge the two by
// normalizing BOTH the form label AND each stored answer key into the same
// canonical space. The notTest guards encode false positives found by an
// adversarial review (other countries, sponsorship reframes, schedule
// availability, tax residency, "state your reason", etc.) — a WRONG autofill is
// worse than a blank field.

type CanonRE = { test: RegExp; not?: RegExp };

// Canada work-eligibility — tested BEFORE the US one so a Canada label never
// grabs the US "Yes".
const RE_WORK_AUTH_CA: CanonRE = {
  test: /(?:authoriz|eligible|entitled|legally\s+(?:able|permitted|allowed)|right\s+to\s+work|permitted\s+to\s+work)[^?]*\bwork\b[^?]*\bcanada\b|canadian\s+work\s+(?:authoriz|eligib|permit)/i,
  not: /sponsor|immigration|other\s+than|overtime|weekend|\bnight\b|\bshift\b|remotely|from\s+home|\btravel\b/i,
};
// Sponsorship — tested BEFORE work authorization (a sponsorship-reframed label
// mentions "work" too, but its answer is the OPPOSITE polarity).
const RE_REQUIRES_SPONSORSHIP: CanonRE = {
  test: /(?:require|need|request)\w*[^?]*\bsponsor|sponsor\w*[^?]*(?:require|need)|(?:visa|immigration|employment|work\s+permit|h-?1-?b)\s+sponsor|sponsor(?:ship)?\s+(?:to\s+work|for\s+employment|is\s+required|required)|now\s+or\s+in\s+the\s+future[^?]*(?:sponsor|immigration)/i,
  not: /\brefer|athlete|charit|donat|payroll\s+giving|conference/i,
};
// US work authorization (incl. the generic "country for which you applied").
const RE_WORK_AUTH_US: CanonRE = {
  test: /(?:authoriz|eligible|entitled|legally\s+(?:able|permitted|allowed)|right\s+to\s+work|permitted\s+to\s+work)[^?]*\bwork\b[^?]*(?:united\s+states|u\.?\s?s\.?(?:a)?\b|the\s+country|country\s+(?:for|in)\s+which)|\bwork\b[^?]*\bauthoriz\w*[^?]*(?:united\s+states|u\.?\s?s\.?\b)|^\s*work\s+authori[sz]ation\b/i,
  not: /sponsor|visa|immigration|canad|kingdom|\buk\b|britain|england|australia|\beu\b|europe|german|france|french|ireland|irish|india|singapore|china|japan|mexico|brazil|netherlands|spain|italy|overtime|weekend|\bnight\b|\bshift\b|flexible\s+hours|remotely|from\s+home|remote\s+work|classified|clearance|itar|equipment|machinery|\brequire[sd]?\b[^?]*\bauthoriz/i,
};
const RE_COUNTRY: CanonRE = {
  test: /^\s*country\b|country\s*\*?\s*$|country\s+of\s+(?:residence|citizenship)|(?:which|what)\s+country\s+do\s+you/i,
  not: /\bcode\b|\bdial\b|phone/i,
};
// Which state/province do you reside in? + "From where do you intend to work?"
const RE_LOCATION_STATE: CanonRE = {
  test: /state\s*(?:\/|\s+or\s+)\s*(?:canadian\s+|u\.?s\.?\s+)?province|province\s*(?:\/|\s+or\s+)\s*state|(?:which|what)\s+(?:u\.?s\.?\s+)?state\b[^?]*\b(?:reside|residen|live|living|located|based)|(?:reside|residen|living|located|currently\s+based)\b[^?]*\b(?:state|province)\b|from\s+where\s+do\s+you[^?]*\bwork/i,
  not: /for\s+tax|tax\s+purpose|universit|college|school|(?:role|position|job)\s+is\s+based|state\s+your|state\s+of\s+mind|were\s+you\s+born/i,
};
const RE_HOW_HEARD: CanonRE = {
  test: /how\s+(?:did|do|were|have)\s+you\s+(?:first\s+)?(?:hear|heard|learn|find\s+out|found\s+out|discover|come\s+to\s+(?:hear|know)|become\s+aware)\s+(?:of|about)|how\s+were\s+you\s+(?:referred|made\s+aware)|referral\s+source|source\s+of\s+(?:referral|your\s+application)|where\s+did\s+you\s+(?:hear|find\s+out)\s+about/i,
  not: /hear\s+back|our\s+products|competitor|the\s+issue|your\s+(?:strength|weakness|passion)|last\s+role/i,
};
// Generic location (city/address) — NOT state/province (that is its own key).
const RE_LOCATION: CanonRE = {
  test: /location|\bcity\b|current\s+address|where.*\bbased\b/i,
  not: /ethnic|relocat/i,
};

// Order matters — first match wins. More-specific before more-general.
const CANONICAL_ORDER: Array<[string, CanonRE]> = [
  ['work_authorization_ca', RE_WORK_AUTH_CA],
  ['requires_sponsorship', RE_REQUIRES_SPONSORSHIP],
  ['work_authorization_us', RE_WORK_AUTH_US],
  ['how_heard', RE_HOW_HEARD],
  ['location_state', RE_LOCATION_STATE],
  ['location', RE_LOCATION],
  ['country', RE_COUNTRY],
];

function deslug(key: string): string {
  return key.replace(/[_-]+/g, ' ').trim();
}

/** Normalize the user's stored answer KEYS (e.g. the slug
 * "are_you_authorized_to_work_in_the_united_states_") into canonical keys, so a
 * differently-phrased form reuses the saved answer. */
export function canonicalAnswersFrom(p: Packet): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(p.answers)) {
    if (!v || k.startsWith('__')) continue;
    const label = deslug(k);
    for (const [canon, re] of CANONICAL_ORDER) {
      if (matchesLabel({ test: re.test, notTest: re.not }, label)) {
        if (!out[canon]) out[canon] = v;
        break;
      }
    }
  }
  return out;
}

/** Best-effort employer name from the apply URL (greenhouse/lever/ashby slug),
 * so company-specific questions ("worked for Figma before") match precisely. */
export function companyFromUrl(url: string | null | undefined): string {
  if (!url) return '';
  const m =
    /(?:job-boards\.|boards\.)?greenhouse\.io\/(?:embed\/job_app\?for=)?([a-z0-9][a-z0-9-]*)/i.exec(url) ||
    /jobs\.lever\.co\/([a-z0-9][a-z0-9-]*)/i.exec(url) ||
    /jobs\.ashbyhq\.com\/([a-z0-9][a-z0-9-]*)/i.exec(url);
  return m ? m[1].replace(/-/g, ' ') : '';
}

export function buildMatchers(p: Packet, opts: { company?: string } = {}): Matcher[] {
  const a = p.answers;
  const id = p.identity;
  const canon = canonicalAnswersFrom(p);
  const company = (opts.company || '').trim();

  // "Have you worked/been employed at <this company> before?" — narrow on
  // purpose: requires an employment verb, a prior-time word, AND a reference to
  // THIS employer (here / us / our company / the company slug). Without the
  // employer anchor a generic regex wrongly fires on "worked with children
  // before", "worked for the government before", etc. Safe default "No" (the
  // user has not previously worked at these companies).
  const companyRef =
    `(?:\\bhere\\b|\\b(?:with|for|by|at)\\s+us\\b|\\bour\\s+(?:company|organi[sz]ation|team|firm)\\b|\\bthis\\s+(?:company|organi[sz]ation|firm)\\b` +
    (company ? `|\\b${escapeRegex(company)}\\b` : '') +
    `)`;
  const verb = `(?:work\\w*|employ\\w*|contract\\w*|consult\\w*|intern\\w*)`;
  const workedHereTest = new RegExp(
    `(?=.*\\b(?:before|previous(?:ly)?|prior|ever|in\\s+the\\s+past|former(?:ly)?|for\\s+any\\s+length)\\b)` +
      `(?:${verb}[^?]*${companyRef}|${companyRef}[^?]*${verb})`,
    'i'
  );
  const workedHereNot =
    /current(?:ly)?\s+(?:work|employ)|children|sensitive|recruiter|family|government|competitor|\bunion\b|insurance|salary|reference|staffing|non-?compete|terminated|disciplined|\bpublic\b/i;

  return [
    // Preferred name BEFORE first/last name (it contains "first name").
    {
      key: 'preferred_name',
      test: /preferred\s+(?:first\s+)?name|name\s+you\s+go\s+by|what\s+name\s+do\s+you\s+(?:go\s+by|prefer)|\bnick\s*name\b|what\s+(?:do|should)\s+(?:we|i)\s+call\s+you/i,
      notTest: /legal\s+name|last\s+name|full\s+name|family\s+name|offer\s+letter|\bbadge\b|call(?:ed)?\s+(?:back|for)|phone\s+screen|first\s+or\s+last/i,
      value: () => id.firstName,
    },
    { key: 'first_name', test: /first\s*name/i, notTest: /preferred/i, value: () => id.firstName },
    { key: 'last_name', test: /last\s*name|surname|family\s*name/i, value: () => id.lastName },
    { key: 'full_name', test: /^(full\s*)?name$|your\s*name/i, value: () => id.fullName },
    { key: 'email', test: /e-?mail/i, value: () => id.email },
    { key: 'phone', test: /phone|mobile|cell/i, value: () => id.phone || a['phone'] },
    // Worked-here-before BEFORE the work-authorization family (both mention "work").
    { key: 'worked_here_before', test: workedHereTest, notTest: workedHereNot, value: () => a['worked_here_before'] || canon['worked_here_before'] || 'No' },
    { key: 'work_authorization_ca', test: RE_WORK_AUTH_CA.test, notTest: RE_WORK_AUTH_CA.not, value: () => a['work_authorization_ca'] || canon['work_authorization_ca'] },
    { key: 'requires_sponsorship', test: RE_REQUIRES_SPONSORSHIP.test, notTest: RE_REQUIRES_SPONSORSHIP.not, value: () => a['requires_sponsorship'] || canon['requires_sponsorship'] },
    { key: 'work_authorization_us', test: RE_WORK_AUTH_US.test, notTest: RE_WORK_AUTH_US.not, value: () => a['work_authorization_us'] || canon['work_authorization_us'] },
    { key: 'country', test: RE_COUNTRY.test, notTest: RE_COUNTRY.not, value: () => id.country || a['country'] || canon['country'] },
    { key: 'location_state', test: RE_LOCATION_STATE.test, notTest: RE_LOCATION_STATE.not, value: () => id.location || a['address'] },
    { key: 'location', test: RE_LOCATION.test, notTest: RE_LOCATION.not, value: () => id.location || a['address'] },
    { key: 'linkedin_url', test: /linked\s*in/i, value: () => id.linkedinUrl || a['linkedin_url'] },
    { key: 'github_url', test: /github/i, value: () => id.githubUrl || a['github_url'] },
    { key: 'portfolio_url', test: /portfolio|personal\s+(web)?site|website/i, value: () => id.portfolioUrl || a['portfolio_url'] },
    { key: 'current_company', test: /(?:current|present|most\s+recent)\b[^?]{0,25}\b(?:company|employer|organization)|name\s+of\s+your\s+(?:company|employer)|present\s+employer|company\s+you\s+(?:currently\s+)?work/i, notTest: /why|reason|leav|cover|salary|how\s+long|years?\s+at/i, value: () => a['current_company'] },
    { key: 'salary_expectation', test: /salary|compensation|pay\s+expectation/i, value: () => a['salary_expectation'] },
    { key: 'start_date', test: /start\s*date|when\s+can\s+you\s+start|notice\s+period|available/i, value: () => a['start_date'] },
    { key: 'willing_to_relocate', test: /relocat/i, value: () => a['willing_to_relocate'] },
    { key: 'remote_preference', test: /remote|work\s+arrangement|hybrid/i, value: () => a['remote_preference'] },
    { key: 'years_experience', test: /years\s+of\s+(relevant\s+)?experience|how\s+many\s+years/i, value: () => a['years_experience'] },
    { key: 'why_company', test: /why\s+(do\s+you\s+want|are\s+you\s+interested|us|join)/i, value: () => a['why_this_company'] },
    { key: 'why_role', test: /why\s+this\s+(role|position)|interest(?:ed)?\s+in\s+this\s+(role|position)/i, value: () => a['why_this_role'] },
    { key: 'cover_letter', test: /cover\s*letter|additional\s+information|anything\s+else/i, value: () => p.coverLetter },
    { key: 'how_heard', test: RE_HOW_HEARD.test, notTest: RE_HOW_HEARD.not, value: () => a['how_heard'] || canon['how_heard'] || 'Company careers page' },
    { key: 'pronouns', test: /pronoun/i, value: () => a['pronouns'] },
  ];
}

const EEO_PATTERN = /gender|race|ethnic|veteran|disabilit|sexual\s+orientation|transgender|lgbtq|2slgbtqia|person\s+of\s+colou?r|indigenous|pronoun/i;

/** Unselected-dropdown placeholder texts ("Select...", "Please choose", "--"). */
export const PLACEHOLDER_RE = /^(please\s+)?(select|choose)\b|^--|^—|^\s*$/i;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Choose which option text best matches the wanted answer. Tier order matters:
 * exact equality, then whole-word yes/no, then prefix, then substring —
 * substring LAST and never for yes/no, because "No" is a substring of
 * "Non-binary", "Norway", and "Notice period" (real cross-fill bugs).
 * EEO questions fall back to a decline-to-answer option: neutral, and an
 * empty required dropdown blocks submission.
 */
const NEGATION_RE = /\b(not|never|no\s+longer|haven'?t|have\s+not|did\s+not|don'?t|none|neither)\b/i;

export function pickOption(
  wanted: string | undefined,
  optionTexts: string[],
  opts: { eeoDecline?: boolean; aliases?: string[]; consent?: boolean; yesNoProse?: boolean } = {}
): string | undefined {
  const options = optionTexts.filter((o) => o.trim() && !PLACEHOLDER_RE.test(o.trim()));
  const norm = (s: string) => s.trim().toLowerCase();
  const literal = (w: string): string | undefined => {
    const exact = options.find((o) => norm(o) === w);
    if (exact) return exact;
    const yesNo = /^(yes|no)$/.exec(w)?.[1];
    if (yesNo) {
      const hit = options.find((o) => new RegExp(`^${yesNo}\\b`, 'i').test(o.trim()));
      if (hit) return hit;
      // Prose options instead of literal Yes/No ("I have not previously been
      // employed at Affirm" = No). ONLY when the caller marks this a yes/no
      // question (yesNoProse) — otherwise "I don't wish to answer" on a gender
      // dropdown would be read as "No". Map No → the single negated option;
      // Yes → the single non-negated option (ambiguous when several → blank).
      if (opts.yesNoProse) {
        if (yesNo === 'no') {
          const neg = options.filter((o) => NEGATION_RE.test(o));
          if (neg.length === 1) return neg[0];
        } else {
          const pos = options.filter((o) => !NEGATION_RE.test(o));
          if (pos.length === 1) return pos[0];
        }
      }
      return undefined;
    }
    const prefix = w.length >= 3 ? options.find((o) => norm(o).startsWith(w)) : undefined;
    if (prefix) return prefix;
    const substr = w.length >= 4 ? options.find((o) => norm(o).includes(w)) : undefined;
    if (substr) return substr;
    // Verbose stored answer, terse option: "Yes — authorized to work" → "Yes".
    const reverse = options
      .filter((o) => norm(o).length >= 3 && w.startsWith(norm(o)))
      .sort((a, b) => norm(b).length - norm(a).length)[0];
    if (reverse) return reverse;
    const word = /^(yes|no)\b/.exec(w)?.[1];
    if (word) {
      const hit = options.find((o) => new RegExp(`^${word}\\b`, 'i').test(o.trim()));
      if (hit) return hit;
    }
    return undefined;
  };

  if (wanted && wanted.trim()) {
    const hit = literal(norm(wanted));
    if (hit) return hit;
    const state = expandedStateOption(wanted, options);
    if (state) return state;
  }
  // Aliases: the stored answer phrases it one way, the dropdown another
  // ("Company careers page" vs the option "Affirm's Career Site").
  for (const alias of opts.aliases || []) {
    const hit = literal(norm(alias)) || options.find((o) => norm(o).includes(norm(alias)));
    if (hit) return hit;
  }
  // Consent dropdowns ("By selecting 'I agree'…") usually offer one agreement
  // option — pick the affirmative.
  if (opts.consent) {
    const agree = options.find((o) => /\b(i\s+)?(agree|accept|consent)\b|\byes\b|i\s+understand/i.test(o));
    if (agree) return agree;
  }
  if (opts.eeoDecline) {
    // "I do not want to answer" is the CC-305 disability form's phrasing.
    return options.find((o) => /decline|prefer not|don.t wish|do not wish|do not want|don.t want|rather not say/i.test(o));
  }
  return undefined;
}

/** Channel-name aliases so "Company careers page" maps to whatever the
 * "how did you hear" dropdown actually calls its careers-site option. */
export const HOW_HEARD_ALIASES = ['career site', 'careers page', 'company website', 'company site', 'careers', 'company career', 'other'];

/** Matcher keys whose answer is a genuine Yes/No — they may map onto prose
 * options ("I have not previously been employed…" = No). EEO keys are NOT
 * here, so a decline option is never read as "No". */
export const YES_NO_KEYS = new Set(['work_authorization_us', 'work_authorization_ca', 'requires_sponsorship', 'worked_here_before']);

/** Consent/agreement gate copy ("I agree to the privacy policy / terms"). These
 * are proceed-to-apply acknowledgements, not marketing opt-ins. */
export const CONSENT_RE = /\bi\s+(agree|acknowledge|consent|understand|have\s+read|accept)\b|agree\s+to\s+the|privacy\s+(policy|notice)|terms\s+(and|&|of)|processed\s+in\s+accordance|candidate\s+privacy/i;
export const CONSENT_NOT = /marketing|newsletter|promotional|subscribe|opt[\s-]?in\s+to|keep\s+me\s+(posted|informed)|future\s+(jobs|opportunities|roles)/i;

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
  const matchers = buildMatchers(packet, { company: companyFromUrl(task.applyUrl) });
  const report: FieldReport = {
    filled: [], skippedOptional: [], unanswered: [], guessed: [],
    resumeAttached: false, coverLetterAttached: false,
  };

  // Consent banners intercept pointer events and silently break every fill.
  await dismissOverlays(page);

  // The form may live in an embedded iframe — fill where the fields are.
  const root = await pickFormScope(page);
  // A narrow formSelector (e.g. "form, #application-form") keeps us off
  // header/newsletter inputs on the OLD boards.greenhouse.io. But the NEW
  // job-boards.greenhouse.io renders its fields OUTSIDE any <form>/#application
  // container, so that scope matches almost nothing — fill found 1 input where
  // the page has 19. Fall back to "body" whenever the narrow scope is sparse.
  let scope = root === page ? (opts.formSelector || 'body') : 'body';
  if (scope !== 'body') {
    const controlsIn = async (sel: string) =>
      root.locator(`${sel} input:not([type="hidden"]), ${sel} textarea, ${sel} select, ${sel} [role="combobox"]`).count().catch(() => 0);
    const scoped = await controlsIn(scope);
    if (scoped < 3) {
      const whole = await controlsIn('body');
      if (whole > scoped) scope = 'body';
    }
  }

  report.diag = {
    workerBuild: (process.env.RAILWAY_GIT_COMMIT_SHA || 'local').slice(0, 7),
    browser: process.env.CAREEVA_BROWSER_DESC,
    scope: root === page ? 'main' : 'iframe',
    textInputs: 0,
    selects: 0,
    comboboxes: 0,
    fileInputs: 0,
  };

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
  report.diag.fileInputs = await root.locator(`${scope} input[type="file"]`).count().catch(() => 0);
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

  // Remember full values so the end-state audit can re-fill and re-verify.
  const fullValues = new Map<string, string>();

  // 2) Text inputs + textareas
  const textInputs = root.locator(
    `${scope} input[type="text"], ${scope} input[type="email"], ${scope} input[type="tel"], ${scope} input[type="url"], ${scope} input:not([type]), ${scope} textarea`
  );
  const count = await textInputs.count();
  report.diag.textInputs = count;
  for (let i = 0; i < count; i++) {
    const el = textInputs.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    // Combobox filter inputs masquerade as text inputs. Typing raw text into
    // one shows a value but selects NOTHING — the dropdown pass owns them.
    const isComboInput = await el.evaluate((node: Element) =>
      node.getAttribute('role') === 'combobox' ||
      node.hasAttribute('aria-haspopup') ||
      node.hasAttribute('aria-autocomplete') ||
      !!node.closest('[role="combobox"]')
    ).catch(() => false);
    if (isComboInput) continue;
    const existing = await el.inputValue().catch(() => '');
    if (existing) continue; // never clobber prefilled values
    const label = (await labelFor(root, el)) || (await el.getAttribute('placeholder')) || (await el.getAttribute('name')) || '';
    if (!label) continue;
    // name attrs come underscored ("first_name") — normalize so patterns match
    const labelNorm = label.replace(/[_-]+/g, ' ');
    const required = (await el.getAttribute('required')) !== null || (await el.getAttribute('aria-required')) === 'true' || /\*/.test(label);

    if (EEO_PATTERN.test(labelNorm)) {
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

    const m = findMatcher(matchers, labelNorm);
    // Canonical matcher first, then the user's taught answer bank (answers the
    // user provided for this exact question on a previous application).
    const value = m?.value(packet) ?? packet.answers[slug(labelNorm)];
    const via = m?.value(packet) ? m!.key : 'answer_bank';
    if (value) {
      if (await verifiedFill(el, value)) {
        report.filled.push({ label, value: value.slice(0, 60), via });
        fullValues.set(label, value);
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
          fullValues.set(label, guess);
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
  report.diag.selects = sCount;
  for (let i = 0; i < sCount; i++) {
    const el = selects.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const label = (await labelFor(root, el)) || (await el.getAttribute('name')) || '';
    const labelNorm = label.replace(/[_-]+/g, ' ');
    const m = findMatcher(matchers, labelNorm);
    const value = m?.value(packet) ?? packet.answers[slug(labelNorm)];
    const optionTexts: string[] = await el.locator('option').allTextContents();
    const verifiedSelect = async (optionLabel: string): Promise<boolean> => {
      await el.selectOption({ label: optionLabel }, { timeout: 5000 }).catch(() => {});
      const after = await el.inputValue().catch(() => '');
      return !!after;
    };
    const isConsent = CONSENT_RE.test(labelNorm) && !CONSENT_NOT.test(labelNorm);
    if (EEO_PATTERN.test(labelNorm) && !value) {
      const decline = pickOption(undefined, optionTexts, { eeoDecline: true });
      if (decline && (await verifiedSelect(decline))) {
        report.filled.push({ label, value: decline, via: 'eeo_decline' });
      }
      continue;
    }
    if (value || isConsent) {
      // Exact-first tiered matching; "Which state/province do you live in?"
      // also expands abbreviations from the user's location ("Hawthorne, NJ"
      // -> "New Jersey"). Aliases bridge channel-name wording; consent picks
      // the "I agree" option.
      const target = pickOption(value, optionTexts, {
        eeoDecline: EEO_PATTERN.test(labelNorm),
        aliases: m?.key === 'how_heard' ? HOW_HEARD_ALIASES : undefined,
        consent: isConsent,
        yesNoProse: YES_NO_KEYS.has(m?.key || ''),
      });
      if (target && (await verifiedSelect(target))) {
        report.filled.push({ label, value: target, via: isConsent && !value ? 'consent' : m?.key || 'answer_bank' });
      } else if (value) {
        report.unanswered.push(label + ` (no option matched "${value.slice(0, 30)}")`);
      }
    }
  }

  // 4) ARIA comboboxes — the NEW Greenhouse (job-boards.greenhouse.io) and
  //    other React forms render dropdowns as role=combobox widgets with
  //    listbox popups, not native <select> elements.
  const combos = root.locator(`${scope} [role="combobox"], ${scope} input[aria-haspopup="listbox"], ${scope} button[aria-haspopup="listbox"]`);
  const cbCount = await combos.count();
  report.diag.comboboxes = cbCount;
  // One widget often matches twice (outer role=combobox + inner haspopup
  // input) — process each labeled question once.
  const seenComboLabels = new Set<string>();
  // Remember combobox picks so the end-state audit can re-verify them.
  const comboFills = new Map<string, string>();

  // What the widget currently displays. React-select-style widgets keep the
  // chosen option in a sibling node (the input stays empty), so fall back to
  // the field container's text minus the label.
  const comboDisplay = async (el: ReturnType<FormScope['locator']>, label: string): Promise<string> => {
    const own = ((await el.inputValue().catch(() => '')) || (await el.textContent().catch(() => '')) || '').trim();
    if (own) return own;
    const text = await el.evaluate((node: Element) => {
      let c: Element | null = node.parentElement;
      for (let d = 0; d < 4 && c; d++) {
        const t = (c.textContent || '').trim();
        if (t && t.length < 400) {
          const controls = c.querySelectorAll('input:not([type="hidden"]), select, textarea, [role="combobox"], button[aria-haspopup]');
          if (controls.length <= 2) return t; // this field's container, not a section
        }
        c = c.parentElement;
      }
      return '';
    }).catch(() => '');
    return text.replace(label, '').trim();
  };

  // Whole-word check so "No" doesn't count as shown inside "now"/"Non-binary".
  const displayShows = (display: string, target: string): boolean => {
    if (!display) return false;
    const re = new RegExp('(^|\\W)' + escapeRegex(target.trim()).replace(/\s+/g, '\\s+') + '($|\\W)', 'i');
    return re.test(display);
  };

  /**
   * Open a combobox, pick the option matching `wanted` (or an EEO decline),
   * and VERIFY the widget displays it afterwards — a fill the read-back can't
   * corroborate is reported as a failure, never as filled.
   */
  const selectComboOption = async (
    el: ReturnType<FormScope['locator']>,
    label: string,
    wanted: string | undefined,
    isEeo: boolean,
    extra: { aliases?: string[]; consent?: boolean; yesNoProse?: boolean } = {}
  ): Promise<{ ok: boolean; picked?: string; reason?: string }> => {
    try {
      // Transient misses happen on React widgets — one retry before giving up.
      try {
        await el.click({ timeout: 4000 });
      } catch {
        await page.waitForTimeout(1000);
        await el.click({ timeout: 4000 });
      }
      await page.waitForTimeout(500);
      // Options often render in a portal at the document root — search
      // broadly but VISIBLE-ONLY: hidden listboxes stay in the DOM (the phone
      // widget keeps its 240-country menu there permanently), and matching a
      // hidden "Norfolk Island" against answer "No" then timing out on its
      // click was the original "dropdown interaction failed".
      let options = root.locator('[role="option"]:visible');
      let texts = await options.allTextContents();
      // Typing-style combobox: options only appear once you type.
      let typedOpen = false;
      if (!texts.some((t) => t.trim()) && wanted) {
        await el.pressSequentially(wanted.slice(0, 60), { timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(600);
        options = root.locator('[role="option"]:visible');
        texts = await options.allTextContents();
        typedOpen = true;
      }
      if (!texts.some((t) => t.trim())) {
        await page.keyboard.press('Escape').catch(() => {});
        return { ok: false, reason: 'dropdown did not open' };
      }
      let target = pickOption(wanted, texts, { eeoDecline: isEeo, aliases: extra.aliases, consent: extra.consent, yesNoProse: extra.yesNoProse });
      // Autocomplete widgets reformat what you type ("Hawthorne, NJ" →
      // "Hawthorne, NJ, United States"): accept a filtered suggestion that
      // shares a real word with the answer, but never a blind first option.
      if (!target && typedOpen && wanted) {
        const words = wanted.toLowerCase().split(/\W+/).filter((t) => t.length >= 4);
        target = texts.find((o) => words.some((t) => o.toLowerCase().includes(t)));
      }
      if (!target) {
        await page.keyboard.press('Escape').catch(() => {});
        return { ok: false, reason: `no option matched "${(wanted || '').slice(0, 30)}"` };
      }
      // Click the EXACT option text — substring filters can hit the wrong row.
      const exact = options.filter({ hasText: new RegExp('^\\s*' + escapeRegex(target.trim()) + '\\s*$', 'i') }).first();
      const candidate = (await exact.count().catch(() => 0)) ? exact : options.filter({ hasText: target.trim().slice(0, 40) }).first();
      await candidate.click({ timeout: 4000 });
      await page.waitForTimeout(300);
      const shown = await comboDisplay(el, label);
      const popupGone = (await root.locator('[role="option"]:visible').count().catch(() => 0)) === 0;
      if (displayShows(shown, target) || (popupGone && (!shown || !PLACEHOLDER_RE.test(shown)))) {
        return { ok: true, picked: target.trim() };
      }
      await page.keyboard.press('Escape').catch(() => {});
      return { ok: false, reason: 'selection did not register' };
    } catch {
      await page.keyboard.press('Escape').catch(() => {});
      return { ok: false, reason: 'dropdown interaction failed' };
    }
  };

  for (let i = 0; i < cbCount; i++) {
    const el = combos.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const current = ((await el.inputValue().catch(() => '')) || (await el.textContent().catch(() => '')) || '').trim();
    if (current && !PLACEHOLDER_RE.test(current)) continue; // already has a real value
    const label = (await labelFor(root, el)) || (await el.getAttribute('aria-label')) || '';
    if (!label) continue;
    if (seenComboLabels.has(label)) continue;
    const labelNorm = label.replace(/[_-]+/g, ' ');
    const required = (await el.getAttribute('aria-required')) === 'true' || /\*/.test(label);
    const isEeo = EEO_PATTERN.test(labelNorm);

    // EEO answers come ONLY from explicit stored answers — a generic matcher
    // must never leak an unrelated value in ("ethniCITY" once matched the
    // location matcher and offered the user's city to a race question).
    const m = isEeo ? undefined : findMatcher(matchers, labelNorm);
    const eeoStored = !isEeo ? undefined
      : packet.answers['gender'] && /gender/i.test(labelNorm) ? packet.answers['gender']
      : packet.answers['ethnicity'] && /race|ethnic/i.test(labelNorm) ? packet.answers['ethnicity']
      : packet.answers['veteran_status'] && /veteran/i.test(labelNorm) ? packet.answers['veteran_status']
      : packet.answers['disability_status'] && /disabilit/i.test(labelNorm) ? packet.answers['disability_status']
      : undefined;
    const value = isEeo
      ? eeoStored ?? packet.answers[slug(labelNorm)]
      : m?.value(packet) ?? packet.answers[slug(labelNorm)];
    // Consent dropdowns ("By selecting 'I agree'…") carry no stored answer but
    // are a required proceed-to-apply gate — pick the agreement option.
    const isConsent = !isEeo && CONSENT_RE.test(labelNorm) && !CONSENT_NOT.test(labelNorm);
    if (!value && !isEeo && !isConsent) {
      seenComboLabels.add(label);
      if (required) report.unanswered.push(label);
      else report.skippedOptional.push(label);
      continue;
    }

    const extra = { aliases: m?.key === 'how_heard' ? HOW_HEARD_ALIASES : undefined, consent: isConsent, yesNoProse: YES_NO_KEYS.has(m?.key || '') };
    let result = await selectComboOption(el, label, value, isEeo, extra);
    if (!result.ok && !result.reason?.startsWith('no option matched')) {
      // Interaction-level failures are often transient — one full re-attempt.
      result = await selectComboOption(el, label, value, isEeo, extra);
    }
    if (result.ok && result.picked) {
      seenComboLabels.add(label);
      report.filled.push({
        label,
        value: result.picked.slice(0, 60),
        via: m?.key || (value ? 'answer_bank' : isConsent ? 'consent' : 'eeo_decline'),
      });
      comboFills.set(label, result.picked);
      continue;
    }
    // Leave the label unclaimed: cross-wired widgets can share one label (the
    // phone country selector once stole "Which state or province…"), and the
    // real dropdown deserves its attempt. Failures dedupe in the final report.
    // Honest failure reporting. An EEO question the user HAS an answer for
    // must surface in unanswered — silently leaving it empty blocks
    // submission with no trace in the report.
    const reason = result.reason || 'dropdown interaction failed';
    if (required && (value || !isEeo)) report.unanswered.push(`${label} (${reason})`);
    else report.skippedOptional.push(`${label} (${isEeo && !value ? 'EEO — ' : ''}${reason})`);
  }

  // 5) End-state audit — React forms can clear values after we move on (state
  //    resets, re-renders). The report must describe the FINAL form, not our
  //    attempts: re-read every field we filled, re-fill once if the value
  //    vanished, and demote anything still empty so it reaches the user's
  //    answer loop instead of being claimed as done.
  if (fullValues.size > 0 || comboFills.size > 0) {
    await page.waitForTimeout(800); // let any pending re-render settle
    const auditInputs = root.locator(
      `${scope} input[type="text"], ${scope} input[type="email"], ${scope} input[type="tel"], ${scope} input[type="url"], ${scope} input:not([type]), ${scope} textarea`
    );
    const auditCount = await auditInputs.count();
    for (let i = 0; i < auditCount; i++) {
      const el = auditInputs.nth(i);
      if (!(await el.isVisible().catch(() => false))) continue;
      const label = (await labelFor(root, el)) || (await el.getAttribute('placeholder')) || (await el.getAttribute('name')) || '';
      const intended = fullValues.get(label);
      if (!intended) continue;
      let current = await el.inputValue().catch(() => '');
      if (!current.trim()) {
        await verifiedFill(el, intended);
        current = await el.inputValue().catch(() => '');
      }
      if (!current.trim()) {
        const idx = report.filled.findIndex((f) => f.label === label);
        if (idx >= 0) report.filled.splice(idx, 1);
        report.unanswered.push(label + ' (value did not persist — the form cleared it)');
      }
    }

    // Comboboxes get the same treatment: re-read each claimed pick, retry the
    // selection once if it vanished, then demote honestly.
    const seenAudit = new Set<string>();
    for (let i = 0; i < (comboFills.size ? await combos.count().catch(() => 0) : 0); i++) {
      const el = combos.nth(i);
      if (!(await el.isVisible().catch(() => false))) continue;
      const label = (await labelFor(root, el)) || (await el.getAttribute('aria-label')) || '';
      if (!label || seenAudit.has(label)) continue;
      const expected = comboFills.get(label);
      if (!expected) continue;
      seenAudit.add(label);
      const shown = await comboDisplay(el, label);
      if (displayShows(shown, expected) || (shown && !PLACEHOLDER_RE.test(shown))) continue;
      const redo = await selectComboOption(el, label, expected, EEO_PATTERN.test(label.replace(/[_-]+/g, ' ')));
      if (redo.ok) continue;
      const idx = report.filled.findIndex((f) => f.label === label);
      if (idx >= 0) report.filled.splice(idx, 1);
      report.unanswered.push(label + ' (selection did not register)');
    }
  }

  // 6) Consent / agreement checkboxes. Many forms gate submission behind a
  //    required "I agree to the privacy policy / terms" box. These are
  //    proceed-to-apply acknowledgements (not opt-in marketing), so check the
  //    REQUIRED ones whose label reads as an agreement. Marketing/optional
  //    opt-ins are deliberately left alone.
  const consentBoxes = root.locator(`${scope} input[type="checkbox"]`);
  const cxCount = await consentBoxes.count().catch(() => 0);
  for (let i = 0; i < cxCount; i++) {
    const el = consentBoxes.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    if (await el.isChecked().catch(() => false)) continue;
    const label = (await labelFor(root, el)) || (await el.getAttribute('aria-label')) || '';
    const required = (await el.getAttribute('required')) !== null || (await el.getAttribute('aria-required')) === 'true' || /\*/.test(label);
    if (!required) continue;
    if (!CONSENT_RE.test(label) || CONSENT_NOT.test(label)) continue;
    await el.check({ timeout: 4000 }).catch(() => el.click({ timeout: 4000 }).catch(() => {}));
    if (await el.isChecked().catch(() => false)) {
      report.filled.push({ label: label.slice(0, 80) || 'Consent', value: 'checked', via: 'consent' });
    } else {
      report.unanswered.push((label.slice(0, 80) || 'Required consent checkbox') + ' (could not check)');
    }
  }

  // A label can fail on one widget and succeed on its twin (cross-wired
  // labels) — a question that ended up filled is not unanswered.
  const filledLabels = [...new Set(report.filled.map((f) => f.label))];
  const ultimatelyFilled = (entry: string) =>
    filledLabels.some((l) => entry === l || entry.startsWith(l + ' ('));
  report.unanswered = report.unanswered.filter((q) => !ultimatelyFilled(q));
  report.skippedOptional = report.skippedOptional.filter((q) => !ultimatelyFilled(q));

  // The same question can be recorded twice (duplicate widgets, audit) —
  // present each once.
  report.unanswered = [...new Set(report.unanswered)];
  report.skippedOptional = [...new Set(report.skippedOptional)];

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

/**
 * Why does this page have no fillable form? Inspect what the browser actually
 * landed on so the user's error message states facts, not guesses ("login
 * gated" used to be reported for everything, including bot-blocks).
 */
export async function describeUnfillablePage(page: Page): Promise<string> {
  const title = ((await page.title().catch(() => '')) || '').slice(0, 80);
  const url = page.url();
  const sample = ((await page.locator('body').innerText().catch(() => '')) || '').slice(0, 3000);
  if (/just a moment|attention required|verify you are human|cloudflare|are you a robot|unusual traffic|access denied/i.test(title + ' ' + sample)) {
    return `the page is a bot-protection challenge ("${title}") at ${url} — the apply engine's server IP is being blocked for this site; running the worker from a residential IP (or adding a browser proxy) fixes this`;
  }
  if (/sign in|log ?in|create (an )?account/i.test(sample) && /password/i.test(sample)) {
    return `the page is a login wall at ${url} — this ATS requires an account before it shows the application form`;
  }
  if (/greenhouse\.io/.test(url) && /job application for/i.test(title)) {
    // Verified live (2026-06-12): the same URL renders 23 inputs from a
    // residential IP and zero from a datacenter IP, on the same browser.
    return `the Greenhouse application page loaded ("${title}") but its form never rendered — Greenhouse's bot protection refuses this server's IP. Run the worker from a residential IP, or set PROXY_SERVER to a residential proxy`;
  }
  return `the browser landed on "${title}" at ${url}, which has no application form — likely a listing/landing page or a broken apply link`;
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
    // Walk up ancestors, but ONLY trust a container that holds exactly one
    // form control — otherwise we steal a NEIGHBORING field's label (which
    // put a first name into "Current Company" on Greenhouse's React forms).
    let container: Element | null = node.parentElement;
    for (let depth = 0; depth < 4 && container; depth++) {
      const controls = container.querySelectorAll('input:not([type="hidden"]), textarea, select, [role="combobox"]');
      if (controls.length === 1) {
        const lbl = container.querySelector('label, legend, .label, [class*="label"]');
        if (lbl?.textContent?.trim()) return lbl.textContent;
      }
      if (controls.length > 1) break; // multi-field section — stop, don't guess
      container = container.parentElement;
    }
    return '';
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
