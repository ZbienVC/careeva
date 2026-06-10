/**
 * Generic adapter — best-effort filler for ANY application form (company
 * career pages, SmartRecruiters, iCIMS-lite, Typeform-ish forms, etc.).
 * Fill quality varies; it always produces a field report + screenshot, and in
 * approve_first mode nothing is submitted without the user seeing it.
 */
import type { Page } from 'playwright';
import { AtsAdapter, TaskLike, FillContext, FillResult, SubmitResult, fillVisibleForm } from './index';

export const genericAdapter: AtsAdapter = {
  name: 'generic',
  matches: () => false, // selected only as explicit fallback by the registry

  async fill(page: Page, task: TaskLike, ctx: FillContext): Promise<FillResult> {
    await page.goto(task.applyUrl!, { waitUntil: 'domcontentloaded', timeout: 45000 });
    const applyBtn = page.locator('a:has-text("Apply"), button:has-text("Apply")').first();
    if (await applyBtn.count() && !(await page.locator('input[type="file"], form input[type="text"]').count())) {
      await applyBtn.click().catch(() => {});
      await page.waitForTimeout(2000);
    }
    return fillVisibleForm(page, task, ctx);
  },

  async submit(page: Page, task: TaskLike): Promise<SubmitResult> {
    const btn = page
      .locator('button:has-text("Submit"), input[type="submit"], button[type="submit"], button:has-text("Apply")')
      .last();
    if (!(await btn.count())) return { ok: false, error: 'Submit control not found on unknown form' };
    await btn.click();
    const confirmed = await page
      .waitForSelector('text=/thank|submitted|received|confirmation|success/i', { timeout: 20000 })
      .then(() => true)
      .catch(() => false);
    return confirmed ? { ok: true } : { ok: false, error: 'No confirmation detected (unknown form) — verify manually' };
  },
};
