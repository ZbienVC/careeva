/**
 * Workday adapter — BEST EFFORT, honestly labeled.
 *
 * Workday is the hardest mainstream ATS to automate: most tenants force
 * account creation/login, the flow is multi-page, and field structure varies
 * per company. Per the platform's safety rules the worker NEVER creates
 * accounts or enters credentials. Strategy:
 *   - If an "Apply with no account / autofill with resume" path exists, take it
 *     and fill what's visible page by page.
 *   - The moment a login/account wall appears, stop and hand off to review with
 *     a screenshot, so the user finishes in the companion view.
 * Expect a meaningful share of Workday tasks to end in needs_review — that is
 * by design, not failure.
 */
import type { Page } from 'playwright';
import { AtsAdapter, TaskLike, FillContext, FillResult, SubmitResult, fillVisibleForm, FieldReport } from './index';

const LOGIN_WALL = 'input[type="password"], text=/sign in|create account|log in/i';

export const workdayAdapter: AtsAdapter = {
  name: 'workday',
  matches: (ats, url) => ats === 'workday' || /myworkdayjobs|workday\.com/.test(url),

  async fill(page: Page, task: TaskLike, ctx: FillContext): Promise<FillResult> {
    await page.goto(task.applyUrl!, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const apply = page.locator('a:has-text("Apply"), button:has-text("Apply")').first();
    if (await apply.count()) { await apply.click().catch(() => {}); await page.waitForTimeout(2000); }

    // Prefer the guest/quick path when offered
    const quick = page.locator('button:has-text("Apply Manually"), button:has-text("Autofill with Resume"), a:has-text("Apply Manually")').first();
    if (await quick.count()) { await quick.click().catch(() => {}); await page.waitForTimeout(2000); }

    if (await page.locator(LOGIN_WALL).first().isVisible().catch(() => false)) {
      const report: FieldReport = { filled: [], skippedOptional: [], unanswered: ['Workday requires an account/login for this company'], guessed: [], resumeAttached: false, coverLetterAttached: false };
      return { ok: false, error: 'Workday login wall — credentials are never automated. Finish via companion view.', report };
    }

    // Multi-page flow: fill, click Next/Continue, repeat (max 6 pages)
    let last: FillResult | null = null;
    for (let pageNum = 0; pageNum < 6; pageNum++) {
      last = await fillVisibleForm(page, task, ctx);
      const next = page.locator('button:has-text("Next"), button:has-text("Continue"), button:has-text("Save and Continue")').first();
      const submitVisible = await page.locator('button:has-text("Submit")').first().isVisible().catch(() => false);
      if (submitVisible) break;
      if (!(await next.count())) break;
      if (!last.ok && last.report.unanswered.length > 0) break; // don't advance past unanswered required fields
      await next.click().catch(() => {});
      await page.waitForTimeout(2500);
      if (await page.locator(LOGIN_WALL).first().isVisible().catch(() => false)) {
        last.ok = false;
        last.error = 'Workday login wall mid-flow — finish via companion view.';
        break;
      }
    }
    return last || { ok: false, error: 'Workday flow not recognized', report: { filled: [], skippedOptional: [], unanswered: [], guessed: [], resumeAttached: false, coverLetterAttached: false } };
  },

  async submit(page: Page, task: TaskLike): Promise<SubmitResult> {
    const btn = page.locator('button:has-text("Submit")').first();
    if (!(await btn.count())) return { ok: false, error: 'Submit not reachable (likely account-gated)' };
    await btn.click();
    const confirmed = await page.waitForSelector('text=/submitted|thank|congratulations/i', { timeout: 25000 }).then(() => true).catch(() => false);
    return confirmed ? { ok: true } : { ok: false, error: 'No Workday confirmation — verify manually' };
  },
};
