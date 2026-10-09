/**
 * @module utils/profanityFilter
 *
 * Word-list profanity check for player-chosen stable names, used by
 * `validateStableName` in `utils/validation.ts`. Robot names and team names
 * do not apply this filter.
 */

/**
 * Prohibited words: lower-case, letters only.
 * Production systems should use a more sophisticated filtering library.
 */
export const PROFANITY_LIST: readonly string[] = [
  'damn',
  'hell',
  'crap',
  'shit',
  'fuck',
  'bitch',
  'ass',
  'bastard',
  'dick',
  'cock',
  'pussy',
  'whore',
  'slut',
  'fag',
  'nigger',
  'nigga',
  'retard',
  'rape',
  'nazi',
  'hitler',
];

/**
 * List entries that are also rejected inside a longer run of letters
 * ("bigbitch", "MYBASTARDBOT"). An entry qualifies only if it has at least
 * 5 letters AND is not a substring of any common English word. Excluded by
 * that rule: every entry under 5 letters (e.g. "ass" in glass/class,
 * "hell" in shell/hello, "cock" in cockpit), "pussy" (pussycat, pussyfoot),
 * "nigger" (snigger), "nigga" (niggard), "retard" (retardant).
 */
export const COMPOUND_MATCH_ENTRIES: readonly string[] = ['bitch', 'bastard', 'whore', 'hitler'];

const PROFANITY_SET: ReadonlySet<string> = new Set(PROFANITY_LIST);

/** Maximal letter runs; every non-letter (space, digit, `-`, `_`, punctuation) separates. */
const LETTER_RUN = /\p{L}+/gu;

/** camelCase/PascalCase parts of a letter run: "BigAss" → Big, Ass; "ASSHole" → ASS, Hole. */
const CAMEL_CASE_PART = /\p{Lu}+(?!\p{Ll})|\p{Lu}?\p{Ll}+/gu;

/**
 * Check whether text contains a prohibited word from {@link PROFANITY_LIST}.
 *
 * Matching is whole-word and case-insensitive, so ordinary words that merely
 * contain a list entry are allowed ("Glass Cannon", "Assembly Line",
 * "Shell Corp", "Scunthorpe Steel", "Classic", "Hello").
 *
 * Rules, applied to each maximal run of letters (any non-letter character
 * such as a space, digit, hyphen, underscore or punctuation separates runs):
 * 1. The whole run, lower-cased, equals a list entry ("ass", "SHIT", "ShIt",
 *    "Big_Ass", "big-ass", "Ass123").
 * 2. A camelCase/PascalCase part of the run equals a list entry
 *    ("BigAss" → "Big" + "Ass", "ASSHole" → "ASS" + "Hole").
 * 3. Compound rule: the lower-cased run contains an entry from
 *    {@link COMPOUND_MATCH_ENTRIES} anywhere ("bigbitchbot"). Only entries of
 *    at least 5 letters that are never a substring of a common English word
 *    qualify, so shorter or ambiguous entries are matched by rules 1-2 only
 *    ("bigass" and "shitty" are not caught).
 *
 * Leetspeak and other character substitutions are not decoded.
 *
 * @param text - Text to check, e.g. a stable name
 * @returns `true` when the text contains a prohibited word
 *
 * Requirements: 1.7
 */
export function containsProfanity(text: string): boolean {
  for (const run of text.match(LETTER_RUN) ?? []) {
    const lower = run.toLowerCase();

    // Rule 1: the whole letter run is a list entry.
    if (PROFANITY_SET.has(lower)) {
      return true;
    }

    // Rule 2: a camelCase/PascalCase part of the run is a list entry.
    const parts = run.match(CAMEL_CASE_PART) ?? [];
    if (parts.some((part) => PROFANITY_SET.has(part.toLowerCase()))) {
      return true;
    }

    // Rule 3: long, unambiguous entries are also caught inside compounds.
    if (COMPOUND_MATCH_ENTRIES.some((entry) => lower.includes(entry))) {
      return true;
    }
  }

  return false;
}
