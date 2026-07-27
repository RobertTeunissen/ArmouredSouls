# Verification Results — Spec #46

Run at the completion of task group 12. Every criterion from `requirements.md` § Verification Criteria.

## Summary

| | Count |
|---|---|
| Criteria passed | 27 of 28 |
| Criteria blocked | 1 (criterion 25 passes locally; the live-host half of task 11.1 is outstanding) |
| Requirement 11 | Added after the initial verification pass — Training Facility roster concentration |
| Backend suites | 191 passed, 2687 tests, 0 failed |
| Frontend suites | 183 passed, 1827 tests, 0 failed (1 file / 3 tests skipped, pre-existing) |
| Shell harness | 15 passed, 0 failed |
| `tsc --noEmit` | clean, backend and frontend |
| ESLint on changed files | 0 errors, 0 new warnings |

Three criteria were narrowed during verification because they were written as
unscoped repo-wide greps that matched legitimate unrelated code or the very
comments recording the change. Each narrowing is recorded below with the reason.
This follows the precedent set earlier in this spec, where criterion 14 was
narrowed for the same reason (`currentLeague` legitimately survives on
`LossesLeaderboardEntry`).

---

## Grep-based checks (task 12.1)

| # | Result | Evidence |
|---|--------|----------|
| 1 | ✅ pass | `autoCreateNextTeamTournament` called at `cycleScheduler.ts:723`, outside the active-tournament branch |
| 3 | ✅ pass | No matches. Every merchandising multiplier goes through Prestige_Per_Slot (`prestigePerSlot / 10000`) |
| 4 | ✅ pass | No matches. The divergent streaming display formulas are gone |
| 6 | ✅ pass | `economyFormulas.ts:94` — base rate table starts at `1: 10000` |
| 7 | ✅ pass (narrowed) | See note A |
| 9 | ✅ pass | Remaining matches are all inside `fetchTeamBattleRecordsForSize()`, which the criterion excludes |
| 10 | ✅ pass | No matches |
| 13 | ✅ pass (narrowed) | See note B |
| 14 | ✅ pass | No matches on either surface |
| 16 | ✅ pass | Two assignments each, one for the `roster_expansion` special case and one for `calculateFacilityOperatingCost()` |
| 19 | ✅ pass | Streak queries exist for the four league modes (`recordsQueryService.ts:883`) as well as KotH |
| 20 | ✅ pass | All three trigger types present in all three files (1 / 4 / 3 matches) |
| 21 | ✅ pass | `battlePostCombat.ts:273,276` — both counters incremented in the shared helper |
| 23 | ✅ pass (narrowed) | See note C |
| 24 | ✅ pass | `disk-monitor.sh:68` resolves the default to `7200` |
| 26 | ✅ pass | `facilities.ts:62` — `training_facility` reports `maxLevel: 10`, costs extended to `1500000` |
| 27 | ✅ pass | All 8 `calculateTrainingFacilityDiscount(` call sites pass two arguments |
| 28 | ✅ pass | `trainingFacilityRosterDiscount` 18 tests, plus updated `discounts`, `sharedFormulas`, and both `robotServices` suites |

### Note A — criterion 7 narrowed

Original: `grep -rn "0\.25s\|0.25 cooldown\|+1\.0 base damage\|effectiveCooldown -= \|effectiveBaseDamage += "` must return no matches.

The two accumulator patterns return no matches, which is the substantive check —
the flat fold is gone. Three matches remain on the literal values, and all three
are prose explaining what v1.7 changed:

- `app/shared/utils/weaponRefinement.ts` — fold docblock rationale
- `app/frontend/src/components/weapon-refinement/refinementCopy.ts` — header
- `app/backend/src/content/guide/weapons/refinement.md` — a `callout-info` telling
  players what changed and why

Removing these would delete the rationale for the change from the exact places a
future reader would look for it. The criterion was narrowed to require that no
remaining match is a *specification of current behaviour*.

### Note B — criterion 13 narrowed

Original: `grep -rn "minBattles\|minRobots" app/backend/src app/frontend/src` must
return no matches.

`minRobots` is an unrelated field name used throughout
`services/subscription/rosterEligibilityFilter.ts` (Booking Office event
eligibility: 2v2 needs 2 robots, 3v3 needs 3) and `minRobotsRequired` is the
league rebalancing quorum. Neither is a leaderboard filter and neither is in
scope for Requirement 5. Narrowed to the four leaderboard surfaces, where the only
matches are the two comments recording the removal.

### Note C — criterion 23 narrowed

Original: `grep -rn "source .*\.env\|\. .*\.env" app/scripts/` must return no
matches.

All five matches are comments *warning against* sourcing — the pattern matches its
own documentation, in `preflight.sh`, `backup.sh`, `disk-monitor.sh`, and the new
test harness. Anchored to executable lines instead; returns no matches.

---

## Test suite checks (task 12.2)

| # | Suite | Result |
|---|-------|--------|
| 2 | `cycleScheduler|tournament` | ✅ pass — includes the per-participant-type cadence assertions |
| 5 | `economyFormulas|economyCalculations|streamingRevenue|financialReport` | ✅ pass — includes the Roster_Capacity monotonicity property test and the per-level payback test |
| 8 | `weaponRefinement` (backend) + `weapon-refinement` (frontend) | ✅ pass — 80 backend, 46 frontend. Includes the proportional-gain property test and the symlink import-identity test |
| 11 | `records` | ✅ pass — includes the Property 6 no-identical-values assertion |
| 12 | `hall-of-records` (frontend) | ✅ pass — 23 tests including mobile viewport assertions |
| 15 | `leaderboard` + `Leaderboards` | ✅ pass — includes the zero-`total_battles` fame visibility test |
| 17 | `facility` | ✅ pass — includes the operating-cost parity assertion for every `FACILITY_TYPES` entry |
| 18 | `BookingOfficePage` | ✅ pass — 17 tests, disabled states and mobile viewport |
| 22 | `achievement` | ✅ pass — 34 in-service + 27 structural + 31 unlock tests |
| 25 | `bash app/scripts/__tests__/disk-monitor.test.sh` | ✅ pass — 15 of 15 |

Full-suite runs rather than pattern-scoped runs were used as the final gate:

```
backend   190 suites  2666 tests  0 failed   (--maxWorkers=2, see below)
frontend  183 suites  1827 tests  0 failed   (1 file / 3 tests skipped, pre-existing)
shell      15 assertions          0 failed
```

### ⚠️ Pre-existing flakiness surfaced by the larger suite

At Jest's default worker count the backend suite intermittently fails **one**
supertest-based property test per run, and a different one each time:

| Run | Failure |
|---|---|
| 1 | `securityHeaders.property.test.ts` |
| 2 | `errorHandler.property.test.ts`, `tournament-bracket-seeding.property.test.ts` |
| 3 | `errorHandler.property.test.ts` — Property 12, counterexample `<iframe src="https://evil.com"></iframe>` |
| 4, 5 | clean |

This was investigated rather than assumed:

- **Not a logic defect.** Each failing file passes in isolation on repeated runs
  (`errorHandler` 4/4, `tournament-bracket-seeding` 6/6, `securityHeaders` 1/1). The
  `<iframe>` counterexample is a `fc.constant`, so it is generated on *every* run
  of that property — if it were a real sanitizer gap it would fail every time, not
  one run in three.
- **Not introduced by this spec.** All three files are untouched
  (`git diff --quiet HEAD` confirms). Stashing the entire spec and running the
  baseline twice gave 179 suites / 2431 tests clean both times.
- **Cause: parallel worker contention.** This spec adds 11 test suites (179 → 190).
  The affected tests all drive `supertest`, which binds an ephemeral port per
  request; at higher worker counts that contends. `--maxWorkers=2` gives a
  deterministic clean pass, twice — and `.kiro/steering/coding-standards.md`
  already prescribes reduced workers for exactly this symptom.

**This is not fixed here** — it is pre-existing, outside every requirement in this
spec, and the correct fix (making the supertest-based property suites bind
deterministically, or pinning their worker count) is its own piece of work. Flagged
so the intermittent CI red is not mistaken for a Spec #46 regression. Use
`--maxWorkers=2` for a reliable backend gate until it is addressed.

**The frontend has the same class of problem.** After Requirement 11 the default
parallel run intermittently fails a varying set of property tests — including
`tab-navigation-pbt` and `EffectiveStatsDisplay.pbt`, which this spec never
touches. Every affected file passes in isolation, and `--no-file-parallelism` gives
a clean 183/1827 pass twice in a row. Same diagnosis, same non-fix: use
`vitest run --no-file-parallelism` as the reliable frontend gate.

The two reliable gate commands:

```bash
cd app/backend  && npx jest --config jest.config.unit.js --maxWorkers=2
cd app/frontend && npx vitest run --no-file-parallelism
```

### Coverage note

The 90% threshold for combat, economy, and achievement code is carried by the
suites added under this spec: `refinementProportionality` (18),
`merchandisingConcentration` (27), `streamingRevenueParity` (20),
`achievementRegistration` (27), `achievementUnlocks` (31), `teamModeWins` (16),
`recordsScoping` (17), `facilityOperatingCostParity` (43), `leaderboardVisibility`
(11), `tournamentCadence` (14). Presentation changes for Requirements 4–7 are
covered by `CombatRecords` (10), `WinStreakRecords` (10), and
`BookingOfficeUpgradePanel` (17).

---

## Documentation and changelog (task 12.3)

Every file in the design's Documentation Impact table is updated:

| File | Status |
|---|---|
| `.kiro/steering/project-overview.md` | ✅ Economy entry notes Prestige_Per_Slot vs per-robot-per-battle |
| `docs/game-systems/PRD_TOURNAMENT_SYSTEM.md` | ✅ |
| `docs/game-systems/PRD_ECONOMY_SYSTEM.md` | ✅ Prestige_Per_Slot + Streaming_Revenue_Formula single-source section |
| `docs/game-systems/PRD_WEAPON_ECONOMY.md` | ✅ v1.7 section, tier table, version bumped to 1.7 |
| `docs/guides/ADMIN_PANEL_GUIDE.md` | ✅ Checked — no hardcoded tier effect values present, no change needed |
| `docs/prd_pages/PRD_HALL_OF_RECORDS.md` | ✅ v1.4 — disposition table, mode scoping, Career coverage, Win Streaks, bye-win caveat |
| `docs/game-systems/PRD_PRESTIGE_AND_FAME.md` | ✅ |
| `docs/prd_pages/PRD_FACILITIES_PAGE.md` | ✅ Booking Office upgrade control |
| `docs/game-systems/PRD_ACHIEVEMENT_SYSTEM.md` | ✅ Achievement_Trigger_Registration, three root causes, threshold reachability, no-backfill |
| `docs/guides/operations/MONITORING.md` | ✅ Hourly cron, two-hour cooldown, one-entry rule, two new troubleshooting sections |
| Spec #29 stale-emitter record | ✅ Recorded in `MONITORING.md` against the "no deduplication" decision |
| `.kiro/specs/done-june26/44-grand-melee/tasks.md` | ✅ Tasks 10, 10.1, 10.2 marked complete with a note on why they were missed |

All four changelog entries are drafted in `CHANGELOG_DRAFTS.md`:

| # | Category | Title |
|---|----------|-------|
| 1 | `balance` | Sharpen and Forge now scale with your weapon |
| 2 | `feature` | Hall of Records: five categories retired, damage records split by mode |
| 3 | `feature` | New Hall of Records tab: league win streaks |
| 4 | `bugfix` | Nine achievements that could never unlock are fixed |

---

## Findings from the two investigations

**Task 7.8 — Grand Melee kills.** Confirmed as a defect, not a missing feature,
and the cause was one level deeper than the task anticipated. `computePlacements()`
matched `event.attacker` and `event.defender` by robot name, but the `destroyed`
event emitted by the shared simulation loop set **neither field**. So kills were
zero for every robot *and* elimination ordering silently degraded to a pure
damage-dealt sort, losing the elimination-time ranking entirely.

Fixing it inside `computePlacements()` was not possible — the data was never
emitted. The fix adds a `lastDamagedBy` field to `RobotCombatState`, written by
`performAttack()` on HP damage only (a shield-only hit does not bring the defender
closer to destruction, so crediting it would misattribute the kill), and populates
`attacker` / `defender` on the `destroyed` and `yield` events. This touches the
shared simulation loop, so it is wider than the task scoped, but every change is
purely additive on already-optional fields and no other mode reads them. Recorded
as a deviation.

**Task 9.5 — further unreachable achievements.** None found. The structural test
in `achievementRegistration.test.ts` asserts every trigger type declared by any
`ACHIEVEMENTS` entry is registered in `EVENT_TRIGGER_MAP` and handled by a
non-default branch of `evaluateTrigger()`, and that every `progressType: 'numeric'`
entry has a progress resolver branch. All pass, so the nine reported achievements
were the complete set.

---

## Outstanding

**Task 11.1 requires live-host access and is not complete.** See the reminder in
the task file.

### ⚠️ Correction: the duplicate-emitter premise was wrong

Task 11.1, and the design section behind it, asserted that four of the five alerts
per hour on `armouredsouls-acc` came from a duplicate cron entry running a stale
script. **Host diagnosis disproved this.** The findings:

| Check | Result |
|---|---|
| `crontab -l \| grep -c disk-monitor` | `1` — single entry, no duplicate |
| Schedule | `*/15 * * * *` |
| Deployed script | Cooldown logic present, 3600s default |
| `/var/lib/armouredsouls` | Did not exist |
| State files in `/var/lib/armouredsouls` **and** `/tmp` | Neither existed |
| `disk-monitor.log` | Four `.env: line N: command not found` errors per run |

The real cause was a chain:

1. `/var/lib/armouredsouls` never existed, so the script silently used `/tmp`.
2. No state file was present in either location, so `should_alert()` permitted an
   alert on every run. A cooldown whose timestamp never persists is inert.
3. The 15-minute interval multiplied that by four — an amplifier, not the fault.
4. `source .env` was failing on four lines every run, so any variable after the
   first failure, including `DISK_ALERT_COOLDOWN_SECONDS`, was unreliable. This is
   the exact hazard `.kiro/steering/coding-standards.md` documents, live in
   production on a script Spec #29 was supposed to have covered.

**Every code change in group 11 remains correct and addresses causes 1, 2 and 4** —
`env_get` replaces `source`, the `/tmp` fallback is logged, and a failed state write
logs a warning naming the file. Cause 3 is the cron change. What was wrong was only
the *attribution*, and `docs/guides/operations/MONITORING.md` has been rewritten to
record the actual chain in place of the duplicate-entry story.

One thing the diagnosis did **not** establish: why the write to `/tmp` never
persisted, given `/tmp` is writable. The old script suppressed that failure
(`2>/dev/null || true`); the new one logs it. That question resolves on deploy.

### Remediation sequence for task 11.1

The state directory must be created — it is not part of the deploy:

```bash
sudo mkdir -p /var/lib/armouredsouls
sudo chown deploy /var/lib/armouredsouls
# deploy the updated app/scripts/disk-monitor.sh, then:
crontab -e            # */15 * * * *  →  0 * * * *
```

Then verify the chain is closed:

```bash
grep -c 'COOLDOWN_SECONDS:-7200' /opt/armouredsouls/scripts/disk-monitor.sh   # 1
/opt/armouredsouls/scripts/disk-monitor.sh                                    # sends one alert
ls -la /var/lib/armouredsouls/disk-alert-*                                    # state file now exists
/opt/armouredsouls/scripts/disk-monitor.sh                                    # must be SILENT
grep -c 'command not found' /var/log/armouredsouls/disk-monitor.log           # no new occurrences
```

The second manual run being silent is the decisive check: it proves the cooldown is
persisting, which is the thing that was actually broken.

Separately, and outside this spec: **acc is at 99% used with 860MB free.** The
alerts were correct. Reducing their frequency does not address the disk.
