# Design Document: Tag Team Battle Phase Bugs

## Overview

This design addresses 7 bugs in tag team battle phase transitions that cause incorrect winner determination, timestamp handling, robot name display, shield state preservation, and admin portal display issues.

## Requirements Traceability

| Requirement | Design Section |
|-------------|----------------|
| 2.1 Winner ID should be team ID | Component 1: Winner Determination Fix |
| 2.2 Timestamp continuity across phases | Component 2: Timestamp Offset Fix |
| 2.3 Correct robot names in attack messages | Component 3: Robot Name Context Fix |
| 2.4 Preserve surviving robot's shield state | Component 4: Shield State Preservation |
| 2.5 Correct robot name in HP display | Component 3: Robot Name Context Fix |
| 2.6 Admin portal shows all 4 robots | Component 5: Admin Portal Display Fix |
| 2.7 Continue battle with reserves when actives destroyed | Component 6: Draw Detection Fix |
| 3.1-3.9 Backward compatibility | All components include regression prevention |

**Note**: This spec builds on spec 6 (HP tracking fix) which introduces `robotHP`/`robotShield` maps. Both specs will be merged into one PR.

## Architecture

### Robot Naming Convention

In tag team battles, robots are identified by two different naming schemes:

1. **Team-relative names** (used in orchestrator):
   - `team1.activeRobot` / `team1.reserveRobot` - Team 1's robots
   - `team2.activeRobot` / `team2.reserveRobot` - Team 2's robots
   - `team1CurrentRobot` / `team2CurrentRobot` - Currently fighting robot for each team

2. **Position-relative names** (used in combat simulator and message generator):
   - `robot1` / `robot2` - The two robots currently fighting in a phase
   - `robot1` is always the Team 1 fighter, `robot2` is always the Team 2 fighter
   - These change between phases based on who tagged in

**Phase-to-Robot Mapping**:
| Phase | robot1 (Team 1) | robot2 (Team 2) | Scenario |
|-------|-----------------|-----------------|----------|
| 1 | team1.activeRobot | team2.activeRobot | Always |
| 2 | team1.reserveRobot | team2.activeRobot | Team 1 tagged out |
| 2 | team1.activeRobot | team2.reserveRobot | Team 2 tagged out |
| 2 | team1.reserveRobot | team2.reserveRobot | Both tagged out |
| 3 | team1.reserveRobot | team2.reserveRobot | Both eventually tagged out |

The `phases` array in the battle result tracks which robots fought in each phase, mapping `robot1Name`/`robot2Name` to the actual robot names.

### Winner ID and Reward Allocation

**Critical Finding**: The reward allocation code in `updateTagTeamStats()` **already expects `winnerId` to be a team ID**:

```typescript
const team1Won = result.winnerId === team1.id;  // Line 1742
const team2Won = result.winnerId === team2.id;  // Line 1743
```

The current bug where `winnerId` is set to a robot ID causes **incorrect reward allocation** because:
- `result.winnerId` (robot ID like 42) ≠ `team1.id` (team ID like 5)
- Both `team1Won` and `team2Won` become `false`
- This may cause both teams to receive loser rewards or no rewards

**After the fix**: Setting `winnerId = team1.id` or `winnerId = team2.id` will correctly trigger winner rewards for the winning team.

### Current State (Defective)

```
┌─────────────────────────────────────────────────────────────┐
│              Tag Team Battle Orchestrator                    │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  Phase 1: simulateBattle(active1, active2)                  │
│     └─ Events with timestamps 0..N                          │
│                                                              │
│  Tag-out detected → activateReserveRobot()                  │
│     └─ Reserve gets FULL shields (BUG: should preserve      │
│        surviving robot's depleted shields)                   │
│                                                              │
│  Phase 2: simulateBattle(robot1, robot2)                    │
│     └─ Events with timestamps 0..M (BUG: should be N..N+M)  │
│                                                              │
│  Winner: winnerId = robotId (BUG: should be teamId)         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Combat Message Generator                        │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  convertTagTeamEvents() → convertSimulatorEvents()          │
│     └─ Emits battle_start at timestamp 0 for EACH phase     │
│        (BUG: should only emit once for phase 1)             │
│     └─ Robot names from context may be stale after tag-in   │
│        (BUG: causes empty names in messages)                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Admin Portal (BattleLogsTab)                    │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  Shows: Robot 1 vs Robot 2 (BUG: should show all 4 robots)  │
│  Winner: Often "Draw" (BUG: incorrect draw detection)       │
└─────────────────────────────────────────────────────────────┘
```

### Target State (Fixed)

```
┌─────────────────────────────────────────────────────────────┐
│              Tag Team Battle Orchestrator                    │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  Phase 1: simulateBattle(team1.active, team2.active)        │
│     └─ Events with timestamps 0..T1                         │
│     └─ Track surviving robot's shield state                 │
│                                                              │
│  Tag-out detected (one or both teams):                      │
│     └─ Reserve gets full HP/shields (fresh fighter)         │
│     └─ Surviving robot KEEPS depleted shields               │
│                                                              │
│  Phase 2: simulateBattle(team1Current, team2Current)        │
│     └─ Events with timestamps 0..T2                         │
│     └─ Orchestrator adds offset T1 to all phase 2 events    │
│     └─ team1Current = reserve if team1 tagged out, else active │
│     └─ team2Current = reserve if team2 tagged out, else active │
│                                                              │
│  Phase 3 (if needed): simulateBattle(team1.reserve, team2.reserve) │
│     └─ Only occurs if one team tagged out in phase 1,       │
│        then the other team tags out in phase 2              │
│     └─ Events with timestamps 0..T3                         │
│     └─ Orchestrator adds offset T1+T2 to all phase 3 events │
│                                                              │
│  Winner: winnerId = teamId (team1.id or team2.id)           │
│     └─ Reward allocation uses team1Won = (winnerId === team1.id) │
│     └─ This is already the expected format in updateTagTeamStats() │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Combat Message Generator                        │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  convertTagTeamEvents():                                    │
│     └─ Tracks timestamp offset per phase                    │
│     └─ Passes isPhase2+ flag to convertSimulatorEvents()    │
│                                                              │
│  convertSimulatorEvents():                                  │
│     └─ Skips battle_start for phase 2+ (isPhase2+ flag)     │
│     └─ Uses phase-specific robot names from context         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Admin Portal (BattleLogsTab)                    │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  Tag Team: Shows "Team 1 (Active + Reserve) vs Team 2"      │
│  Winner: Correctly shows winning team (not robot)           │
└─────────────────────────────────────────────────────────────┘
```

## Component Design

### Component 1: Winner Determination Fix

**File**: `prototype/backend/src/services/tagTeamBattleOrchestrator.ts`
**Lines**: 900-912

**Current Code (Defective)**:
```typescript
} else if (team1CurrentFighterHP <= 0) {
  winnerId = team2CurrentFighterId;  // BUG: robot ID
} else if (team2CurrentFighterHP <= 0) {
  winnerId = team1CurrentFighterId;  // BUG: robot ID
```

**Fixed Code**:
```typescript
} else if (team1CurrentFighterHP <= 0) {
  winnerId = team2.id;  // FIXED: team ID
} else if (team2CurrentFighterHP <= 0) {
  winnerId = team1.id;  // FIXED: team ID
} else if (team1CurrentFighterHP > team2CurrentFighterHP) {
  winnerId = team1.id;  // FIXED: team ID
} else if (team2CurrentFighterHP > team1CurrentFighterHP) {
  winnerId = team2.id;  // FIXED: team ID
```

**Regression Prevention**: 
- Standard 1v1 battles continue to use robot ID (different code path in `battleOrchestrator.ts`)
- Add unit test to verify tag team battles return team ID

### Component 2: Timestamp Offset Fix

**File**: `prototype/backend/src/services/combatMessageGenerator.ts`
**Function**: `convertTagTeamEvents()` and `convertSimulatorEvents()`

**Problem**: Each phase's events start at timestamp 0, and `convertSimulatorEvents` emits `battle_start` at timestamp 0 for each phase.

**Solution**:
1. Track cumulative timestamp offset in `convertTagTeamEvents()`
2. Pass `skipBattleStart: boolean` flag to `convertSimulatorEvents()` for phase 2+
3. Apply timestamp offset to all events from phase 2+

**Updated `convertTagTeamEvents()`**:
```typescript
static convertTagTeamEvents(
  mixedEvents: any[],
  context: { /* existing fields */ }
): any[] {
  const narrativeEvents: any[] = [];
  let currentPhase = 0;
  let phaseEvents: CombatEvent[] = [];
  let cumulativeTimestamp = 0;  // NEW: track offset

  for (const event of mixedEvents) {
    if (event.type === 'tag_out' || event.type === 'tag_in') {
      // Flush accumulated phase events
      if (phaseEvents.length > 0 && currentPhase < context.phases.length) {
        const phase = context.phases[currentPhase];
        const converted = this.convertSimulatorEvents(phaseEvents, {
          ...phase,
          skipBattleStart: currentPhase > 0,  // NEW: skip for phase 2+
          timestampOffset: cumulativeTimestamp,  // NEW: apply offset
        });
        narrativeEvents.push(...converted);
        
        // Update cumulative timestamp from last event
        if (phaseEvents.length > 0) {
          cumulativeTimestamp = phaseEvents[phaseEvents.length - 1].timestamp;
        }
        phaseEvents = [];
        currentPhase++;
      }
      // Tag events already have correct timestamps from orchestrator
      narrativeEvents.push(event);
      continue;
    }
    phaseEvents.push(event as CombatEvent);
  }
  // ... flush remaining events
}
```

**Updated `convertSimulatorEvents()` signature**:
```typescript
static convertSimulatorEvents(
  simulatorEvents: CombatEvent[],
  context: {
    // ... existing fields ...
    skipBattleStart?: boolean;  // NEW: skip battle_start for phase 2+
    timestampOffset?: number;   // NEW: add to all timestamps
  }
): any[]
```

### Component 3: Robot Name Context Fix

**File**: `prototype/backend/src/services/combatMessageGenerator.ts`

**Problem**: After tag-in, attack messages show empty attacker/defender names because the context still references the tagged-out robot.

**Root Cause Analysis**:
- `convertTagTeamEvents()` passes phase-specific robot names via `context.phases[currentPhase]`
- However, the raw simulator events use `event.attacker` and `event.defender` which should already contain the correct names
- The issue is that `generateAttack()` may be receiving empty strings

**Solution**:
1. Verify that `simulateBattle()` correctly sets `event.attacker` and `event.defender` to robot names
2. In `convertSimulatorEvents()`, ensure attack messages use `event.attacker`/`event.defender` directly
3. Add fallback to phase context names if event names are missing

**Code Change in `convertSimulatorEvents()`**:
```typescript
} else if (event.type === 'attack' || event.type === 'critical') {
  const attackerName = event.attacker || context.robot1Name;  // Fallback
  const defenderName = event.defender || context.robot2Name;  // Fallback
  
  narrativeEvents.push({
    timestamp: ts + (context.timestampOffset ?? 0),
    type: event.type === 'critical' ? 'critical' : 'attack',
    attacker: attackerName,
    defender: defenderName,
    message: this.generateAttack({
      attackerName,
      defenderName,
      // ... rest of params
    }),
  });
}
```

### Component 4: Shield State Preservation

**File**: `prototype/backend/src/services/tagTeamBattleOrchestrator.ts`
**Function**: `simulateTagTeamBattle()`

**Problem**: When phase 2 starts, the surviving robot (who just defeated their opponent) has full shields instead of their depleted shield state from phase 1.

**Root Cause**:
- `simulateBattle()` calls `initializeCombatState()` which sets `currentShield: robot.currentShield`
- `robot.currentShield` is the max shield value, not the depleted value from phase 1

**Solution**:
1. After phase 1 ends, capture the surviving robot's shield state
2. Before calling `simulateBattle()` for phase 2, update the surviving robot's `currentShield` property
3. The reserve robot keeps full shields (they're fresh)

**Code Change**:
```typescript
// After phase 1 completes
const phase1Result = simulateBattle(team1CurrentRobot, team2CurrentRobot);
team1CurrentRobot.currentHP = phase1Result.robot1FinalHP;
team2CurrentRobot.currentHP = phase1Result.robot2FinalHP;

// NEW: Capture shield state from phase 1 final event
const phase1FinalEvent = phase1Result.events[phase1Result.events.length - 1];
if (phase1FinalEvent?.robotShield) {
  team1CurrentRobot.currentShield = phase1FinalEvent.robotShield[team1CurrentRobot.name] ?? team1CurrentRobot.currentShield;
  team2CurrentRobot.currentShield = phase1FinalEvent.robotShield[team2CurrentRobot.name] ?? team2CurrentRobot.currentShield;
}

// When team2 tags out but team1 survives:
if (team2NeedsTagOut && !team1NeedsTagOut) {
  // team1CurrentRobot keeps their depleted shields (already set above)
  // team2CurrentRobot = activateReserveRobot() gets full shields (correct)
}
```

### Component 5: Admin Portal Display Fix

**File**: `prototype/frontend/src/components/admin/BattleLogsTab.tsx`

**Problem**: Tag team battles only show "Robot 1 vs Robot 2" instead of all 4 participating robots.

**Solution**: Update the table row rendering to show team information for tag team battles.

**Code Change**:
```tsx
<td className="p-3">
  {battle.battleFormat === '2v2' ? (
    <div>
      <div className="text-primary font-semibold">Team 1</div>
      <div className="text-xs text-secondary">
        {battle.team1ActiveName} + {battle.team1ReserveName}
      </div>
    </div>
  ) : (
    <Link to={`/robots/${battle.robot1.id}`} className="text-primary hover:underline">
      {battle.robot1.name}
    </Link>
  )}
</td>
<td className="p-3">
  {battle.battleFormat === '2v2' ? (
    <div>
      <div className="text-purple-400 font-semibold">Team 2</div>
      <div className="text-xs text-secondary">
        {battle.team2ActiveName} + {battle.team2ReserveName}
      </div>
    </div>
  ) : (
    <Link to={`/robots/${battle.robot2.id}`} className="text-purple-400 hover:underline">
      {battle.robot2.name}
    </Link>
  )}
</td>
```

**Backend API Change**: The `/api/admin/battles` endpoint needs to include team robot names in the response for tag team battles.

### Component 6: Draw Detection Fix

**File**: `prototype/backend/src/services/tagTeamBattleOrchestrator.ts`
**Lines**: 870-912

**Problem**: When both active robots are destroyed but reserves are available, the system incorrectly declares a draw instead of continuing with reserves.

**Root Cause Analysis**:
- The current logic checks `team1NeedsTagOut && team2NeedsTagOut` and handles simultaneous tag-outs
- However, the draw detection at lines 870-912 may trigger before reserves are properly tagged in

**Solution**: Ensure draw is only declared when:
1. Both teams have exhausted ALL robots (active AND reserve destroyed), OR
2. Time limit reached with both teams still having robots alive

**Code Change**:
```typescript
// Determine winner (Requirements 3.6, 3.7, 3.8)
let winnerId: number | null = null;
let isDraw = false;

// Calculate total remaining HP for each team
const team1TotalHP = team1ActiveFinalHP + (team1ReserveUsed ? team1ReserveFinalHP : team1.reserveRobot.maxHP);
const team2TotalHP = team2ActiveFinalHP + (team2ReserveUsed ? team2ReserveFinalHP : team2.reserveRobot.maxHP);

// Requirement 3.8: Battle timeout draw
if (currentTime >= maxTime || lastPhaseWasDraw) {
  isDraw = true;
}
// Requirement 3.7: Both teams exhausted (all robots destroyed/yielded)
else if (team1TotalHP <= 0 && team2TotalHP <= 0) {
  isDraw = true;
}
// Team 1 exhausted
else if (team1TotalHP <= 0) {
  winnerId = team2.id;
}
// Team 2 exhausted
else if (team2TotalHP <= 0) {
  winnerId = team1.id;
}
// Both teams have HP remaining - compare current fighters
else if (team1CurrentFighterHP > team2CurrentFighterHP) {
  winnerId = team1.id;
} else if (team2CurrentFighterHP > team1CurrentFighterHP) {
  winnerId = team2.id;
} else {
  isDraw = true;
}
```

## Documentation Impact

### Files to Update
- `docs/prd_core/BATTLE_SIMULATION_ARCHITECTURE.md` - Add section on tag team phase transitions
- `.kiro/steering/coding-standards.md` - No changes needed

### No Changes Needed
- `docs/guides/ERROR_CODES.md` - Unrelated to this fix

## Testing Strategy

1. **Unit Tests**: 
   - Test winner determination returns team ID for tag team battles
   - Test timestamp continuity across phases
   - Test shield state preservation for surviving robot

2. **Property-Based Tests**:
   - For any tag team battle, `winnerId` should be `team1.id`, `team2.id`, or `null` (draw)
   - For any phase 2+ event, timestamp should be >= phase 1 end timestamp
   - For surviving robot, shield state should match phase 1 final state

3. **Integration Tests**:
   - Simulate full tag team battle and verify all 7 bugs are fixed
   - Verify admin portal displays all 4 robots correctly

4. **Manual Verification**:
   - Run a tag team battle on ACC environment
   - Verify battle log shows correct timestamps, robot names, and winner

## Migration Notes

- No database migration required
- No API breaking changes
- Backward compatible with existing battle logs (they will continue to display with old behavior)
- New battles will have correct data
