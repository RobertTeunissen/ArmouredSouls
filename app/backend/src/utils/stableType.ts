/**
 * Stable_Type helpers (Spec #55, invariant I1).
 *
 * Invariant I1: `isGenerated = true` ⇔ `stableType = generated` for every
 * `User`. Every user-creation path that is not Activation derives its
 * Stable_Type from `isGenerated` through {@link stableTypeForCreation}, so the
 * two columns cannot disagree. Activation (the only path that creates
 * `automaton` users) sets `stableType = automaton` with `isGenerated = false`.
 *
 * Kept free of Prisma imports so `prisma/seed.ts` and unit tests can use it.
 */

/** Mirrors the Prisma `StableType` enum. */
export type StableTypeValue = 'human' | 'generated' | 'automaton';

/**
 * Stable_Type for a user created outside Activation (registration,
 * `generateBattleReadyUsers`, `prisma/seed.ts`).
 */
export function stableTypeForCreation(isGenerated: boolean): 'human' | 'generated' {
  return isGenerated ? 'generated' : 'human';
}

/** True when the pair satisfies invariant I1. */
export function satisfiesStableTypeInvariant(isGenerated: boolean, stableType: StableTypeValue): boolean {
  return isGenerated === (stableType === 'generated');
}
