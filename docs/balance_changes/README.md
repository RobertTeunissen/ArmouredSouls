# Balance Changes

Game balance adjustments documenting what changed, why, and what the old values were. These serve as design history for future balance decisions.

The authoritative weapon catalog and pricing formula lives in [PRD_WEAPON_ECONOMY.md](../game-systems/PRD_WEAPON_ECONOMY.md).

## Contents

### Economy
- `STARTING_ECONOMY_REBALANCE.md` — Starting credits ₡2M→₡3M, attribute costs +50%, facility costs -50%
- `TRAINING_FACILITY_REBALANCE.md` — Training facility economics and academy caps
- `COMBAT_TRAINING_ACADEMY_COST_REDUCTION.md` — Academy upgrade cost reduction

### Combat Mechanics
- `COUNTER_ATTACK_SYSTEM_REWORK.md` — Counter-attack trigger and damage rework
- `RANGED_VS_MELEE_REBALANCE.md` — Melee vs ranged balance philosophy and adjustments
- `WEAPON_CONTROL_IMPLEMENTATION.md` — Weapon control malfunction mechanic
- `MOVEMENT_EVENT_THROTTLING_REVERT.md` — Reverted movement event throttling

### AI & Targeting
- `THREAT_SCORING_TARGET_SELECTION_INTEGRATION.md` — Threat-based target selection in combat
- `KOTH_LINEARIZED_SCALING.md` — KotH attribute scaling, score-aware targeting, passive penalties

### Architecture
- `MULTI_ROBOT_SIMULATOR_FOR_KOTH.md` — N-robot simulator architecture enabling KotH

## Related Documentation

- [PRD_WEAPON_ECONOMY.md](../game-systems/PRD_WEAPON_ECONOMY.md) — Weapon catalog, pricing formula, 47-weapon roster
- [COMBAT_FORMULAS.md](../architecture/COMBAT_FORMULAS.md) — Combat calculation formulas
- [PRD_ECONOMY_SYSTEM.md](../game-systems/PRD_ECONOMY_SYSTEM.md) — Overall economy design
