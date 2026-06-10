/**
 * Lever adapter. Application form lives at jobs.lever.co/<co>/<id>/apply.
 */
import type { Page } from 'playwright';
import { AtsAdapter, TaskLike, FillContext, FillResult, SubmitResult, fillVisibleForm } from './index';

export const leverAdapter: AtsAdapter = {
  name: 'lever',
  matches: (ats, url) => ats === 'lever' || /lever\.co/.test(url),

  async fill(page: Page, task: TaskLike, ctx: FillContext): Promise<FillResult> {
    let url = task.applyUrl!;
    if (!/\/apply\b/.test(url)) url = url.replace(/\/?$/, '/apply');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForSelector('input[type="file"], input[name="name"]', { timeout: 15000 }).catch(() => {});
    return fillVisibleForm(page, task, ctx, { formSelector: 'form' });
  },

  async submit(page: Page, task: TaskLike): Promise<SubmitResult> {
    const btn = page.locator('button:has-text("Submit application"), button[type="submit"]').first();
    if (!(await btn.count())) return { ok: false, error: 'Submit button not found' };
    await btn.click();
    const confirmed = await Promise.race([
      page.waitForURL(/thanks|confirmation/i, { timeout: 20000 }).then(() => true).catch(() => false),
      page.waitForSelector('text=/application.*submitted|thank/i', { timeout: 20000 }).then(() => true).catch(() => false),
    ]);
    return confirmed ? { ok: true } : { ok: false, error: 'No confirmation detected after submit — verify manually before retrying' };
  },
};
