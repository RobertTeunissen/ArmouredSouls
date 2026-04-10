# Movement Event Throttling Revert

**Date**: March 28, 2026  
**File Modified**: `app/backend/src/services/battle/combatSimulator.ts`

## What Changed

Movement event throttling parameters were reverted to their original, more sensitive values:

| Parameter | Previous Value | New Value |
|-----------|---------------|-----------|
| `MOVEMENT_EVENT_THRESHOLD` | 2.0 grid units | 1.0 grid units |
| `MOVEMENT_EVENT_MIN_INTERVAL` | 1.0 seconds | 0.5 seconds |

Additionally, the following throttling constants were removed entirely:
- `RANGE_TRANSITION_MIN_INTERVAL` (was 1.5 seconds)
- `SHIELD_REGEN_THRESHOLD` (was 0.25 / 25% increments)

## Why It Changed

The aggressive throttling introduced previously was likely causing:
- Loss of granularity in battle replays and logs
- Missing movement events that players expected to see
- Reduced fidelity in combat visualization
- Potential issues with range-based weapon mechanics not triggering correctly

The removal of range transition and shield regen throttling suggests these events should now fire at their natural rate without artificial suppression.

## Expected Impact on Gameplay

### Positive Effects
- More detailed battle logs showing finer movement increments
- Better visual feedback during combat animations
- More accurate range transition detection for weapon effectiveness
- Shield regeneration events visible at natural intervals

### Potential Concerns
- Increased event volume may impact performance on lower-end clients
- Larger battle log data size
- More network traffic if events are streamed in real-time

### Monitoring Recommendations
- Watch for performance regressions in battle simulation
- Monitor battle log sizes for significant increases
- Gather player feedback on combat visualization quality
