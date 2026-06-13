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

    // GH embeds inject their iframe via JS AFTER load — wait for any form
    // signal before deciding what kind of page this is.
    await page
      .waitForSelector('#grnhse_iframe, input[type="file"], #application-form, form[action*="greenhouse"]', { timeout: 10000 })
      .catch(() => {});

    // Custom career sites (careers.<company>.com) embed the real form in an
    // iframe — drive the iframe's page directly by navigating to its src.
    const resolveEmbed = async (): Promise<void> => {
      const iframeEl = page.locator('#grnhse_iframe');
      if (await iframeEl.count()) {
        const src = await iframeEl.getAttribute('src');
        if (src) await page.goto(src, { waitUntil: 'domcontentloaded', timeout: 45000 });
      }
    };
    await resolveEmbed();

    // Listing page without a visible form: click the Apply control, then
    // re-check for an injected embed.
    if (!(await page.locator('input[type="file"]').count())) {
      const applyBtn = page
        .locator('a:has-text("Apply"), button:has-text("Apply Now"), button:has-text("Apply for this job"), a:has-text("APPLY")')
        .first();
      if (await applyBtn.count()) {
        await applyBtn.click().catch(() => {});
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        await page.waitForTimeout(1500);
        await resolveEmbed();
      }
    }

    // Last resort: the page links out to the hosted Greenhouse board.
    if (!(await page.locator('input[type="file"], #application-form').count())) {
      const ghLink = await page
        .locator('a[href*="greenhouse.io"]')
        .first()
        .getAttribute('href')
        .catch(() => null);
      if (ghLink) {
        await page.goto(ghLink, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(1000);
        await resolveEmbed();
      }
    }

    // The new job-boards UI mounts the form client-side, sometimes seconds
    // after the header renders (slow containers) — wait for REAL form
    // controls, and nudge with a scroll once before giving up.
    const formControls = 'input[type="file"], #application-form input, form input[type="text"], textarea';
    if (!(await page.waitForSelector(formControls, { timeout: 20000 }).catch(() => null))) {
      await page.mouse.wheel(0, 4000).catch(() => {});
      await page.waitForSelector(formControls, { timeout: 8000 }).catch(() => {});
    }
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
