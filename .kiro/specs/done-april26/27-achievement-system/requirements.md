# Requirements Document

## Introduction

The Achievement & Milestone System adds a progression layer to Armoured Souls that transforms invisible prestige and fame accumulation into celebrated milestones. Achievements span multiple difficulty tiers (Easy, Medium, Hard, Very Hard, Secret), each awarding credit and prestige rewards with a collectible hexagonal badge and progress tracking. The system directly addresses Loop 4 (Reputation Loop) from the Game Loop Audit — today prestige and fame are one-way accumulators with no celebration moments. Achievements provide the "dopamine hit" layer on top of the existing economic backbone.

The full achievement catalog is defined in #[[file:docs/game-systems/PRD_ACHIEVEMENT_SYSTEM.md]]. This requirements document captures the system behavior, not the individual achievement content.

## Glossary

- **Achievement**: A one-time milestone that a player earns by meeting a specific trigger condition, awarding credits, prestige, and a collectible badge.
- **Achievement_Service**: The centralized backend singleton responsible for evaluating trigger conditions and awarding achievements after game events.
- **Achievement_Config**: The static TypeScript configuration file (`src/config/achievements.ts`) defining all achievement definitions including trigger conditions, rewards, and metadata. Definitions live in code (version-controlled, deployed with the app) rather than in the database, because they change with game updates, not at runtime.
- **Badge**: A hexagonal, industrial-themed SVG/WebP icon representing an achievement, displayed in full color when unlocked and greyed out when locked.
- **Tier**: A difficulty classification (Easy, Medium, Hard, Very Hard, Secret) that determines an achievement's credit reward, prestige reward, and badge border color.
- **Pinned_Achievement**: An unlocked achievement selected by the player for display on their stable page showcase (maximum 6).
- **Rarity_Cache**: An in-memory cache storing per-achievement earner counts and total active player count, refreshed once per game cycle.
- **Progress_Indicator**: A visual bar with exact numeric values showing a player's current progress toward a numeric achievement threshold.
- **Stable_Page**: The public-facing page (`/stables/:userId`) displaying a player's stable information, robots, facilities, and achievement showcase.
- **Achievements_Page**: The private page (`/achievements`) where a player views all achievements, progress, rarity data, and manages pinned favourites.
- **Toast_Notification**: A slide-in notification displayed when an achievement unlocks, showing the badge, name, reward, and rarity.
- **User_Achievement**: A database record linking a user to an earned achievement, including the unlock timestamp and optionally the robot that earned it.
- **Retroactive_Award**: The one-time process on feature launch that evaluates existing player data and grants all already-qualified achievements.
- **Active_Player**: A player (User) who has participated in at least one battle, used as the denominator for rarity percentage calculations.
- **Robot_Level_Achievement**: An achievement triggered by an individual robot's performance (e.g., wins, kills, ELO), where the earning robot is recorded.
- **User_Level_Achievement**: An achievement triggered by stable-wide metrics (e.g., prestige, total currency, facility count), not tied to a specific robot.

## Expected Contribution

This spec addresses **Backlog #8 (Achievement / Milestone System)** and **Loop 4 (Reputation Loop)** from the Game Loop Audit (#6). Today, prestige and fame are invisible accumulators — players have no milestone moments, no celebration, and no intermediate goals. The achievement system fixes this.

### Concrete Outcomes

1. **Loop 4 goes from broken to functional**: Before — prestige ticks from 999 to 1,000 with zero player-visible feedback. After — a toast notification fires, credits and prestige are awarded, a badge unlocks, and the player sees "Established" on their profile. Every prestige rank threshold and fame tier becomes a celebrated moment.
2. **Players gain intermediate goals**: Before — no answer to "what should I work toward?" After — the `/achievements` page shows progress bars like "34/50 wins" and "742/1,000 prestige", giving players concrete targets between cycles.
3. **Social proof layer added**: Before — no way to compare progression with other players outside leaderboards. After — every achievement shows "Earned by 3 of 16 players (19%)" with rarity labels (Common → Legendary).
4. **Stable page gains identity**: Before — `StableViewPage` shows stats, robots, and facilities. After — a 6-badge pinned showcase section lets players curate their "trophy wall," visible to all visitors.
5. **New backend service pattern**: `AchievementService` establishes the event-driven evaluation pattern (check-and-award after game actions) that can be reused for future systems (daily challenges, seasonal rewards).
6. **New database infrastructure**: `UserAchievement` table for unlock records, `pinnedAchievements` JSON on User, `currentWinStreak`/`bestWinStreak` on Robot for league battles.

### Verification Criteria

After all tasks are complete, run these checks to confirm the spec delivered:

1. **Achievement config exists and has entries**: `grep -c "id:" app/backend/src/config/achievements.ts` returns a positive number matching the achievement count in the PRD.
2. **Database model exists**: `grep "user_achievements" app/backend/prisma/schema.prisma` returns the model definition. `grep "pinned_achievements" app/backend/prisma/schema.prisma` returns the User field.
3. **Win streak fields exist**: `grep "current_win_streak" app/backend/prisma/schema.prisma` returns Robot model fields.
4. **API endpoints exist**: `grep -r "\/api\/achievements" app/backend/src/routes/` returns routes for GET /api/achievements, GET /api/achievements/recent, and PUT /api/achievements/pinned.
5. **Stable API extended**: `grep "achievements" app/backend/src/routes/stables.ts` shows achievement data in the stable response.
6. **AchievementService integration**: `grep "achievementService\|checkAndAward" app/backend/src/services/battle/battlePostCombat.ts` confirms the post-combat hook is wired.
7. **Frontend pages exist**: `ls app/frontend/src/pages/AchievementsPage.tsx` succeeds. `grep -i "achievement" app/frontend/src/pages/StableViewPage.tsx` shows the showcase section.
8. **Tests pass**: `cd app/backend && npm test -- --silent` exits 0. Achievement-specific test files exist under `app/backend/tests/`.
9. **Retroactive script exists**: `ls app/backend/scripts/retroactive-achievements.ts` succeeds.
10. **Zod validation on achievement routes**: `grep "validateRequest" app/backend/src/routes/achievements.ts` returns matches for all route handlers.
11. **PRD updated**: `grep "Implemented\|IMPLEMENTED" docs/game-systems/PRD_ACHIEVEMENT_SYSTEM.md` shows the status has been updated.

---

## Requirements

### Requirement 1: Achievement Definition Configuration

**User Story:** As a developer, I want all achievement definitions stored in a static TypeScript configuration file, so that achievement metadata is version-controlled, deployed with the app, and does not require database changes or admin UI to update.

#### Acceptance Criteria

1. THE Achievement_Config SHALL define each achievement entry with a unique string identifier (e.g., "C1", "L5", "E3").
2. WHEN a new achievement entry is added to the Achievement_Config, THE Achievement_Config SHALL require the following fields: id, name, description, reference, tier, scope, rewardCredits, rewardPrestige, hidden, triggerType, progressType, progressLabel, and badgeIconFile.
3. THE Achievement_Config SHALL assign each achievement to exactly one tier from the set: easy, medium, hard, very_hard, secret.
4. THE Achievement_Config SHALL assign each achievement a scope of either "user" or "robot".
5. THE Achievement_Config SHALL set the `hidden` field to true for all achievements with tier "secret" and false for all other tiers.
6. THE Achievement_Config SHALL define credit rewards per tier as: Easy ₡25,000, Medium ₡50,000, Hard ₡100,000, Very Hard ₡250,000, Secret ₡50,000 (default, overridable per achievement).
7. THE Achievement_Config SHALL define prestige rewards per tier as: Easy +25, Medium +50, Hard +100, Very Hard +250, Secret +50 (default, overridable per achievement).
8. THE Achievement_Config SHALL be the single source of truth for achievement definitions — no achievement metadata SHALL be stored in the database.

### Requirement 2: Achievement Data Model and Persistence

**User Story:** As a developer, I want a database model to record which achievements each player has earned, so that unlock state persists across sessions and seasons.

#### Acceptance Criteria

1. THE User_Achievement model SHALL store the fields: id, userId, achievementId, robotId (nullable), and unlockedAt.
2. THE User_Achievement model SHALL enforce a unique constraint on the combination of userId and achievementId, preventing duplicate awards.
3. WHEN a Robot_Level_Achievement is awarded, THE Achievement_Service SHALL record the robotId of the robot that triggered the achievement.
4. WHEN a User_Level_Achievement is awarded, THE Achievement_Service SHALL set robotId to null.
5. THE User_Achievement model SHALL include database indexes on userId, robotId, and achievementId for query performance.
6. THE User model SHALL include a `pinnedAchievements` JSON field defaulting to an empty array, storing up to 6 achievement ID strings.

### Requirement 3: Achievement Evaluation and Awarding

**User Story:** As a player, I want achievements to be automatically evaluated and awarded when I complete qualifying actions, so that I receive recognition without manual intervention.

#### Acceptance Criteria

1. WHEN a battle completes, THE Achievement_Service SHALL evaluate all applicable achievement conditions for each participating robot and its owner.
2. WHEN a league promotion occurs, THE Achievement_Service SHALL evaluate league progression achievements for the promoted robot.
3. WHEN a weapon is purchased, THE Achievement_Service SHALL evaluate weapon-related achievements for the purchasing player.
4. WHEN a robot attribute is upgraded, THE Achievement_Service SHALL evaluate attribute achievements for the upgraded robot's owner.
5. WHEN a facility is upgraded, THE Achievement_Service SHALL evaluate facility achievements for the upgrading player.
6. WHEN a robot is created, THE Achievement_Service SHALL evaluate robot count achievements for the creating player.
7. WHEN tuning points are allocated, THE Achievement_Service SHALL evaluate tuning achievements for the allocating player.
8. WHEN onboarding completes, THE Achievement_Service SHALL evaluate the onboarding achievement for the completing player.
9. WHEN a practice arena battle completes, THE Achievement_Service SHALL evaluate the practice battle achievement for the participating player.
10. WHEN a tournament completes, THE Achievement_Service SHALL evaluate tournament achievements for the winning robot's owner.
11. WHEN an achievement condition is met and the player does not already hold that achievement, THE Achievement_Service SHALL create a User_Achievement record and award the configured credit and prestige rewards to the player.
12. WHEN an achievement condition is met and the player already holds that achievement, THE Achievement_Service SHALL take no action (idempotent behavior enforced by the unique constraint).
13. THE Achievement_Service SHALL return the list of newly unlocked achievements to the calling code, enabling toast notification data to be included in API responses.

### Requirement 4: Win Streak Tracking

**User Story:** As a player, I want my consecutive win streaks tracked per robot per battle type, so that streak-based achievements can be evaluated accurately.

#### Acceptance Criteria

1. THE Robot model SHALL include `currentWinStreak` and `bestWinStreak` integer fields for league battles, both defaulting to 0.
2. WHEN a robot wins a league battle, THE system SHALL increment that robot's league currentWinStreak by 1.
3. WHEN a robot loses or draws a league battle, THE system SHALL reset that robot's league currentWinStreak to 0.
4. WHEN a robot's currentWinStreak exceeds its bestWinStreak, THE system SHALL update bestWinStreak to match currentWinStreak.
5. THE existing KotH win streak fields (`kothCurrentWinStreak`, `kothBestWinStreak`) SHALL be used for KotH streak-based achievements — no new KotH fields are needed.
6. THE win streak fields SHALL be updated in the same post-combat transaction that updates other robot stats, ensuring consistency.

### Requirement 5: Achievement Progress Computation

**User Story:** As a player, I want to see my exact progress toward each achievement, so that I know how close I am to earning it and have intermediate goals to work toward.

#### Acceptance Criteria

1. WHEN the Achievements_Page is loaded, THE Achievements_Page SHALL display a progress bar with exact numeric values for every achievement that has a numeric threshold (e.g., "34 / 50 wins", "₡3,290,028 / ₡5,000,000").
2. THE Achievement_Service SHALL compute progress values at read time from existing User and Robot model fields, without storing redundant progress counters.
3. WHEN a Robot_Level_Achievement has a numeric threshold, THE Achievement_Service SHALL report the progress of the player's best-performing robot for that metric, along with that robot's name.
4. WHEN an achievement has a boolean or one-time trigger condition, THE Achievements_Page SHALL display "Not yet achieved" instead of a progress bar for locked achievements, or the unlock date for unlocked achievements.
5. WHEN an achievement has tier "secret" and is not yet earned, THE Achievements_Page SHALL display "???" with no progress information.
6. WHEN an achievement has tier "secret" and is earned, THE Achievements_Page SHALL display the achievement normally with full details.

### Requirement 6: Pinned Achievement Showcase on Stable Page

**User Story:** As a player, I want to select up to 6 favourite achievements to display on my stable page, so that other players can see my proudest accomplishments when visiting my stable.

#### Acceptance Criteria

1. THE Stable_Page SHALL display a row of 6 hexagonal badge slots in the achievement showcase section, positioned between the "Stable Statistics" and "Robots" sections.
2. WHEN a player has pinned achievements, THE Stable_Page SHALL display those badges at 64×64px with their tier-colored border.
3. WHEN a pinned badge slot is empty, THE Stable_Page SHALL display a faint hexagonal outline placeholder.
4. WHEN a visitor hovers over a pinned badge, THE Stable_Page SHALL display a tooltip showing the achievement name, description, and unlock date.
5. WHEN a player views their own stable, THE Stable_Page SHALL display an "×" button on each pinned badge to unpin it and a "+" button on empty slots to open a picker modal.
6. THE picker modal SHALL display all of the player's unlocked achievements as a grid, allowing the player to select one to pin.
7. WHEN a player attempts to pin more than 6 achievements, THE System SHALL reject the request with a 400 status code.
8. WHEN a player attempts to pin an achievement they have not unlocked, THE System SHALL reject the request with a 400 status code.
9. THE Stable_Page SHALL display a summary line below the showcase: "{unlocked}/{total} Achievements · View all →" linking to the Achievements_Page.

### Requirement 7: Dedicated Achievements Page

**User Story:** As a player, I want a dedicated page to browse all achievements, track my progress, and manage my pinned favourites, so that I have a comprehensive view of my progression.

#### Acceptance Criteria

1. THE Achievements_Page SHALL display all achievements in a scrollable list (no category tabs — categories are internal metadata only).
2. THE Achievements_Page SHALL display each achievement as a card showing: badge (locked or unlocked), name, one-line description, progress indicator, reward preview, unlock date (if earned), rarity indicator, and a pin toggle button.
3. THE Achievements_Page SHALL provide filter controls for: tier (Easy, Medium, Hard, Very Hard, Secret), and status (All, Locked, Unlocked).
4. THE Achievements_Page SHALL provide sort options for: default order, rarity (rarest first or most common first), status (locked first or unlocked first), and tier (hardest first or easiest first).
5. THE Achievements_Page SHALL display a summary section showing total unlocked count and per-tier breakdown.
6. WHEN a player toggles the pin button on an achievement card, THE Achievements_Page SHALL add or remove that achievement from the player's pinned list (respecting the maximum of 6).
7. THE Achievements_Page SHALL display reward previews greyed out for locked achievements and highlighted for unlocked achievements.
8. THE Achievements_Page SHALL use the tier color as the progress bar fill color (green for Easy, blue for Medium, orange for Hard, red for Very Hard, purple for Secret).

### Requirement 8: Achievement Rarity and Social Proof

**User Story:** As a player, I want to see how many other players have earned each achievement, so that I can gauge whether I am ahead of or behind the community and feel motivated by rare accomplishments.

#### Acceptance Criteria

1. THE Achievements_Page SHALL display a rarity indicator on each achievement card showing "Earned by {count} of {total} players ({percentage}%)".
2. THE Rarity_Cache SHALL compute earner counts per achievement and total Active_Player count, refreshed once per game cycle during settlement.
3. THE Achievements_Page SHALL display a rarity label based on the percentage of Active_Players who earned the achievement: Common (>75%), Uncommon (25–75%), Rare (10–25%), Epic (1–10%), Legendary (<1% or 0).
4. THE Stable_Page achievement showcase SHALL NOT display rarity labels on pinned badges.

### Requirement 9: Achievement Badge Display

**User Story:** As a player, I want every achievement to have a visually distinct hexagonal badge that is greyed out when locked and full color when unlocked, so that I have a clear visual representation of my progress.

#### Acceptance Criteria

1. THE Badge SHALL use a hexagonal frame with a 4px border in the tier color: green (#3fb950) for Easy, blue (#58a6ff) for Medium, orange (#d29922) for Hard, red (#f85149) for Very Hard, purple (#a371f7) for Secret.
2. THE Badge SHALL render at 128×128px in detail views and 64×64px in list views.
3. WHILE an achievement is locked, THE Badge SHALL render in monochrome grayscale with 40% opacity via CSS filter, with the border ring in #57606a.
4. WHILE an achievement is unlocked, THE Badge SHALL render in full color with a subtle inner glow matching the tier color at 20% opacity.
5. THE Badge locked and unlocked states SHALL be achieved via CSS classes applied to a single image asset per achievement, without requiring separate locked image files.
6. WHEN an achievement has tier "secret" and is not yet earned, THE system SHALL display a generic "???" placeholder badge (a hexagonal frame with purple border and a question mark icon) instead of the achievement's actual badge silhouette.
7. WHEN an achievement has tier "secret" and is earned, THE system SHALL display the achievement's actual badge in full color, identical to non-secret unlocked badges.

### Requirement 10: Achievement Toast Notifications

**User Story:** As a player, I want to receive a celebratory notification when I earn an achievement, so that the moment feels rewarding and I am aware of my accomplishment.

#### Acceptance Criteria

1. WHEN an achievement unlocks after a battle, THE System SHALL display a slide-in toast notification from the top-right showing the badge icon at 48×48px, achievement name, reward summary, and rarity label.
2. THE toast notification SHALL auto-dismiss after 5 seconds.
3. WHEN multiple achievements unlock simultaneously, THE System SHALL stack the toast notifications.
4. WHEN a player clicks a toast notification, THE System SHALL navigate to that achievement on the Achievements_Page.
5. THE unlock animation on the badge SHALL use a 300ms scale-in animation (0.95 → 1.0, ease-out) and SHALL respect the `prefers-reduced-motion` media query by disabling the animation.

### Requirement 11: Battle Report Achievement Integration

**User Story:** As a player, I want to see which achievements I earned from a battle directly in the battle report, so that I can associate accomplishments with specific battles.

#### Acceptance Criteria

1. WHEN a battle results in one or more achievement unlocks, THE battle report SHALL display the earned achievement badges in a row below the "Battle Outcomes" section.
2. WHEN a battle results in no achievement unlocks, THE battle report SHALL not display an achievement section.

### Requirement 12: Achievement API Endpoints

**User Story:** As a developer, I want well-defined API endpoints for retrieving achievements and managing pinned favourites, so that the frontend can display achievement data and allow player interaction.

#### Acceptance Criteria

1. THE System SHALL provide a `GET /api/achievements` endpoint that returns the full achievement catalog with the authenticated player's progress, unlock status, pinned state, and rarity data.
2. THE System SHALL provide a `GET /api/achievements/recent` endpoint that returns the last 10 unlocked achievements for the authenticated player.
3. THE System SHALL provide a `PUT /api/achievements/pinned` endpoint that accepts an array of up to 6 achievement ID strings and updates the authenticated player's pinned achievements.
4. WHEN the `PUT /api/achievements/pinned` endpoint receives more than 6 IDs, an invalid achievement ID, or an achievement ID the player has not unlocked, THE System SHALL return a 400 status code with a descriptive error message.
5. THE `GET /api/stables/:userId` endpoint SHALL be extended to include the viewed player's pinned achievements (id, name, tier, badgeIconFile, unlockedAt) and achievement summary (totalUnlocked, totalAvailable) in its response.
6. ALL achievement API endpoints SHALL apply Zod schema validation to their params, query, and body using the `validateRequest` middleware.

### Requirement 13: Retroactive Achievement Awards

**User Story:** As an existing player, I want to receive all achievements I have already qualified for when the feature launches, so that my prior accomplishments are recognized immediately.

#### Acceptance Criteria

1. WHEN the achievement system launches, THE System SHALL run a one-time migration script that evaluates every achievement condition against each existing player's current data.
2. WHEN an existing player qualifies for one or more achievements based on current data, THE migration script SHALL create User_Achievement records and award the accumulated credit and prestige rewards in a single transaction per player.
3. THE migration script SHALL set the `unlockedAt` timestamp to the migration execution time for all retroactively awarded achievements.
4. THE migration script SHALL execute before the frontend feature is enabled, so that players see their existing achievements on first load.
5. THE migration script SHALL log the total number of retroactive awards per player for admin visibility.

### Requirement 14: Achievement Tier Progression Pacing

**User Story:** As a game designer, I want the achievement set distributed across difficulty tiers with deliberate pacing, so that the full set is not completable in a single season and players always have goals to work toward.

#### Acceptance Criteria

1. THE Easy tier achievements SHALL be earnable within the first week of play for an active player.
2. THE Very Hard tier achievements SHALL require multiple seasons of sustained play to complete.
3. THE Secret tier achievements SHALL remain hidden (name shows as "???", generic placeholder badge, no progress bar) until earned by the player.
4. THE full achievement set SHALL NOT be completable within a single season by any player.

### Requirement 15: Achievement Rewards Are Non-Gating

**User Story:** As a game designer, I want achievement rewards limited to credits and prestige, so that achievements celebrate accomplishments without creating combat advantages or gating gameplay mechanics.

#### Acceptance Criteria

1. THE Achievement_Config SHALL define rewards exclusively as credits and prestige for every achievement.
2. THE Achievement_Service SHALL NOT grant any combat stat bonuses, weapon unlocks, or gameplay mechanic access as achievement rewards.
3. THE Achievement_Service SHALL NOT restrict access to any game feature based on achievement count or specific achievement completion.

### Requirement 16: Achievement System Security

**User Story:** As a developer, I want the achievement system to follow the project's security patterns, so that achievement data cannot be manipulated by unauthorized users.

#### Acceptance Criteria

1. ALL achievement API endpoints SHALL require authentication via the `authenticateToken` middleware.
2. THE `GET /api/achievements` and `GET /api/achievements/recent` endpoints SHALL only return data for the authenticated user — a player SHALL NOT be able to view another player's full achievement progress or unlock history.
3. THE `PUT /api/achievements/pinned` endpoint SHALL only modify the authenticated user's pinned achievements — a player SHALL NOT be able to modify another player's pins.
4. THE Achievement_Service SHALL award achievements exclusively through server-side evaluation — no client-submitted claim or unlock request SHALL be accepted.
5. THE `PUT /api/achievements/pinned` endpoint SHALL validate that every achievement ID in the request exists in the Achievement_Config and is unlocked by the authenticated user, returning 400 for invalid or locked IDs.
6. THE achievement routes SHALL use the `validateRequest` middleware with Zod schemas for all params, query, and body inputs, consistent with the project's ESLint `require-validate-request` rule.

### Requirement 18: Achievement Audit Logging and Cycle Summary Integration

**User Story:** As a game operator, I want every achievement unlock to be logged as an audit event with the credit and prestige rewards, so that the cycle summary's financial numbers are fully reconciled and achievement income is visible in analytics.

#### Acceptance Criteria

1. WHEN an achievement is awarded, THE Achievement_Service SHALL log an `achievement_unlock` audit event via the EventLogger, including the achievementId, achievement name, tier, rewardCredits, and rewardPrestige in the payload.
2. THE `achievement_unlock` audit event SHALL include the userId and robotId (if applicable) in the event options, consistent with other audit event types.
3. THE `StableMetric` interface SHALL include an `achievementRewards` field representing the total credits earned from achievement unlocks during the cycle.
4. THE `CycleSnapshotService.aggregateStableMetrics()` method SHALL query `achievement_unlock` audit events for the cycle and sum the credit rewards per user into the `achievementRewards` field.
5. THE `achievementRewards` field SHALL be included in the `netProfit` calculation alongside other income sources (battle credits, merchandising, streaming) minus expenses (repair costs, operating costs, purchases).
6. THE `CycleEventPayload` interface SHALL include an `achievementId` field for achievement unlock events.
7. THE `docs/backend/docs/audit-logging-schema.md` SHALL be updated to document the `achievement_unlock` event type and its payload schema.

### Requirement 17: Documentation Updates

**User Story:** As a developer, I want all affected documentation updated when the achievement system is implemented, so that the project's documentation stays accurate and complete.

#### Acceptance Criteria

1. THE PRD at `docs/game-systems/PRD_ACHIEVEMENT_SYSTEM.md` SHALL be updated to reflect the final implementation status (mark sections as implemented, update any design decisions that changed during implementation).
2. THE `docs/BACKLOG.md` SHALL be updated to move Achievement System (#8) to the "Recently Completed" table with a link to this spec.
3. THE `docs/game-systems/PRD_PRESTIGE_AND_FAME.md` "What's Not Implemented" section SHALL be updated to reference the achievement system as implemented, linking to the PRD.
4. THE `docs/game-systems/PRD_ECONOMY_SYSTEM.md` Section 6 (Achievement Rewards) SHALL be updated to reflect the final reward amounts and link to the achievement PRD.
5. IF new steering files or patterns are introduced (e.g., event-driven service pattern), THEY SHALL be documented in the appropriate location under `.kiro/steering/` or `docs/guides/`.
