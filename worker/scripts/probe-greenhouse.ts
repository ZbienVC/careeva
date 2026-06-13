/**
 * Live probe: run the shared form filler against a real Greenhouse
 * application form and print the field report. FILLS ONLY — never submits,
 * never attaches a file, so nothing is transmitted to the employer.
 *
 *   npx tsx scripts/probe-greenhouse.ts [job_app URL]
 */
import { chromium } from 'playwright';
import { fillVisibleForm, TaskLike } from '../src/adapters/index';

const URL = process.argv[2] || 'https://job-boards.greenhouse.io/embed/job_app?for=instacart&token=7642778';

// Answers keyed exactly the way the worker looks them up (slug of the
// normalized label), built from the question text so the probe can't drift
// from the production keying.
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 50);
const answers: Record<string, string> = {};
const q = (text: string, answer: string) => {
  for (const v of [text, text + '*', text + ' *']) answers[slug(v.replace(/[_-]+/g, ' '))] = answer;
};
q('Are you currently, or have you previously, worked for Instacart?', 'No');
q('Do you identify as a member of the 2SLGBTQIA+ community?', 'No');
q('Will you now or in the future require immigration sponsorship to work for Instacart?', 'No');
q('Do you identify as a Person of Colour?', 'No');
q('Are you legally authorized to work in Canada?', 'Yes');
answers['work_authorization_us'] = 'Yes';
answers['requires_sponsorship'] = 'No';
answers['how_heard'] = 'Company careers page';

const task: TaskLike = {
  id: 'probe',
  applyUrl: URL,
  mode: 'probe',
  packet: {
    answers,
    identity: {
      firstName: 'Probe', lastName: 'Test', fullName: 'Probe Test',
      email: 'probe@example.com', phone: '5555550100',
      location: 'Toronto, ON', country: 'Canada',
    },
  },
};

(async () => {
  // Mirror the worker's launcher: full-Chromium headless, shell as fallback.
  // PROBE_SHELL=1 forces the stripped headless shell (the worker's pre-3e57c61
  // browser) to isolate fingerprint-blocking from IP-blocking.
  const browser = process.env.PROBE_SHELL
    ? await chromium.launch({ headless: true })
    : await chromium
        .launch({ headless: true, channel: 'chromium' })
        .catch(() => chromium.launch({ headless: true }));
  console.log('browser:', process.env.PROBE_SHELL ? 'headless-shell' : 'full chromium', browser.version());
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('input, textarea', { timeout: 15000 }).catch(() => {});
  const res = await fillVisibleForm(page, task, { resumePath: null, config: null });
  console.log(JSON.stringify(res.report, null, 2));
  console.log('ok:', res.ok, res.error ? `error: ${res.error}` : '');
  await page.screenshot({ path: '/tmp/probe-greenhouse.png', fullPage: true });
  console.log('screenshot: /tmp/probe-greenhouse.png');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
