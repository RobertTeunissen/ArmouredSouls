/**
 * Spec #51 — shared construction of unique, *still valid* registration credentials
 * for the auth property suites.
 *
 * THE BUG THIS REPLACES
 * ---------------------
 * Ten property suites built a unique email like this:
 *
 *   const suffix = `${Date.now()}${runIndex++}`;
 *   const uniqueEmail = `${email.split('@')[0]}${suffix}@t.co`.slice(0, 20);
 *
 * `suffix` is a 13-digit timestamp plus a run counter, so it grows as fast-check
 * shrinks. Once local-part + suffix + `@t.co` exceeded 20 characters, the trailing
 * `.slice(0, 20)` truncated the *domain* — producing `a175640000000017@t.c` or
 * worse. `registerBodySchema` then correctly rejected it with 400 and the suite
 * failed asserting 201.
 *
 * The guard immediately below it only re-checked the minimum length, never the
 * corruption caused by the maximum:
 *
 *   if (uniqueUsername.length < 3 || uniqueEmail.length < 3) return;
 *
 * The 20-character cap was itself wrong: `email` is `@db.VarChar(50)` and
 * `registerBodySchema` allows `.max(50)`.
 *
 * Note for anyone triaging these suites: the fast-check counterexample shrinks to
 * a 3-character username, which makes the username look like the culprit. It is
 * not. The username path is fine — truncating a username to 20 characters leaves
 * it valid, because the charset is unrestricted within the regex.
 *
 * THE RULE
 * --------
 * Budget the local part so the finished address always fits, then append the
 * domain. Never truncate a composed address.
 */

/** `registerBodySchema`: `z.string().min(3).max(20)`, and `@db.VarChar(50)`. */
const USERNAME_MAX = 20;

/** `registerBodySchema`: `z.string().min(3).max(50).email()`, and `@db.VarChar(50)`. */
const EMAIL_MAX = 50;

/** `securityValidation.stableName`: `.min(3).max(30)`, and `@db.VarChar(30)`. */
const STABLE_NAME_MAX = 30;

const EMAIL_DOMAIN = '@t.co';

export interface UniqueRegistration {
  username: string;
  email: string;
  stableName: string;
}

/**
 * Build a unique registration payload that satisfies every validation rule.
 *
 * The suffix is placed last and never truncated, so uniqueness survives; the
 * caller's generated base is what gets trimmed to make room.
 *
 * @param base   Generated values from fast-check arbitraries.
 * @param suffix Per-run uniqueness token, e.g. `` `${Date.now()}${runIndex++}` ``.
 */
export function uniqueRegistration(
  base: { username: string; email?: string; stableName?: string },
  suffix: string,
): UniqueRegistration {
  const localBudget = EMAIL_MAX - EMAIL_DOMAIN.length - suffix.length;
  const emailBase = (base.email ?? 'u').split('@')[0];
  const emailLocal = `${emailBase.slice(0, Math.max(0, localBudget))}${suffix}`;

  return {
    username: `${base.username.slice(0, Math.max(0, USERNAME_MAX - suffix.length))}${suffix}`.slice(
      0,
      USERNAME_MAX,
    ),
    email: `${emailLocal}${EMAIL_DOMAIN}`,
    stableName: `${(base.stableName ?? 'stb').slice(
      0,
      Math.max(0, STABLE_NAME_MAX - suffix.length - 1),
    )}_${suffix}`.slice(0, STABLE_NAME_MAX),
  };
}
