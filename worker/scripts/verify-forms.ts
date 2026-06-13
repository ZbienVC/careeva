/**
 * Live end-to-end verification: run the REAL greenhouse adapter against live
 * forms using the user's actual packet shape (answers stored under
 * exact-question slugs). FILLS ONLY — never submits, never uploads.
 *   npx tsx scripts/verify-forms.ts
 */
import { chromium } from 'playwright';
import { getAdapterFor, TaskLike } from '../src/adapters/index';

// Mirrors the user's real answer bank (slugged keys, NOT canonical).
const answers: Record<string, string> = {
  are_you_authorized_to_work_in_the_united_states_: 'Yes',
  are_you_legally_entitled_to_work_in_canada_: 'Yes',
  requires_sponsorship: 'No',
  will_you_now_or_in_the_future_require_immigration_: 'No',
  country_: 'United States',
  salary_expectation: '$65,000 - $95,000, flexible',
  remote_preference: 'Open to hybrid or remote',
  years_experience: '4',
  start_date: 'Available immediately',
  why_this_company: 'I admire the product and mission.',
  why_this_role: 'It aligns with my background.',
  describe_yourself: 'Data-driven problem solver.',
  // EEO + extras the user provided
  gender: 'Male', hispanic_latino: 'No', veteran_status: 'No', pronouns: 'He/Him',
  worked_here_before: 'No',
};
const identity = {
  firstName: 'Zach', lastName: 'Bienstock', fullName: 'Zach Bienstock',
  email: 'zbienstock@example.com', phone: '19738036121',
  location: 'Hawthorne, NJ', country: 'United States',
  linkedinUrl: 'https://www.linkedin.com/in/zach-bienstock/', githubUrl: 'https://github.com/ZbienVC',
};

const FORMS = [
  ['Figma', 'https://job-boards.greenhouse.io/figma/jobs/6013495004?gh_jid=6013495004'],
  ['Databricks', 'https://job-boards.greenhouse.io/databricks/jobs/8563183002'],
];

import { PrismaClient } from '@prisma/client';
import { materializeFile } from '../src/storage';

(async () => {
  const prisma = new PrismaClient();
  const resumePath = await materializeFile(prisma, 'resumes/cmn9udgay0000s01m27s7yv2y/ce4b5daf8d79a927-Zachary_Bienstock_Resume.pdf');
  await prisma.$disconnect();
  const browser = await chromium.launch({ headless: true, channel: 'chromium' }).catch(() => chromium.launch({ headless: true }));
  for (const [name, url] of FORMS) {
    const task: TaskLike = { id: 'verify', applyUrl: url, mode: 'probe', packet: { answers, coverLetter: 'Cover letter text.', identity } };
    const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', viewport: { width: 1366, height: 900 } });
    const page = await ctx.newPage();
    try {
      const adapter = getAdapterFor('greenhouse', url)!;
      const res = await adapter.fill(page, task, { resumePath, config: null });
      const fr = res.report;
      console.log(`\n=== ${name} === filled ${fr.filled.length} | unanswered ${fr.unanswered.length} | resume ${fr.resumeAttached} | saw ${fr.diag?.textInputs}txt/${fr.diag?.comboboxes}combo`);
      console.log('  FILLED  :', fr.filled.map(f => `${f.via}:${f.value.slice(0,22)}`).join(' | '));
      if (fr.unanswered.length) console.log('  UNANSWER:', JSON.stringify(fr.unanswered));
    } catch (e) {
      console.log(`\n=== ${name} === ERROR ${e instanceof Error ? e.message : e}`);
    }
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
