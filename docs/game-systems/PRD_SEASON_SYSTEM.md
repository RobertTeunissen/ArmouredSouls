# Season System

**Spec:** #45 · **Status:** Implemented · **Last updated:** July 2026

Authoritative description of the season structure. This supersedes backlog item #41, which had prestige and achievements persisting across seasons.

## Purpose

Before seasons, Armoured Souls ran one endless timeline. Credits accumulated past the point where anything was left to buy, facility levels only ever rose, and a player who joined months late was permanently behind. Seasons bound the timeline so that scarcity returns, the meta can shift, and a new player joining mid-season is in the same race as everyone else.

## Structure

A season has two phases:

| Phase | Length | Behaviour |
|---|---|---|
| Preparation | `PREPARATION_LENGTH_CYCLES`, default 2 | No battle events run. Settlement performs phase advancement only. Players build freely. |
| Competitive | `SEASON_LENGTH_CYCLES`, default 100 | Normal play. All events on their usual daily schedule. |

Competitive cycle 1 is a **scheduling cycle**. Every battle event executes previously scheduled matches before scheduling new ones 24 hours out; preparation created none, so cycle 1 finds nothing due and schedules for cycle 2. With the default 2-cycle preparation window this means three consecutive non-combat days. Set `PREPARATION_LENGTH_CYCLES=1` for two.

### Configuration

| Variable | Default | Constraint |
|---|---|---|
| `SEASON_LENGTH_CYCLES` | 100 | integer ≥ 1 |
| `PREPARATION_LENGTH_CYCLES` | 2 | integer ≥ 0 |
| `COUNTDOWN_CYCLES` | 7 | integer ≥ 0 |
| `ACCOLADE_DEPTH` | 10 | integer ≥ 1 |
| `RETAINED_IMAGES_PER_STABLE` | 20 | integer ≥ 1 |

All are Zod-validated at startup; an invalid value fails startup naming the key.

## Reset scope

At a Season_Rollover everything below is archived, then deleted.

**Deleted:** `robots`, `battle_participants`, `tuning_allocations`, `subscriptions`, `weapon_inventory`, `weapon_refinement`, `facilities`, `team_battles`, `team_battle_members`, `standings`, `scheduled_matches_v2`, `scheduled_match_participants`, `tournaments`, `tournament_matches`, `user_achievements`.

**Purged history:** `battles`, `battle_summaries`, `audit_logs`, `cycle_snapshots`, `financial_ledger`, `league_history`, `leaderboard_cache`, `practice_arena_daily_stats`. The global cycle counter resets to 0.

**Reset on every Human_Stable:** `currency` to ₡3,000,000 regardless of prior balance, `prestige` to 0, all four championship counters to 0, `pinnedAchievements` emptied, `totalPracticeBattles` to 0.

**Preserved:** the `users` row itself (credentials, role, stable name, profile and notification settings, theme, token version, changelog marker, login and creation timestamps), all seven onboarding fields, `lastSeenSeasonNumber`, `weapons`, `changelog_entries`, `admin_audit_logs`, `reset_logs`, `seasons`, the four archive tables, and every uploaded robot image.

### Why prestige and achievements reset

Prestige gates facility levels — Workshop L4 at 1,000 prestige, L7 at 5,000, L9 at 10,000. If prestige carried forward, a veteran would open every season able to reach facility depths a newer player could not, and the advantage would compound indefinitely. Resetting makes facility depth a mid-season goal that is re-earned.

Achievements reset for a related reason: a permanent collection stops being interesting once the easy ones are gone. Per season it is a scorecard, and each season's count and unlocked list are recorded in the archive.

## Generated stables

`users.is_generated` marks system-created stables — auto-generated bots (`auto_wimpbot`, `auto_averagebot`, `auto_expertbot`) and seeded test stables (`test_user_*`). The seeded `admin` account is **not** generated.

Generated_Stables are **deleted** at rollover, not reset. An emptied bot stable would never rebuild, so the matchmaking pool would fill with dead accounts. They receive no per-stable or per-robot archive.

Their competitive results **do** survive, as denormalized text in `season_standing_snapshots` and `season_accolades` with `is_generated_subject = true` and a null `user_id`. Without this a tier won by a bot would show no champion, and a player who finished fourth in a records category would be recorded as third.

The classification column defaults to `false` deliberately: a misclassified bot survives a rollover as a dead account, which is recoverable, whereas a misclassified human would be deleted.

### Bot population after a rollover

Because the global cycle counter resets to 0 and `generateBattleReadyUsers(cycleNumber)` creates N stables on cycle N, the bot population restarts at one stable on cycle 1 and grows with the season — roughly 55 stables by cycle 10 and 210 by cycle 20. Early-season matchmaking pools are therefore thin; the existing pipeline handles this by fabricating an in-memory bye robot. This is a known property, not a defect.

## Rollover stages

```
Stage 1 ARCHIVE  — write stable/robot archives, standings snapshot, accolades.
                   No destructive writes. Batched 50 stables per transaction.
Stage 2 VERIFY   — one stable archive per Human_Stable, robot archive count
                   equals Human_Stable robot count. Counts humans only.
                   Failure aborts with all operational data intact.
Stage 3 PURGE    — delete generated stables (200 per transaction), reset
                   competitive/economic state, purge history, reset counter,
                   open the next season in preparation.
Stage 4 POST     — orphan sweep, VACUUM, changelog draft. All non-fatal.
```

Stage 3 is batched by user so an interruption leaves whole users done and whole users untouched, never a half-reset stable. Stage 4 is non-transactional because `VACUUM` cannot run inside a transaction block.

The rollover is idempotent per season: a retry detects a complete archive and skips to Stage 3. Concurrency is guarded by the scheduler's existing job mutex; the admin trigger routes through it and returns `409` when held.

## Archive model

| Table | Contents |
|---|---|
| `seasons` | One row per season. `phase`, cycle counters, `generated_stable_count`, timestamps. |
| `stable_season_archives` | One row per Human_Stable per season. Final credits, prestige, aggregate record, highest ELO, fame, titles, achievements, facilities, counts, cycles run. |
| `robot_season_archives` | One row per robot. Identity, combat stats, loadout names, per-mode standings and team memberships as JSON. |
| `season_accolades` | Captured Hall of Records placements. Belongs to the season; `user_id` null for bot subjects. |
| `season_standing_snapshots` | Top `ACCOLADE_DEPTH` entities per mode/tier/instance, bots included. Bounded, so row count does not scale with the bot population. |

Every value is denormalized text or numbers. The only foreign keys are `stable_season_archives.user_id` and the internal archive link.

`Instance_Rank` is computed at archive time by ordering standings on `leaguePoints DESC, wins DESC, entityId ASC` within each mode/tier/instance, counting Generated_Stable entities so an archived rank is the robot's true position.

## Season 0

The migration does not create it — the Season_Service creates it lazily on first read, with `competitiveCyclesCompleted` backfilled from `cycle_metadata.total_cycles`. This keeps the migration pure DDL plus one backfill, with no one-shot insert that cannot be rerun.

Season 0 has **no fixed length** and never rolls over automatically, regardless of how far its cycle count exceeds `SEASON_LENGTH_CYCLES`. It closes only when an administrator triggers a manual rollover. `Season_Number === 0` is itself the legacy marker — there is no legacy flag column, because the number already carries that information.

Its archived figures are career totals: no season baseline was ever recorded for prestige earned, battle record, highest ELO, achievement counts, or titles. Every surface labels Season 0 accordingly rather than presenting it as a completed 100-cycle season.

## Balance changes

The Preparation_Phase is the window in which balance changes are applied. This is **convention and documentation, not an enforced code path**: acceptance is the only deployed environment and must stay deployable at any point in a season.

No mechanism is needed because the reset itself is the effective-date mechanism. At the start of a preparation window every player holds zero robots, weapons, facilities, and attribute levels, so a changed cost curve or damage constant has nothing to act on retroactively. Archives store literal outcomes and are never recomputed, so an archived season stays readable under later balance rules.

A `draft` / `balance` changelog entry is created automatically at rollover for an administrator to complete and publish during the window.

## Uploaded images

Robot rows are deleted at rollover; their uploaded image files are not. Files live at `uploads/user-robots/{userId}/{uuid}.webp` and survive both a rollover and an account reset, capped at `RETAINED_IMAGES_PER_STABLE` per user.

The critical companion is `cleanupOrphans`: its referenced set is built from live `robots.imageUrl` **and** every `robot_season_archives.image_url`, plus every file still in a live user's directory. Without the archive paths the nightly sweep would delete exactly the files the archive depends on — retention would appear to work at rollover and silently fail days later.

The Image_Library is scoped strictly to the owning user. Ownership is enforced by resolving the path through the traversal guard and then requiring it to sit under `uploads/user-robots/{callerId}/` **with a trailing separator** — without the separator, user 1's prefix also matches user 12's directory. Failure returns a generic `403 Access denied` that does not reveal whether the file exists.

Deleting an image nulls `image_url` on affected archive rows so history renders a default silhouette. This is the single deliberate mutation of an archive row, confined to a cosmetic column.

## Related documents

- `docs/game-systems/PRD_CYCLE_SYSTEM.md` — settlement steps and phase gating
- `docs/game-systems/PRD_AUTO_USER_GENERATION.md` — generated stable lifecycle
- `docs/architecture/PRD_SERVICE_DIRECTORY.md` — cron schedule and suspension
- `docs/architecture/DATABASE_SCHEMA.md` — table definitions
- `docs/guides/ADMIN_PANEL_GUIDE.md` — admin season controls
