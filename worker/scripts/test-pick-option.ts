/**
 * Unit tests for pickOption — the dropdown option matcher. Run with:
 *   npx tsx scripts/test-pick-option.ts
 *
 * These encode the cross-fill bugs from real runs: substring-first matching
 * used to let "No" select "Non-binary"/"Norway", and the typed fallback
 * clicked the first option blind.
 */
import { pickOption } from '../src/adapters/index';

let failures = 0;
function expect(name: string, actual: string | undefined, want: string | undefined) {
  const pass = actual === want;
  if (!pass) failures++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}` + (pass ? '' : `\n      got ${JSON.stringify(actual)}, want ${JSON.stringify(want)}`));
}

// ── Yes/No must match whole words only ──
expect('"No" never matches Non-binary',
  pickOption('No', ['Male', 'Female', 'Non-binary', 'I don\'t wish to answer']), undefined);
expect('"No" never matches Norway',
  pickOption('No', ['Norway', 'Sweden', 'United States']), undefined);
expect('"No" picks the bare No',
  pickOption('No', ['Yes', 'No', 'I don\'t wish to answer']), 'No');
expect('"No" picks a No-prefixed sentence',
  pickOption('No', ['Yes, currently', 'No, I have not', 'Unsure']), 'No, I have not');
expect('"Yes" picks the bare Yes over substrings',
  pickOption('Yes', ['Eyes on', 'Yes', 'No']), 'Yes');

// ── Exact match beats everything ──
expect('exact match wins',
  pickOption('I don\'t wish to answer', ['Yes', 'No', 'I don\'t wish to answer']), 'I don\'t wish to answer');
expect('exact match is case/space-insensitive',
  pickOption('  i DON\'T wish to answer ', ['I don\'t wish to answer']), 'I don\'t wish to answer');

// ── Prefix and substring tiers ──
expect('prefix: stored short, option verbose',
  pickOption('United States', ['Canada', 'United States of America']), 'United States of America');
expect('reverse: stored verbose, option is its prefix',
  pickOption('New York City, NY', ['New York', 'New Jersey']), 'New York');
expect('ambiguous overlap stays unmatched (both options contain "authorized")',
  pickOption('I am authorized to work', ['Authorized', 'Not authorized']), undefined);
expect('verbose yes answer falls back to yes-leading option',
  pickOption('Yes I can start immediately', ['Yes', 'No']), 'Yes');

// ── Placeholders are never candidates ──
expect('placeholder Select... is skipped',
  pickOption('Select', ['Select...', 'Selective Service']), 'Selective Service');

// ── State expansion still works ──
expect('state abbreviation expands',
  pickOption('Hawthorne, NJ', ['New York', 'New Jersey', 'Connecticut']), 'New Jersey');

// ── EEO decline fallback ──
expect('EEO with no stored answer declines',
  pickOption(undefined, ['Man', 'Woman', 'I don\'t wish to answer'], { eeoDecline: true }), 'I don\'t wish to answer');
expect('EEO decline variants',
  pickOption(undefined, ['Male', 'Female', 'Decline to self-identify'], { eeoDecline: true }), 'Decline to self-identify');
expect('EEO stored answer beats decline',
  pickOption('No', ['Yes', 'No', 'I don\'t wish to answer'], { eeoDecline: true }), 'No');
expect('EEO unmatchable answer falls back to decline, not empty',
  pickOption('N/A', ['Yes', 'No', 'I don\'t wish to answer'], { eeoDecline: true }), 'I don\'t wish to answer');

// ── No invented answers ──
expect('non-EEO unmatchable answer returns nothing',
  pickOption('Purple', ['Yes', 'No']), undefined);
expect('empty options returns nothing',
  pickOption('Yes', []), undefined);

if (failures) {
  console.error(`\n${failures} test(s) FAILED`);
  process.exit(1);
}
console.log('\nAll pickOption tests passed.');
