# Implementation Plan: Seeding and Auto-User Creation

## Overview

Overhaul the seed system and auto-generation system to replace archetype-based user creation with a tiered stable system (WimpBot/AverageBot/ExpertBot). Implementation proceeds bottom-up: shared constants and utilities first, then seed rewrite, then auto-generation rewrite, then test rewrites, then documentation cleanup.

## Tasks

- [x] 1. Create shared constants and utility functions
  - [x] 1.1 Create tier configuration constants and shared types
    - Create a new file `app/backend/src/utils/tierConfig.ts`
    - Define `TierConfig` interface, `TIER_CONFIGS` array (WimpBot/AverageBot/ExpertBot with robotCount, attributeLevel, priceTier, createTagTeam)
    - Define `LOADOUT_TITLES` mapping (single→Lone, weapon_shield→Guardian, dual_wield→Twin, two_handed→Heavy)
    - Define `WEAPON_CODENAMES` mapping for all 47 weapons
    - Define `STABLE_ADJECTIVES` (40 entries) and `STABLE_NOUNS` (40 entries) word lists
    - Define `TieredGenerationResult` interface with tierBreakdown
    - _Requirements: 8.1, 8.2, 9.1, 10.1, 11.1, 13.2, 13.3, 13.5_

  - [x] 1.2 Implement `distributeTiers(n)` function
    - Add to `tierConfig.ts` or a new `app/backend/src/utils/distributeTiers.ts`
    - Integer division by 3 with remainder allocated WimpBot-first, then AverageBot, then ExpertBot
    - Return `{ wimpBot, averageBot, expertBot }` object
    - Handle edge cases: n=0 returns all zeros, n=1 returns {1,0,0}, n=2 returns {1,1,0}
    - _Requirements: 8.2, 8.3_

  - [x] 1.3 Write property test for `distributeTiers` (Property 1)
    - Create `app/backend/tests/utils/distributeTiers.test.ts`
    - **Property 1: Tier distribution is correct and exhaustive**
    - For any positive integer N, verify sum equals N, each count is floor(N/3) or ceil(N/3), and wimpBot >= averageBot >= expertBot
    - Use fast-check with `fc.integer({ min: 1, max: 500 })`, 100 runs
    - **Validates: Requirements 8.2, 8.3**

  - [x] 1.4 Implement `generateStableName(existingNames)` function
    - Create `app/backend/src/utils/stableNameGenerator.ts`
    - Combine random adjective + noun from word lists
    - If collision with existingNames, append incrementing numeric suffix
    - Return unique stable name string
    - _Requirements: 13.5, 13.6_

  - [x] 1.5 Write property test for `generateStableName` (Property 8)
    - Create `app/backend/tests/utils/stableNameGenerator.test.ts`
    - **Property 8: Stable names are unique and use only neutral words**
    - Verify all names are unique, composed of valid adjective+noun, and contain no tier keywords ("Wimp", "Average", "Expert", "Bot")
    - **Validates: Requirements 13.5, 13.6**

  - [x] 1.6 Implement `selectWeapon` and `selectShield` functions
    - Create `app/backend/src/utils/weaponSelection.ts`
    - Implement 3-level fallback chain: loadout+range+tier → loadout+tier → any weapon in tier
    - `selectShield` filters for `handsRequired = 'shield'` within price tier
    - Log warnings at each fallback level
    - _Requirements: 14.1, 14.2, 14.3_

  - [x] 1.7 Write property tests for weapon selection (Properties 3, 4)
    - Create `app/backend/tests/utils/weaponSelection.test.ts`
    - **Property 3: Weapon selection respects loadout and price tier constraints**
    - **Property 4: Weapon selection fallback always produces a valid weapon**
    - **Validates: Requirements 9.4, 9.5, 9.6, 10.4, 10.5, 10.6, 11.4, 11.5, 11.6, 14.1, 14.2**

- [x] 2. Checkpoint - Ensure all utility tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Rewrite seed system (`app/backend/prisma/seed.ts`)
  - [x] 3.1 Rewrite `seedAdminAccount` and remove `seedCoreTestUsers`
    - Remove `seedCoreTestUsers` function entirely (no more player1–5)
    - Modify admin creation: currency ₡3,000,000, prestige 0, assign stableName via `generateStableName`
    - Remove all archetype-related code: `ARCHETYPE_SPECS` array, `seedArchetypeUsers` function
    - Remove `seedAttributeTestUsers` function
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 Rewrite `seedWimpBotUsers` for 200 users with new naming
    - 200 users (`test_user_001` through `test_user_200`), currency ₡100,000 each
    - Distribute evenly: 50 Practice Sword, 50 Practice Blaster, 50 Training Rifle, 50 Training Beam
    - Set loadoutType to "single" for one-handed weapons, "two_handed" for two-handed weapons
    - Name robots using `{Tier} {LoadoutTitle} {WeaponCodename} {Number}` format
    - Assign stableName to each user via `generateStableName`
    - Distribute across bronze league instances evenly (not all in bronze_1)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9_

  - [x] 3.3 Verify bye robot and weapon catalog are unchanged
    - Confirm `seedByeRobot` and `seedWeapons` functions remain intact
    - Confirm `seedCycleMetadata` remains intact
    - _Requirements: 6.1, 6.2, 6.3, 7.1_

- [x] 4. Rewrite auto-generation system (`app/backend/src/utils/userGeneration.ts`)
  - [x] 4.1 Rewrite `generateBattleReadyUsers` with tiered stable creation
    - Remove all archetype code (ARCHETYPE_SPECS, archetype cycling logic)
    - Accept `cycleNumber`, use `distributeTiers(cycleNumber)` to determine tier counts
    - For each tier count, create stables with the correct robot count (3/2/1)
    - Use `auto_<tier>_<sequential_number>` username format
    - Return `TieredGenerationResult` with tierBreakdown
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 4.2 Implement per-robot creation within stables
    - Random loadoutType (25% each of single/weapon_shield/dual_wield/two_handed)
    - Random rangeBand (25% each of melee/short/mid/long)
    - Random stance (33% each of balanced/offensive/defensive)
    - Random yieldThreshold (integer 0–20)
    - Use `selectWeapon` for main weapon, `selectShield` for weapon_shield offhand, duplicate for dual_wield
    - Set attributes to tier's attributeLevel for all 23 attributes
    - Calculate HP = 50 + floor(attributeLevel * 5), shield = floor(attributeLevel * 4)
    - Name robots using `{Tier} {LoadoutTitle} {WeaponCodename} {Number}` format
    - Assign to bronze league via `assignLeagueInstance('bronze')`
    - _Requirements: 9.1–9.7, 10.1–10.7, 11.1–11.7, 12.1, 12.2, 13.1, 13.4_

  - [x] 4.3 Implement tag team creation for multi-robot stables
    - Create TagTeam for WimpBot (3 robots, use first 2) and AverageBot (2 robots) stables
    - Skip tag team for ExpertBot (1 robot)
    - Use `assignTagTeamLeagueInstance('bronze')` for league assignment
    - Wrap each stable in a Prisma `$transaction` for atomicity
    - _Requirements: 9.8, 10.8_

  - [x] 4.4 Add bankruptcy logging
    - After cycle processing, if any user's currency drops below ₡0, log the bankruptcy event with username and cycle number
    - _Requirements: 16.3_

- [x] 5. Checkpoint - Verify seed and auto-generation compile and run
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Rewrite existing test files
  - [x] 6.1 Rewrite `app/backend/tests/userGeneration.test.ts`
    - Remove all archetype references (`archetype_` usernames, `cleanupArchetypeUsers` helper)
    - Test tiered generation: verify WimpBot/AverageBot/ExpertBot stable creation
    - Test correct robot counts per tier (3/2/1)
    - Test weapon tier validation (budget/mid/premium per tier)
    - Test username format (`auto_wimpbot_*`, `auto_averagebot_*`, `auto_expertbot_*`)
    - Test `TieredGenerationResult` structure with tierBreakdown
    - _Requirements: 8.1, 8.2, 9.1, 10.1, 11.1_

  - [x] 6.2 Write property tests in userGeneration.test.ts (Properties 2, 5, 6, 10, 11, 12)
    - **Property 2: Generated robots have tier-appropriate attributes**
    - **Property 5: All generated robots start in Bronze league with ELO 1200**
    - **Property 6: All generated users start with ₡100,000 and a stable name**
    - **Property 10: Generated robots have valid stance and yield threshold**
    - **Property 11: Generated robots have valid loadout type and range band selection**
    - **Property 12: HP and shield are correctly derived from attributes**
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.7, 8.4, 8.5, 9.1, 9.2, 9.3, 9.7, 10.1, 10.2, 10.3, 10.7, 11.1, 11.2, 11.3, 11.7, 12.1, 12.2, 15.1, 16.1, 16.2**

  - [x] 6.3 Rewrite `app/backend/tests/twoRobotTagTeamGeneration.test.ts`
    - Remove all archetype references ("Two-Robot Specialist", `archetype_two_robot_*` usernames, "Specialist Alpha"/"Specialist Beta" robot names)
    - Test tag team creation for WimpBot stables (3 robots, tag team from first 2)
    - Test tag team creation for AverageBot stables (2 robots, tag team from both)
    - Test no tag team for ExpertBot stables (1 robot)
    - Verify tag team league assignment is bronze
    - _Requirements: 9.8, 10.8_

  - [x] 6.4 Write property test for tag teams (Property 9)
    - Add to twoRobotTagTeamGeneration.test.ts
    - **Property 9: Tag teams are created for multi-robot stables**
    - **Validates: Requirements 9.8, 10.8**

  - [x] 6.5 Rewrite `app/backend/tests/seed.property.test.ts`
    - Update `simulateSeed()` to reflect new seed structure: admin with ₡3M/prestige 0, no player1–5, no archetypes, no attribute test users
    - Update user count expectations: bye_robot_user + admin + 200 WimpBots = 202 (dev/acceptance), bye_robot_user only (production)
    - Verify idempotence properties still hold with new seed structure
    - Verify 47 weapons seeded (update WEAPON_NAMES list)
    - _Requirements: 1.2, 1.3, 2.1, 3.1, 5.1, 7.1_

  - [x] 6.6 Write property test for seed robot naming (Property 13)
    - Add to seed.property.test.ts
    - **Property 13: Seed loadout type matches weapon hand requirement**
    - Verify one-handed weapons get "single" loadout, two-handed weapons get "two_handed" loadout
    - **Validates: Requirements 5.6**

  - [x] 6.7 Rewrite `app/backend/tests/integration/adminCycleGeneration.test.ts`
    - Remove archetype weapon seeding, replace with full weapon catalog or representative budget/mid/premium weapons
    - Update cleanup to target `auto_wimpbot_*`, `auto_averagebot_*`, `auto_expertbot_*` usernames
    - Verify tiered stable creation during cycle execution
    - Verify `TieredGenerationResult` response structure with tierBreakdown
    - Verify progressive user count per cycle still works (cycle N creates N users)
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 6.8 Write property test for robot naming (Property 7)
    - Add to userGeneration.test.ts or a dedicated test file
    - **Property 7: Robot names encode loadout and are unique**
    - Verify all names are unique, contain tier identifier, valid loadout title, and valid weapon codename matching equipped weapon
    - **Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.6**

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Documentation cleanup
  - [x] 8.1 Remove archetype references from SEED_DATA_SPECIFICATION.md
    - Remove "Player Archetype Test Users" section and all 10 archetype definitions
    - Remove "Dynamic User Generation" archetype cycling logic
    - Add new sections documenting tiered stable system (WimpBot/AverageBot/ExpertBot)
    - Update admin account specs (₡3M, prestige 0)
    - Update WimpBot population specs (200 users, 4 practice weapons, new naming format)
    - _Requirements: 4.1, 4.2_

  - [x] 8.2 Remove archetype references from other documentation files
    - Check and update `docs/prd_core/PRD_AUTO_USER_GENERATION.md` to reflect tiered system
    - Check `docs/implementation_notes/UNIQUE_ROBOT_NAMES.md` for archetype name references
    - Preserve `docs/PLAYER_ARCHETYPES_GUIDE.md` as standalone player strategy guide, removing only seed-data-generation ties
    - _Requirements: 4.3, 4.4_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (Properties 1–13)
- Unit tests validate specific examples and edge cases
- No database schema changes are needed — existing models support all new behavior
- The 4 existing test files need complete rewrites (not patches) due to pervasive archetype references
- 3 new test utility files are created under `tests/utils/`
