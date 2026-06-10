/**
 * Greenhouse adapter. Handles both boards.greenhouse.io and the newer
 * job-boards.greenhouse.io hosted forms (the application form lives at
 * <job url>#app or the same page). Real file upload via the shared toolkit.
 */
import type { Page } from 'playwright';
import { AtsAdapter, TaskLike, FillContext, FillResult, SubmitResult, fillVisibleForm } from './index';

export const greenhouseAdapter: AtsAdapter = {
  name: 'greenhouse',
  matches: (ats, url) => ats === 'greenhouse' || /greenhouse\.io/.test(url),

  async fill(page: Page, task: TaskLike, ctx: FillContext): Promise<FillResult> {
    await page.goto(task.applyUrl!, { waitUntil: 'domcontentloaded', timeout: 45000 });
    // Hosted boards: the form is on-page (id "application-form" / "#app_body"),
    // embedded boards: inside #grnhse_app iframe.
    const iframe = page.frameLocator('#grnhse_iframe');
    const hasIframe = await page.locator('#grnhse_iframe').count();
    if (hasIframe) {
      // Drive the iframe's page directly by navigating to its src
      const src = await page.locator('#grnhse_iframe').getAttribute('src');
      if (src) await page.goto(src, { waitUntil: 'domcontentloaded', timeout: 45000 });
    }
    // Some GH pages need the "Apply" tab clicked to reveal the form
    const applyBtn = page.locator('a:has-text("Apply"), button:has-text("Apply Now"), button:has-text("Apply for this job")').first();
    if (await applyBtn.count() && !(await page.locator('input[type="file"]').count())) {
      await applyBtn.click().catch(() => {});
      await page.waitForTimeout(1200);
    }
    await page.waitForSelector('input, textarea', { timeout: 15000 }).catch(() => {});
    return fillVisibleForm(page, task, ctx, { formSelector: 'form, #application-form, #main' });
  },

  async submit(page: Page, task: TaskLike): Promise<SubmitResult> {
    const btn = page.locator('button:has-text("Submit Application"), input[type="submit"][value*="Submit" i], button[type="submit"]').first();
    if (!(await btn.count())) return { ok: false, error: 'Submit button not found' };
    await btn.click();
    const confirmed = await Promise.race([
      page.waitForSelector('text=/thank you|application.*(received|submitted)|confirmation/i', { timeout: 20000 }).then(() => true),
      page.waitForTimeout(20000).then(() => false),
    ]);
    if (confirmed) return { ok: true };
    // Stayed on form with validation errors?
    const errs = await page.locator('.field-error, [class*="error"]:visible').allTextContents().catch(() => []);
    return errs.length
      ? { ok: false, error: 'Validation errors: ' + errs.slice(0, 3).join(' | ') }
      : { ok: false, error: 'No confirmation detected after submit — verify manually before retrying' };
  },
};
