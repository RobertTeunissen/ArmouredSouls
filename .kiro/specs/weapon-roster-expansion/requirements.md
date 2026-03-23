# Requirements Document

## Introduction

The Armoured Souls weapon catalog currently contains 26 weapons distributed across a 36-slot grid defined by Range (Melee, Short, Mid, Long) × Hand Type (1H, 2H) × Price Tier (Budget, Mid, Premium, Luxury), plus 4 Shield tiers. Of these 36 slots, 22 are empty — creating gaps that limit strategic diversity and player choice. Three entire categories (2H Short, 1H Mid, and 1H Long) have zero weapons.

This feature fills those 22 gaps through a combination of reclassifying existing weapons to better-fitting categories and designing new weapons for remaining empty slots. Every new or moved weapon must conform to the established pricing formula, range band rules, and attribute bonus conventions. The result is a complete, balanced weapon grid that has at least one weapon in every slot across all loadout types and price tiers.

## Glossary

- **Grid**: The 36-slot matrix of Range × Hand Type × Price Tier (plus 4 Shield tiers) that defines the weapon roster structure
- **Roster_Planner**: The system responsible for analyzing the grid, identifying gaps, proposing weapon moves and new weapon designs, and validating that all slots are filled
- **Pricing_Engine**: The subsystem that calculates weapon cost using the formula: `Total Cost = (Base Cost + Attribute Cost + DPS Cost) × Hand Multiplier`
- **Seed_Data_Manager**: The component that manages the weapon catalog in the database seed file (`prototype/backend/prisma/seed.ts`) and the specification document (`docs/prd_core/SEED_DATA_SPECIFICATION.md`)
- **Weapon_Validator**: The subsystem that verifies weapon stat integrity — ensuring DPS, cost, range assignment, and attribute bonuses are internally consistent
- **Range_Band**: One of four distance classifications: Melee (0–2 units), Short (3–6 units), Mid (7–12 units), Long (13+ units)
- **Price_Tier**: One of four cost brackets: Budget (<₡100K), Mid (₡100–250K), Premium (₡250–400K), Luxury (₡400K+)
- **Hand_Type**: Either one-handed (1H, multiplier 1.0×), two-handed (2H, multiplier 1.6×), or shield (multiplier 0.9×)
- **DPS_Ratio**: A weapon's damage per second divided by the baseline DPS of 2.0
- **Attribute_Cost**: The sum of ₡500 × bonus² for each attribute bonus on a weapon
- **Weapon_Move**: Reclassifying an existing weapon to a different grid slot by changing its hand type, range assignment, or price tier (with corresponding stat adjustments)
- **Balance_Curve**: The expected smooth progression of DPS and total attribute bonuses within a single Range × Hand Type column across price tiers

## Requirements

### Requirement 1: Grid Gap Analysis

**User Story:** As a game designer, I want the Roster_Planner to identify all empty slots in the 36-slot weapon grid, so that I have a clear map of which weapons need to be created or moved.

#### Acceptance Criteria

1. THE Roster_Planner SHALL identify all 36 grid slots defined by the combination of 4 ranges × 2 hand types × 4 price tiers, plus 4 shield tiers
2. WHEN the Roster_Planner analyzes the current 26-weapon catalog, THE Roster_Planner SHALL classify each weapon into exactly one grid slot based on its range, hand type, and cost
3. THE Roster_Planner SHALL report exactly 22 empty slots from the current catalog: 1H Melee Luxury, 2H Melee Budget, 2H Melee Mid, 2H Melee Premium, 1H Short Luxury, 2H Short Budget, 2H Short Mid, 2H Short Premium, 2H Short Luxury, 1H Mid Budget, 1H Mid Mid, 1H Mid Premium, 1H Mid Luxury, 2H Mid Mid, 1H Long Budget, 1H Long Mid, 1H Long Premium, 1H Long Luxury, 2H Long Mid, Shield Mid, Shield Premium, and Shield Luxury
4. IF a weapon's cost falls on the boundary between two price tiers, THEN THE Roster_Planner SHALL assign the weapon to the tier where it provides better grid coverage

### Requirement 2: Weapon Reclassification Plan

**User Story:** As a game designer, I want the Roster_Planner to propose moving existing weapons to new grid slots where they are a better fit, so that overcrowded categories are thinned and empty categories gain coverage without creating entirely new weapons.

#### Acceptance Criteria

1. THE Roster_Planner SHALL evaluate each overcrowded grid slot (slots containing 2 or more weapons) for candidates that could be reclassified to an empty slot
2. WHEN the Roster_Planner proposes a weapon move, THE Roster_Planner SHALL specify the original grid slot, the target grid slot, and all stat changes required (hand type, base damage, cooldown, attribute bonuses, cost)
3. WHEN the Laser Rifle is reclassified from 1H Short Mid to 2H Short Mid, THE Pricing_Engine SHALL recalculate its cost using the two-handed multiplier (1.6×) and adjusted stats
4. WHEN the Assault Rifle is upgraded from 1H Short Mid to 1H Short Premium, THE Pricing_Engine SHALL recalculate its cost to fall within the ₡250K–₡400K range with increased base damage and attribute bonuses
5. THE Roster_Planner SHALL verify that each weapon move does not create a new gap in the source grid slot (the source slot must retain at least one weapon or be intentionally vacated because another weapon fills it)
6. WHEN the Battle Axe (₡402K) is reclassified from 2H Melee Premium to 2H Melee Luxury, THE Roster_Planner SHALL confirm the reclassification is valid because the weapon's cost already exceeds the Luxury threshold of ₡400K

### Requirement 3: New Weapon Design for Remaining Gaps

**User Story:** As a game designer, I want new weapons designed for each grid slot that remains empty after reclassification, so that every slot in the 36-weapon grid is filled.

#### Acceptance Criteria

1. THE Roster_Planner SHALL design a new weapon for each grid slot that remains empty after all weapon moves are applied
2. THE Roster_Planner SHALL assign each new weapon a unique name that fits the sci-fi robot combat setting
3. THE Roster_Planner SHALL specify for each new weapon: name, weapon type (energy, ballistic, melee, or shield), hand type, base damage, cooldown, cost, all attribute bonuses, and a description
4. THE Roster_Planner SHALL assign each new weapon a `rangeBand` value (melee, short, mid, or long) consistent with its grid slot, stored directly on the weapon record in the database
5. WHEN designing a new one-handed weapon, THE Roster_Planner SHALL ensure the weapon is compatible with Single, Weapon+Shield, and Dual-Wield loadout types
6. WHEN designing a new two-handed weapon, THE Roster_Planner SHALL ensure the weapon is compatible only with the Two-Handed loadout type

### Requirement 4: Pricing Formula Compliance

**User Story:** As a game designer, I want every new or reclassified weapon to have its cost calculated using the established pricing formula, so that the weapon economy remains fair and consistent.

#### Acceptance Criteria

1. THE Pricing_Engine SHALL calculate each weapon's cost using: `Total Cost = (Base Cost + Attribute Cost + DPS Cost) × Hand Multiplier` where Base Cost = ₡50,000, Attribute Cost = Σ(500 × bonus²), DPS Cost = ₡50,000 × (DPS Ratio - 1.0) × 3.0, DPS Ratio = (baseDamage / cooldown) / 2.0, and Hand Multiplier = 1.0 (1H), 1.6 (2H), or 0.9 (shield)
2. THE Pricing_Engine SHALL round the final cost to the nearest ₡1,000
3. THE Pricing_Engine SHALL produce a cost that falls within the target price tier for each weapon's assigned grid slot
4. IF the formula-calculated cost does not fall within the target price tier, THEN THE Roster_Planner SHALL adjust the weapon's base damage, cooldown, or attribute bonuses until the cost aligns with the target tier
5. THE Pricing_Engine SHALL include a full pricing breakdown (Base Cost, Attribute Cost, DPS Cost, Hand Multiplier, Total) for each new or reclassified weapon

### Requirement 5: Balance Curve Integrity

**User Story:** As a game designer, I want each Range × Hand Type column to have a smooth progression of power across price tiers, so that upgrading to a more expensive weapon always feels like a meaningful improvement.

#### Acceptance Criteria

1. WITHIN each Range × Hand Type combination, THE Roster_Planner SHALL ensure that DPS increases monotonically from Budget to Luxury tier
2. WITHIN each Range × Hand Type combination, THE Roster_Planner SHALL ensure that total attribute bonus points (sum of absolute values of all bonuses) increase from Budget to Luxury tier
3. THE Roster_Planner SHALL ensure that no weapon in a lower price tier has higher DPS than a weapon in a higher price tier within the same Range × Hand Type column
4. THE Roster_Planner SHALL ensure that the DPS gap between adjacent tiers within a column does not exceed 1.5 DPS to prevent power spikes
5. WHEN a two-handed melee weapon is designed, THE Roster_Planner SHALL assign it the Melee optimal range (0–2 units) regardless of its two-handed classification

### Requirement 6: Weapon Type Diversity

**User Story:** As a game designer, I want the expanded roster to maintain a balanced mix of energy, ballistic, and melee weapon types, so that no single damage type dominates any range or tier.

#### Acceptance Criteria

1. THE Roster_Planner SHALL distribute weapon types (energy, ballistic, melee) across the grid so that no single weapon type occupies more than 60% of filled slots within any Range × Hand Type column
2. THE Roster_Planner SHALL ensure that each Range × Hand Type column with 3 or more weapons contains at least 2 different weapon types
3. WHEN designing new shield weapons, THE Roster_Planner SHALL assign the shield weapon type and use the 0.9× hand multiplier with zero base damage
4. THE Roster_Planner SHALL ensure that new shield weapons provide progressively stronger defensive attribute bonuses (Armor Plating, Shield Capacity, Counter Protocols) from Mid to Luxury tier

### Requirement 7: Seed Data Update

**User Story:** As a developer, I want the complete weapon definitions for all new and reclassified weapons provided in a format compatible with the seed data file, so that I can update the database without manual translation.

#### Acceptance Criteria

1. THE Seed_Data_Manager SHALL produce a weapon definition for each new weapon containing all fields required by the seed data schema: name, weaponType, baseDamage, cooldown, cost, handsRequired, damageType, loadoutType, rangeBand, specialProperty, description, and all applicable attribute bonus fields
2. THE Seed_Data_Manager SHALL produce updated weapon definitions for each reclassified weapon with all changed fields clearly identified
3. THE Seed_Data_Manager SHALL ensure that the handsRequired field is set to "one" for one-handed weapons, "two" for two-handed weapons, and "shield" for shield weapons
4. THE Seed_Data_Manager SHALL ensure that the loadoutType field is set to "single" for one-handed weapons and "two_handed" for two-handed weapons
5. THE Seed_Data_Manager SHALL ensure that the damageType field matches the weaponType for non-shield weapons (melee → melee, ballistic → ballistic, energy → energy) and is set to "none" for shields

6. THE Seed_Data_Manager SHALL ensure that the rangeBand field is set to the weapon's assigned range band: 'melee' for melee weapons and shields, 'short'/'mid'/'long' for ranged weapons as defined in the design document's range assignment table

### Requirement 8: Documentation Update

**User Story:** As a developer, I want all documentation that references weapon counts, catalogs, or weapon-related data updated to reflect the expanded roster, so that every document in the project remains accurate and consistent.

#### Acceptance Criteria

1. THE Seed_Data_Manager SHALL update SEED_DATA_SPECIFICATION.md: weapon count from 26 to the new total, add entries for each new weapon, update entries for each reclassified weapon, update the "Weapon Summary by Loadout Type" section, and add a version history entry (v1.5) documenting the roster expansion
2. THE Seed_Data_Manager SHALL update PRD_WEAPONS_LOADOUT.md: weapon counts per category, loadout coverage counts, DPS rankings per range band, and price tier distribution tables
3. THE Seed_Data_Manager SHALL update PRD_WEAPON_ECONOMY_OVERHAUL.md: the "Revised Weapon Catalog" section, the "Final Weapon Catalog Summary" section, and any weapon count references
4. THE Seed_Data_Manager SHALL update PRD_WEAPON_SHOP.md: weapon counts referenced in filtering logic, category counts, and test coverage sections
5. THE Seed_Data_Manager SHALL update PLAYER_ARCHETYPES_GUIDE.md: the "26 weapons" reference to the new total, and the "Appendix B: Complete Weapon Catalog" listing to include all new and reclassified weapons
6. THE Seed_Data_Manager SHALL update the in-game guide file loadout-types.md: the weapon compatibility table counts ("One-handed weapons (15)", "Two-handed weapons (8)", "Shield weapons (3)") to reflect the new totals per hand type
7. THE Seed_Data_Manager SHALL update the in-game guide file movement-and-positioning.md: weapon examples listed per range band to include representative new weapons
8. THE Seed_Data_Manager SHALL update PRD_ONBOARDING_SYSTEM.md: the weapon category count table in Step 6 ("Energy: 7 weapons", "Ballistic: 10 weapons", "Melee: 7 weapons", "Shield: 3 weapons") to reflect the new totals per weapon type, and the recommended weapon tables in Step 7 (Budget, Mid, and Premium tiers) to include representative new weapons where appropriate
9. THE Seed_Data_Manager SHALL remove the dead recommendation pipeline: delete `WeaponRecommendationCard.tsx` and `recommendationEngine.ts` (and its tests), remove the `GET /api/onboarding/recommendations` route from `onboarding.ts`, remove `getRecommendations()` and `getRecommendationsWithRetry()` from the frontend API client, remove recommendation-related exports from the onboarding barrel, and remove recommendation endpoint mocks from performance tests
10. THE Seed_Data_Manager SHALL verify that no other documentation file references a hardcoded weapon count of 26 (or earlier counts like 23) and update any found

### Requirement 9: Weapon Image Assets

**User Story:** As a player, I want every weapon in the shop to have a visual image, so that I can identify weapons at a glance and the shop feels polished rather than showing placeholder icons.

#### Acceptance Criteria

1. THE Seed_Data_Manager SHALL create a `.webp` image file for each new weapon in `prototype/frontend/src/assets/weapons/` using the kebab-case naming convention (e.g., `plasma-lance.webp`)
2. THE Seed_Data_Manager SHALL create a corresponding `.svg` source file for each new weapon in the same directory
3. THE Seed_Data_Manager SHALL ensure each image follows the existing visual style: weapon illustration on a transparent or dark background, suitable for display at 48×48 to 192×192 pixels
4. THE Seed_Data_Manager SHALL verify that the `getWeaponImagePath()` utility in `weaponImages.ts` correctly resolves each new weapon name to its image file without code changes (the utility uses dynamic glob import of `*.webp` files)
5. THE Seed_Data_Manager SHALL NOT need to modify the weapon shop frontend code, as it loads weapon data from the API and resolves images dynamically by weapon name

### Requirement 10: Weapon Stat Validation

**User Story:** As a game designer, I want every weapon in the expanded roster validated for internal consistency, so that no weapon has contradictory or impossible stats.

#### Acceptance Criteria

1. THE Weapon_Validator SHALL verify that every weapon's cost matches the pricing formula output within a ₡5,000 tolerance
2. THE Weapon_Validator SHALL verify that no weapon has a base damage of 0 unless it is a shield
3. THE Weapon_Validator SHALL verify that every weapon's cooldown is between 2 and 7 seconds (inclusive)
4. THE Weapon_Validator SHALL verify that every weapon's DPS falls between 1.5 and 6.0 (inclusive)
5. THE Weapon_Validator SHALL verify that no attribute bonus exceeds +15 or falls below -5
6. IF the Weapon_Validator detects a validation failure, THEN THE Weapon_Validator SHALL report the weapon name, the failing field, the expected range, and the actual value

### Requirement 11: Existing Weapon Preservation

**User Story:** As a game designer, I want weapons that are not being reclassified to remain unchanged, so that existing player inventories and archetype builds are not disrupted.

#### Acceptance Criteria

1. THE Seed_Data_Manager SHALL preserve the exact stats (base damage, cooldown, cost, attribute bonuses) of every weapon that is not explicitly listed as a reclassification target
2. THE Seed_Data_Manager SHALL preserve all 4 starter/practice weapons (Practice Sword, Practice Blaster, Training Rifle, Training Beam) at ₡50,000 with zero bonuses
3. IF a weapon is reclassified, THEN THE Seed_Data_Manager SHALL document the before and after stats in a change log within the requirements
4. THE Seed_Data_Manager SHALL verify that all 10 player archetype test users in the seed data remain functional after the roster expansion (their equipped weapons must still exist with valid stats)

### Requirement 12: Price Tier Alignment

**User Story:** As a player, I want the weapon shop's price tier filters to match the actual tier boundaries used in weapon design, so that filtering by "Premium" shows weapons that are genuinely in the Premium price range.

#### Acceptance Criteria

1. THE Seed_Data_Manager SHALL update the `FilterPanel.tsx` price tier boundaries to: Budget (< 100,000), Mid (100,000-249,999), Premium (250,000-399,999), Luxury (400,000+)
2. THE Seed_Data_Manager SHALL update the weapon shop onboarding price filter cap from 300,000 to 250,000 to align with the new Mid tier upper boundary
3. THE Seed_Data_Manager SHALL update all onboarding text references to the "300,000" weapon price threshold to reflect the new tier boundary of 250,000
4. THE Seed_Data_Manager SHALL update the weapon shop filtering tests to assert the new tier boundaries
5. THE Seed_Data_Manager SHALL update PRD_WEAPON_ECONOMY_OVERHAUL.md tier definitions to match the authoritative boundaries
6. THE Seed_Data_Manager SHALL verify that the e2e weapon shop tests pass with the updated tier labels
