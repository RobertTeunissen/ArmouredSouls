# Implementation Plan: Weapon Bonus Rebalance

## Overview

Data-only rebalance swapping dead/mismatched attribute bonuses on 7 weapons to live combat attributes. Each task modifies only data — no combat formulas, schema changes, or new weapons. Implementation order: seed data → tests → migration → documentation.

## Tasks

- [x] 1. Update WEAPON_DEFINITIONS in seed.ts
  - [x] 1.1 Swap Energy Blade bonuses: remove `hydraulicSystemsBonus: 4`, add `combatPowerBonus: 4`. Final: attackSpeed +5, combatPower +4, weaponControl +3
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 10.1_
  - [x] 1.2 Swap Plasma Blade bonuses: remove `hydraulicSystemsBonus: 5`, add `combatPowerBonus: 5`. Final: combatPower +5, attackSpeed +4, criticalSystems +3, gyroStabilizers +2
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 10.1_
  - [x] 1.3 Swap Power Sword bonuses: remove `hydraulicSystemsBonus: 7`, `counterProtocolsBonus: 5`, `gyroStabilizersBonus: 4`; add `penetrationBonus: 7`, `criticalSystemsBonus: 5`, `weaponControlBonus: 4`. Retain combatPower +3
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 10.1_
  - [x] 1.4 Swap Battle Axe bonuses: remove `hydraulicSystemsBonus: 6`, `servoMotorsBonus: -2`; add `penetrationBonus: 6`, `attackSpeedBonus: -2`. Retain combatPower +4, criticalSystems +3
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 10.1_
  - [x] 1.5 Swap Heavy Hammer bonuses: remove `hydraulicSystemsBonus: 8`, `servoMotorsBonus: -3`; add `penetrationBonus: 8`, `attackSpeedBonus: -3`. Retain combatPower +7, criticalSystems +4
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 10.1_
  - [x] 1.6 Swap Reactive Shield bonuses: remove `servoMotorsBonus: -2`; add `evasionThrustersBonus: -2`. Retain shieldCapacity +7, counterProtocols +6, powerCore +4
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 10.1_
  - [x] 1.7 Swap Ion Beam bonuses: remove `shieldCapacityBonus: 8`; add `combatPowerBonus: 8`. Retain penetration +10, attackSpeed +5, targetingSystems +4
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 10.1_
  - [x] 1.8 Verify seed.ts compiles without TypeScript errors
    - Do not modify baseDamage, cooldown, weaponType, handsRequired, damageType, loadoutType, cost, description, or specialProperty on any weapon
    - Do not add or remove weapon entries — array must remain 23 weapons
    - _Requirements: 10.2, 10.3, 10.4_

- [x] 2. Write property-based and unit tests
  - [x] 2.1 Create test file `app/backend/src/__tests__/weapon-bonus-rebalance.test.ts` with imports
    - Import `WEAPON_DEFINITIONS` from `../../../prisma/seed.ts`
    - Import `fc` from `fast-check`
    - Define helper constants: list of 9 dead attribute bonus field names, list of 7 modified weapon names, pre-rebalance snapshot lookup (Σ(bonus²), cost, non-bonus fields, and full field snapshots for unmodified weapons)
    - _Requirements: 9.1, 9.2, 8.1, 8.2, 8.3, 10.2, 13.2, 13.3_
  - [x] 2.2 Write property test: No Dead Attribute Bonuses
    - **Property 1: No Dead Attribute Bonuses**
    - Use `fc.constantFrom(...WEAPON_DEFINITIONS)` to sample weapons, assert all 9 dead bonus fields are 0 or undefined for every weapon
    - Minimum 100 iterations
    - **Validates: Requirements 9.1, 9.2**
  - [x] 2.3 Write property test: Bonus Magnitudes Preserved and Prices Unchanged
    - **Property 2: Bonus Magnitudes Preserved and Prices Unchanged**
    - For each weapon, compute Σ(bonus²) from all 23 bonus fields and assert it equals the pre-rebalance expected value; assert cost matches
    - Minimum 100 iterations
    - **Validates: Requirements 8.1, 8.2, 8.3**
  - [x] 2.4 Write property test: Non-Bonus Fields Unchanged
    - **Property 3: Non-Bonus Fields Unchanged**
    - For each weapon, assert name, baseDamage, cooldown, weaponType, handsRequired, damageType, loadoutType, cost, specialProperty, and description match pre-rebalance values
    - Minimum 100 iterations
    - **Validates: Requirements 10.2, 13.2**
  - [x] 2.5 Write property test: Unmodified Weapons Fully Unchanged
    - **Property 4: Unmodified Weapons Fully Unchanged**
    - For each of the 16 unmodified weapons, assert ALL fields (including all bonus fields) match pre-rebalance snapshot
    - Minimum 100 iterations
    - **Validates: Requirements 13.3**
  - [x] 2.6 Write unit tests for each modified weapon's specific bonus values
    - Test Energy Blade: combatPowerBonus === 4, hydraulicSystemsBonus === 0, attackSpeedBonus === 5, weaponControlBonus === 3
    - Test Plasma Blade: combatPowerBonus === 5, hydraulicSystemsBonus === 0, attackSpeedBonus === 4, criticalSystemsBonus === 3, gyroStabilizersBonus === 2
    - Test Power Sword: penetrationBonus === 7, criticalSystemsBonus === 5, weaponControlBonus === 4, combatPowerBonus === 3, hydraulicSystemsBonus === 0, counterProtocolsBonus === 0, gyroStabilizersBonus === 0
    - Test Battle Axe: penetrationBonus === 6, attackSpeedBonus === -2, combatPowerBonus === 4, criticalSystemsBonus === 3, hydraulicSystemsBonus === 0, servoMotorsBonus === 0
    - Test Heavy Hammer: penetrationBonus === 8, attackSpeedBonus === -3, combatPowerBonus === 7, criticalSystemsBonus === 4, hydraulicSystemsBonus === 0, servoMotorsBonus === 0
    - Test Reactive Shield: evasionThrustersBonus === -2, shieldCapacityBonus === 7, counterProtocolsBonus === 6, powerCoreBonus === 4, servoMotorsBonus === 0
    - Test Ion Beam: combatPowerBonus === 8, shieldCapacityBonus === 0, penetrationBonus === 10, attackSpeedBonus === 5, targetingSystemsBonus === 4
    - Test WEAPON_DEFINITIONS.length === 23
    - _Requirements: 1.1–1.4, 2.1–2.4, 3.1–3.5, 4.1–4.4, 5.1–5.4, 6.1–6.4, 7.1–7.4, 13.2_

- [x] 3. Checkpoint — Verify seed data and tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Create Prisma migration for acc/prod environments
  - [x] 4.1 Create migration directory and SQL file
    - Create `app/backend/prisma/migrations/<timestamp>_weapon_bonus_rebalance/migration.sql`
    - Write 7 idempotent UPDATE statements matching weapons by name, updating only changed bonus columns
    - Energy Blade: set hydraulic_systems_bonus = 0, combat_power_bonus = 4
    - Plasma Blade: set hydraulic_systems_bonus = 0, combat_power_bonus = 5
    - Power Sword: set hydraulic_systems_bonus = 0, counter_protocols_bonus = 0, gyro_stabilizers_bonus = 0, penetration_bonus = 7, critical_systems_bonus = 5, weapon_control_bonus = 4
    - Battle Axe: set hydraulic_systems_bonus = 0, servo_motors_bonus = 0, penetration_bonus = 6, attack_speed_bonus = -2
    - Heavy Hammer: set hydraulic_systems_bonus = 0, servo_motors_bonus = 0, penetration_bonus = 8, attack_speed_bonus = -3
    - Reactive Shield: set servo_motors_bonus = 0, evasion_thrusters_bonus = -2
    - Ion Beam: set shield_capacity_bonus = 0, combat_power_bonus = 8
    - Do not modify baseDamage, cooldown, cost, weaponType, handsRequired, damageType, loadoutType, or description columns
    - Do not modify any weapons other than the 7 listed
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

- [x] 5. Update weapon catalog documentation
  - [x] 5.1 Update `docs/prd_core/SEED_DATA_SPECIFICATION.md`
    - Update bonus values for Energy Blade, Plasma Blade, Power Sword, Battle Axe, Heavy Hammer, Reactive Shield, and Ion Beam to match new WEAPON_DEFINITIONS
    - Do not modify entries for unmodified weapons
    - _Requirements: 11.1, 11.3_
  - [x] 5.2 Update `docs/prd_core/PRD_WEAPONS_LOADOUT.md`
    - Update bonus values where individual weapon bonuses are listed for the 7 modified weapons
    - Do not modify entries for unmodified weapons
    - _Requirements: 11.2, 11.3_

- [x] 6. Final checkpoint — Verify all changes
  - Ensure all tests pass, ask the user if questions arise.
  - Verify no files outside the allowed set were modified (seed.ts, migration SQL, SEED_DATA_SPECIFICATION.md, PRD_WEAPONS_LOADOUT.md, test file)
  - _Requirements: 13.1, 13.4_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific before/after bonus values for each weapon
- The migration follows existing naming convention: `YYYYMMDDHHMMSS_weapon_bonus_rebalance`
