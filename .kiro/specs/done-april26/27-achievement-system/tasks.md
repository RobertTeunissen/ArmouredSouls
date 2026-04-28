# Implementation Plan: Achievement System

## Overview

Implement the Achievement & Milestone System for Armoured Souls, adding a progression layer that transforms invisible prestige/fame accumulation into celebrated milestones with credit and prestige rewards, collectible hexagonal badges, and progress tracking. This directly addresses Loop 4 (Reputation Loop) from the Game Loop Audit.

Implementation follows a dependency-first sequence: schema → config → service → routes → frontend → integration → tests → docs → verification.

## Tasks

- [x] 1. Database schema and migration
  - [x] 1.1 Create Prisma migration for achievement system schema changes
    - Add `UserAchievement` model to `app/backend/prisma/schema.prisma` with fields: `id`, `userId`, `achievementId` (VarChar(10)), `robotId` (nullable), `unlockedAt` (DateTime, default now)
    - Add `@@unique([userId, achievementId])` constraint on `UserAchievement`
    - Add `@@index([userId])`, `@@index([robotId])`, `@@index([achievementId])` on `UserAchievement`
    - Add `@@map("user_achievements")` table mapping
    - Add `user` relation (onDelete: Cascade) and `robot` relation (onDelete: SetNull) to `UserAchievement`
    - Add `achievements UserAchievement[]` relation to both `User` and `Robot` models
    - Add `pinnedAchievements Json @default("[]") @map("pinned_achievements")` to `User` model
    - Add `totalPracticeBattles Int @default(0) @map("total_practice_battles")` to `User` model
    - Add `currentWinStreak Int @default(0) @map("current_win_streak")` to `Robot` model
    - Add `bestWinStreak Int @default(0) @map("best_win_streak")` to `Robot` model
    - Add `currentLoseStreak Int @default(0) @map("current_lose_streak")` to `Robot` model
    - Add `offensiveWins Int @default(0) @map("offensive_wins")` to `Robot` model
    - Add `defensiveWins Int @default(0) @map("defensive_wins")` to `Robot` model
    - Add `balancedWins Int @default(0) @map("balanced_wins")` to `Robot` model
    - Add `dualWieldWins Int @default(0) @map("dual_wield_wins")` to `Robot` model
    - Run `npx prisma migrate dev` to generate and apply the migration
    - Run `npx prisma generate` to regenerate the Prisma client
    - _Requirements: 2.1, 2.2, 2.5, 2.6, 4.1, 4.5_

- [x] 2. Achievement configuration file
  - [x] 2.1 Create `app/backend/src/config/achievements.ts` with all achievement definitions
    - Define `AchievementTier`, `AchievementScope`, `AchievementCategory`, `AchievementProgressType`, and `AchievementTriggerType` types
    - Define `AchievementDefinition` interface with all required fields: id, name, description, reference, category, tier, scope, rewardCredits, rewardPrestige, hidden, triggerType, triggerThreshold (optional), triggerMeta (optional), progressType, progressLabel, badgeIconFile
    - Define `TIER_REWARDS` constant mapping each tier to its credit and prestige reward amounts: Easy (₡25,000 / +25), Medium (₡50,000 / +50), Hard (₡100,000 / +100), Very Hard (₡250,000 / +250), Secret (₡50,000 / +50 default)
    - Define `ACHIEVEMENTS` array with all entries from the PRD catalog (C1–C19, L1–L17, E1–E17, P1–P10, S1–S14)
    - Each entry must have a unique `id`, correct `tier`, correct `scope` (user or robot), `hidden === (tier === 'secret')`, and reward amounts matching `TIER_REWARDS` for non-secret tiers
    - Implement `getAchievementById(id)` and `getAchievementsByTriggerType(type)` helper functions
    - Follow the `facilities.ts` config pattern (exported const array with typed interface)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 14.1, 14.2, 14.3, 14.4, 15.1_

  - [x] 2.2 Write unit tests for achievement config validation in `app/backend/src/services/achievement/__tests__/achievementConfig.test.ts`
    - Test that all entries have unique IDs
    - Test that every entry has all required fields populated
    - Test that `hidden === (tier === 'secret')` for every entry
    - Test that non-secret tier rewards match `TIER_REWARDS` constants
    - Test that `getAchievementById` returns correct entries and undefined for invalid IDs
    - Test that `getAchievementsByTriggerType` returns correct subsets
    - Test that every entry has a valid `scope` of 'user' or 'robot'
    - Test that every entry has a valid `tier` from the allowed set
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 15.1_

  - [x] 2.3 Write property-based tests for achievement config in `app/backend/src/services/achievement/__tests__/achievementService.property.test.ts`
    - **Property 1: Achievement config consistency** — For every achievement in the ACHIEVEMENTS array: (a) id is unique, (b) tier is valid, (c) scope is valid, (d) hidden === (tier === 'secret'), (e) non-secret rewards match TIER_REWARDS, (f) only rewardCredits and rewardPrestige reward fields exist
    - **Validates: Requirements 1.1, 1.3, 1.4, 1.5, 1.6, 1.7, 15.1**
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.6, 1.7, 15.1_

- [x] 3. Achievement error classes
  - [x] 3.1 Create `app/backend/src/errors/achievementErrors.ts`
    - Define `AchievementErrorCode` enum with: `INVALID_ACHIEVEMENT_ID`, `ACHIEVEMENT_NOT_UNLOCKED`, `TOO_MANY_PINNED`
    - Define `AchievementError` class extending `AppError` with constructor accepting code, message, statusCode (default 400), and optional details
    - Follow the existing error class pattern from `src/errors/` (e.g., `AuthError`, `RobotError`)
    - _Requirements: 12.4, 16.5, 16.6_

- [x] 4. AchievementService core implementation
  - [x] 4.1 Create `app/backend/src/services/achievement/achievementService.ts` with the core service
    - Define `AchievementEvent` interface with `type: AchievementEventType` and `data: Record<string, unknown>`
    - Define `AchievementEventType` union type covering all 13 event types: battle_complete, league_promotion, weapon_purchased, weapon_equipped, attribute_upgraded, facility_upgraded, robot_created, tuning_allocated, stance_changed, onboarding_complete, practice_battle, tournament_complete, daily_finances
    - Define `UnlockedAchievement` interface with: id, name, description, tier, rewardCredits, rewardPrestige, badgeIconFile, robotId, robotName
    - Implement `IAchievementService` interface with methods: `checkAndAward()`, `getPlayerAchievements()`, `getRecentUnlocks()`, `updatePinnedAchievements()`, `getStableAchievements()`, `refreshRarityCache()`
    - Implement `checkAndAward(userId, robotId, event)` as the single entry point — maps event.type to a subset of achievements to evaluate, reads existing unlocks, evaluates conditions, inserts new UserAchievement records, awards credits and prestige, returns newly unlocked achievements
    - Implement event-typed dispatch so only relevant achievements are checked per event type (not all on every event)
    - Implement idempotent behavior: check existing unlocks before inserting, handle unique constraint violations gracefully
    - Implement try-catch wrapper so achievement evaluation failures don't block the calling code (log errors, return empty array on failure)
    - For robot-level achievements, record the triggering robotId; for user-level achievements, set robotId to null
    - Award credits via direct increment (not `lockUserForSpending` — server-initiated, no race condition risk)
    - _Requirements: 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13, 15.2, 15.3_

  - [x] 4.2 Implement win streak and lose streak update logic in `battlePostCombat.ts`
    - Extend `updateRobotCombatStats()` in `app/backend/src/services/battle/battlePostCombat.ts` to update `currentWinStreak`, `bestWinStreak`, and `currentLoseStreak` fields
    - On a league win: increment `currentWinStreak` by 1, reset `currentLoseStreak` to 0, update `bestWinStreak` if `currentWinStreak` exceeds it
    - On a league loss: reset `currentWinStreak` to 0, increment `currentLoseStreak` by 1
    - On a league draw: reset `currentWinStreak` to 0, reset `currentLoseStreak` to 0
    - Also update stance/loadout win counters: increment `offensiveWins`, `defensiveWins`, `balancedWins`, or `dualWieldWins` based on the robot's stance and loadout at battle time, only on wins
    - Ensure these updates happen in the same post-combat flow that updates other robot stats (consistency)
    - Use existing KotH streak fields (`kothCurrentWinStreak`, `kothBestWinStreak`) for KotH streak achievements — no new KotH fields needed
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 4.3 Implement achievement progress computation in the AchievementService
    - Implement `getPlayerAchievements(userId)` method that computes progress at read time from existing User and Robot model fields
    - For robot-level achievements with numeric thresholds, report the best-performing robot's progress and include that robot's name
    - For boolean/one-time achievements, return null progress (frontend shows "Not yet achieved" or unlock date)
    - For secret achievements not yet earned, return hidden data (name as "???", no progress)
    - For secret achievements already earned, return full details
    - Compute progress from: Robot.wins, Robot.kills, Robot.elo, Robot.fame, Robot.totalBattles, User.prestige, User.currency, facility counts, robot counts, weapon counts, streaming revenue (SUM from BattleParticipant), lifetime earnings (SUM from BattleParticipant)
    - Return `AchievementsResponse` shape with achievements array, summary (total, unlocked, byTier), and rarity data
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 4.4 Implement rarity cache in the AchievementService
    - Implement `AchievementRarityCache` interface with `counts: Map<string, number>`, `totalActivePlayers: number`, `refreshedAt: Date`
    - Implement `refreshRarityCache()` method that queries `SELECT achievement_id, COUNT(*) FROM user_achievements GROUP BY achievement_id` and total active players (users with at least 1 battle via robots)
    - Initialize cache on service startup (with empty fallback if DB query fails)
    - Implement `getRarityLabel(percentage)` function returning: Common (>75%), Uncommon (25–75%), Rare (10–25%), Epic (1–10%), Legendary (<1% or 0)
    - Cache is refreshed after each cycle settlement (called from daily settlement)
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 4.5 Implement pinned achievements management in the AchievementService
    - Implement `updatePinnedAchievements(userId, achievementIds)` method
    - Validate: max 6 IDs, each ID exists in ACHIEVEMENTS config, each ID is unlocked by the user
    - Throw `AchievementError` with appropriate code for invalid input (INVALID_ACHIEVEMENT_ID, ACHIEVEMENT_NOT_UNLOCKED, TOO_MANY_PINNED)
    - Update the user's `pinnedAchievements` JSON field
    - Implement `getStableAchievements(userId)` method returning pinned achievement details (id, name, tier, badgeIconFile, unlockedAt) and summary (totalUnlocked, totalAvailable)
    - `totalAvailable` counts non-hidden achievements plus any hidden achievements the user has earned
    - _Requirements: 6.7, 6.8, 12.3, 12.4, 16.5_

- [x] 5. Checkpoint — Verify core service compiles and unit tests pass
  - Ensure `npx prisma generate` succeeds with the new schema
  - Ensure `npm run build` compiles without errors in `app/backend`
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: (checkpoint)_

- [x] 6. Achievement API routes
  - [x] 6.1 Create `app/backend/src/routes/achievements.ts` with three endpoints
    - Implement `GET /api/achievements` — calls `achievementService.getPlayerAchievements(userId)`, returns full catalog with progress, unlock status, pinned state, and rarity data for the authenticated user only
    - Implement `GET /api/achievements/recent` — calls `achievementService.getRecentUnlocks(userId, limit)`, returns last 10 unlocked achievements for the authenticated user
    - Implement `PUT /api/achievements/pinned` — calls `achievementService.updatePinnedAchievements(userId, achievementIds)`, accepts array of up to 6 achievement ID strings
    - All three endpoints require `authenticateToken` middleware
    - All three endpoints use `validateRequest` middleware with Zod schemas for params, query, and body
    - Define Zod schemas: `pinnedAchievementsSchema` for PUT body (array of strings, max 6), `recentQuerySchema` for GET recent (optional limit param)
    - `GET /api/achievements` and `GET /api/achievements/recent` only return data for the authenticated user (no cross-user access)
    - `PUT /api/achievements/pinned` only modifies the authenticated user's pins
    - Return 400 with descriptive error message for: >6 IDs, invalid achievement ID, locked achievement ID
    - Register the router in the main app (e.g., `app.use('/api/achievements', achievementsRouter)`)
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.6, 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_

  - [x] 6.2 Extend `app/backend/src/routes/stables.ts` to include achievement data
    - In the `GET /api/stables/:userId` handler, call `achievementService.getStableAchievements(userId)` to get pinned achievements and summary
    - Add `achievements` field to the response: `{ pinned: PinnedAchievement[], totalUnlocked: number, totalAvailable: number }`
    - Each `PinnedAchievement` includes: id, name, tier, badgeIconFile, unlockedAt
    - Do NOT include rarity labels in the stable response (rarity is only on the achievements page)
    - _Requirements: 8.4, 12.5_

  - [x] 6.3 Write route handler tests in `app/backend/src/routes/__tests__/achievements.test.ts`
    - Test `GET /api/achievements` returns correct response shape with achievements array, summary, and rarity
    - Test `GET /api/achievements/recent` returns last N unlocks in correct order
    - Test `PUT /api/achievements/pinned` accepts valid input (1–6 unlocked IDs) and returns success
    - Test `PUT /api/achievements/pinned` rejects >6 IDs with 400
    - Test `PUT /api/achievements/pinned` rejects invalid achievement ID with 400
    - Test `PUT /api/achievements/pinned` rejects locked achievement ID with 400
    - Test all endpoints return 401 without authentication token
    - Test Zod validation rejects malformed input on all endpoints
    - Test `GET /api/achievements` only returns the authenticated user's data (not another user's)
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.6, 16.1, 16.2, 16.3, 16.6_

- [x] 7. Backend integration — Wire AchievementService into existing game flows
  - [x] 7.1 Integrate into `app/backend/src/services/battle/battlePostCombat.ts`
    - Add a `checkAndAwardAchievements()` helper function that calls `achievementService.checkAndAward()` with `battle_complete` event data
    - Event data must include: won, destroyed, finalHpPercent, eloDiff, opponentElo, yielded, previousBattleYielded, damageDealt, opponentDamageDealt, loadoutType, stance, yieldThreshold, hasTuning, hasMainWeapon, battleType, minHpReached, battleDurationSeconds
    - Call this helper after `awardPrestigeToUser()` and `awardFameToRobot()` in the post-combat flow
    - Return the unlocked achievements array to the calling orchestrator for inclusion in API responses
    - Wrap in try-catch so achievement failures don't block battle processing
    - _Requirements: 3.1, 3.11, 3.13, 16.4_

  - [x] 7.2 Integrate into all battle orchestrators
    - Modify `app/backend/src/services/battle/leagueBattleOrchestrator.ts` to pass unlocked achievements through `processBattle()` return value and include `achievementUnlocks` in the battle result API response
    - Modify `app/backend/src/services/battle/tournamentBattleOrchestrator.ts` to call `achievementService.checkAndAward()` with `tournament_complete` event after tournament wins
    - Modify `app/backend/src/services/battle/tagTeamBattleOrchestrator.ts` to call `achievementService.checkAndAward()` with `battle_complete` event after tag team battles
    - Modify `app/backend/src/services/battle/kothBattleOrchestrator.ts` to call `achievementService.checkAndAward()` with `battle_complete` event after KotH battles
    - All orchestrators include `achievementUnlocks: UnlockedAchievement[]` in their API responses (empty array if none)
    - _Requirements: 3.1, 3.10, 3.13, 11.1, 11.2_

  - [x] 7.3 Integrate into league rebalancing service
    - Modify `app/backend/src/services/battle/leagueRebalancingService.ts` to call `achievementService.checkAndAward()` with `league_promotion` event after promoting a robot
    - Event data includes: newLeague, robotId
    - _Requirements: 3.2_

  - [x] 7.4 Integrate into weapon, robot, facility, tuning, and onboarding routes
    - Modify `app/backend/src/routes/weapons.ts` to call `achievementService.checkAndAward()` with `weapon_purchased` event after weapon purchase AND `weapon_equipped` event after weapon equip (for S1–S3 weapon type achievements and E9 effective stat check)
    - Include `achievementUnlocks` in weapon purchase and equip API responses
    - Modify `app/backend/src/routes/robots.ts` to call `achievementService.checkAndAward()` with `attribute_upgraded` event after attribute upgrade, `robot_created` event after robot creation, and `stance_changed` event after stance change (for E9 effective stat check)
    - Include `achievementUnlocks` in attribute upgrade, robot creation, and stance change API responses
    - Modify `app/backend/src/routes/facility.ts` to call `achievementService.checkAndAward()` with `facility_upgraded` event after facility upgrade
    - Include `achievementUnlocks` in facility upgrade API response
    - Modify `app/backend/src/routes/tuning.ts` to call `achievementService.checkAndAward()` with `tuning_allocated` event after tuning allocation
    - Include `achievementUnlocks` in tuning allocation API response
    - Modify `app/backend/src/routes/onboarding.ts` to call `achievementService.checkAndAward()` with `onboarding_complete` event after onboarding completion
    - Include `achievementUnlocks` in onboarding completion API response
    - _Requirements: 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.11, 3.13_

  - [x] 7.5 Integrate into practice arena and daily settlement
    - Modify `app/backend/src/services/practiceArena/practiceArenaService.ts` to call `achievementService.checkAndAward()` with `practice_battle` event after practice battles
    - Increment `User.totalPracticeBattles` in the practice arena service after each practice battle
    - Include `achievementUnlocks` in practice battle API response
    - Modify the daily settlement service (economy calculations) to call `achievementService.checkAndAward()` with `daily_finances` event if a user's balance goes negative
    - Call `achievementService.refreshRarityCache()` after each cycle settlement completes
    - _Requirements: 3.9, 8.2_

- [x] 8. Checkpoint — Verify backend integration compiles and existing tests still pass
  - Ensure `npm run build` compiles without errors in `app/backend`
  - Ensure all existing tests pass (`npm test -- --silent` in `app/backend`)
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: (checkpoint)_

- [x] 9. Frontend — Achievement components and pages
  - [x] 9.1 Create `AchievementBadge` component at `app/frontend/src/components/AchievementBadge.tsx`
    - Props: `achievement` (definition + unlock state), `size` (64 or 128), `locked` (boolean), `secret` (boolean)
    - Render hexagonal badge with tier-colored border: green (#3fb950) Easy, blue (#58a6ff) Medium, orange (#d29922) Hard, red (#f85149) Very Hard, purple (#a371f7) Secret
    - Locked state: CSS class `achievement-badge--locked` with `filter: grayscale(100%) brightness(0.4)` and `opacity: 0.4`, border in #57606a
    - Unlocked state: full color with subtle inner glow matching tier color at 20% opacity
    - Secret + locked: render generic "???" placeholder badge with purple border and question mark icon instead of actual badge silhouette
    - Secret + unlocked: render actual badge in full color (identical to non-secret unlocked)
    - Use single image asset per achievement — locked/unlocked via CSS classes only (no separate locked images)
    - Support 128×128px detail view and 64×64px list view sizes
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

  - [x] 9.2 Create `AchievementToast` component at `app/frontend/src/components/AchievementToast.tsx`
    - Slide-in toast from top-right showing badge icon at 48×48px, achievement name, reward summary (e.g., "₡25,000 + 25 prestige"), and rarity label
    - Auto-dismiss after 5 seconds
    - Stack multiple toasts when multiple achievements unlock simultaneously
    - Click on toast navigates to `/achievements`
    - 300ms scale-in animation (0.95 → 1.0, ease-out) on the badge
    - Respect `prefers-reduced-motion` media query by disabling animation
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 9.3 Create `useAchievementToasts` hook at `app/frontend/src/hooks/useAchievementToasts.ts`
    - Register an Axios response interceptor on the shared `apiClient` that checks every API response for `achievementUnlocks` field
    - When `achievementUnlocks` is a non-empty array, queue each unlock as a toast notification
    - Register the hook once at the app level (in `App.tsx` or a layout wrapper)
    - Handle the retroactive awards edge case: on login, check `GET /api/achievements/recent` for recent unlocks and show a summary notification ("You earned X achievements!") rather than individual toasts if count is high
    - _Requirements: 10.1, 10.3, 3.13_

  - [x] 9.4 Create `AchievementsPage` at `app/frontend/src/pages/AchievementsPage.tsx`
    - Fetch `GET /api/achievements` on mount
    - Render scrollable list of all achievements as cards (no category tabs — categories are internal metadata only)
    - Each card shows: badge (locked/unlocked via AchievementBadge component), name, one-line description, progress indicator, reward preview, unlock date (if earned), rarity indicator ("Earned by X of Y players (Z%)"), and pin toggle button
    - Progress indicator: progress bar with exact numeric values for numeric achievements (e.g., "34 / 50 wins"), "Not yet achieved" for locked boolean achievements, unlock date for unlocked boolean achievements
    - Progress bars use tier color as fill: green (Easy), blue (Medium), orange (Hard), red (Very Hard), purple (Secret)
    - For robot-level achievements, show best robot's progress with "(best: RobotName)" note
    - Secret achievements not yet earned: show "???" badge, no progress, no name/description
    - Secret achievements earned: show normally with full details
    - Reward preview greyed out for locked, highlighted for unlocked
    - Rarity labels: Common (>75%), Uncommon (25–75%), Rare (10–25%), Epic (1–10%), Legendary (<1% or 0) with appropriate colors
    - Filter controls: tier dropdown (Easy, Medium, Hard, Very Hard, Secret), status dropdown (All, Locked, Unlocked)
    - Sort controls: default order, rarity (rarest first / most common first), status (locked first / unlocked first), tier (hardest first / easiest first)
    - Summary section at top: total unlocked count and per-tier breakdown
    - Pin toggle button on each card: add/remove from pinned list (max 6)
    - Add route for `/achievements` in the app router
    - _Requirements: 5.1, 5.4, 5.5, 5.6, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 8.1, 8.3_

  - [x] 9.5 Create `AchievementPinnerModal` component at `app/frontend/src/components/AchievementPinnerModal.tsx`
    - Grid display of all unlocked achievements
    - Click to pin/unpin an achievement
    - Show current pin count (X/6)
    - Close on selection or backdrop click
    - Calls `PUT /api/achievements/pinned` to persist changes
    - _Requirements: 6.5, 6.6_

  - [x] 9.6 Add achievement showcase section to `app/frontend/src/pages/StableViewPage.tsx`
    - Add new section between "Stable Statistics" and "Robots" sections
    - Display 6 hexagonal badge slots in a horizontal row using AchievementBadge component at 64×64px
    - Pinned badges show with tier-colored border; empty slots show faint hexagonal outline placeholder (`border-dashed border-white/20`)
    - Hover tooltip on pinned badges: achievement name, description, unlock date
    - Own-stable view: "×" button on pinned badges to unpin, "+" button on empty slots to open AchievementPinnerModal
    - Visitor view: read-only badges with hover tooltips, no edit controls
    - Summary line below showcase: "{unlocked}/{total} Achievements · View all →" linking to `/achievements`
    - Do NOT display rarity labels on pinned badges (only on achievements page)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.9, 8.4_

  - [x] 9.7 Add achievement badges to battle report display
    - In the battle report component, add a row of earned achievement badges below the "Battle Outcomes" section
    - Only display when the battle resulted in one or more achievement unlocks (read from `achievementUnlocks` in battle result data)
    - When no achievements were earned, do not display an achievement section
    - _Requirements: 11.1, 11.2_

  - [x] 9.8 Create frontend utility functions in `app/frontend/src/utils/achievementUtils.ts`
    - Implement `getRarityLabel(percentage: number)` returning the rarity label string and color based on percentage thresholds
    - Implement `filterAchievements(achievements, filters)` for tier and status filtering
    - Implement `sortAchievements(achievements, sortOption)` for rarity, status, and tier sorting
    - Implement `getTierColor(tier)` returning the hex color for each tier
    - These pure functions are used by AchievementsPage and are testable independently
    - _Requirements: 7.3, 7.4, 8.3_

- [x] 10. Checkpoint — Verify frontend compiles and renders
  - Ensure `npm run build` compiles without errors in `app/frontend`
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: (checkpoint)_

- [x] 11. Retroactive achievement migration script
  - [x] 11.1 Create `app/backend/scripts/retroactive-achievements.ts`
    - Iterate all users and their robots
    - Evaluate every achievement's trigger condition against current data (wins, ELO, prestige, fame, facilities, weapon counts, robot counts, streaming revenue, etc.)
    - For each qualifying achievement, insert a `UserAchievement` record with `unlockedAt` set to the migration execution time
    - Award accumulated credit and prestige rewards in a single transaction per user
    - Log total retroactive awards per user for admin visibility (console output with user ID, username, and count)
    - Handle errors per-user gracefully (log and continue processing remaining users)
    - Script must be runnable standalone via `npx ts-node scripts/retroactive-achievements.ts`
    - Script must run before the frontend feature is enabled so players see achievements on first load
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [x] 12. Backend tests — Unit and property-based tests for AchievementService
  - [x] 12.1 Write unit tests in `app/backend/src/services/achievement/__tests__/achievementService.test.ts`
    - Test achievement evaluation for each event type: battle_complete, league_promotion, weapon_purchased, weapon_equipped, attribute_upgraded, facility_upgraded, robot_created, tuning_allocated, onboarding_complete, practice_battle, tournament_complete, daily_finances
    - Test specific trigger conditions: perfect victory (C9), low HP win (C10), ELO upset (C11), win streak (C12/C13), yield forced (C14), comeback win (C15), no tuning win (C17), all-mode wins (C18), low HP survival (C19), glass cannon (S9), overkill (S10), reserve robot win (S11), survival streak (S12), lose streak (S14)
    - Test idempotency: calling checkAndAward for an already-held achievement returns empty array and does not create duplicate records
    - Test robot-level achievements record correct robotId; user-level achievements record null robotId
    - Test credit and prestige rewards are correctly awarded per tier
    - Test secret achievements: hidden until earned, revealed after earning
    - Test pin validation: 6 pins OK, 7 pins rejected, invalid ID rejected, locked ID rejected
    - Test rarity cache refresh logic
    - Test graceful degradation: service returns empty array on internal errors
    - _Requirements: 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13, 15.2, 15.3_

  - [x] 12.2 Write property-based tests in `app/backend/src/services/achievement/__tests__/achievementService.property.test.ts`
    - **Property 2: Achievement scope determines robotId** — For any achievement award, robot-scope achievements have non-null robotId, user-scope achievements have null robotId
    - **Validates: Requirements 2.3, 2.4**
    - **Property 3: Achievement award correctness** — For any achievement with numeric threshold and any player whose stat meets/exceeds threshold and who doesn't already hold it, checkAndAward creates exactly one record and awards correct rewards
    - **Validates: Requirements 3.11, 3.13**
    - **Property 4: Achievement award idempotency** — For any already-held achievement, checkAndAward returns empty array and creates no duplicate record
    - **Validates: Requirements 3.12**
    - **Property 5: Win streak state machine** — For any sequence of win/loss/draw outcomes, currentWinStreak increments on win and resets on loss/draw
    - **Validates: Requirements 4.2, 4.3**
    - **Property 6: Best win streak invariant** — For any sequence of outcomes, bestWinStreak equals the max currentWinStreak ever reached and never decreases
    - **Validates: Requirements 4.4**
    - **Property 7: Progress computation correctness** — For any achievement with numeric progressType and any player state, computed progress equals the current value of the relevant model field
    - **Validates: Requirements 5.2**
    - **Property 8: Best robot progress selection** — For any robot-level achievement with numeric threshold and any player with 1+ robots, reported progress equals the max across all robots for that metric
    - **Validates: Requirements 5.3**
    - **Property 9: Pin validation rejects invalid or locked achievements** — For any array of achievement IDs with >6 entries, invalid IDs, or locked IDs, the endpoint returns 400
    - **Validates: Requirements 6.7, 6.8, 12.4, 16.5**
    - **Property 10: Rarity count correctness** — For any set of UserAchievement records, the rarity cache count for each achievementId equals the number of distinct userIds holding it
    - **Validates: Requirements 8.2**
    - **Property 11: Rarity label classification** — For any percentage value, the rarity label matches the defined thresholds (Common >75%, Uncommon 25-75%, Rare 10-25%, Epic 1-10%, Legendary <1%)
    - **Validates: Requirements 8.3**
    - **Property 14: Achievement data isolation** — For any two distinct users, user A's GET /api/achievements response contains only user A's data, never user B's
    - **Validates: Requirements 16.2, 16.3**
    - _Requirements: 2.3, 2.4, 3.11, 3.12, 3.13, 4.2, 4.3, 4.4, 5.2, 5.3, 6.7, 6.8, 8.2, 8.3, 12.4, 16.2, 16.3, 16.5_

- [x] 13. Frontend tests — Component and utility tests
  - [x] 13.1 Write frontend utility tests in `app/frontend/src/utils/__tests__/achievementUtils.test.ts`
    - Test `getRarityLabel` returns correct label and color for each threshold boundary
    - Test `filterAchievements` correctly filters by tier and status combinations
    - Test `sortAchievements` correctly sorts by rarity, status, and tier
    - Test `getTierColor` returns correct hex color for each tier
    - _Requirements: 7.3, 7.4, 8.3_

  - [x] 13.2 Write frontend property-based tests in `app/frontend/src/utils/__tests__/achievementUtils.property.test.ts`
    - **Property 11: Rarity label classification** — Pure function `getRarityLabel(percentage)` returns correct label for any percentage 0–100
    - **Validates: Requirements 8.3**
    - **Property 12: Achievement filter correctness** — For any combination of tier and status filters, the result contains exactly matching achievements
    - **Validates: Requirements 7.3**
    - **Property 13: Achievement sort correctness** — For any sort option, the result is totally ordered by the selected criterion
    - **Validates: Requirements 7.4**
    - _Requirements: 7.3, 7.4, 8.3_

  - [x] 13.3 Write frontend component tests
    - Write `app/frontend/src/components/__tests__/AchievementBadge.test.tsx` — test locked/unlocked/secret states render correctly, correct CSS classes applied, correct sizes
    - Write `app/frontend/src/components/__tests__/AchievementToast.test.tsx` — test toast renders with correct data, auto-dismiss behavior, click navigation, animation class presence, prefers-reduced-motion handling
    - Write `app/frontend/src/pages/__tests__/AchievementsPage.test.tsx` — test page renders achievement cards, filter controls work, sort controls work, summary section displays correctly, pin toggle works
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 10.1, 10.2, 10.4, 10.5, 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 14. Checkpoint — Verify all tests pass across backend and frontend
  - Run `npm test -- --silent` in `app/backend` and verify all tests pass
  - Run `npm test -- --run` in `app/frontend` and verify all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: (checkpoint)_

- [x] 15. Documentation updates
  - [x] 15.1 Update `docs/game-systems/PRD_ACHIEVEMENT_SYSTEM.md`
    - Change status from "📋 Design — Not Yet Implemented" to "✅ Implemented"
    - Mark all implemented sections as implemented
    - Update any design decisions that changed during implementation
    - _Requirements: 17.1_

  - [x] 15.2 Update `docs/BACKLOG.md`
    - Move Achievement System (#8) to the "Recently Completed" table
    - Add link to spec #27 (`/.kiro/specs/to-do/27-achievement-system/`)
    - _Requirements: 17.2_

  - [x] 15.3 Update `docs/game-systems/PRD_PRESTIGE_AND_FAME.md`
    - Update the "What's Not Implemented" section to reference the achievement system as now implemented
    - Add link to `PRD_ACHIEVEMENT_SYSTEM.md`
    - _Requirements: 17.3_

  - [x] 15.4 Update `docs/game-systems/PRD_ECONOMY_SYSTEM.md`
    - Update Section 6 (Achievement Rewards) to reflect the final reward amounts per tier
    - Add link to `PRD_ACHIEVEMENT_SYSTEM.md` for the full achievement catalog
    - _Requirements: 17.4_

  - [x] 15.5 Update `.kiro/steering/project-overview.md`
    - Add "Achievement System" to the Key Systems list with a brief description
    - _Requirements: 17.5_

- [x] 15A. Achievement audit logging and cycle summary integration
  - [x] 15A.1 Add `ACHIEVEMENT_UNLOCK` event type and `logAchievementUnlock` helper to EventLogger
    - Add `ACHIEVEMENT_UNLOCK = 'achievement_unlock'` to the `EventType` enum in `app/backend/src/services/common/eventLogger.ts`
    - Add `logAchievementUnlock(cycleNumber, userId, achievementId, rewardCredits, rewardPrestige, robotId?)` method to the `EventLogger` class
    - The method calls `this.logEvent()` with the achievement data in the payload and userId/robotId in options
    - _Requirements: 18.1, 18.2_

  - [x] 15A.2 Wire audit logging into `AchievementService.checkAndAward()`
    - Import `eventLogger` and `getCurrentCycle` into the achievement service
    - After awarding credits and prestige for each newly unlocked achievement, call `eventLogger.logAchievementUnlock()` with the current cycle number
    - Wrap the audit log call in try-catch so logging failures don't block achievement awarding
    - _Requirements: 18.1, 18.2_

  - [x] 15A.3 Add `achievementRewards` to `StableMetric` and cycle snapshot aggregation
    - Add `achievementRewards: number` field to the `StableMetric` interface in `app/backend/src/types/snapshotTypes.ts`
    - Add `achievementId?: string` field to the `CycleEventPayload` interface in the same file
    - In `CycleSnapshotService.aggregateStableMetrics()`, query `achievement_unlock` events for the cycle and sum `payload.rewardCredits` per user into the `achievementRewards` field
    - Initialize `achievementRewards` to 0 in the `getOrCreateMetric` helper
    - Include `achievementRewards` in the `netProfit` calculation: `netProfit = totalCreditsEarned + merchandisingIncome + streamingIncome + achievementRewards - totalRepairCosts - operatingCosts - totalPurchases`
    - _Requirements: 18.3, 18.4, 18.5, 18.6_

  - [x] 15A.4 Update `app/backend/docs/audit-logging-schema.md` to document the `achievement_unlock` event type
    - Add `achievement_unlock` under a new "Achievement Events" section with payload fields: achievementId, rewardCredits, rewardPrestige
    - _Requirements: 18.7_

- [x] 16. Final verification — Run Verification Criteria from requirements.md
  - [x] 16.1 Run all Verification Criteria checks
    - **Check 1**: Run `grep -c "id:" app/backend/src/config/achievements.ts` — verify it returns a positive number matching the achievement count in the PRD
    - **Check 2**: Run `grep "user_achievements" app/backend/prisma/schema.prisma` — verify the UserAchievement model definition exists. Run `grep "pinned_achievements" app/backend/prisma/schema.prisma` — verify the User field exists
    - **Check 3**: Run `grep "current_win_streak" app/backend/prisma/schema.prisma` — verify Robot model win streak fields exist
    - **Check 4**: Run `grep -r "\/api\/achievements" app/backend/src/routes/` — verify routes exist for GET /api/achievements, GET /api/achievements/recent, and PUT /api/achievements/pinned
    - **Check 5**: Run `grep "achievements" app/backend/src/routes/stables.ts` — verify achievement data in stable response
    - **Check 6**: Run `grep -E "achievementService|checkAndAward" app/backend/src/services/battle/battlePostCombat.ts` — verify post-combat hook is wired
    - **Check 7**: Run `ls app/frontend/src/pages/AchievementsPage.tsx` — verify file exists. Run `grep -i "achievement" app/frontend/src/pages/StableViewPage.tsx` — verify showcase section
    - **Check 8**: Run `cd app/backend && npm test -- --silent` — verify exit code 0. Verify achievement-specific test files exist under `app/backend/src/services/achievement/__tests__/` and `app/backend/src/routes/__tests__/`
    - **Check 9**: Run `ls app/backend/scripts/retroactive-achievements.ts` — verify file exists
    - **Check 10**: Run `grep "validateRequest" app/backend/src/routes/achievements.ts` — verify Zod validation on all route handlers
    - **Check 11**: Run `grep -i "implemented\|IMPLEMENTED" docs/game-systems/PRD_ACHIEVEMENT_SYSTEM.md` — verify status updated
    - _Requirements: All verification criteria from requirements.md Expected Contribution section_

## Requirements Traceability Matrix

| Requirement | Acceptance Criteria | Covered By Tasks |
|---|---|---|
| 1. Achievement Definition Configuration | 1.1–1.8 | 2.1, 2.2, 2.3 |
| 2. Achievement Data Model and Persistence | 2.1–2.6 | 1.1, 4.1, 12.1, 12.2 |
| 3. Achievement Evaluation and Awarding | 3.1–3.13 | 4.1, 7.1, 7.2, 7.3, 7.4, 7.5, 9.3, 12.1, 12.2 |
| 4. Win Streak Tracking | 4.1–4.6 | 1.1, 4.2, 12.2 |
| 5. Achievement Progress Computation | 5.1–5.6 | 4.3, 9.4, 12.2 |
| 6. Pinned Achievement Showcase on Stable Page | 6.1–6.9 | 4.5, 9.5, 9.6, 12.2 |
| 7. Dedicated Achievements Page | 7.1–7.8 | 9.4, 9.8, 13.1, 13.2, 13.3 |
| 8. Achievement Rarity and Social Proof | 8.1–8.4 | 4.4, 6.2, 9.4, 9.8, 12.2, 13.1, 13.2 |
| 9. Achievement Badge Display | 9.1–9.7 | 9.1, 13.3 |
| 10. Achievement Toast Notifications | 10.1–10.5 | 9.2, 9.3, 13.3 |
| 11. Battle Report Achievement Integration | 11.1–11.2 | 7.2, 9.7 |
| 12. Achievement API Endpoints | 12.1–12.6 | 6.1, 6.2, 6.3, 12.2 |
| 13. Retroactive Achievement Awards | 13.1–13.5 | 11.1 |
| 14. Achievement Tier Progression Pacing | 14.1–14.4 | 2.1 |
| 15. Achievement Rewards Are Non-Gating | 15.1–15.3 | 2.1, 2.2, 2.3, 4.1, 12.1 |
| 16. Achievement System Security | 16.1–16.6 | 6.1, 6.3, 7.1, 12.2 |
| 17. Documentation Updates | 17.1–17.5 | 15.1, 15.2, 15.3, 15.4, 15.5 |
| 18. Achievement Audit Logging | 18.1–18.7 | 15A.1, 15A.2, 15A.3, 15A.4 |

## Notes

- All tasks are mandatory — no optional tasks per project spec quality standards.
- Each task references specific requirements for traceability.
- Checkpoints ensure incremental validation at key milestones.
- Property tests validate universal correctness properties from the design document.
- Unit tests validate specific examples and edge cases.
- The final task group runs the Verification Criteria from requirements.md to confirm the spec delivered what it promised.
