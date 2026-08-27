# Spec 49 — Bye System Unification: Investigation Notes

> **Status: investigation complete, requirements not started.**
> This document is a captured code audit plus three decisions that must be made before
> `requirements.md` can be written. It is deliberately not a requirements document — writing one
> now would bake in a balance change nobody has signed off.
>
> Audited August 2026 against the working tree. Read-only audit: no build or test run was performed,
> so the constants and control flow below are as-written in source, not runtime-confirmed.

## Intent (from the product owner)

1. Bye matches are **unified**, preferably behind a shared component.
2. Bye rewards are **the same for every battle type** — one participation reward.
3. KotH and Grand Melee are **in scope**. A robot with a subscription that receives no match, for
   any reason, has a bye.
4. Rationale: *"Users have allocated a subscription and expect something in return."*

## Answered: does a scheduled bye lock the subscription slot?

**Yes, and it already does today — no new rule is needed.**

`resolveOutstandingEventsForRobots` in `app/backend/src/services/scheduling/eventScheduleScope.ts`
treats any `scheduled_matches_v2` row with `status: 'scheduled'` as an outstanding obligation. A
league bye *is* such a row, so it already holds the slot with no special-casing. The tournament branch
states the same intent in a comment: bye rounds count, because "the robot is still committed to the
bracket even in a round it does not have to fight."

So Spec #35's existing rule already covers byes, and extends to KotH and Grand Melee automatically
once bye rows are created for them:

- Unsubscribing stays **free, immediate and always allowed**.
- The freed slot is **not reusable** until the bye resolves.
- Slot accounting remains `subscriptions ∪ outstanding obligations`.

This is also the only safe answer once a bye pays a reward. Without it a player could unsubscribe,
re-subscribe elsewhere, and collect two rewards from one slot in one cycle.

## Correction: "same as last place" is not "the same for every match type"

Each placement mode multiplies the tier base by its own event multiplier *before* applying the 0.2
floor, so "what last place gets" is three different numbers:

| | Formula | Fraction of tier base |
|---|---|---|
| `league_1v1` bye (today) | `getParticipationReward(tier)` | **0.20** |
| `koth` last place | `tierBase × KOTH_CREDIT_BASE_MULTIPLIER (1.5) × 0.2` | **0.30** |
| `grand_melee` last place | `tierBase × GRAND_MELEE_CREDIT_BASE_MULTIPLIER (2.5) × 0.2` | **0.50** |

`getParticipationReward` already exists — `Math.round(getLeagueWinReward(league) * 0.2)` in
`app/backend/src/utils/economyFormulas.ts:177-179` — and is already tier-scaled, so the concept needs
no new home. Note the `0.2` is a bare inline literal at line 178, not a named constant.

## Current bye reward inventory — all nine modes

Credits as a fraction of the same-tier base. Sources: `leagueBattleOrchestrator.processByeBattle`,
`tagTeamResultUpdater`, `teamBattleOrchestrator`, `tournamentService`,
`teamTournamentBattleOrchestrator`.

| Mode | Bye credits | Prestige | Fame | LP | Streaming |
|---|---|---|---|---|---|
| `league_1v1` | **0.20** — `getParticipationReward`, and it skips `calculateBattleWinnings`, so it is 0.167 of a real winner payout at zero prestige and 0.118 at the +50% cap | 0 | 0 | +3 | 0 |
| `tournament_1v1` | **0** — no `battles` row is created at all | 0 | 0 | unchanged | 0 |
| `tag_team` | **2.40** — full `2 × (base + participation)` | full (1.6× tier) | full | +3 | 0 |
| `league_2v2` | **2.40** — full `2 × (base + participation)` | full | full | +3 | 0 |
| `league_3v3` | **3.60** — full `3 × (base + participation)` | full | full | +3 | 0 |
| `tournament_2v2` | **0** | 0 | 0 | unchanged | 0 |
| `tournament_3v3` | **0** | 0 | 0 | unchanged | 0 |
| `koth` | no bye concept | — | — | — | — |
| `grand_melee` | no bye concept | — | — | — | — |

For contrast: `koth` last place also gets `1 × tierFactor` fame; `grand_melee` last place gets zero
fame (it has no `?? 1` fallback where KotH does). Both receive **full streaming revenue**, which no
bye participant in any mode does — `awardStreamingRevenueForParticipant` returns `null` on its first
line when `isByeMatch` is true (`battlePostCombat.ts:81`).

Comparability caveat, stated rather than estimated: for the three tournament modes the "fraction of a
same-tier win reward" column is undefined, because tournament credits are not tier-scaled at all
(flat `BASE_CREDIT_REWARD = 20000` × size × round progress, `utils/tournamentRewards.ts`). The zero is
exact; the tier qualifier simply does not apply.

## Three decisions required before requirements

### Decision 1 — flat or mode-relative participation reward

- **Option A (recommended): one flat `getParticipationReward(tier)` for every mode's bye.** 0.20 ×
  tier base everywhere. Matches "the same for every match type" literally. Consequence: a bye pays
  *less* than an actual last place in KotH (0.20 vs 0.30) and Grand Melee (0.20 vs 0.50). That is
  arguably correct — turning up and fighting should beat not fighting.
- **Option B: mode-relative.** A bye pays whatever that mode's participation floor pays, so
  0.20 / 0.30 / 0.50 by mode. Matches "the same reward as someone placed last" literally, but the
  amounts then differ per mode, which contradicts point 2 of the intent.

### Decision 2 — the team-bye nerf

Unifying downward is **not a tidy-up, it is a significant nerf**. A `league_2v2` or `tag_team` bye
currently pays 2.40 × tier base with full prestige and full fame. Moving it to a flat participation
reward is roughly a **12× cut**, and `league_3v3` is worse (3.60 → 0.20, an 18× cut). Defensible — a
walkover should not pay like a win — but it needs explicit sign-off, not an implementation note.

Secondary question this raises: do team byes keep full prestige and fame, or do those go to zero to
match `league_1v1`? Prestige gates facility levels (Spec #45), so this is not cosmetic.

### Decision 3 — tournaments

Tournament credits are not tier-scaled, so a tier-based participation reward has nothing to attach
to. Two coherent positions:

- **Recommended: tournament byes stay at zero credits but become *visible*.** A bracket bye already
  pays something real — advancement. The actual defect is that nothing tells the player it happened.
- Alternative: pay `calculateTournamentParticipationReward` (30% of that round's win reward). This
  makes a bye pay more in later rounds, which is a different shape from every other mode.

## Also in scope: two defects found during the audit

Both are the same class as the repair-formula duplication fixed in Spec #48 — one number, more than
one declaration, nothing enforcing agreement.

1. **`teamSize` applied twice in team tournament credits.**
   `app/backend/src/services/tournament/teamTournamentBattleOrchestrator.ts:738-744`:
   `winnerCreditPerRobot = calculateTournamentWinReward(...) * teamSize`, then
   `awardCreditsWithLedger(..., winnerCreditPerRobot * teamSize, ...)`. The owner receives
   `base × teamSize²` — 9× instead of 3× for a 3v3. Reported as written, with no claim about intent.
2. **The Grand Melee LP scale is declared twice.** `GRAND_MELEE_LP_SCALE` in
   `services/grand-melee/grandMeleeRewards.ts:22` only fills the result object's `lpDelta`; the value
   actually written to `standings.leaguePoints` comes from a separate `GRAND_MELEE_POINT_SCALE` in
   `services/standings/standingsService.ts`. Same numbers today, two declarations, no test tying them
   together.

## Correction to an earlier claim: KotH and Grand Melee do not drop *leftovers*

An earlier note in conversation said leftover robots below `MIN_GROUP_SIZE` are dropped. That is
wrong, and the real behaviour is simpler.

`kothMatchmakingService.ts` (`MIN_GROUP_SIZE = 5`, `IDEAL_GROUP_SIZE = 6`) and
`grandMeleeMatchmakingService.ts` (`MIN_GROUP_SIZE = 8`, `IDEAL_GROUP_SIZE = 20`) both:

- Skip an **entire instance** when `eligible.length < MIN_GROUP_SIZE`, with one `logger.info` naming
  the instance and a count, never the individual robots.
- Otherwise place **every** eligible robot. `groupByLPBanding` shrinks `groupCount` until
  `floor(n / groupCount) >= MIN_GROUP_SIZE`, then distributes `baseSize + (gi < remainder ? 1 : 0)`,
  consuming the whole sorted array. Seven KotH-eligible robots become one group of seven, not five
  plus two discards.

So the only drop case is a whole tier/instance falling under the minimum, in which case *all* of its
robots are skipped. Nothing is written anywhere: the `continue` precedes
`schedulingService.createMatch`, so there is no `scheduled_matches_v2` row, no `battles` row, no
`standings` write and no `audit_logs` row. Nothing is player-visible and nothing is queryable.

This makes the requirement cleaner than expected — it is a whole-instance condition, not a per-robot
remainder — and it also means a subscribed robot can silently get nothing on a quiet day in a thin
tier, which is precisely the case the intent is aimed at.

## Scope boundary against Spec 50

Spec 49 is **what a bye pays and when one exists** — backend reward semantics, bye row creation for
all nine modes, subscription slot behaviour, and the two defects above.

Spec 50 is **what the three surfaces show**, including bye visibility and stable-total rewards. It
does not depend on Spec 49 for the stable-total fix, which is wrong today regardless of byes. It
depends on 49 only for bye rows existing in KotH and Grand Melee.

The seam is deliberate: 49 carries a balance decision that needs its own deliberation, and 50 fixes a
number that is visibly wrong on three pages today. Blocking 50 behind a balance change would be the
wrong trade.
