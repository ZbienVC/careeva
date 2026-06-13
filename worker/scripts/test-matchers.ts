/**
 * Canonical matcher tests. The NEGATIVE cases come from an adversarial review
 * that hunted false positives (a wrong autofill is worse than a blank field).
 * Run: npx tsx scripts/test-matchers.ts
 */
import { buildMatchers, findMatcher, canonicalAnswersFrom, companyFromUrl, Packet } from '../src/adapters/index';

let failures = 0;
const norm = (s: string) => s.replace(/[_-]+/g, ' ');

// A representative packet: answers stored under exact-question slugs (the real
// shape from the user's bank) plus identity.
const packet: Packet = {
  answers: {
    are_you_authorized_to_work_in_the_united_states_: 'Yes',
    are_you_legally_entitled_to_work_in_canada_: 'Yes',
    requires_sponsorship: 'No',
    will_you_now_or_in_the_future_require_immigration_: 'No',
    country_: 'United States',
    salary_expectation: '$65,000 - $95,000',
  },
  identity: { firstName: 'Zach', lastName: 'Bienstock', fullName: 'Zach Bienstock', email: 'z@example.com', phone: '19738036121', location: 'Hawthorne, NJ', country: 'United States' },
};

function expectKey(label: string, wantKey: string | null, company = 'figma') {
  const matchers = buildMatchers(packet, { company });
  const m = findMatcher(matchers, norm(label));
  const got = m?.key ?? null;
  const pass = got === wantKey;
  if (!pass) { failures++; console.log(`FAIL  ${JSON.stringify(label)}\n      matched key ${JSON.stringify(got)}, want ${JSON.stringify(wantKey)}`); }
  else console.log(`PASS  [${got ?? 'none'}] ${label}`);
}

function expectValue(label: string, wantValue: string | undefined, company = 'figma') {
  const matchers = buildMatchers(packet, { company });
  const m = findMatcher(matchers, norm(label));
  const got = m?.value(packet, norm(label));
  const pass = got === wantValue;
  if (!pass) { failures++; console.log(`FAIL  value ${JSON.stringify(label)}\n      got ${JSON.stringify(got)}, want ${JSON.stringify(wantValue)}`); }
  else console.log(`PASS  value [${got}] ${label}`);
}

console.log('── canonicalAnswersFrom: stored slugs normalize to canonical keys ──');
const canon = canonicalAnswersFrom(packet);
for (const [k, v] of [['work_authorization_us', 'Yes'], ['work_authorization_ca', 'Yes'], ['requires_sponsorship', 'No'], ['country', 'United States']] as const) {
  const pass = canon[k] === v;
  if (!pass) { failures++; console.log(`FAIL  canon[${k}] = ${JSON.stringify(canon[k])}, want ${JSON.stringify(v)}`); }
  else console.log(`PASS  canon[${k}] = ${v}`);
}

console.log('\n── company extraction ──');
for (const [url, want] of [
  ['https://job-boards.greenhouse.io/figma/jobs/6013495004?gh_jid=6013495004', 'figma'],
  ['https://boards.greenhouse.io/affirm/jobs/7708925003', 'affirm'],
  ['https://jobs.lever.co/brex/abc', 'brex'],
] as const) {
  const got = companyFromUrl(url);
  const pass = got === want;
  if (!pass) { failures++; console.log(`FAIL  companyFromUrl ${url} -> ${got}, want ${want}`); }
  else console.log(`PASS  companyFromUrl -> ${got}`);
}

console.log('\n── work authorization (US) — TRUE positives ──');
expectKey('Are you legally authorized to work in the United States?*', 'work_authorization_us');
expectKey('Are you authorized to work in the country for which you applied? *', 'work_authorization_us');
expectKey('Are you currently authorized to work in the US', 'work_authorization_us');
expectValue('Are you legally authorized to work in the United States?*', 'Yes');
expectValue('Are you authorized to work in the country for which you applied?', 'Yes');

console.log('\n── work authorization — FALSE positives (must NOT be work_authorization_us) ──');
for (const l of [
  'Are you legally authorized to work in the United Kingdom?',
  'Are you authorized to work in Australia?',
  'Are you eligible to work in the EU?',
  'Are you legally entitled to work in Germany?',
  'Are you eligible to work overtime?',
  'Are you eligible to work weekends and holidays?',
  'Are you eligible to work the night shift?',
  'Are you authorized to work from home under your current arrangement?',
  'Do you have authorization to work on classified or government projects?',
]) {
  const m = findMatcher(buildMatchers(packet, { company: 'figma' }), norm(l));
  const bad = m?.key === 'work_authorization_us';
  if (bad) { failures++; console.log(`FAIL  ${JSON.stringify(l)} wrongly matched work_authorization_us`); }
  else console.log(`PASS  not-US-auth [${m?.key ?? 'none'}] ${l}`);
}

console.log('\n── Canada work auth ──');
expectKey('Are you currently authorized to work in Canada?*', 'work_authorization_ca');
expectKey('Are you legally entitled to work in Canada?*', 'work_authorization_ca');
expectValue('Are you authorized to work in Canada?', 'Yes');

console.log('\n── sponsorship (opposite polarity, tested before work auth) ──');
expectKey('Will you now or in the future require immigration sponsorship to work for Figma?*', 'requires_sponsorship');
expectKey('Do you require visa sponsorship?', 'requires_sponsorship');
expectValue('Will you now or in the future require immigration sponsorship?', 'No');
for (const l of ['Did an employee sponsor or refer you for this position?', 'Are you a sponsored athlete or brand ambassador?', 'Would you like to sponsor a charity through our payroll giving program?']) {
  const m = findMatcher(buildMatchers(packet, { company: 'figma' }), norm(l));
  const bad = m?.key === 'requires_sponsorship';
  if (bad) { failures++; console.log(`FAIL  ${JSON.stringify(l)} wrongly matched requires_sponsorship`); }
  else console.log(`PASS  not-sponsorship [${m?.key ?? 'none'}] ${l}`);
}

console.log('\n── location / state ──');
expectKey('Which U.S. State or Canadian Province do you reside in?*', 'location_state');
expectKey('From where do you intend to work?', 'location_state');
expectValue('Which U.S. State or Canadian Province do you reside in?', 'Hawthorne, NJ');
for (const l of [
  'Please state your reason for wanting to work here.',
  'Are you a resident of any other state or province for tax purposes?',
  'What is the state or province of your university?',
  'Are you currently living in the state where this role is based?',
]) {
  const m = findMatcher(buildMatchers(packet, { company: 'figma' }), norm(l));
  const bad = m?.key === 'location_state';
  if (bad) { failures++; console.log(`FAIL  ${JSON.stringify(l)} wrongly matched location_state`); }
  else console.log(`PASS  not-location_state [${m?.key ?? 'none'}] ${l}`);
}

console.log('\n── how heard ──');
expectKey('How did you first learn about Affirm as an employer? *', 'how_heard', 'affirm');
expectKey('How did you hear about this position?', 'how_heard');
expectValue('How did you first learn about Affirm as an employer?', 'Company careers page', 'affirm');
for (const l of ['How did you hear back from our recruiter?', 'How did you learn about our products in your last role?']) {
  const m = findMatcher(buildMatchers(packet, { company: 'figma' }), norm(l));
  const bad = m?.key === 'how_heard';
  if (bad) { failures++; console.log(`FAIL  ${JSON.stringify(l)} wrongly matched how_heard`); }
  else console.log(`PASS  not-how_heard [${m?.key ?? 'none'}] ${l}`);
}

console.log('\n── worked here before (company-aware, narrow) ──');
expectKey('Have you previously been employed at Affirm for any length of time?*', 'worked_here_before', 'affirm');
expectKey('Have you ever worked for Figma before, as an employee or a contractor/consultant?*', 'worked_here_before', 'figma');
expectValue('Have you ever worked for Figma before?', 'No', 'figma');
for (const l of [
  'Have you ever worked with children before?',
  'Have you ever worked with sensitive data?',
  'Have you ever worked for the government before?',
  'Have you ever signed a non-compete with a previous employer?',
  'Were you previously employed in the financial services industry?',
  'Have you ever worked with a recruiter before?',
]) {
  const m = findMatcher(buildMatchers(packet, { company: 'figma' }), norm(l));
  const bad = m?.key === 'worked_here_before';
  if (bad) { failures++; console.log(`FAIL  ${JSON.stringify(l)} wrongly matched worked_here_before`); }
  else console.log(`PASS  not-worked_here [${m?.key ?? 'none'}] ${l}`);
}

console.log('\n── preferred name ──');
expectKey('Preferred Name', 'preferred_name');
expectKey('Preferred First Name', 'preferred_name');
expectValue('Preferred First Name', 'Zach');
for (const l of ['Do you want to be called back?', 'Is this the name you want on your offer letter?', 'Full legal name', 'Last Name']) {
  const m = findMatcher(buildMatchers(packet, { company: 'figma' }), norm(l));
  const bad = m?.key === 'preferred_name';
  if (bad) { failures++; console.log(`FAIL  ${JSON.stringify(l)} wrongly matched preferred_name`); }
  else console.log(`PASS  not-preferred_name [${m?.key ?? 'none'}] ${l}`);
}

console.log('\n── country (not country code) ──');
expectKey('Country*', 'country');
expectValue('Country*', 'United States');
for (const l of ['Home country code', 'Current country code']) {
  const m = findMatcher(buildMatchers(packet, { company: 'figma' }), norm(l));
  const bad = m?.key === 'country';
  if (bad) { failures++; console.log(`FAIL  ${JSON.stringify(l)} wrongly matched country`); }
  else console.log(`PASS  not-country [${m?.key ?? 'none'}] ${l}`);
}

console.log('\n── current company ──');
{
  const p2: Packet = { ...packet, answers: { ...packet.answers, current_company: 'Acme Corp' } };
  const m = findMatcher(buildMatchers(p2, { company: 'reddit' }), norm('Please provide the name of your current (or most recent) company'));
  const okKey = m?.key === 'current_company';
  const okVal = m?.value(p2) === 'Acme Corp';
  if (!okKey || !okVal) { failures++; console.log(`FAIL  current company -> key ${m?.key}, value ${m?.value(p2)}`); }
  else console.log('PASS  current_company -> Acme Corp');
  // must NOT match "why are you leaving your current company"
  const bad = findMatcher(buildMatchers(p2, { company: 'reddit' }), norm('Why are you leaving your current company?'));
  if (bad?.key === 'current_company') { failures++; console.log('FAIL  "why leaving current company" wrongly matched current_company'); }
  else console.log(`PASS  not-current_company [${bad?.key ?? 'none'}] why leaving`);
}

console.log('\n── based in region (derived from location) ──');
expectValue('Are you based in the San Francisco Bay Area?', 'No');
expectValue('Are you currently located in the New Jersey area?', 'Yes');
expectKey('Which state do you reside in?', 'location_state'); // must NOT hijack to based_in_region

console.log('\n── core identity still works ──');
expectValue('First Name*', 'Zach');
expectValue('Last Name*', 'Bienstock');
expectValue('Email*', 'z@example.com');
expectKey('LinkedIn Profile', 'linkedin_url');

if (failures) { console.error(`\n${failures} matcher test(s) FAILED`); process.exit(1); }
console.log('\nAll matcher tests passed.');
