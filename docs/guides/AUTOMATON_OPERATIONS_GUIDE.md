# Automaton Operations Guide

**Spec:** #55, #57 · **Audience:** administrators and developers · **Last updated:** 24 October 2026

How to run Automaton_Stables: adding and activating stables, tuning them, reading their turns and alerts, handling incidents, and moving definitions and strategies between the admin page and the repository. Product rules are in `docs/game-systems/PRD_AUTOMATON_STABLES.md`.

Everything below happens on `/admin/automatons` (admin login required; every mutation is written to the admin audit log) or with two backend scripts run from `app/backend`:

| Command | Purpose |
|---|---|
| `pnpm run automaton:sync [--dry-run]` | Catalogue_Sync: add Draft_Automatons for new Catalogue_Entries and fill missing Repository_Images |
| `pnpm run automaton:unpack <file> [--force]` | Catalogue_Unpack / Strategy_Unpack: write an exported file into the repository |

## 1. Creating and activating stables

**From the repository (normal path).** A Catalogue_Entry in `app/backend/prisma/automaton-catalogue/{catalogueKey}.json` becomes a Draft_Automaton at the next ACC deploy (Catalogue_Sync). Locally, run `pnpm run automaton:sync` after `prisma migrate deploy` and `prisma db seed` (the sync validates weapon names against the `weapons` table).

**From the admin page.** Editor → **New stable** (catalogue key, stable name, strategy). Add blueprints, Team_Names and the Event_Order before activating; the Editor shows every rule error inline.

**Activating.** Editor → **Activate** (one stable) or Stables → **Activate all drafts** (each draft on its own, in Catalogue_Key order, with a per-stable result; one rejection does not stop the others). Activation is rejected when the stable name or username is taken or the strategy targets, blueprints, Team_Names or Event_Order fail validation. Activation is one-way: an active stable cannot be deleted or paused on its own. It joins the cohort at the next Turn_Step and builds its opening roster from ₡3,000,000.

Batch activation is no longer needed for Turn_Step capacity. The Turn_Step keeps starting turns until its deadline (the earlier of step start + 6 h and the next scheduled job minus 15 min; on the default schedule the 6 h cap binds, about 06:00 UTC after the 00:00 settlement) and runs up to 3 turns in parallel, so every Active_Automaton, opening builds included, takes its turn the same night (see `docs/implementation_notes/AUTOMATON_TURN_STEP_DEADLINE.md` for the capacity estimate). Activating many drafts at once still puts them all into matchmaking in the same cycle; check the Status_Bar after the next Turn_Step.

**Expansion_Stables (spec 57).** After the deploy that delivers spec 57, every Expansion_Stable appears as a Draft_Automaton next to the active starter stables; nothing is activated automatically. There is no activation cap (spec 57 decision 19): every draft may be activated, with the per-stable **Activate** in the Editor or **Activate all drafts**. Each new Active_Automaton's first turn is an opening build, the slowest kind of turn. Spec 57's capacity analysis (`.kiro/specs/done-october26/57-automaton-catalogue-expansion/review/SCALING.md`) assumed the former fixed 300 s Turn_Step budget, which is superseded. Of its open items (§6), bounded parallel turns, a deadline scaled to the night window and a lease heartbeat are done. Still open:

- Fair rotation after deadline skips, so the last-activated stables are not always the ones skipped (skips are now exceptional).
- Fewer SQL statements per charged action (incremental facts, batched event-log and spending writes).
- Bulk skip marking.
- Batched or background admin operations (a batch size for activate-drafts, a paginated or streamed catalogue export, a cached Need_Attention count).
- A battle-volume measurement at the target robot count before activating thousands of Automatons.

**Turn_Step knobs** (backend `.env`, defaults shown; details in `docs/guides/operations/DEPLOYMENT.md`): `AUTOMATON_TURN_CONCURRENCY=3` (turns in parallel; `1` makes the step sequential again and is the first lever if parallel turns misbehave), `AUTOMATON_TURN_STEP_MAX_MS=21600000` (6 h cap), `AUTOMATON_TURN_STEP_SCHEDULE_MARGIN_MS=900000` (15 min before the next scheduled job). A changed value applies at the next Turn_Step after a backend restart.

**Deleting.** Only a Draft_Automaton can be deleted; its blueprints and admin-uploaded images go with it. A draft that came from a Catalogue_Entry comes back at the next sync; delete the catalogue file in a pull request to remove it for good.

## 2. Tuning Goal_Targets

Editor → Build order panel. Each Goal of the stable's Build_Order has a target input with its allowed range. Changes apply from the next Automaton_Turn; no deploy and no test run are needed, because the conformance suite covers every target inside the bounds.

- Use **Preview next cycle** (Turn_Preview, read-only) to see what the stable would buy and which Goal it ends on. Statuses: Done ✓, Bought, Saving (needed / held credits), Blocked 🔒 (reason), Waiting, Waiting 🔒 (prestige-gated).
- A robots target can never exceed the buildable blueprints (slots 1…k without a gap): add a blueprint first, or the save is rejected with `AUTOMATON_BLUEPRINTS_TOO_FEW`.
- A target change that alters the number of Team_Rule teams needs the matching Team_Names in the same save (`AUTOMATON_TEAM_NAMES_MISMATCH` otherwise).
- Saving for a long time is intended behaviour (no saving timeout). If a stall is undesirable, lower the Saving Goal's target or move money-hungry Goals through a new Strategy_Version.
- Blueprint edits (loadout, stance, yield, Build_Focus, Weapon_Path, Refinement_Plan) and Event_Order or Team_Names edits reach the live robots at the next turn through upkeep and the Build_Order, never from the admin request. Refinements already applied are never undone. A new robot name is used only the next time a robot is built from that slot; an existing robot is never renamed. An image change updates the live robot at once.

## 3. Reading Turn_Records and alerts

**Status_Bar** (every tab): Program_Switch, last Turn_Step (label `Cycle {n}`, `Prep {n}` or `Season start`, time, processed count, duration), failed count and Needs attention count.

**Needs attention** (Stables filter), computed per request:

| Reason | Meaning | Typical action |
|---|---|---|
| Last cycle failed: {reason} | The most recent Turn_Record is `failed` | Read the turn in Cycle history; fix the profile or report a defect |
| Balance negative | `User.currency < 0` | Usually repairs outgrowing low-tier income. On a v1 strategy, upgrade the stable to v2 (§8, Economy Goal and income facilities first); check repair levels and yield thresholds if it persists |
| Nothing bought for {n} cycles | 14 or more consecutive completed turns with no charged action | Check the Saving Goal in the preview |

**Cycle history** (Editor) lists the stable's Turn_Records: trigger, slot, attempt, status and reason, start and end balance, credits spent and received, actions and the final Goal outcomes. Turn_Records are purged at rollover.

**Server log.** One line per Turn_Step:

```
[automaton-turns] trigger=settlement season=3 slot=41 source=scheduler processed=11 completed=11 skipped=none failed=0 alreadyFinal=0 actions=attribute_upgrade=4,facility_upgrade=1 spent=812000 received=0 saving=9 blocked=2 durationMs=6200 concurrency=3 budgetMs=21600000 deadline=cap
```

`concurrency` is the effective number of parallel turns, `budgetMs` the time the step had to start turns, and `deadline` where that came from: `schedule` (next scheduled job minus margin), `cap` (`AUTOMATON_TURN_STEP_MAX_MS`, e.g. scheduler off) or `floor` (the 300 s minimum when settlement ran late).

**Alerts** go to the monitoring webhook (`sendMonitoringAlert`) and `logger.error` with an `[automaton-alert]` prefix, always with the Catalogue_Key and reason.

Inside a Turn_Step the per-stable kinds (`automaton_turn_failed`, `automaton_invalid_parameters`, `automaton_negative_balance`, `automaton_balance_recovered`, `automaton_saving_streak`, `automaton_upkeep_issues`) are logged at once but sent to Discord as one message per kind when the step ends: a heading such as `⚠️ Automaton balance turned negative — season 3 cycle 41: 4 stable(s) (23 stable(s) negative in total)` and one `• catalogue-key: reason` line per stable. A kind with one stable keeps the single-alert text. A message that would pass Discord's 2000-character limit ends with `…and N more (see [automaton-alert] log lines)`. Before this, a step with many stables in the same state posted one message each, and Discord's per-webhook rate limit dropped alerts from the burst. Step-level kinds are sent at once.

| Kind | Raised when | Meaning |
|---|---|---|
| `automaton_turn_failed` | A turn ended `failed` | Investigate; the next turn re-plans from fresh facts |
| `automaton_turn_step_failed` | The Turn_Step itself failed, a cutover started during it (`AUTOMATON_CUTOVER_IN_PROGRESS`, rest skipped `cutover_in_progress`) or it lost its lease (`TURN_STEP_LEASE_LOST`, rest not started) | Settlement continued; check the log. The stables act at their next turn |
| `automaton_step_budget_exhausted` | "Turn_Step deadline reached": stables were not started before the deadline | They were skipped (`step_budget_exhausted`) and build at their next turn. Should not happen on the default schedule; check the alert's deadline, budget and concurrency |
| `automaton_invalid_parameters` | Pinned Strategy_Version missing or stored Goal_Targets invalid | Restore the file or fix the targets |
| `automaton_negative_balance` | Balance below zero at turn start after a non-negative previous turn (or no previous turn) | Upkeep only until it recovers. A stable that stays negative is not listed again; it is only counted in the "negative in total" note and the step log line `N stable(s) started their turn with a negative balance` |
| `automaton_balance_recovered` | Balance at ₡0 or more at turn start after a negative previous turn | Informational; the stable can buy again |
| `automaton_saving_streak` | Same Goal Saving for more than 14 consecutive turns | Informational; the stable keeps saving |
| `automaton_upkeep_issues` | A team registration, subscription, settings or tuning call failed | Retried next turn |
| `automaton_upgrade_rejected` | A Strategy_Version upgrade rejected a stable | Fix blueprints or Team_Names, then upgrade that stable |
| `automaton_catalogue_sync_conflicts` | Catalogue_Sync skipped an entry whose stable name is taken | See §6 |

In the heavy simulation (no battle income) operating costs pushed many stables below zero after the opening build, producing 88 negative-balance alerts over two seasons. On ACC in Season 1 (stables activated late, cycles 70–71) the v1 strategies left over half the stables negative within ten cycles and the alert listed 100+ stables every night, which is why it now lists transitions only. The cause and the v2 response are in `docs/implementation_notes/AUTOMATON_ECONOMY_AND_EVENT_FIT.md`.

## 4. Program_Switch incident procedure

Use the Program_Switch when Automatons misbehave (a defect spends credits wrongly, a turn fails for every stable, a Turn_Step is too slow).

1. Status_Bar → switch **off** (confirmation dialog; audited with old and new value). From the next Turn_Step every turn is recorded `skipped` / `program_off`, with no purchases and no Free_Upkeep. Settlement, battles, matchmaking and repairs continue; Automaton robots keep their subscriptions, teams and scheduled matches and keep fighting.
2. Investigate with Cycle history, Turn_Preview (read-only, works while off) and the `[automaton-turns]` / `[automaton-alert]` log lines.
3. Fix: change Goal_Targets or blueprints in the Editor, or deploy a code fix.
4. Switch **on**. Skipped turns are not replayed; each stable plans from its current facts at its next turn.

There is no per-stable pause, no endpoint to run a turn manually and no way to edit a live robot, team, subscription, weapon or balance directly. Those restrictions are deliberate.

## 5. Catalogue_Export → Unpack → PR → deploy

Use this to bring admin-page edits (or a stable created on ACC) into the repository.

1. Catalogue tab → **Export this stable** or **Export all** (the Editor header also has **Export**). The file holds the Catalogue_Entries; active stables export their current `User.stableName`. Images uploaded in the admin page are embedded; Repository_Images are not, because sync finds them by convention.
2. Locally, in `app/backend`: `pnpm run automaton:unpack <file>`. It validates every entry, writes `prisma/automaton-catalogue/{key}.json` and decodes embedded images to `app/frontend/public/assets/automatons/{key}/{slot}.webp`. It refuses to overwrite a file without `--force`.
3. Open a pull request. CI validates the schema, weapon names, the Coverage_Matrix and the image folder.
4. After merge, the ACC deploy runs Catalogue_Sync: new keys become Draft_Automatons; existing keys are left alone apart from image fills. Sync never updates an existing profile from a file, so exporting and re-syncing on the same environment is a no-op.

## 6. Conflicts

Catalogue_Sync skips an entry when its stable name is taken by a stable or another profile. The run continues, the conflict appears in the Catalogue tab's sync status and raises `automaton_catalogue_sync_conflicts`. Resolve it by renaming the stable in the catalogue file (pull request) or by freeing the name; the next sync adds the draft. An invalid file fails the whole sync (exit 1, nothing written) and with it the deploy step; see `docs/guides/operations/DEPLOYMENT.md`.

## 7. Images

- **Repository_Images:** `app/frontend/public/assets/automatons/{catalogueKey}/{slot}.webp`, 512 × 512 px square WebP; the folder is the Catalogue_Key and the file name the Blueprint_Slot (1–11). Catalogue files store no image path. `catalogueImages.test.ts` fails on a file that does not match a Catalogue_Key and one of its slots or is not a 512 × 512 WebP; missing images are allowed.
- **Fill-only sync:** a blueprint without an image gets its Repository_Image at the next Catalogue_Sync, and the live robot built from it gets the same image if it has none. Sync never replaces or deletes an image that is already set.
- **Admin uploads win:** Editor → blueprint → **Upload image** (2 MB limit, processed to 512 × 512 WebP) stores the file in `uploads/automatons/{catalogueKey}/` and updates the blueprint and its live robot in one transaction. Replaced upload files of an active stable are never deleted automatically (season archives may reference them), and the rollover orphan sweep does not touch this directory. Deleting a Draft_Automaton deletes its uploads.
- No image at all is fine: the robot shows the same generic frame as a player's robot without an image.
- **Expansion slots:** commit an expansion Repository_Image only together with or after the Catalogue_Entry of its Catalogue_Key (spec 57 R4.4); a folder without an entry fails `catalogueImages.test.ts`. A missing expansion image can be added later under the same path, and the next Catalogue_Sync fills it in.

## 8. Strategy workflow

1. **Design:** Strategies → Strategy_Library → **New strategy** or **New version** (a copy of `key.vN` numbered `latestVersion + 1`). The Strategy_Builder edits the numbered Goal list, defaults and bounds and checks the builder rules on every edit (every required Goal type present, last Goal "Attributes → Max", bounds within the Goal type's limits).
2. **Preview:** the draft preview runs the draft against a chosen stable (Turn_Preview path) and against a simulated fresh ₡3,000,000 stable over the opening turns. Both are read-only.
3. **Export strategy file:** saves `{key}.v{n}.json` (disabled while the draft has rule errors). For a new version, the export lists the stables an upgrade would reject (too few blueprints, missing Team_Names); fix those stables before the version is deployed.
4. **Unpack:** `pnpm run automaton:unpack {key}.v{n}.json` writes `app/backend/src/config/automaton-strategies/{key}.v{n}.json` (never over an existing file).
5. **Pull request:** approved by the product owner. CI runs the conformance suite and the generic scenario test over every Strategy_Definition_File, so a new file needs no new test.
6. **Deploy:** the file loads at server start and appears in the Strategy_Library and the strategy dropdown. No stable changes.
7. **Upgrade:** Strategy_Library → **Upgrade** (one stable or all stables on an older version). The dry run shows old → new targets per Goal and any stable that would be rejected; confirm to apply. Each stable is upgraded or rejected on its own, with one audit entry each.

**v2 rollout (October 2026).** Every strategy has a v2 file (Economy Goal, income and repair facilities earlier; `docs/implementation_notes/AUTOMATON_ECONOMY_AND_EVENT_FIT.md`). After the deploy, run **Upgrade** → all stables for each strategy: every v1 Goal maps to v2 with its target kept, and only the Economy Goal (default 20 cycles) is new, so no stable should be rejected. Admin-created stables already get v2. New Catalogue_Entries should pin `"version": 2`; existing entries stay on v1 because Catalogue_Sync never updates an existing profile.

**Never delete a Strategy_Definition_File that a profile still uses.** The server refuses to start when a pinned file is missing, and if it disappears at runtime the stable's turns fail with `invalid_parameters` and an alert. Upgrade every stable off a version (the Library shows "N stables on vX") before removing it.

## Related documents

- `docs/game-systems/PRD_AUTOMATON_STABLES.md`
- `docs/guides/ADMIN_PANEL_GUIDE.md` — Automatons page walkthrough
- `docs/guides/FINANCIAL_LEDGER_AUDIT_GUIDE.md` — tracing an Automaton turn in the ledger
- `docs/guides/ERROR_CODES.md` — Automaton error codes
- `docs/architecture/SEED_DATA_SPECIFICATION.md` — catalogue and strategy file formats
