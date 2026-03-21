# Multi-Robot Battle Simulator Refactor

**Date**: March 18, 2026  
**Status**: ✅ Implemented  
**Priority**: Medium - Architecture and gameplay expansion

---

## What Changed

### New Unified Simulator: `simulateBattleMulti()`

The combat simulator now supports N-robot battles through a single unified entry point. The old `simulateBattle()` function is preserved as a backward-compatible wrapper.

| Aspect | Old Behavior | New Behavior |
|--------|-------------|--------------|
| Entry point | `simulateBattle(robot1, robot2, isTournament)` | `simulateBattleMulti(robots[], config)` |
| Robot count | Fixed 2 robots | N robots (minimum 2) |
| Configuration | Single `isTournament` boolean | `BattleConfig` object with `allowDraws`, `maxDuration`, `gameModeConfig`, `gameModeState`, `arenaRadius` |
| Draw handling | `isTournament ? HP tiebreaker : draw` | `config.allowDraws ? draw : HP tiebreaker (highest HP%)` |
| Game modes | None | Extensible via `GameModeConfig` (zone control/KotH, custom win conditions, arena zones) |
| Result shape | `CombatResult` | `SpatialCombatResult` with optional `kothMetadata` |

### Time Limit Resolution (Section 5)

When the battle reaches `MAX_BATTLE_DURATION` (120s) without a decisive outcome:

- **Draws allowed** (`allowDraws: true`): Battle ends as a draw, no winner assigned
- **Draws disallowed** (`allowDraws: false`): HP tiebreaker — robot with the highest HP percentage wins

### Backward-Compatible Wrapper: `simulateBattle()`

The original 1v1 function signature is preserved and delegates to `simulateBattleMulti()`:

```typescript
simulateBattle(robot1, robot2, isTournament = false)
// Maps to: simulateBattleMulti([robot1, robot2], { allowDraws: !isTournament })
```

The wrapper maps the `SpatialCombatResult` back to the legacy `CombatResult` shape, so all existing callers (league, tournament, tag team orchestrators) continue to work without changes.

### KotH Metadata in Results

When a zone control game mode is active, the result now includes `kothMetadata`:

- `finalZoneScores` — per-robot zone scores at match end
- `zoneOccupationTimes` — cumulative time each robot held the zone
- `uncontestedTimes` — time spent as sole zone occupant
- `zoneEntries` / `zoneExits` — zone transition counts
- `killCounts` — eliminations per robot
- `matchDuration` — total match time

---

## Why It Changed

1. **Foundation for new game modes**: The existing 1v1-only simulator couldn't support planned features like King of the Hill, Free-for-All, and Battle Royale. A unified N-robot simulator with pluggable game mode hooks enables all of these without duplicating the core combat loop.

2. **Configuration flexibility**: The single `isTournament` boolean was too limited. The new `BattleConfig` object allows callers to control draw rules, duration, arena size, and game mode behavior independently.

3. **Time limit fairness**: The HP tiebreaker for no-draw modes (tournaments) now uses HP percentage rather than raw HP, ensuring robots with different max HP values are compared fairly.

4. **Data richness for zone modes**: KotH and zone control modes need detailed occupation and scoring metadata for post-match analysis and leaderboards. Embedding this in the result avoids separate tracking systems.

---

## Expected Impact on Gameplay

### Existing 1v1 Battles
- **No change** — the `simulateBattle()` wrapper preserves identical behavior for league and tournament matches
- All existing combat formulas, attribute calculations, and event generation remain untouched
- The 7-phase tick loop (movement, facing, targeting, attacks, shields, state checks, position snapshots) is unchanged

### Tournament Tiebreakers
- HP tiebreaker now uses percentage instead of raw HP — this is a minor fairness improvement for matchups between robots with different max HP pools
- A robot at 50/100 HP now ties with a robot at 150/300 HP (both 50%), whereas before the 150 HP robot would have won on raw value

### New Game Modes (Future)
- King of the Hill, Free-for-All, and Battle Royale modes can now be implemented by providing appropriate `GameModeConfig` and `GameModeState` objects
- Zone scoring, custom win conditions, and per-tick hooks are all supported through the config interface

### No Changes To
- Core damage formula (combat power, weapon control, penetration, armor)
- Hit chance calculation (targeting, evasion, gyro, stance)
- Critical hit mechanics
- Counter-attack system
- Shield regeneration
- Yield threshold behavior
- Weapon malfunction rates
- Spatial mechanics (range bands, backstab, hydraulic bonus, adaptation, pressure)
- Any robot attribute weights or scaling factors

---

## Files Modified

1. `prototype/backend/src/services/combatSimulator.ts` — Added `simulateBattleMulti()` time limit handling (section 5), result building (section 6), and backward-compatible `simulateBattle()` wrapper

---

## Testing Checklist

- [ ] Verify `simulateBattle()` wrapper produces identical results to direct `simulateBattleMulti()` calls for 1v1
- [ ] Verify tournament mode (`isTournament: true`) resolves time-limit draws with HP% tiebreaker
- [ ] Verify league mode (`isTournament: false`) allows draws at time limit
- [ ] Verify HP% tiebreaker is fair across robots with different max HP values
- [ ] Verify KotH metadata is populated when zone control game mode is active
- [ ] Verify KotH metadata is absent for standard 1v1 battles
- [ ] Verify all existing league/tournament orchestrators work without modification
- [ ] Verify `simulateBattleMulti()` throws for fewer than 2 robots
- [ ] Verify ending positions are correctly recorded in results
