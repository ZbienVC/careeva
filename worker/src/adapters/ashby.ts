/**
 * Ashby adapter. jobs.ashbyhq.com/<org>/<jobId>/application — React form,
 * fields render progressively; the shared toolkit handles label resolution.
 */
import type { Page } from 'playwright';
import { AtsAdapter, TaskLike, FillContext, FillResult, SubmitResult, fillVisibleForm } from './index';

export const ashbyAdapter: AtsAdapter = {
  name: 'ashby',
  matches: (ats, url) => ats === 'ashby' || /ashbyhq\.com/.test(url),

  async fill(page: Page, task: TaskLike, ctx: FillContext): Promise<FillResult> {
    let url = task.applyUrl!;
    if (!/application/.test(url)) url = url.replace(/\/?$/, '/application');
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForSelector('input, textarea', { timeout: 15000 }).catch(() => {});
    return fillVisibleForm(page, task, ctx);
  },

  async submit(page: Page, task: TaskLike): Promise<SubmitResult> {
    const btn = page.locator('button:has-text("Submit Application"), button:has-text("Submit")').last();
    if (!(await btn.count())) return { ok: false, error: 'Submit button not found' };
    await btn.click();
    const confirmed = await page
      .waitForSelector('text=/thank|submitted|received/i', { timeout: 20000 })
      .then(() => true)
      .catch(() => false);
    return confirmed ? { ok: true } : { ok: false, error: 'No confirmation detected after submit — verify manually before retrying' };
  },
};
