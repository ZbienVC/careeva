/** Print the exact option texts of specific dropdowns on a Greenhouse form. */
import { chromium } from 'playwright';

const URL = process.argv[2] || 'https://job-boards.greenhouse.io/embed/job_app?for=instacart&token=7642778';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('input, textarea', { timeout: 15000 }).catch(() => {});

  const combos = page.locator('[role="combobox"], input[aria-haspopup="listbox"], button[aria-haspopup="listbox"]');
  const n = await combos.count();
  console.log('comboboxes:', n);
  for (let i = 0; i < n; i++) {
    const el = combos.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const id = await el.getAttribute('id');
    const aria = await el.getAttribute('aria-label');
    const labelEl = id ? page.locator(`label[for="${id}"]`).first() : null;
    const label = aria || (labelEl && (await labelEl.count()) ? await labelEl.textContent() : '') || '';
    if (!/gender|state or province|2slgbtqia|person of colour/i.test(label)) continue;
    console.log(`\n[${i}] tag=${await el.evaluate((e) => e.tagName)} label=${JSON.stringify(label.trim())}`);
    await el.click({ timeout: 4000 }).catch((e) => console.log('  click failed:', String(e).slice(0, 120)));
    await page.waitForTimeout(700);
    const texts = await page.locator('[role="option"]').allTextContents();
    console.log('  options:', JSON.stringify(texts));
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
