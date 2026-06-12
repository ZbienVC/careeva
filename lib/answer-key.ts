/**
 * lib/answer-key.ts — canonical question-key derivation for the answer bank.
 *
 * The worker reports unanswered questions as "<label> (<diagnostic reason>)".
 * Anything saved back into the answer bank MUST be keyed off the CLEAN label,
 * or the key never matches the form field again (the slug truncates at 50
 * chars, so a leaked suffix poisons the key permanently — e.g. "Do you
 * identify as a Person of Colour?* (dropdown interaction failed)" slugs to
 * "...colour_dropdown_int" while the worker looks up "...colour_").
 *
 * DIAGNOSTIC_SUFFIX_RE must cover every reason string the worker emits — see
 * worker/src/adapters/index.ts (fill did not stick / no option matched /
 * dropdown interaction failed / selection did not register / value did not
 * persist / EEO variants). Keep the two in sync.
 */

export const DIAGNOSTIC_SUFFIX_RE =
  /\s*\((fill did not stick|no option matched[^)]*|dropdown interaction failed|selection did not register|value did not persist[^)]*|EEO[^)]*)\)\s*$/i;

/** Remove trailing worker diagnostics (possibly stacked) from a question label. */
export function stripDiagnostics(question: string): string {
  let s = question.trim();
  while (DIAGNOSTIC_SUFFIX_RE.test(s)) s = s.replace(DIAGNOSTIC_SUFFIX_RE, '').trim();
  return s;
}

/** Mirrors the worker's label slug (worker/src/adapters/index.ts slug()) —
 * answers keyed this way match the form field on refill AND auto-fill the
 * same question on future applications. */
export function slugifyQuestion(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 50);
}
