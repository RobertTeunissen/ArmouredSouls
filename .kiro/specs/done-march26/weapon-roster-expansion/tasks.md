# Implementation Plan: Weapon Roster Expansion

## Overview

Expand the weapon catalog from 26 to 47 weapons by adding a `rangeBand` column, seeding 21 new weapons, reclassifying 2 existing weapons, simplifying range classification logic, removing the dead recommendation pipeline, updating price tier boundaries, adding weapon image assets, and updating documentation. All changes use TypeScript with Prisma, React, and fast-check for property-based testing.

## Tasks

- [x] 1. Database schema update and migration
  - [x] 1.1 Add `rangeBand` column to Weapon model in `app/backend/prisma/schema.prisma`
    - Add `rangeBand String @map("range_band") @db.VarChar(10)` field to the Weapon model
    - Place it after the `description` field
    - _Requirements: 3.4, 7.1_
  - [x] 1.2 Create Prisma migration for the `rangeBand` column
    - Run `npx prisma migrate dev --name add-weapon-range-band`
    - Migration SQL: `ALTER TABLE weapons ADD COLUMN range_band VARCHAR(10) NOT NULL DEFAULT 'short'`
    - _Requirements: 3.4_

- [x] 2. Seed data: add new weapons and reclassify existing ones
  - [x] 2.1 Update `app/backend/prisma/seed.ts` with reclassified weapons
    - Laser Rifle: change handsRequired to "two", loadoutType to "two_handed", baseDamage to 9, cost to 243000, update description
    - Assault Rifle: change baseDamage to 14, cost to 293000, combatPowerBonus to +6, targetingSystemsBonus to +5, weaponControlBonus to +4, attackSpeedBonus to +3, update description
    - Battle Axe: acknowledge tier correction (no stat changes, cost 402000 already Luxury)
    - Set `rangeBand` on all 26 existing weapons per design Section 4 range assignment table
    - _Requirements: 2.3, 2.4, 2.6, 7.2, 7.6_
  - [x] 2.2 Verify archetype test users' equipped weapons still function after reclassifications
    - Check all 10 player archetype test users in seed data — ensure their equipped weapons (especially Laser Rifle and Assault Rifle) still exist with valid stats after reclassification
    - If any archetype user equips Laser Rifle, update their loadout since it's now two-handed
    - _Requirements: 11.4_
  - [x] 2.3 Add 21 new weapon definitions to `app/backend/prisma/seed.ts`
    - Add weapons B1-B21 from design Section 7: Vibro Mace, War Club, Shock Maul, Thermal Lance, Volt Sabre, Scatter Cannon, Pulse Accelerator, Arc Projector, Bolt Carbine, Flux Repeater, Disruptor Cannon, Nova Caster, Mortar System, Beam Pistol, Photon Marksman, Gauss Pistol, Particle Lance, Siege Cannon, Barrier Shield, Fortress Shield, Aegis Bulwark
    - Each definition must include: name, weaponType, baseDamage, cooldown, cost, handsRequired, damageType, loadoutType, rangeBand, specialProperty, description, and all attribute bonus fields
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 7.1, 7.3, 7.4, 7.5_
  - [x] 2.4 Write property tests for seed data completeness and pricing (P1, P2, P6, P13, P14, P15)
    - **Property P1: Pricing Round-Trip** — For every non-starter weapon, the pricing formula applied to its stats must produce a cost within 5,000 of the stored cost
    - **Validates: Requirements 4.1, 4.2, 4.3, 10.1**
    - **Property P2: Tier Compliance** — For every weapon, its stored cost must fall within the boundaries of its assigned price tier
    - **Validates: Requirements 4.3, 12.1**
    - **Property P6: Schema Completeness** — Every weapon definition must include all required fields
    - **Validates: Requirements 7.1**
    - **Property P13: Unique Names** — Every weapon must have a unique name
    - **Validates: Requirements 3.2**
    - **Property P14: Starter Weapon Preservation** — The 4 starters must each have cost=50000, baseDamage=6, cooldown=3, zero attribute bonuses
    - **Validates: Requirements 11.2**
    - **Property P15: Grid Coverage** — Every slot in the 36-slot grid must contain at least one weapon
    - **Validates: Requirements 1.1, 1.3, 3.1**

- [x] 3. Checkpoint — Ensure seed data and schema are correct
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Simplify range classification logic
  - [x] 4.1 Simplify `app/backend/src/services/arena/rangeBands.ts`
    - Update `WeaponLike` interface to `{ name: string; rangeBand: RangeBand }`
    - Replace `getWeaponOptimalRange()` rule chain with `return weapon.rangeBand`
    - Remove `LONG_RANGE_WEAPONS` list
    - Update `canAttack()` to use `weapon.rangeBand === 'melee'` instead of `weapon.weaponType === 'melee'`
    - _Requirements: 3.4_
  - [x] 4.2 Simplify `app/frontend/src/utils/weaponRange.ts`
    - Update `WeaponLike` interface to `{ name: string; rangeBand: RangeBand }`
    - Replace `getWeaponOptimalRange()` rule chain with `return weapon.rangeBand`
    - Remove `LONG_RANGE_WEAPONS` list
    - _Requirements: 3.4_
  - [x] 4.3 Update `WeaponShopPage.tsx` range band filter call site
    - Update the `getWeaponOptimalRange()` call in the filter logic to pass `weapon.rangeBand` instead of `weaponType`/`handsRequired`/`name`
    - _Requirements: 3.4_
  - [x] 4.4 Write property test for range band stored values (P7)
    - **Property P7: Range Band Stored** — For every weapon, the `rangeBand` field must be one of 'melee', 'short', 'mid', or 'long', and must match the weapon's grid slot assignment
    - **Validates: Requirements 3.4, 7.6**
  - [x] 4.5 Write unit tests for simplified `getWeaponOptimalRange()`
    - Test that the function returns `weapon.rangeBand` for all 47 weapons
    - Test all four range band values: melee, short, mid, long
    - _Requirements: 3.4_

- [x] 5. Dead code removal — recommendation pipeline
  - [x] 5.1 Delete dead recommendation files
    - DELETE `app/frontend/src/components/onboarding/WeaponRecommendationCard.tsx`
    - DELETE `app/backend/src/services/recommendationEngine.ts`
    - DELETE `app/backend/tests/recommendationEngine.test.ts`
    - _Requirements: 8.9_
  - [x] 5.2 Remove recommendation exports from `app/frontend/src/components/onboarding/index.ts`
    - Remove `WeaponRecommendationCard`, `STARTER_WEAPONS` export
    - Remove `WeaponRecommendation` type export
    - _Requirements: 8.9_
  - [x] 5.3 Remove recommendation route from `app/backend/src/routes/onboarding.ts`
    - Remove the `GET /api/onboarding/recommendations` route handler
    - Remove the `import { recommendationEngine } from '../services/recommendationEngine'` import
    - _Requirements: 8.9_
  - [x] 5.4 Remove recommendation code from frontend API client `app/frontend/src/utils/onboardingApi.ts`
    - Remove `getRecommendations()`, `getRecommendationsWithRetry()`, `clearRecommendationCache()`
    - Remove recommendation cache object and `buildRecommendationCacheKey()`
    - Remove exported types: `Recommendation`, `BudgetAllocation`, `RecommendationsResponse`
    - _Requirements: 8.9_
  - [x] 5.5 Remove recommendation test sections from test files
    - Remove recommendations test section from `app/backend/tests/onboardingApi.test.ts`
    - Remove recommendations endpoint mock from `app/frontend/src/components/onboarding/__tests__/performance.test.tsx`
    - _Requirements: 8.9_

- [x] 6. Checkpoint — Ensure dead code removal is clean
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Price tier alignment
  - [x] 7.1 Update `FilterPanel.tsx` price tier boundaries
    - Change `priceRanges` array to: Budget (<100K), Mid (100-250K), Premium (250-400K), Luxury (400K+)
    - Update labels: 'Mid (₡100-250K)', 'Premium (₡250-400K)', 'Luxury (₡400K+)'
    - _Requirements: 12.1_
  - [x] 7.2 Update `WeaponShopPage.tsx` onboarding price cap
    - Change onboarding filter `priceRange` from `{ min: 0, max: 300000 }` to `{ min: 0, max: 250000 }`
    - Update "under ₡300,000" text to "under ₡250,000" in the onboarding banner
    - _Requirements: 12.2, 12.3_
  - [x] 7.3 Update `Step7_WeaponPurchase.tsx` price references
    - Update any ₡300K references in guidance text to ₡250K
    - _Requirements: 12.3_
  - [x] 7.4 Update weapon shop filtering tests
    - Update `app/frontend/src/__tests__/weaponShopFiltering.test.ts` tier boundary assertions
    - Update `app/frontend/src/pages/__tests__/WeaponShopPage.onboarding.test.tsx` 300000 assertion to 250000
    - Update `app/frontend/tests/e2e/weapon-shop.spec.ts` if tier labels changed
    - _Requirements: 12.4, 12.6_

- [x] 8. Weapon stat validation property tests
  - [x] 8.1 Write property test for DPS range (P3)
    - **Property P3: DPS Range** — For every non-shield weapon, DPS (baseDamage/cooldown) must be between 1.5 and 6.0 inclusive. Starters (50K) are exempt
    - **Validates: Requirements 10.4**
  - [x] 8.2 Write property test for cooldown range (P4)
    - **Property P4: Cooldown Range** — For every non-shield weapon, cooldown must be between 2 and 7 seconds inclusive
    - **Validates: Requirements 10.3**
  - [x] 8.3 Write property test for attribute bonus range (P5)
    - **Property P5: Attribute Bonus Range** — For every weapon, each attribute bonus must be between -5 and +15 inclusive
    - **Validates: Requirements 10.5**
  - [x] 8.4 Write property test for hand multiplier consistency (P8)
    - **Property P8: Hand Multiplier Consistency** — For every weapon: one→1.0, two→1.6, shield→0.9
    - **Validates: Requirements 4.1**
  - [x] 8.5 Write property test for monotonic DPS within columns (P9)
    - **Property P9: Monotonic DPS Within Columns** — Within each Range × Hand Type column, the highest-DPS weapon in tier N must have DPS ≤ the lowest-DPS weapon in tier N+1
    - **Validates: Requirements 5.1, 5.3**
  - [x] 8.6 Write property test for shield invariants (P10)
    - **Property P10: Shield Invariants** — For every shield: baseDamage=0, cooldown=0, damageType='none', handsRequired='shield', loadoutType='weapon_shield'
    - **Validates: Requirements 6.3**
  - [x] 8.7 Write property test for damage type consistency (P11)
    - **Property P11: Damage Type Consistency** — For every non-shield weapon: damageType must match weaponType
    - **Validates: Requirements 7.5**
  - [x] 8.8 Write property test for loadout type consistency (P12)
    - **Property P12: Loadout Type Consistency** — one→'single', two→'two_handed', shield→'weapon_shield'
    - **Validates: Requirements 7.4**
  - [x] 8.9 Write property test for type diversity (P16)
    - **Property P16: Type Diversity** — For every column with 5+ weapons, no single weaponType may exceed 60%
    - **Validates: Requirements 6.1**

- [x] 9. Checkpoint — Ensure all property tests and implementation are solid
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Weapon image assets
  - [x] 10.1 Create 21 new `.webp` image files in `app/frontend/src/assets/weapons/`
    - Create placeholder images for: vibro-mace, war-club, shock-maul, thermal-lance, volt-sabre, scatter-cannon, pulse-accelerator, arc-projector, bolt-carbine, flux-repeater, disruptor-cannon, nova-caster, mortar-system, beam-pistol, photon-marksman, gauss-pistol, particle-lance, siege-cannon, barrier-shield, fortress-shield, aegis-bulwark
    - Use kebab-case naming convention matching weapon names
    - _Requirements: 9.1, 9.3_
  - [x] 10.2 Create 21 corresponding `.svg` source files in the same directory
    - One `.svg` per new weapon matching the `.webp` filenames
    - _Requirements: 9.2_

- [x] 11. Documentation updates
  - [x] 11.1 Update `docs/prd_core/SEED_DATA_SPECIFICATION.md`
    - Update weapon count from 26 to 47
    - Add entries for all 21 new weapons
    - Update entries for Laser Rifle and Assault Rifle reclassifications
    - Update "Weapon Summary by Loadout Type" section with new counts: 1H 22, 2H 19, Shield 6
    - Add version history entry v1.5 documenting the roster expansion
    - _Requirements: 8.1_
  - [x] 11.2 Update `docs/prd_core/PRD_WEAPONS_LOADOUT.md`
    - Update category counts, DPS rankings per range band, and price tier distribution tables
    - _Requirements: 8.2_
  - [x] 11.3 Update `docs/balance_changes/PRD_WEAPON_ECONOMY_OVERHAUL.md`
    - Update "Revised Weapon Catalog" section, "Final Weapon Catalog Summary" section, weapon count references
    - Update tier definitions to match authoritative boundaries: Budget <100K, Mid 100-250K, Premium 250-400K, Luxury 400K+
    - _Requirements: 8.3, 12.5_
  - [x] 11.4 Update `docs/prd_pages/PRD_WEAPON_SHOP.md`
    - Update weapon counts in filtering logic, category counts, and test coverage sections
    - _Requirements: 8.4_
  - [x] 11.5 Update `docs/PLAYER_ARCHETYPES_GUIDE.md`
    - Update "26 weapons" reference to "47 weapons"
    - Update "Appendix B: Complete Weapon Catalog" with all new and reclassified weapons
    - _Requirements: 8.5_
  - [x] 11.6 Update in-game guide files
    - Update `app/backend/src/content/guide/weapons/loadout-types.md`: 1H 15→22, 2H 8→19, Shield 3→6
    - Update `app/backend/src/content/guide/combat/movement-and-positioning.md`: add new weapon examples per range band
    - _Requirements: 8.6, 8.7_
  - [x] 11.7 Update `docs/prd_core/PRD_ONBOARDING_SYSTEM.md`
    - Update weapon type counts in Step 6: Energy 6→13, Ballistic 10→17, Melee 7→11, Shield 3→6
    - Update recommended weapon tables in Step 7 to include representative new weapons
    - _Requirements: 8.8_
  - [x] 11.8 Scan for stale weapon count references
    - Search all docs for hardcoded "26 weapons" or "23 weapons" references and update to 47
    - _Requirements: 8.10_

- [x] 12. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Property tests use fast-check with `fc.constantFrom(...WEAPON_DEFINITIONS)` to sample from the full 47-weapon catalog
- Each property test task maps to a specific correctness property (P1-P16) from the design document
- The `getWeaponImagePath()` utility uses dynamic glob import of `*.webp` files, so no code changes are needed for image resolution
- Checkpoints ensure incremental validation after each major phase
