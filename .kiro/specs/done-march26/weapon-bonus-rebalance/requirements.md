# Requirements Document

## Introduction

Eight of the 23 seeded weapons in Armoured Souls have attribute bonuses referencing attributes with no combat formula implementation (hydraulicSystems, servoMotors). These "dead" bonuses waste bonus points that provide zero gameplay value. Additionally, the Ion Beam (a 2H offensive energy weapon) gives +8 shieldCapacity — a major flavour mismatch — and the Power Sword allocates only 3 of 19 bonus points to combatPower despite being the highest-DPS one-handed melee weapon.

This feature swaps each dead or mismatched bonus 1:1 to a live attribute at the exact same magnitude, preserving weapon prices. This is a DATA-ONLY rebalance — no combat formula changes, no schema changes, no new weapons.

## Glossary

- **Seed_Data**: The WEAPON_DEFINITIONS array in `app/backend/prisma/seed.ts` and corresponding documentation that defines all 23 weapons
- **Dead_Attribute**: A robot attribute that has no implementation in `combatSimulator.ts` and therefore provides zero combat value (hydraulicSystems, servoMotors, combatAlgorithms, threatAnalysis, adaptiveAI, logicCores, syncProtocols, supportSystems, formationTactics)
- **Live_Attribute**: A robot attribute that is referenced by at least one combat formula in `combatSimulator.ts` (combatPower, targetingSystems, criticalSystems, penetration, weaponControl, attackSpeed, armorPlating, shieldCapacity, evasionThrusters, damageDampeners, counterProtocols, hullIntegrity, gyroStabilizers, powerCore)
- **Pricing_Formula**: `Total Cost = (Base Cost + Attribute Cost + DPS Cost) × Hand Multiplier` where `Attribute Cost = Σ(500 × bonus²)` for all bonuses
- **Flavour_Mismatch**: A weapon bonus that contradicts the weapon's intended combat role (e.g., a 2H offensive weapon giving a large defensive bonus)
- **Weapon_Catalog_Docs**: The weapon specifications in `docs/prd_core/SEED_DATA_SPECIFICATION.md` and `docs/prd_core/PRD_WEAPONS_LOADOUT.md`

## Requirements

### Requirement 1: Energy Blade Bonus Swap

**User Story:** As a game designer, I want the Energy Blade's dead hydraulicSystems bonus replaced with a combat-effective attribute, so that the weapon's bonus points contribute to actual gameplay.

| Remove | Add | Magnitude |
|--------|-----|-----------|
| hydraulicSystemsBonus +4 | combatPowerBonus +4 | +4 |

**Final bonuses:** attackSpeed +5, combatPower +4, weaponControl +3

#### Acceptance Criteria

1. THE Energy Blade SHALL have zero hydraulicSystemsBonus
2. THE Energy Blade SHALL have combatPowerBonus of +4
3. THE Energy Blade SHALL retain attackSpeedBonus +5 and weaponControlBonus +3 unchanged
4. THE Energy Blade cost SHALL remain ₡238,000

### Requirement 2: Plasma Blade Bonus Swap

**User Story:** As a game designer, I want the Plasma Blade's dead hydraulicSystems bonus replaced with a combat-effective attribute, so that the weapon's bonus points contribute to actual gameplay.

| Remove | Add | Magnitude |
|--------|-----|-----------|
| hydraulicSystemsBonus +5 | combatPowerBonus +5 | +5 |

**Final bonuses:** combatPower +5, attackSpeed +4, criticalSystems +3, gyroStabilizers +2

#### Acceptance Criteria

1. THE Plasma Blade SHALL have zero hydraulicSystemsBonus
2. THE Plasma Blade SHALL have combatPowerBonus of +5
3. THE Plasma Blade SHALL retain attackSpeedBonus +4, criticalSystemsBonus +3, and gyroStabilizersBonus +2 unchanged
4. THE Plasma Blade cost SHALL remain ₡269,000

### Requirement 3: Power Sword Bonus Swap

**User Story:** As a game designer, I want the Power Sword's dead and mismatched bonuses replaced with offensive attributes, so that the highest-DPS one-handed weapon performs as a premium offensive melee weapon.

| Remove | Add | Magnitude |
|--------|-----|-----------|
| hydraulicSystemsBonus +7 | penetrationBonus +7 | +7 |
| counterProtocolsBonus +5 | criticalSystemsBonus +5 | +5 |
| gyroStabilizersBonus +4 | weaponControlBonus +4 | +4 |

**Final bonuses:** penetration +7, criticalSystems +5, weaponControl +4, combatPower +3

#### Acceptance Criteria

1. THE Power Sword SHALL have zero hydraulicSystemsBonus, zero counterProtocolsBonus, and zero gyroStabilizersBonus
2. THE Power Sword SHALL have penetrationBonus +7, criticalSystemsBonus +5, and weaponControlBonus +4
3. THE Power Sword SHALL retain combatPowerBonus +3 unchanged
4. THE Power Sword cost SHALL remain ₡350,000
5. THE Power Sword SHALL allocate 100% of its positive bonus points to offensive Live_Attributes

### Requirement 4: Battle Axe Bonus Swap

**User Story:** As a game designer, I want the Battle Axe's dead bonuses replaced with combat-effective attributes, so that the weapon's bonus points and penalties contribute to actual gameplay.

| Remove | Add | Magnitude |
|--------|-----|-----------|
| hydraulicSystemsBonus +6 | penetrationBonus +6 | +6 |
| servoMotorsBonus -2 | attackSpeedBonus -2 | -2 |

**Final bonuses:** penetration +6, combatPower +4, criticalSystems +3, attackSpeed -2

#### Acceptance Criteria

1. THE Battle Axe SHALL have zero hydraulicSystemsBonus and zero servoMotorsBonus
2. THE Battle Axe SHALL have penetrationBonus +6 and attackSpeedBonus -2
3. THE Battle Axe SHALL retain combatPowerBonus +4 and criticalSystemsBonus +3 unchanged
4. THE Battle Axe cost SHALL remain ₡388,000

### Requirement 5: Heavy Hammer Bonus Swap

**User Story:** As a game designer, I want the Heavy Hammer's dead bonuses replaced with combat-effective attributes, so that the weapon's bonus points and penalties contribute to actual gameplay.

| Remove | Add | Magnitude |
|--------|-----|-----------|
| hydraulicSystemsBonus +8 | penetrationBonus +8 | +8 |
| servoMotorsBonus -3 | attackSpeedBonus -3 | -3 |

**Final bonuses:** penetration +8, combatPower +7, criticalSystems +4, attackSpeed -3

#### Acceptance Criteria

1. THE Heavy Hammer SHALL have zero hydraulicSystemsBonus and zero servoMotorsBonus
2. THE Heavy Hammer SHALL have penetrationBonus +8 and attackSpeedBonus -3
3. THE Heavy Hammer SHALL retain combatPowerBonus +7 and criticalSystemsBonus +4 unchanged
4. THE Heavy Hammer cost SHALL remain ₡450,000

### Requirement 6: Reactive Shield Bonus Swap

**User Story:** As a game designer, I want the Reactive Shield's dead penalty replaced with a real penalty on a live attribute, so that the trade-off is meaningful in combat.

| Remove | Add | Magnitude |
|--------|-----|-----------|
| servoMotorsBonus -2 | evasionThrustersBonus -2 | -2 |

**Final bonuses:** shieldCapacity +7, counterProtocols +6, powerCore +4, evasionThrusters -2

#### Acceptance Criteria

1. THE Reactive Shield SHALL have zero servoMotorsBonus
2. THE Reactive Shield SHALL have evasionThrustersBonus -2
3. THE Reactive Shield SHALL retain shieldCapacityBonus +7, counterProtocolsBonus +6, and powerCoreBonus +4 unchanged
4. THE Reactive Shield cost SHALL remain ₡113,000

### Requirement 7: Ion Beam Bonus Swap

**User Story:** As a game designer, I want the Ion Beam's defensive shieldCapacity bonus replaced with an offensive attribute, so that the highest-DPS two-handed energy weapon has bonuses matching its offensive role.

| Remove | Add | Magnitude |
|--------|-----|-----------|
| shieldCapacityBonus +8 | combatPowerBonus +8 | +8 |

**Final bonuses:** penetration +10, combatPower +8, attackSpeed +5, targetingSystems +4

#### Acceptance Criteria

1. THE Ion Beam SHALL have zero shieldCapacityBonus
2. THE Ion Beam SHALL have combatPowerBonus +8
3. THE Ion Beam SHALL retain penetrationBonus +10, attackSpeedBonus +5, and targetingSystemsBonus +4 unchanged
4. THE Ion Beam cost SHALL remain ₡538,000

### Requirement 8: Weapon Prices Remain Unchanged

**User Story:** As a game designer, I want weapon prices to remain unchanged after the rebalance, so that players who already purchased weapons are not disadvantaged or refunded.

#### Acceptance Criteria

1. THE cost field for every weapon in the Seed_Data SHALL be identical before and after the rebalance
2. THE Pricing_Formula Attribute Cost component SHALL produce the same value before and after each swap because bonus magnitudes are preserved exactly
3. THE prices of unmodified weapons SHALL remain unchanged

### Requirement 9: No Remaining Dead Attribute Bonuses

**User Story:** As a game designer, I want to ensure no weapon in the catalog references a dead attribute, so that every bonus point in the game has combat value.

#### Acceptance Criteria

1. THE Seed_Data SHALL contain no weapon with a non-zero bonus on hydraulicSystems, servoMotors, combatAlgorithms, threatAnalysis, adaptiveAI, logicCores, syncProtocols, supportSystems, or formationTactics
2. Every bonus field on every weapon in the Seed_Data SHALL reference only Live_Attributes

### Requirement 10: Update Seed Data File

**User Story:** As a developer, I want the WEAPON_DEFINITIONS array in seed.ts updated with the new bonuses, so that the database is seeded with the rebalanced weapon data.

#### Acceptance Criteria

1. THE WEAPON_DEFINITIONS array in `app/backend/prisma/seed.ts` SHALL reflect the new bonus values for all 7 modified weapons
2. THE seed file SHALL not modify baseDamage, cooldown, weaponType, handsRequired, damageType, loadoutType, cost, or description fields for any weapon
3. THE seed file SHALL not add or remove any weapon entries from the WEAPON_DEFINITIONS array
4. THE seed.ts file SHALL compile without TypeScript errors after the changes

### Requirement 11: Update Weapon Catalog Documentation

**User Story:** As a developer, I want the weapon catalog documentation updated to match the new seed data, so that documentation remains the authoritative reference for weapon specifications.

#### Acceptance Criteria

1. THE weapon entries in `docs/prd_core/SEED_DATA_SPECIFICATION.md` SHALL be updated to reflect the new bonus values for all 7 modified weapons
2. THE weapon entries in `docs/prd_core/PRD_WEAPONS_LOADOUT.md` SHALL be updated to reflect the new bonus values where individual weapon bonuses are listed
3. THE documentation SHALL not modify any weapon entries that were not changed in the rebalance

### Requirement 12: Prisma Migration for Acceptance and Production Environments

**User Story:** As a developer, I want a Prisma SQL migration that updates the 7 modified weapons in existing databases, so that acceptance and production environments receive the rebalanced bonuses automatically via the CI/CD pipeline's `prisma migrate deploy` step without requiring a full re-seed.

#### Acceptance Criteria

1. THE migration SHALL be a Prisma migration containing SQL UPDATE statements for the 7 modified weapons (Energy Blade, Plasma Blade, Power Sword, Battle Axe, Heavy Hammer, Reactive Shield, Ion Beam)
2. EACH UPDATE statement SHALL match the weapon by name and update only the bonus columns that changed (removing old dead/mismatched bonus columns, setting new live bonus columns)
3. THE migration SHALL not modify baseDamage, cooldown, cost, weaponType, handsRequired, damageType, loadoutType, or description columns
4. THE migration SHALL not modify any weapons other than the 7 listed
5. THE migration SHALL be idempotent — running it on a database that already has the new values SHALL produce no errors or changes
6. THE migration SHALL run automatically on acc/prod via the existing `prisma migrate deploy` step in the CI/CD pipeline

### Requirement 13: Validate No Unintended Side Effects

**User Story:** As a game designer, I want to verify that the rebalance does not break existing game systems, so that the change is safe to deploy.

#### Acceptance Criteria

1. THE rebalance SHALL not modify any file outside of `app/backend/prisma/seed.ts`, `docs/prd_core/SEED_DATA_SPECIFICATION.md`, `docs/prd_core/PRD_WEAPONS_LOADOUT.md`, and the new Prisma migration file
2. THE rebalance SHALL not change the total number of weapons (23)
3. THE rebalance SHALL not modify the 16 weapons that have no dead bonuses and no flavour mismatches
4. THE rebalance SHALL not modify combatSimulator.ts or any other backend source code
