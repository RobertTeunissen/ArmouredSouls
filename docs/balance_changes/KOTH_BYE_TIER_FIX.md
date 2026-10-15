# KotH Bye Tier Correction (#536, R6)

**Effective season**: Season 2 (applies from the first KotH run after the #536 deploy; it is a bug fix, so it is not held for a preparation window).

**Issue**: [#536](https://github.com/RobertTeunissen/ArmouredSouls/issues/536), risk R6 in the battle-time readiness design.

**Source**: branch `fix/season2-combat-baseline`, commit `11f84ad7` (`fix(koth): pay KotH byes at the match tier`).

## What changed

A King of the Hill bye happens when a tier instance has fewer than 5 eligible robots (and, since #536, when battle-time forfeits leave fewer than 5 ready robots). Each robot gets the participation reward for its tier, with no combat.

The KotH bye branch called `resolvePlacementBye` without the match tier. The bye writer then defaulted to bronze, so every KotH bye was paid the **Bronze** participation reward, whatever the robot's tier. Grand Melee already passed the tier and was correct.

The KotH orchestrator now maps the match's `leagueType` at both fetch sites and passes it to `resolvePlacementBye`, the same way Grand Melee does. KotH byes are tier-scaled.

| KotH tier | Bye paid before | Bye paid now |
|---|---:|---:|
| Bronze | ₡1,500 | ₡1,500 |
| Silver | ₡1,500 | ₡3,000 |
| Gold | ₡1,500 | ₡6,000 |
| Platinum | ₡1,500 | ₡12,000 |
| Diamond | ₡1,500 | ₡23,000 |
| Champion | ₡1,500 | ₡45,000 |

Amounts are `getParticipationReward(tier)` per robot (`app/backend/src/utils/economyFormulas.ts`).

## What did not change

- No coefficient, base reward or formula changed. The bye amount still comes from `resolveByeReward` / `BYE_MODE_SPECS` (`app/backend/src/utils/byeRewards.ts`).
- A bye is still worth less per robot than a last-place finish in a fought KotH match (0.20 × tier base versus 0.30 × tier base), so fighting still beats sitting out.
- Bronze KotH byes and every Grand Melee bye are paid exactly as before.
- Past underpaid byes are not back-paid.

## Who is affected

Players with Silver-and-above KotH robots in thin tier instances. Their byes now pay the same tier-scaled reward as the other eight modes.

## Verification

- `tests/kothOrchestrator.test.ts`: the bye branch passes the match tier to `resolvePlacementBye`.
- `tests/integration/placementForfeit.test.ts`: a plain gold KotH bye pays `getParticipationReward('gold')`, and the below-minimum crash rerun pays each bye once at the gold amount.
