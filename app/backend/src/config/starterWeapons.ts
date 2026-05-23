// Starter (training) weapon name list.
//
// These are the four free/baseline weapons new players use during onboarding,
// one per range band. Centralized here so achievement triggers (e.g.,
// "Identity Forged" / E25 — refine a starter weapon to Legendary status) and
// any other code that needs to identify "is this a starter weapon" share a
// single source of truth.
//
// The list is intentionally a literal const so callers can use it as a type
// (`(typeof STARTER_WEAPON_NAMES)[number]`) when narrowing.
export const STARTER_WEAPON_NAMES = [
  'Practice Sword',
  'Practice Blaster',
  'Training Rifle',
  'Training Beam',
] as const;

export type StarterWeaponName = (typeof STARTER_WEAPON_NAMES)[number];
