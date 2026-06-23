# Page → Database Table Audit

> Generated 2026-06-20. Full audit of every frontend page/tab and the database tables it reads.

## Database Tables (27 total)

| # | Model | DB Table |
|---|-------|----------|
| 1 | User | `users` |
| 2 | Facility | `facilities` |
| 3 | Robot | `robots` |
| 4 | WeaponInventory | `weapon_inventory` |
| 5 | WeaponRefinement | `weapon_refinement` |
| 6 | Weapon | `weapons` |
| 7 | BattleParticipant | `battle_participants` |
| 8 | Battle | `battles` |
| 9 | ScheduledLeagueMatch | `scheduled_matches` |
| 10 | CycleMetadata | `cycle_metadata` |
| 11 | AuditLog | `audit_logs` |
| 12 | CycleSnapshot | `cycle_snapshots` |
| 13 | Tournament | `tournaments` |
| 14 | ScheduledTournamentMatch | `tournament_matches` |
| 15 | ResetLog | `reset_logs` |
| 16 | ScheduledKothMatch | `scheduled_koth_matches` |
| 17 | ScheduledKothMatchParticipant | `scheduled_koth_match_participants` |
| 18 | PracticeArenaDailyStats | `practice_arena_daily_stats` |
| 19 | ChangelogEntry | `changelog_entries` |
| 20 | UserAchievement | `user_achievements` |
| 21 | TuningAllocation | `tuning_allocations` |
| 22 | AdminAuditLog | `admin_audit_logs` |
| 23 | LeagueHistory | `league_history` |
| 24 | Subscription | `subscriptions` |
| 25 | TeamBattle | `team_battles` |
| 26 | TeamBattleMember | `team_battle_members` |
| 27 | ScheduledTeamBattleMatch | `scheduled_team_battle_matches` |

---

## Player Pages

### 1. Dashboard (`/dashboard`)

| Component | Tables Read |
|-----------|-------------|
| Robot cards | `robots`, `weapons`, `weapon_inventory` |
| Upcoming matches | `scheduled_matches`, `scheduled_koth_matches`, `tournament_matches`, `scheduled_team_battle_matches`, `robots` |
| Recent matches | `battles`, `battle_participants`, `robots` |
| Financial summary | `users` (currency), `robots`, `facilities`, `subscriptions` |
| Stable statistics | `users`, `robots` |
| Team readiness warning | `team_battles`, `team_battle_members`, `subscriptions`, `robots` |
| League standings summary | `robots` (leaguePoints, currentLeague) |
| Active tournament card | `tournaments`, `tournament_matches` |
| Tier change notifications | `league_history` |
| Changelog modal | `changelog_entries`, `users` (lastSeenChangelog) |
| Onboarding banner | `users` (onboarding fields) |

**Total tables: 15** — `users`, `robots`, `facilities`, `weapons`, `weapon_inventory`, `subscriptions`, `team_battles`, `team_battle_members`, `scheduled_matches`, `scheduled_koth_matches`, `tournament_matches`, `scheduled_team_battle_matches`, `battles`, `battle_participants`, `league_history`, `changelog_entries`

---

### 2. Robot Detail (`/robots/:id`)

| Tab | Tables Read |
|-----|-------------|
| **Overview** | `robots`, `weapon_inventory`, `weapons`, `weapon_refinement`, `users` |
| **Matches** | `battles`, `battle_participants`, `robots` |
| **Upgrades** (owner) | `robots`, `users` (currency), `facilities` (academy levels), `cycle_metadata` |
| **Tuning** (owner) | `tuning_allocations`, `robots`, `facilities` (tuning bay level) |
| **Battle Config** (owner) | `robots`, `weapon_inventory`, `weapons`, `weapon_refinement` |
| **Stats** (owner) | `robots`, `battle_participants` |
| **Analytics** | `robots`, `battles`, `battle_participants`, `cycle_snapshots`, `audit_logs` |
| **League History** | `league_history`, `robots`, `team_battles` |

**Upcoming Matches sidebar**: `scheduled_matches`, `tournament_matches`, `scheduled_koth_matches`, `scheduled_team_battle_matches`

**Total tables: 14** — `robots`, `users`, `facilities`, `weapon_inventory`, `weapons`, `weapon_refinement`, `battles`, `battle_participants`, `tuning_allocations`, `cycle_metadata`, `cycle_snapshots`, `audit_logs`, `league_history`, `scheduled_matches`, `tournament_matches`, `scheduled_koth_matches`, `scheduled_team_battle_matches`, `team_battles`

---

### 3. Robots List (`/robots`)

| Tables Read |
|-------------|
| `robots`, `weapon_inventory`, `weapons`, `users` |

---

### 4. Create Robot (`/robots/create`)

| Tables Read | Tables Written |
|-------------|---------------|
| `users` (currency), `facilities` (roster expansion level), `robots` (count) | `robots` (create), `users` (deduct currency), `audit_logs` |

---

### 5. Weapon Shop (`/weapon-shop`)

| Tab | Tables Read | Tables Written |
|-----|-------------|---------------|
| **Catalog** | `weapons`, `facilities` (workshop level for discount), `users` (currency) | — |
| **Inventory** | `weapon_inventory`, `weapons`, `weapon_refinement`, `robots` (equipped status), `users` (currency) | `weapon_inventory` (sell), `weapon_refinement` (create on refine), `users` (credit changes) |

**Total tables: 6** — `weapons`, `weapon_inventory`, `weapon_refinement`, `robots`, `users`, `facilities`

---

### 6. Facilities (`/facilities`)

| Tables Read | Tables Written |
|-------------|---------------|
| `facilities`, `users` (currency), `robots` (count for roster), `cycle_metadata` | `facilities` (upgrade), `users` (deduct currency), `audit_logs` |

---

### 7. Booking Office (`/booking-office`)

| Tables Read | Tables Written |
|-------------|---------------|
| `subscriptions`, `robots`, `facilities` (booking office level), `team_battles`, `team_battle_members` | `subscriptions` (subscribe/unsubscribe) |

---

### 8. Battle History (`/battle-history`)

| Filter | Tables Read |
|--------|-------------|
| All types (league, tournament, koth, tag_team, league_2v2, league_3v3, tournament_2v2, tournament_3v3) | `battles`, `battle_participants`, `robots`, `users` |
| Outcome filter (win/loss/draw) | Same tables, filtered by `winnerId` |

**Total tables: 4** — `battles`, `battle_participants`, `robots`, `users`

---

### 9. Battle Detail (`/battle/:id`)

| Tables Read |
|-------------|
| `battles` (including `battleLog` JSON), `battle_participants`, `robots`, `users` |

**Total tables: 4** — `battles`, `battle_participants`, `robots`, `users`

---

### 10. League Standings (`/league-standings`)

| Tab/Mode | Tables Read |
|----------|-------------|
| **1v1** | `robots`, `users`, `subscriptions` |
| **2v2** | `team_battles`, `team_battle_members`, `robots`, `users` |
| **3v3** | `team_battles`, `team_battle_members`, `robots`, `users` |
| **Tag Team** | `team_battles`, `team_battle_members`, `robots`, `users` |
| Instance list (all modes) | Same as above per mode |

**Total tables: 5** — `robots`, `users`, `subscriptions`, `team_battles`, `team_battle_members`

---

### 11. KotH Standings (`/koth-standings`)

| Tables Read |
|-------------|
| `robots`, `users`, `subscriptions`, `scheduled_koth_matches`, `battles` |

---

### 12. Leaderboards

| Page | Tables Read |
|------|-------------|
| **Fame** (`/leaderboards/fame`) | `robots`, `users` |
| **Prestige** (`/leaderboards/prestige`) | `users` |
| **Losses** (`/leaderboards/losses`) | `robots`, `users` |

---

### 13. Hall of Records (`/hall-of-records`)

| Category Tab | Tables Read |
|--------------|-------------|
| **Combat** | `battles`, `battle_participants`, `robots`, `users` |
| **Upsets** | `battles`, `battle_participants`, `robots` |
| **Career** | `robots`, `users` |
| **Economic** | `users` |
| **Prestige** | `users` |
| **King of the Hill** | `robots`, `users` |
| **Team Battles** | `team_battles`, `team_battle_members`, `robots`, `users` |
| **Tournaments** | `tournaments`, `robots`, `users` |

**Total tables: 7** — `battles`, `battle_participants`, `robots`, `users`, `team_battles`, `team_battle_members`, `tournaments`

---

### 14. Tournaments (`/tournaments`)

| View | Tables Read |
|------|-------------|
| **List** | `tournaments` |
| **Detail** (`/tournaments/:id`) | `tournaments`, `tournament_matches`, `robots`, `users`, `team_battles`, `team_battle_members` |

---

### 15. Team Battles (`/team-battles`)

| Tab | Tables Read | Tables Written |
|-----|-------------|---------------|
| **2v2** | `team_battles`, `team_battle_members`, `robots`, `subscriptions`, `scheduled_team_battle_matches`, `league_history` | `team_battles`, `team_battle_members` |
| **3v3** | `team_battles`, `team_battle_members`, `robots`, `subscriptions`, `scheduled_team_battle_matches`, `league_history` | `team_battles`, `team_battle_members` |

**Total tables: 6** — `team_battles`, `team_battle_members`, `robots`, `subscriptions`, `scheduled_team_battle_matches`, `league_history`

---

### 16. Financial Report (`/income`)

| Tab | Tables Read |
|-----|-------------|
| **Overview** | `users`, `robots`, `facilities`, `subscriptions`, `cycle_metadata` |
| **Per-Robot** | `users`, `robots`, `facilities`, `subscriptions`, `cycle_metadata` |

**Total tables: 5** — `users`, `robots`, `facilities`, `subscriptions`, `cycle_metadata`

---

### 17. Cycle Summary (`/cycle-summary`)

| Tables Read |
|-------------|
| `audit_logs`, `cycle_metadata`, `users` |

---

### 18. Practice Arena (`/practice-arena`)

| Tables Read | Tables Written |
|-------------|---------------|
| `robots`, `weapon_inventory`, `weapons`, `weapon_refinement`, `tuning_allocations`, `facilities`, `users` | `practice_arena_daily_stats`, `users` (totalPracticeBattles) |

---

### 19. Achievements (`/achievements`)

| Tables Read | Tables Written |
|-------------|---------------|
| `user_achievements`, `users` (pinnedAchievements), `robots` | `user_achievements` (pin/unpin) |

---

### 20. Profile (`/profile`)

| Tables Read | Tables Written |
|-------------|---------------|
| `users`, `robots`, `facilities` | `users` (profile update, password change) |

---

### 21. Stable View (`/stables/:userId`)

| Tables Read |
|-------------|
| `users`, `robots`, `facilities`, `team_battles`, `team_battle_members`, `user_achievements` |

---

### 22. Changelog (`/changelog`)

| Tables Read | Tables Written |
|-------------|---------------|
| `changelog_entries`, `users` (lastSeenChangelog) | `users` (dismiss/mark as seen) |

---

### 23. Guide (`/guide`)

| Tables Read |
|-------------|
| (none — static markdown from filesystem) |

---

### 24. Onboarding (`/onboarding`)

| Tables Read | Tables Written (on reset) |
|-------------|--------------------------|
| `users`, `robots`, `scheduled_matches`, `tournament_matches`, `scheduled_team_battle_matches`, `scheduled_koth_matches`, `reset_logs` | `users`, `robots` (delete), `weapon_inventory` (delete), `facilities` (delete), `tuning_allocations` (delete), `subscriptions` (delete), `team_battles` (delete), `team_battle_members` (delete), `reset_logs` (create) |

---

## Admin Pages

### Admin: Dashboard (`/admin/dashboard`)

| Tables Read |
|-------------|
| `users`, `robots`, `battles`, `cycle_metadata`, `cycle_snapshots`, `subscriptions` |

---

### Admin: Cycle Controls (`/admin/cycles`)

| Tables Read | Tables Written |
|-------------|---------------|
| `cycle_metadata`, `robots`, `users`, `facilities`, `scheduled_matches`, `battles` | (All tables modified during cycle execution — see admin.ts) |

---

### Admin: Practice Arena (`/admin/practice-arena`)

| Tables Read |
|-------------|
| `practice_arena_daily_stats` |

---

### Admin: Battle Logs (`/admin/battles`)

| Tables Read |
|-------------|
| `battles`, `battle_participants`, `robots`, `users` |

---

### Admin: Robot Stats (`/admin/robot-stats`)

| Tables Read |
|-------------|
| `robots`, `users`, `battles`, `battle_participants` |

---

### Admin: League Health (`/admin/league-health`)

| Tables Read |
|-------------|
| `robots`, `team_battles`, `team_battle_members`, `subscriptions`, `league_history` |

---

### Admin: Weapon Analytics (`/admin/weapons`)

| Tables Read |
|-------------|
| `weapons`, `weapon_inventory`, `weapon_refinement`, `robots` |

---

### Admin: Players (`/admin/players`)

| Tables Read | Tables Written |
|-------------|---------------|
| `users`, `robots`, `facilities` | `users` (password reset) |

---

### Admin: Economy Overview (`/admin/economy`)

| Tables Read |
|-------------|
| `users`, `robots`, `facilities`, `audit_logs`, `cycle_metadata` |

---

### Admin: Security (`/admin/security`)

| Tables Read |
|-------------|
| In-memory security events (not DB), `users` |

---

### Admin: Image Uploads (`/admin/image-uploads`)

| Tables Read |
|-------------|
| Filesystem (upload directory), `robots` (imageUrl) |

---

### Admin: Changelog (`/admin/changelog`)

| Tables Read | Tables Written |
|-------------|---------------|
| `changelog_entries`, `users` | `changelog_entries` (create, update, delete, publish) |

---

### Admin: Achievement Analytics (`/admin/achievements`)

| Tables Read |
|-------------|
| `user_achievements`, `users`, `robots` |

---

### Admin: Tuning Adoption (`/admin/tuning`)

| Tables Read |
|-------------|
| `tuning_allocations`, `robots`, `facilities`, `users` |

---

### Admin: Refinement Adoption (`/admin/refinement`)

| Tables Read |
|-------------|
| `weapon_refinement`, `weapon_inventory`, `weapons`, `robots`, `users` |

---

### Admin: Repair Log (`/admin/repair-log`)

| Tables Read |
|-------------|
| `audit_logs` (event_type = repair-related), `robots`, `users` |

---

### Admin: Audit Log (`/admin/audit-log`)

| Tables Read | Tables Written |
|-------------|---------------|
| `admin_audit_logs`, `users` | `admin_audit_logs` (create manual entries) |

---

### Admin: League History (`/admin/league-history`)

| Tables Read |
|-------------|
| `league_history`, `robots`, `team_battles`, `users` |

---

### Admin: Subscription Analytics (`/admin/subscriptions`)

| Tables Read |
|-------------|
| `subscriptions`, `robots`, `users`, `audit_logs` |

---

### Admin: Tournaments (`/admin/tournaments`)

| Tables Read | Tables Written |
|-------------|---------------|
| `tournaments`, `tournament_matches`, `robots`, `users`, `team_battles`, `team_battle_members` | `tournaments`, `tournament_matches`, `battles`, `battle_participants`, `robots`, `admin_audit_logs` |

---

## Cross-Cutting Analysis: Table Usage Heatmap

| Table | # Pages Reading It | Pages |
|-------|-------------------|-------|
| `users` | **24** | Nearly all pages |
| `robots` | **22** | Nearly all pages except Guide, Changelog (alone), Onboarding (read for checks) |
| `battles` | **10** | Dashboard, Robot Detail, Battle History, Battle Detail, Hall of Records, KotH, Analytics, Admin (Battles, Robot Stats, Dashboard) |
| `battle_participants` | **9** | Dashboard, Robot Detail, Battle History, Battle Detail, Hall of Records, Analytics, Admin (Battles, Robot Stats) |
| `facilities` | **10** | Dashboard, Robot Detail, Weapon Shop, Facilities, Booking Office, Financial Report, Practice Arena, Profile, Stable View, Admin (Economy, Players, Tuning) |
| `weapon_inventory` | **7** | Dashboard, Robot Detail, Weapon Shop, Practice Arena, Robots List, Admin (Weapons, Refinement) |
| `weapons` | **7** | Dashboard, Robot Detail, Weapon Shop, Practice Arena, Robots List, Admin (Weapons, Refinement) |
| `weapon_refinement` | **6** | Robot Detail, Weapon Shop, Practice Arena, Admin (Weapons, Refinement) |
| `subscriptions` | **8** | Dashboard, Booking Office, League Standings, KotH, Team Battles, Financial Report, Admin (League Health, Subscriptions) |
| `team_battles` | **9** | Dashboard, League Standings, Team Battles, Hall of Records, Tournaments, Stable View, Booking Office, Admin (League Health, Tournaments) |
| `team_battle_members` | **8** | Dashboard, League Standings, Team Battles, Hall of Records, Tournaments, Stable View, Booking Office, Admin (Tournaments) |
| `scheduled_matches` | **4** | Dashboard, Robot Detail, Onboarding, Admin |
| `scheduled_team_battle_matches` | **4** | Dashboard, Robot Detail, Team Battles, Onboarding |
| `scheduled_koth_matches` | **4** | Dashboard, Robot Detail, KotH Standings, Onboarding |
| `tournament_matches` | **5** | Dashboard, Robot Detail, Tournaments, Onboarding, Admin (Tournaments) |
| `tournaments` | **5** | Dashboard, Hall of Records, Tournaments, Admin (Dashboard, Tournaments) |
| `league_history` | **6** | Dashboard, Robot Detail, League Standings (unseen), Team Battles, Admin (League Health, League History) |
| `tuning_allocations` | **3** | Robot Detail (Tuning tab), Practice Arena, Admin (Tuning) |
| `cycle_metadata` | **7** | Robot Detail (Upgrades), Weapon Shop (purchase), Facilities, Financial Report, Cycle Summary, Analytics, Admin |
| `cycle_snapshots` | **3** | Robot Detail (Analytics), Admin (Dashboard), Analytics |
| `audit_logs` | **6** | Robot Detail (Analytics), Cycle Summary, Admin (Economy, Repair Log, Subscriptions), Analytics |
| `user_achievements` | **4** | Achievements, Stable View, Admin (Achievements) |
| `changelog_entries` | **3** | Dashboard (modal), Changelog, Admin (Changelog) |
| `admin_audit_logs` | **2** | Admin (Audit Log, Tournaments) |
| `practice_arena_daily_stats` | **2** | Practice Arena (write), Admin (Practice Arena) |
| `reset_logs` | **1** | Onboarding |

---

## Unification Opportunities

### 1. Scheduling Tables — Strong Candidate for Unification

Currently **4 separate scheduling tables**:
- `scheduled_matches` (1v1 league)
- `scheduled_team_battle_matches` (2v2/3v3 league + tag team + team tournaments)
- `scheduled_koth_matches` + `scheduled_koth_match_participants`
- `tournament_matches` (1v1 tournaments)

**Overlap:** Dashboard, Robot Detail upcoming, and Onboarding all query ALL FOUR tables separately to assemble a unified "upcoming matches" view. The frontend already merges them into a single list.

**Potential unified model:**
```
ScheduledMatch {
  id, matchType (league_1v1 | league_2v2 | league_3v3 | tag_team | koth | tournament_1v1 | tournament_2v2 | tournament_3v3),
  participant1Id, participant1Type (robot | team),
  participant2Id?, participant2Type?,
  scheduledFor, status, battleId?,
  tournamentId?, round?, matchNumber?,
  leagueType?, leagueInstanceId?,
  kothConfig? (JSON for rotatingZone/scoreThreshold/timeLimit/zoneRadius),
  participants[] (for KotH multi-robot)
}
```

**Impact:** 4 tables → 1 table. Simplifies 4+ queries per page into 1 query with a `matchType` filter. Eliminates the "upcoming matches" merge logic on the frontend.

---

### 2. League Standings — Partial Overlap Between `robots` and `team_battles`

The league standings page queries:
- `robots` for 1v1 (using `currentLeague`, `leagueId`, `leaguePoints`)
- `team_battles` for 2v2/3v3/tag_team (using `teamLeague`, `teamLeagueId`, `teamLp` / `tagTeamLeague`, `tagTeamLeagueId`, `tagTeamLp`)

The league system logic (LP, tiers, instances, promotion/demotion) is duplicated across both models. `LeagueHistory` already has an `entityType` discriminator (`robot` vs `tag_team`).

**Potential:** Extract a `LeagueParticipant` table with a polymorphic `entityType`/`entityId` that holds LP, tier, leagueId, cyclesInLeague. Both `robots` and `team_battles` would reference it. This would also unify the rebalancing logic which currently has 3 separate implementations (1v1, team league, tag team league).

**Risk:** High — deeply embedded in combat and cycle processing. The Robot model has 200+ columns already and pulling league data into a relation adds a JOIN on every read.

---

### 3. Battle Results + Participants — Already Partially Unified

`battles` + `battle_participants` is the correct normalized form. However:
- The `Battle` model still has legacy `robot1Id`/`robot2Id`/`robot1ELOBefore`/`robot2ELOBefore`/etc. columns that duplicate data in `battle_participants`
- Tag team fields (`team1ActiveRobotId`, etc.) are on `Battle` rather than in participants

**Potential:** Drop the legacy robot1/robot2 columns (breaking change for old queries). Move tag team slot data into `battle_participants` using the existing `role` column. This would let battle history queries exclusively use `battle_participants` JOINs.

**Risk:** Medium — many existing queries use `robot1Id`/`robot2Id` for performance. Would require a data migration for historical battles.

---

### 4. Leaderboards / Hall of Records / KotH Standings — Data Source Overlap

These three page groups all query `robots` for aggregate stats:
- **Leaderboards**: fame, prestige (users), losses
- **Hall of Records**: combat, career, economic, prestige, koth, team records
- **KotH Standings**: koth_wins, koth_matches, koth_total_zone_score

All read from the same denormalized counters on `robots` and `users`. No unification needed at the table level — these are already efficient single-table reads with different `ORDER BY` clauses.

**Potential improvement:** Create a materialized stats view/cache table that pre-computes rankings so these pages don't sort the entire `robots` table on every request. Already partially exists via `CycleSnapshot.robotMetrics`.

---

### 5. Financial / Economy Data — Scattered Computation

Financial Report, Cycle Summary, and Admin Economy all compute financial data from:
- `users` (currency)
- `robots` (repairCost, totalRepairsPaid)
- `facilities` (operating costs per level)
- `subscriptions` (subscription costs)
- `audit_logs` (historical transaction events)
- `cycle_metadata` (current cycle number)

**Potential:** A `FinancialLedger` or `Transaction` table that records every credit change as an event (income, expense, purchase type) would eliminate the need to recompute from audit_logs + formula recalculation. The `audit_logs` table already stores financial events but isn't optimized for financial queries.

**Risk:** Low — additive change. Could be populated alongside existing audit_logs without breaking anything.

---

### 6. Subscription + Eligibility — Currently Clean

The `subscriptions` table with its `robotId + eventType` unique constraint is well-designed. No unification needed here.

---

### 7. Admin Audit Logs — Two Separate Tables

- `audit_logs` — game events (battle results, promotions, financial transactions)
- `admin_audit_logs` — admin actions (cycle triggers, tournament creation)

These have different schemas and serve different purposes. The overlap is minimal (both track "who did what when"). Unifying them would add noise to game analytics queries.

**Recommendation:** Keep separate. The separation is intentional and the admin audit log is much simpler.

---

## Summary of Actionable Unifications

| Priority | Change | Tables Affected | Effort | Benefit |
|----------|--------|----------------|--------|---------|
| **HIGH** | Unify scheduling tables into single `ScheduledMatch` | 4 → 1 | Large (migration + all matchmaking services) | Eliminates 4-way fan-out queries on Dashboard/Robot Detail/Onboarding. Single query replaces 4. |
| **MEDIUM** | Remove legacy `Battle.robot1Id`/`robot2Id` columns | `battles` | Medium (migration + query rewrites) | Simplifies battle model, removes data duplication |
| **LOW** | Financial ledger table | +1 new table | Medium (additive) | Faster financial reports, no recomputation from audit_logs |
| **LOW** | Materialized leaderboard cache | +1 new table/view | Small (additive) | Avoids full-table sorts on `robots` for leaderboard pages |
| **RISKY** | Extract `LeagueParticipant` entity | `robots`, `team_battles` → new table | Very Large | Unifies LP/tier logic but adds JOINs everywhere |
