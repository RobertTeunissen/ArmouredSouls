---
inclusion: fileMatch
fileMatchPattern: "**/backend/src/services/battle/**,**/backend/src/services/scheduling/**,**/backend/src/game-engine/**,**/*tournament*,**/*league*,**/*team-battle*,**/*koth*,**/*melee*"
---

# Battle, Season, Repair, and Bye Rules

- Every orchestrator uses `updateRobotCombatStats()` for post-combat robot state and writes a best-effort `BattleSummary` at battle creation. Do not inline HP/ELO/counter updates or make a battle fail because summary creation fails.
- Permanent battle data lives in `battle_summaries` and proper columns. `battle_log` is ephemeral and must not be used for permanent reporting; use `battles.winning_side` for team winners.
- A bye is resolved by `resolveByeEvent`; its amount comes from `resolveByeReward`/the exhaustive `BYE_MODE_SPECS` table. A bye simulates nothing, pays credits only, causes no damage/fame/prestige/streaming, and is counted separately from fought matches.
- Claim a bye before paying it for idempotency. A bye remains a scheduled obligation: it receives the same scoped auto-repair treatment as other scheduled events, including tournament byes.
- Do not use bye placeholders as combat entities or inspect their combat state.
- Live competitive queries are current-season scoped. Cross-season figures come only from archive tables; never re-derive archived values under current rules. Generated stables are identified by `users.is_generated`.
- Repairs use the shared formulas in `app/shared/utils/repairCost.ts`; never duplicate or re-apply discounts.
- The canonical architecture is `docs/architecture/PRD_BATTLE_DATA_ARCHITECTURE.md`; mechanics and schedule details live in `game-mechanics-reference.md` and the relevant PRDs.
