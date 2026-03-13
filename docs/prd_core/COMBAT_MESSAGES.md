# Combat Message Catalog

**Project**: Armoured Souls  
**Document Type**: Product Requirements Document (PRD)  
**Date**: March 1, 2026  
**Status**: Implementation Complete  
**Purpose**: Textual descriptions for battle log events
**Version**: v2.0  

---

## Version History
- v1.0 - Initial draft by GitHub Copilot (February 5, 2026)
- v1.1 - Review done by Robert Teunissen (February 6, 2026)
- v1.2 - Review done by Robert Teunissen (February 9, 2026)
- v1.3 - Updated to reflect actual implementation (February 9, 2026)
- v2.0 - Full narrative system implementation (March 1, 2026)
  - All three orchestrators (league, tournament, tag team) now use real simulator events
  - Stance information messages implemented
  - Counter-attack messages with 8 variations
  - Shield regeneration events emitted by simulator
  - Yield vs destruction distinction with separate message pools
  - Heavy/moderate/light damage status thresholds implemented
  - Real weapon names shown in all combat messages
  - Tag team events converted through narrative generator

---

## Overview

This catalog defines all possible combat messages for the battle simulation system. Each event in a battle generates a human-readable text description that explains what happened.

**Design Principles**:
- Clear and descriptive language
- Consistent formatting
- Informative (uses damage descriptors, not raw numbers)
- Engaging (creates narrative flow)
- Supports replay understanding
- Players see their actual weapon names in combat

---

## Architecture

### Two Message Systems

The codebase has **two distinct message generation systems**:

1. **Combat Simulator** (`combatSimulator.ts`)
   - Produces raw technical events with exact damage numbers
   - Format: `💥 BattleBot Alpha hits for 45 damage with Laser Rifle (30 shield, 15 HP)`
   - Includes formula breakdowns for admin debugging
   - Stored in `detailedCombatEvents` for admin panel

2. **Combat Message Generator** (`combatMessageGenerator.ts`)
   - Converts raw simulator events into narrative player-facing messages
   - Format: `💥 BattleBot Alpha strikes Iron Crusher with Laser Rifle, landing a heavy strike!`
   - Multiple message variations per event type for variety
   - Stored in `battleLog.events` for player-facing display

### Event Flow

```
combatSimulator.ts → CombatEvent[] (raw technical events)
       ↓
combatMessageGenerator.ts → convertSimulatorEvents() → narrative events
       ↓
Stored in battle record as battleLog.events (player-facing)
```

### Orchestrator Integration

All three orchestrators now use the narrative conversion pipeline:

- **League** (`battleOrchestrator.ts`): Calls `generateBattleLog()` with `simulatorEvents`, which delegates to `convertSimulatorEvents()`
- **Tournament** (`tournamentBattleOrchestrator.ts`): Same as league, with `battleType: 'tournament'`
- **Tag Team** (`tagTeamBattleOrchestrator.ts`): Calls `convertTagTeamEvents()` which handles mixed arrays of raw simulator events and narrative tag_out/tag_in events, converting each combat phase separately

---

## Implementation Status

### Fully Implemented ✅

| Category | Variations | Notes |
|----------|-----------|-------|
| Battle Start (Generic) | 5 | Used when no battle type specified |
| Battle Start (League) | 6 | Shows ELO and league type |
| Battle Start (Tournament) | 5 | Elimination-themed |
| Battle Start (Tag Team) | 5 | Shows team names |
| Stance Information | 3 per stance | Offensive, Defensive, Balanced |
| Attack Hit | 12 | With damage descriptors |
| Critical Hit | 12 | Dramatic critical messages |
| Miss/Dodge | 12 | Various evasion narratives |
| Shield Absorption | 5 | When shield blocks all damage |
| Shield Break | 5 | When shield depletes to 0 |
| Shield Regeneration | 5 | Emitted at 25% shield thresholds |
| Malfunction | 6 | Weapon failure messages |
| Counter-Attack Hit | 8 | With weapon name and damage descriptor |
| Counter-Attack Miss | 6 | Counter triggered but missed |
| Yield | 5 | Surrender messages |
| Destruction | 5 | Robot destroyed messages |
| Victory (Standard) | 8 | Normal win |
| Victory (Dominant) | 8 | Winner >80% HP |
| Victory (Close) | 8 | Winner <30% HP |
| Draw | 3 | Time limit reached |
| Damage Status (Heavy) | 3 | HP ≤25% |
| Damage Status (Moderate) | 2 | HP ≤50% |
| Damage Status (Light) | 1 | HP ≤75% |
| ELO Gain | 5 | Rating increase |
| ELO Loss | 5 | Rating decrease |
| Credits Reward | 4 | Battle earnings |
| Prestige | 4 | Prestige awarded |
| Fame | 4 | Fame awarded |
| Tag-Out (Yield) | 8 | Robot yields and tags out |
| Tag-Out (Destruction) | 8 | Robot destroyed, reserve enters |
| Tag-In | 10 | Reserve robot enters arena |

### Not Implemented ❌

| Category | Reason |
|----------|--------|
| Weapon-Specific Messages | All weapons use generic attack messages (by design) |
| Overkill Messages | Not needed - simulator stops at 0 HP |
| Contextual Dramatic Messages | Comeback/domination commentary not prioritized |
| League Impact Messages | Shown in UI summary, not combat log |
| Yield Threshold Warnings | Would add noise to combat log |

---

## Damage Descriptor System

Instead of showing raw damage numbers, the narrative system uses descriptive text based on damage as a percentage of the defender's max HP:

| Threshold | Descriptor |
|-----------|-----------|
| ≥25% of max HP | "a devastating blow" |
| ≥15% of max HP | "a heavy strike" |
| ≥10% of max HP | "a solid hit" |
| ≥5% of max HP | "a moderate impact" |
| ≥2% of max HP | "a glancing blow" |
| <2% of max HP | "a minor scratch" |

## Damage Status Thresholds

Status messages are emitted once per threshold crossing (not repeated):

| Threshold | Severity | Example |
|-----------|----------|---------|
| HP ≤25% | Heavy | "⚠️ {robotName} is heavily damaged - hull integrity critical!" |
| HP ≤50% | Moderate | "⚠️ {robotName} has taken significant damage!" |
| HP ≤75% | Light | "🟢 {robotName} sustains minor damage - still in fighting shape" |

## Shield Regeneration Events

The combat simulator now emits `shield_regen` events when a robot's shield crosses a 25% threshold (0→25%, 25→50%, 50→75%, 75→100%). This prevents spam while still showing meaningful shield recovery moments.

---

## Message Categories

### 1. Battle Initialization

**Battle Start Messages** (varies by battle type):

League (6 variations):
```
"⚔️ Battle commences! {robot1Name} (ELO {robot1ELO}) vs {robot2Name} (ELO {robot2ELO})"
"🎯 {robot1Name} and {robot2Name} enter the arena for {leagueType} league combat!"
```

Tournament (5 variations):
```
"🏆 Tournament bout! {robot1Name} vs {robot2Name} - only one advances!"
"⚔️ Tournament match: {robot1Name} faces {robot2Name} in elimination combat!"
```

Tag Team (5 variations):
```
"🤝 Tag Team Battle! {team1Name} vs {team2Name}!"
"⚔️ Tag team combat begins! {team1Name} sends {robot1Name} against {team2Name}'s {robot2Name}!"
```

**Stance Information** (3 per stance):
```
"⚔️ {robotName} takes an aggressive offensive stance, focusing on damage"
"🛡️ {robotName} adopts a defensive stance, prioritizing survival"
"⚖️ {robotName} maintains a balanced stance, ready to adapt"
```

### 2. Attack Actions

**Attack Hit** (12 variations with damage descriptors):
```
"💥 {attackerName} strikes {defenderName} with {weaponName}, landing {damageDescriptor}!"
"⚡ {attackerName}'s {weaponName} connects, dealing {damageDescriptor} to {defenderName}!"
```

**Critical Hit** (12 variations):
```
"💢 CRITICAL HIT! {attackerName}'s {weaponName} finds a weak point - catastrophic damage!"
"🎯 Perfect strike! {attackerName} lands a critical hit with {weaponName}!"
```

**Shield Absorption** (5 variations - when shield blocks all HP damage):
```
"🛡️ {defenderName}'s energy shield absorbs the impact from {attackerName}'s {weaponName}!"
"⚡ {defenderName}'s shields hold strong against {attackerName}'s {weaponName}!"
```

### 3. Miss/Dodge Actions

**Miss Messages** (12 variations):
```
"❌ {attackerName} swings {weaponName} but misses {defenderName} completely!"
"💨 {defenderName} dodges {attackerName}'s {weaponName} attack effortlessly!"
```

### 4. Counter-Attack Actions

**Successful Counter** (8 variations with weapon name and damage descriptor):
```
"🔄 {defenderName} counters {attackerName}'s attack with {weaponName} for {damageDescriptor}!"
"⚔️ Counter-attack! {defenderName} retaliates with {weaponName}, dealing {damageDescriptor}!"
"💫 {defenderName} parries and counters with {weaponName}, striking {attackerName}!"
"🔄 Quick reflexes! {defenderName} turns defense into offense with {weaponName}!"
"⚔️ {defenderName} exploits an opening and counters with {weaponName}!"
"💫 {defenderName}'s counter protocols activate - {weaponName} strikes back!"
"🔄 Reversal! {defenderName} catches {attackerName} off-guard with a {weaponName} counter!"
"⚔️ {defenderName} reads the attack and retaliates with {weaponName}!"
```

**Counter Miss** (6 variations):
```
"🔄❌ {defenderName} counters but {weaponName} misses {attackerName}!"
"⚔️❌ {defenderName} retaliates with {weaponName} but fails to connect!"
"💫❌ {defenderName}'s counter protocols activate but {weaponName} swings wide of {attackerName}!"
"🔄❌ {defenderName} attempts a counter with {weaponName} — {attackerName} evades!"
"⚔️❌ Counter-attack! {defenderName} strikes back with {weaponName} but misses!"
"💫❌ {defenderName} retaliates but {attackerName} dodges the {weaponName} counter!"
```

**Note**: Counter-attacks trigger on any attack (hit or miss) except malfunctions. The counter itself has its own hit check and can miss.

### 5. Shield Events

**Shield Break** (5 variations):
```
"🛡️💥 {robotName}'s energy shield has been depleted!"
"⚡❌ {robotName}'s shields are down - hull is exposed!"
```

**Shield Regeneration** (5 variations):
```
"🛡️⚡ {robotName}'s power core recharges shields"
"⚡✨ {robotName}'s shields regenerate during the lull in combat"
"🔋 {robotName}'s energy shield restores capacity"
```

### 6. Malfunction Messages

**Malfunction** (6 variations):
```
"⚙️ MALFUNCTION! {robotName}'s {weaponName} jams and fails to fire!"
"⚠️ SYSTEM ERROR! {robotName}'s targeting systems glitch - attack aborted!"
```

### 7. Yield/Surrender Events

**Yield** (5 variations - distinct from destruction):
```
"🏳️ {robotName} yields! Battle ends with {winnerName} victorious!"
"✋ {robotName} surrenders! {winnerName} wins!"
"🛑 {robotName} concedes defeat to {winnerName}!"
```

### 8. Destruction/KO Events

**Destruction** (5 variations - distinct from yield):
```
"💀 {robotName} has been destroyed! Hull integrity at 0%!"
"💥 {robotName}'s systems fail - robot disabled!"
"🔴 KNOCKOUT! {robotName} is down!"
```

### 9. Victory Messages

**Standard Victory** (8 variations - winner 30-80% HP):
```
"🏆 VICTORY! {winnerName} defeats {loserName}!"
"👑 {winnerName} emerges victorious over {loserName}!"
```

**Dominant Victory** (8 variations - winner >80% HP):
```
"🏆 DOMINANT VICTORY! {winnerName} crushes {loserName} with {hpPercent}% HP remaining!"
"👑 FLAWLESS! {winnerName} defeats {loserName} while taking minimal damage!"
```

**Close Victory** (8 variations - winner <30% HP):
```
"🏆 NARROW VICTORY! {winnerName} defeats {loserName} by the slimmest margin!"
"⚔️ Hard-fought victory! {winnerName} wins with only {hp} HP remaining!"
```

### 10. Draw Conditions

**Draw** (3 variations):
```
"⏱️ DRAW! Maximum battle time reached - both combatants survive!"
"⏰ Time expires! Battle ends in a draw."
"🤝 Stalemate! Neither robot could secure victory before time ran out."
```

### 11. Post-Battle Messages

**ELO Changes** (5 gain + 5 loss variations):
```
"📈 {robotName}: {oldELO} → {newELO} (+{change} ELO)"
"📉 {robotName}: {oldELO} → {newELO} ({change} ELO)"
```

**Rewards** (4 credits + 4 prestige + 4 fame variations):
```
"💰 {robotName} receives ₡{credits}"
"⭐ {robotName} gains {prestige} prestige!"
"🎖️ {robotName} gains {fame} fame!"
```

### 12. Tag Team Events

**Tag-Out Yield** (8 variations):
```
"🏳️ {robotName} reaches their yield threshold and tags out! {teamName} calls in their reserve!"
"✋ {robotName} yields! {teamName}'s reserve robot prepares to enter the arena!"
```

**Tag-Out Destruction** (8 variations):
```
"💥 {robotName} is destroyed! {teamName}'s reserve robot rushes to continue the fight!"
"🔥 {robotName} falls in combat! {teamName} sends in their backup!"
```

**Tag-In** (10 variations):
```
"🔄 {robotName} enters the arena for {teamName} at full strength!"
"⚡ Fresh fighter! {robotName} tags in for {teamName} with {hp} HP!"
```

---

## Battle Log JSON Structure

**Event Structure** (player-facing):
```json
{
  "timestamp": 2.5,
  "type": "attack",
  "attacker": "BattleBot Alpha",
  "defender": "Iron Crusher",
  "weapon": "Laser Rifle",
  "message": "⚡ BattleBot Alpha's Laser Rifle connects, dealing a heavy strike to Iron Crusher!"
}
```

**Complete Battle Log** (stored in database):
```json
{
  "events": [
    { "timestamp": 0.0, "type": "battle_start", "message": "⚔️ Battle commences! ..." },
    { "timestamp": 0.1, "type": "stance", "message": "⚔️ BattleBot Alpha takes an aggressive offensive stance..." },
    { "timestamp": 0.2, "type": "stance", "message": "🛡️ Iron Crusher adopts a defensive stance..." },
    { "timestamp": 2.5, "type": "attack", "message": "⚡ BattleBot Alpha's Laser Rifle connects..." },
    { "timestamp": 5.0, "type": "counter", "message": "🔄 Iron Crusher counters with Power Sword..." },
    { "timestamp": 8.0, "type": "shield_break", "message": "🛡️💥 Iron Crusher's energy shield has been depleted!" },
    { "timestamp": 12.0, "type": "damage_status", "message": "⚠️ Iron Crusher has taken significant damage!" },
    { "timestamp": 15.0, "type": "shield_regen", "message": "🛡️⚡ Iron Crusher's power core recharges shields" },
    { "timestamp": 30.0, "type": "yield", "message": "🏳️ Iron Crusher yields! Battle ends with BattleBot Alpha victorious!" },
    { "timestamp": 30.0, "type": "battle_end", "message": "🏆 VICTORY! BattleBot Alpha defeats Iron Crusher!" }
  ],
  "detailedCombatEvents": [ ... ],
  "isByeMatch": false
}
```

---

## Frontend Display

The `BattleDetailPage.tsx` component renders combat messages with color-coded borders based on event type:

| Event Type | Border Color | Background |
|-----------|-------------|------------|
| battle_start | Blue | Blue tint |
| battle_end | Green | Green tint |
| stance | Purple | Purple tint |
| critical | Red | Red tint |
| counter | Yellow | Yellow tint |
| miss | Gray | Dark gray |
| malfunction | Amber | Amber tint |
| shield_break | Red-400 | Red tint |
| shield_regen | Teal | Teal tint |
| yield | Yellow-400 | Yellow tint |
| destroyed | Red-600 | Red tint |
| damage_status | Orange-400 | Orange tint |
| draw | Gray-400 | Gray tint |
| tag_out | Orange | Orange tint |
| tag_in | Cyan | Cyan tint |

Financial/reward messages are filtered from the combat log (shown in the battle summary section instead).

---

**Status**: v2.0 - All core combat message categories implemented  
**Implementation**: `combatMessageGenerator.ts` converts real simulator events into narrative messages  
**All orchestrators**: League, Tournament, and Tag Team use the narrative conversion pipeline
