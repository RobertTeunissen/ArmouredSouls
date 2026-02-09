# Combat Message Catalog

**Project**: Armoured Souls  
**Document Type**: Product Requirements Document (PRD)  
**Date**: February 9, 2026  
**Status**: Draft for Review  
**Purpose**: Textual descriptions for battle log events
**Version**: v1.3  

---

## Version History
- v1.0 - Initial draft by GitHub Copilot (February 5, 2026)
- v1.1 - Review done by Robert Teunissen (February 6, 2026)
- v1.2 - Review done by Robert Teunissen (February 9, 2026)
- v1.3 - Updated to reflect actual implementation (February 9, 2026)


---

## Overview

This catalog defines all possible combat messages for the battle simulation system. Each event in a battle generates a human-readable text description that explains what happened.

**Design Principles**:
- Clear and descriptive language
- Consistent formatting
- Informative (shows damage numbers, effects)
- Engaging (creates narrative flow)
- Supports replay understanding

---

## Implementation Status

**Current Implementation**: `combatMessageGenerator.ts` and `combatSimulator.ts`

### What's Implemented

1. **Battle Start Messages**: ✅ 10 variations implemented
2. **Attack Hit Messages**: ✅ 12 variations with damage descriptors (no exact numbers shown)
3. **Critical Hit Messages**: ✅ 12 variations implemented
4. **Miss Messages**: ✅ 12 variations implemented
5. **Shield Messages**: ✅ Shield absorption (5 variations) and shield break (5 variations)
6. **Malfunction Messages**: ✅ 6 variations for weapon malfunctions
7. **Victory Messages**: ✅ Multiple categories:
   - Standard victory (8 variations)
   - Dominant victory (8 variations, >80% HP)
   - Close victory (8 variations, <30% HP)
8. **Yield Messages**: ✅ 5 variations implemented
9. **ELO Change Messages**: ✅ Separate messages for gains (5) and losses (5)
10. **Reward Messages**: ✅ Credits (4), Prestige (4), Fame (4) variations

### What's NOT Implemented

1. **Stance Information Messages**: ❌ Not shown in combat log
2. **Counter-Attack Messages**: ❌ Counter-attacks use simple format in simulator
3. **Shield Regeneration Messages**: ❌ Not displayed in combat log
4. **Special Weapon Property Messages**: ❌ No weapon-specific messages (armor piercing, burst fire, etc.)
5. **Yield Threshold Messages**: ❌ No warning when yield threshold reached
6. **Heavy/Moderate/Light Damage Status**: ❌ Not displayed during combat
7. **Draw Condition Messages**: ❌ Not implemented
8. **Battle Statistics Summary**: ❌ Not in combat log (shown in UI summary instead)
9. **League Impact Messages**: ❌ Not in combat log

### Key Implementation Differences

**Damage Display Strategy**:
- Documentation shows exact damage numbers in messages
- Implementation uses **damage descriptors** instead: "a devastating blow", "a heavy strike", "a moderate impact", etc.
- This creates more narrative flow and less number spam

**Combat Simulator Messages**:
- The `combatSimulator.ts` uses **simple, direct messages** with exact numbers for technical accuracy
- Example: `💥 BattleBot Alpha hits for 45 damage with Laser Rifle (30 shield, 15 HP)`
- These are used for detailed battle logs and debugging

**Combat Message Generator**:
- The `combatMessageGenerator.ts` provides **narrative-style messages** with descriptors
- Used for generating battle summaries and player-facing logs
- Focuses on storytelling over exact numbers

**Counter-Attacks**:
- Implemented in simulator with simple format: `🔄 {defenderName} counters for {damage} damage!`
- Not using the elaborate counter-attack message variations from documentation

**Malfunctions**:
- Fully implemented with 6 message variations
- Occurs before hit calculation based on weapon control stat

---

## Message Categories

### 1. Battle Initialization

**Implementation Status**: ✅ Battle start implemented (10 variations), ❌ Stance information not in combat log

**Battle Start Messages** (✅ All 10 implemented):
```
1. "⚔️ Battle commences! {robot1Name} (ELO {robot1ELO}) vs {robot2Name} (ELO {robot2ELO})"
2. "🎯 {robot1Name} and {robot2Name} enter the arena for {leagueType} league combat!"
3. "💥 Arena match starting: {robot1Name} vs {robot2Name}"
4. "⚡ The arena lights up as {robot1Name} faces {robot2Name} in {leagueType} league!"
5. "🏟️ {robot1Name} (ELO {robot1ELO}) challenges {robot2Name} (ELO {robot2ELO}) to battle!"
6. "🔥 Combat initialized: {robot1Name} vs {robot2Name} - {leagueType} league match"
7. "⚔️ {robot1Name} and {robot2Name} take their positions in the arena!"
8. "💫 Battle systems online: {robot1Name} vs {robot2Name} engaging now"
9. "🎪 The crowd watches as {robot1Name} confronts {robot2Name} in {leagueType} league!"
10. "⚡ Arena secured. Combatants ready: {robot1Name} vs {robot2Name}"
```

**Stance Information** (❌ NOT in combat log):
```
"🛡️ {robotName} adopts a defensive stance, prioritizing survival"
"⚔️ {robotName} takes an aggressive offensive stance, focusing on damage"
"⚖️ {robotName} maintains a balanced stance, ready to adapt"
```

---

### 2. Attack Actions

**Implementation Status**: ✅ All attack messages implemented with damage descriptors

**Note**: The implementation uses **damage descriptors** instead of exact numbers:
- "a devastating blow" (≥25% of max HP)
- "a heavy strike" (≥15% of max HP)
- "a solid hit" (≥10% of max HP)
- "a moderate impact" (≥5% of max HP)
- "a glancing blow" (≥2% of max HP)
- "a minor scratch" (<2% of max HP)

**Attack Hit Messages** (✅ All 12 implemented):
```
1. "� {attackerName} strikes {defenderName} with {weaponName}, landing {damageDescriptor}!"
2. "⚡ {attackerName}'s {weaponName} connects, dealing {damageDescriptor} to {defenderName}!"
3. "🔪 {attackerName} slashes {defenderName} with {weaponName}, inflicting {damageDescriptor}!"
4. "🎯 {attackerName} lands {damageDescriptor} on {defenderName} with {weaponName}!"
5. "💢 {attackerName}'s {weaponName} finds its mark - {damageDescriptor} to {defenderName}!"
6. "⚔️ {attackerName} drives {weaponName} into {defenderName} for {damageDescriptor}!"
7. "🔥 {weaponName} tears into {defenderName} - {attackerName} delivers {damageDescriptor}!"
8. "� {attackerName} successfully hits {defenderName} with {weaponName}, causing {damageDescriptor}!"
9. "⚡ Direct hit! {attackerName}'s {weaponName} deals {damageDescriptor} to {defenderName}!"
10. "🎯 {attackerName} scores {damageDescriptor} against {defenderName} using {weaponName}!"
11. "💥 {weaponName} impacts {defenderName}'s hull - {damageDescriptor} from {attackerName}!"
12. "🔪 {attackerName} executes a clean strike with {weaponName}, inflicting {damageDescriptor}!"
```

**Shield Absorption Messages** (✅ All 5 implemented):
```
1. "�️ {defenderName}'s energy shield absorbs the impact from {attackerName}'s {weaponName}!"
2. "⚡ {defenderName}'s shields hold strong against {attackerName}'s {weaponName}!"
3. "🛡️ Energy shield flares as {defenderName} deflects {attackerName}'s attack!"
4. "⚡ {defenderName}'s shield takes the hit - hull integrity maintained!"
5. "🛡️ Defensive systems engaged! {defenderName}'s shield blocks {attackerName}'s {weaponName}!"
```

**Critical Hit Messages** (✅ All 12 implemented):
```
1. "💢 CRITICAL HIT! {attackerName}'s {weaponName} finds a weak point - catastrophic damage to {defenderName}!"
2. "🎯 Perfect strike! {attackerName} lands a critical hit with {weaponName} - devastating impact!"
3. "💥 DEVASTATING! {attackerName}'s critical strike with {weaponName} overwhelms {defenderName}!"
4. "⚡ CRITICAL! {attackerName} exploits a vulnerability in {defenderName}'s defenses!"
5. "🔥 MASSIVE DAMAGE! {attackerName}'s {weaponName} scores a critical hit on {defenderName}!"
6. "💢 CRITICAL STRIKE! {attackerName}'s {weaponName} tears through {defenderName}'s armor!"
7. "🎯 Precision attack! {attackerName} targets a critical system on {defenderName} with {weaponName}!"
8. "💥 EXCEPTIONAL! {attackerName} delivers a punishing critical blow with {weaponName}!"
9. "⚡ DEVASTATING CRITICAL! {weaponName} finds the perfect angle - {defenderName} reels from the impact!"
10. "🔥 CRITICAL DAMAGE! {attackerName}'s {weaponName} strikes a vulnerable point on {defenderName}!"
11. "💢 CRUSHING BLOW! {attackerName} lands a critical strike that staggers {defenderName}!"
12. "🎯 PINPOINT ACCURACY! {attackerName}'s {weaponName} exploits a weak spot perfectly!"
```

**Combat Simulator Format** (used in technical logs):
```
"💥 {attackerName} hits for {totalDamage} damage with {weaponName} ({shieldDamage} shield, {hpDamage} HP)"
"💢 CRITICAL! {attackerName} deals {totalDamage} damage with {weaponName} ({shieldDamage} shield, {hpDamage} HP)"
```

---

### 3. Miss/Dodge Actions

**Implementation Status**: ✅ Fully implemented (12 variations)

**Miss Messages** (✅ All 12 implemented):
```
1. "❌ {attackerName} swings {weaponName} but misses {defenderName} completely!"
2. "⚠️ {attackerName}'s {weaponName} attack goes wide - no damage!"
3. "🎯 {attackerName} aims {weaponName} but the shot misses {defenderName}!"
4. "💨 {defenderName} dodges {attackerName}'s {weaponName} attack effortlessly!"
5. "🏃 {defenderName} evades {attackerName}'s {weaponName} with quick reflexes!"
6. "⚡ {defenderName} weaves out of range as {attackerName}'s {weaponName} strikes empty air!"
7. "❌ {attackerName}'s {weaponName} fails to connect - {defenderName} too quick!"
8. "💨 Evasion successful! {defenderName} sidesteps {attackerName}'s {weaponName}!"
9. "🏃 {defenderName}'s thrusters engage - {attackerName}'s attack misses!"
10. "⚠️ {attackerName} miscalculates - {weaponName} hits nothing but air!"
11. "❌ {defenderName} anticipates the attack and dodges {attackerName}'s {weaponName}!"
12. "💨 Clean evasion! {defenderName} avoids {attackerName}'s {weaponName} entirely!"
```

**Combat Simulator Format** (used in technical logs):
```
"❌ {attackerName} misses {defenderName} with {weaponName}"
"❌ [OFFHAND] {attackerName} misses {defenderName} with {weaponName}"
```

---

### 4. Counter-Attack Actions

**Implementation Status**: ⚠️ Partially implemented (simple format only)

**Current Implementation**:
```
"🔄 {defenderName} counters for {damage} damage!"
```

**Documented but NOT Implemented**:

**Successful Counter**
```
"🔄 {defenderName} counters {attackerName}'s attack with {weaponName} for {damage} damage!"
"⚔️ Counter-attack! {defenderName} retaliates with {weaponName}, dealing {damage} damage to {attackerName}!"
"💫 {defenderName} parries and counters, striking {attackerName} for {damage} damage!"
```

**Failed Counter**
```
"🔄 {defenderName} attempts to counter with {weaponName} but misses!"
"⚠️ {defenderName} tries to counter-attack but {attackerName} evades!"
"❌ {defenderName}'s counter with {weaponName} fails to connect!"
```

**Critical Counter**
```
"💢 CRITICAL COUNTER! {defenderName} expertly reverses {attackerName}'s attack, dealing {damage} damage!"
"🎯 Perfect counter! {defenderName}'s {weaponName} strikes {attackerName} for {damage} damage!"
```

---

### 5. Shield Events

**Implementation Status**: ✅ Shield absorption and break implemented

**Shield Break** (✅ All 5 implemented):
```
1. "🛡️💥 {robotName}'s energy shield has been depleted!"
2. "⚡❌ {robotName}'s shields are down - hull is exposed!"
3. "🔴 WARNING: {robotName}'s energy shield has failed!"
4. "💥 Shield generator offline! {robotName} is vulnerable!"
5. "⚠️ Critical: {robotName}'s protective shields have collapsed!"
```

**Shield Regeneration** (❌ NOT Implemented)
```
"🛡️⚡ {robotName}'s power core recharges {amount} shield points"
"⚡✨ {robotName}'s shields regenerate {amount} points"
"🔋 {robotName}'s energy shield restores {amount} capacity"
```

---

### 6. Malfunction Messages

**Implementation Status**: ✅ Fully implemented (6 variations)

**Malfunction Messages** (✅ All 6 implemented):
```
1. "⚙️ MALFUNCTION! {robotName}'s {weaponName} jams and fails to fire!"
2. "⚠️ SYSTEM ERROR! {robotName}'s targeting systems glitch - attack aborted!"
3. "🔧 TECHNICAL FAILURE! {robotName}'s {weaponName} malfunctions mid-attack!"
4. "⚡ POWER SURGE! {robotName}'s weapon systems temporarily offline!"
5. "💥 CRITICAL ERROR! {robotName}'s {weaponName} overheats and shuts down!"
6. "⚙️ MECHANICAL FAULT! {robotName}'s attack systems fail at a critical moment!"
```

**Combat Simulator Format** (used in technical logs):
```
"⚠️ {attackerName}'s {weaponName} malfunctions! (Weapon Control failure)"
"⚠️ [OFFHAND] {attackerName}'s {weaponName} malfunctions! (Weapon Control failure)"
```

---

### 7. Yield/Surrender Events

**Implementation Status**: ✅ Yield messages implemented (5 variations)

**Yield Threshold Reached** (❌ NOT Implemented):
```
"⚠️ {robotName}'s hull integrity critical - yield threshold reached!"
"🏳️ {robotName} signals intent to yield - HP at {percentage}%!"
```

**Yield Accepted** (✅ All 5 implemented):
```
1. "🏳️ {robotName} yields! Battle ends with {winnerName} victorious!"
2. "✋ {robotName} surrenders! {winnerName} wins!"
3. "🛑 {robotName} concedes defeat to {winnerName}!"
4. "⚠️ {robotName} signals surrender - {winnerName} emerges victorious!"
5. "🏳️ {robotName} surrenders to avoid complete destruction!"
```

**Yield Rejected (if opponent continues attacking)** (❌ NOT Implemented):
```
"⚔️ {attackerName} shows no mercy - attack continues despite yield signal!"
"💥 {attackerName} presses the advantage despite {defenderName}'s surrender attempt!"
```

---

### 8. Destruction/KO Events

**Implementation Status**: ✅ Basic destruction implemented

**Robot Destroyed** (✅ Implemented - simple format)

**Current Implementation**:
```
"💀 {robotName} destroyed! {winnerName} wins!"
```

**Documented Messages**:
```
"💀 {robotName} has been destroyed! Hull integrity at 0%!"
"💥 {robotName}'s systems fail - robot disabled!"
"🔴 KNOCKOUT! {robotName} is down!"
```

**Overkill** (❌ NOT Implemented)
```
"💥💥 OVERKILL! {attackerName}'s {weaponName} deals {damage} damage to the already-destroyed {defenderName}!"
"⚡⚡ Excessive force! {attackerName} continues assault on disabled {defenderName}!"
```

---

### 9. Battle Status Updates

**Implementation Status**: ❌ NOT Implemented (no status updates during combat)

**Note**: The combat log does not currently display status updates about robot health during battle. HP values are tracked in the event data but not announced with messages.

**Heavy Damage** (❌ NOT Implemented)
```
"⚠️ {robotName} is heavily damaged - {currentHP}/{maxHP} HP remaining!"
"🔴 {robotName} at critical health: {percentage}%!"
"💔 {robotName}'s hull integrity severely compromised!"
```

**Moderate Damage** (❌ NOT Implemented)
```
"⚠️ {robotName} has taken significant damage - {currentHP}/{maxHP} HP!"
"🟠 {robotName} health: {percentage}%"
```

**Light Damage** (❌ NOT Implemented)
```
"✅ {robotName} still in good condition - {currentHP}/{maxHP} HP"
"🟢 {robotName} sustains minor damage: {percentage}% HP"
```

**No Damage Taken** (❌ NOT Implemented)
```
"💪 {robotName} remains at full health!"
"🛡️ {robotName}'s defenses hold strong - no damage taken!"
```

---

### 10. Draw Conditions

**Implementation Status**: ❌ NOT Implemented

**Time Limit Reached - League** (❌ NOT Implemented)
```
"⏱️ DRAW! Maximum battle time reached - both combatants survive!"
"⏰ Time expires! Battle ends in a draw."
"🤝 Stalemate! Neither robot could secure victory before time ran out."
```

**Draw with Different HP - Tournament** (❌ NOT Implemented)
```
"⏱️ DRAW! Time limit reached. {robot1Name}: {hp1}/{maxHP1} HP, {robot2Name}: {hp2}/{maxHP2} HP"
"⏰ Battle concludes in a draw. {robot1Name} at {percentage1}%, {robot2Name} at {percentage2}%"
```

---

### 11. Battle End - Victory

**Implementation Status**: ✅ Fully implemented with multiple variations

**Standard Victory Messages** (✅ All 8 implemented):
```
1. "🏆 VICTORY! {winnerName} defeats {loserName}!"
2. "👑 {winnerName} emerges victorious over {loserName}!"
3. "⚔️ {winnerName} wins the battle against {loserName}!"
4. "🎉 {winnerName} triumphs over {loserName}!"
5. "💪 {winnerName} claims victory against {loserName}!"
6. "🏆 Battle concluded: {winnerName} defeats {loserName}!"
7. "👑 {winnerName} stands triumphant over the fallen {loserName}!"
8. "⚔️ {loserName} falls before {winnerName}'s superior combat prowess!"
```

**Dominant Victory Messages** (✅ All 8 implemented - >80% HP):
```
1. "🏆 DOMINANT VICTORY! {winnerName} crushes {loserName} with {hpPercent}% HP remaining!"
2. "👑 FLAWLESS! {winnerName} defeats {loserName} while taking minimal damage!"
3. "⚔️ OVERWHELMING! {winnerName} destroys {loserName} at {hpPercent}% health!"
4. "💪 SUPERIOR! {winnerName} dominates {loserName} completely!"
5. "🎯 PERFECT EXECUTION! {winnerName} defeats {loserName} with barely a scratch!"
6. "🔥 UNSTOPPABLE! {winnerName} crushes {loserName} with overwhelming force!"
7. "💥 TOTAL DOMINATION! {winnerName} obliterates {loserName} while remaining nearly undamaged!"
8. "👑 MASTERFUL! {winnerName} outclasses {loserName} in every way!"
```

**Close Victory Messages** (✅ All 8 implemented - <30% HP):
```
1. "🏆 NARROW VICTORY! {winnerName} defeats {loserName} by the slimmest margin!"
2. "⚔️ Hard-fought victory! {winnerName} wins with only {hp} HP remaining!"
3. "💪 {winnerName} barely survives to claim victory over {loserName}!"
4. "🎯 {winnerName} edges out {loserName} in a close battle!"
5. "🔥 CLUTCH! {winnerName} survives by a hair to defeat {loserName}!"
6. "⚡ INTENSE! {winnerName} claims victory despite being pushed to the limit!"
7. "💥 CLOSE CALL! {winnerName} emerges victorious but heavily damaged!"
8. "🏆 NARROW ESCAPE! {winnerName} defeats {loserName} in a nail-biting finish!"
```

**Combat Simulator Format** (used in technical logs):
```
"💀 {robotName} destroyed! {winnerName} wins!"
```

---

### 12. Battle Statistics Summary

**Implementation Status**: ⚠️ Displayed in UI, not in combat log

**Note**: Battle statistics (damage dealt, attacks, critical hits, ELO changes, rewards, league impact) are displayed in the battle summary UI at the top of the battle page, not as messages in the combat log itself.

**Final Stats** (❌ NOT in combat log)
```
"📊 Battle Duration: {duration} seconds"
"📊 {robot1Name}: {damage1} damage dealt, {damageTaken1} damage received"
"📊 {robot2Name}: {damage2} damage dealt, {damageTaken2} damage received"
"📊 Total attacks: {robot1Name} ({attacks1}), {robot2Name} ({attacks2})"
"📊 Critical hits: {robot1Name} ({crits1}), {robot2Name} ({crits2})"
"📊 Counter-attacks: {robot1Name} ({counters1}), {robot2Name} ({counters2})"
```

**ELO Gain Messages** (✅ All 5 implemented):
```
1. "📈 {robotName}: {oldELO} → {newELO} (+{change} ELO)"
2. "⬆️ {robotName} gains {change} ELO rating ({oldELO} → {newELO})"
3. "📊 {robotName}'s rating increases by {change} ELO points"
4. "🎯 {robotName} earns +{change} ELO (now {newELO})"
5. "📈 Rating boost for {robotName}: +{change} ELO"
```

**ELO Loss Messages** (✅ All 5 implemented):
```
1. "� {robotName}: {oldELO} → {newELO} ({change} ELO)"
2. "⬇️ {robotName} loses {change} ELO rating ({oldELO} → {newELO})"
3. "📊 {robotName}'s rating decreases by {change} ELO points"
4. "📉 Rating penalty for {robotName}: {change} ELO"
5. "⬇️ {robotName} drops {change} ELO points (now {newELO})"
```

**Credit Reward Messages** (✅ All 4 implemented):
```
1. "💰 {robotName} receives ₡{credits}"
2. "💵 {robotName} earns ₡{credits} in battle rewards"
3. "🏆 Battle earnings: ₡{credits} awarded to {robotName}"
4. "💰 {robotName} collects ₡{credits} for combat participation"
```

**Prestige Messages** (✅ All 4 implemented):
```
1. "⭐ {robotName} gains {prestige} prestige!"
2. "✨ Prestige awarded: +{prestige} for {robotName}"
3. "🌟 {robotName} earns {prestige} prestige points"
4. "⭐ {robotName}'s reputation increases by {prestige} prestige"
```

**Fame Messages** (✅ All 4 implemented):
```
1. "🎖️ {robotName} gains {fame} fame!"
2. "📣 Fame earned: +{fame} for {robotName}"
3. "🏅 {robotName} receives {fame} fame points"
4. "🎖️ {robotName}'s renown increases by {fame} fame"
```

**League Impact** (❌ NOT Implemented):
```
"📊 League Points: {winnerName} gains +{points}, {loserName} loses -{points}"
"🏆 {robotName} promoted to {newLeague}!"
"⬇️ {robotName} demoted to {newLeague}."
```

---

## Message Templates with Variables

### Template Format
All messages use string interpolation with curly braces:
- `{robotName}` - Robot's name
- `{attackerName}` - Attacker's name
- `{defenderName}` - Defender's name
- `{weaponName}` - Weapon name
- `{damage}` - Damage amount
- `{currentHP}` - Current hit points
- `{maxHP}` - Maximum hit points
- `{percentage}` - HP percentage
- `{elo}` - ELO rating
- `{duration}` - Time in seconds
- etc.

### Message Selection Logic

**Context-aware selection**:
1. Check event type (hit, miss, counter, etc.)
2. Check for special conditions (critical, shield, etc.)
3. Check damage amount (heavy, moderate, light)
4. Select appropriate message from category
5. Add random variation to avoid repetition

**Example Algorithm**:
```typescript
function generateAttackMessage(event: AttackEvent): string {
  const messages = [];
  
  if (event.isCritical) {
    if (event.shieldDamage > 0) {
      messages.push(criticalHitWithShieldMessages);
    } else {
      messages.push(criticalHitMessages);
    }
  } else if (event.shieldDamage > 0 && event.hpDamage > 0) {
    messages.push(partialShieldMessages);
  } else if (event.shieldDamage > 0 && event.hpDamage === 0) {
    messages.push(fullShieldMessages);
  } else {
    messages.push(regularHitMessages);
  }
  
  // Select random message from appropriate category
  const template = messages[Math.floor(Math.random() * messages.length)];
  
  // Interpolate variables
  return interpolate(template, event);
}
```

---

## Battle Log JSON Structure

**Event Structure**:
```json
{
  "timestamp": 2.5,
  "type": "attack",
  "attacker": "robot1",
  "defender": "robot2",
  "weapon": "Laser Rifle",
  "damage": 45,
  "shieldDamage": 30,
  "hpDamage": 15,
  "critical": false,
  "hit": true,
  "message": "⚡ BattleBot Alpha's Laser Rifle penetrates Iron Crusher's shield! 30 shield damage, 15 hull damage!"
}
```

**Complete Battle Log**:
```json
{
  "battleId": 123,
  "events": [
    {
      "timestamp": 0.0,
      "type": "battle_start",
      "robot1": "BattleBot Alpha",
      "robot2": "Iron Crusher",
      "robot1ELO": 1250,
      "robot2ELO": 1280,
      "message": "⚔️ Battle commences! BattleBot Alpha (ELO 1250) vs Iron Crusher (ELO 1280)"
    },
    {
      "timestamp": 0.1,
      "type": "stance",
      "robot": "robot1",
      "stance": "offensive",
      "message": "⚔️ BattleBot Alpha takes an aggressive offensive stance, focusing on damage"
    },
    {
      "timestamp": 2.5,
      "type": "attack",
      "attacker": "robot1",
      "defender": "robot2",
      "weapon": "Laser Rifle",
      "damage": 45,
      "shieldDamage": 30,
      "hpDamage": 15,
      "critical": false,
      "hit": true,
      "message": "⚡ BattleBot Alpha's Laser Rifle penetrates Iron Crusher's shield! 30 shield damage, 15 hull damage!"
    },
    {
      "timestamp": 5.0,
      "type": "attack",
      "attacker": "robot2",
      "defender": "robot1",
      "weapon": "Power Sword",
      "damage": 28,
      "shieldDamage": 0,
      "hpDamage": 28,
      "critical": false,
      "hit": true,
      "message": "💥 Iron Crusher strikes BattleBot Alpha with Power Sword for 28 damage!"
    },
    {
      "timestamp": 7.5,
      "type": "counter",
      "attacker": "robot1",
      "defender": "robot2",
      "weapon": "Laser Rifle",
      "damage": 0,
      "success": false,
      "message": "❌ BattleBot Alpha's counter with Laser Rifle fails to connect!"
    },
    {
      "timestamp": 45.2,
      "type": "yield",
      "robot": "robot2",
      "currentHP": 25,
      "maxHP": 250,
      "message": "🏳️ Iron Crusher yields! Battle ends with BattleBot Alpha victorious!"
    },
    {
      "timestamp": 45.2,
      "type": "battle_end",
      "winner": "robot1",
      "loser": "robot2",
      "reason": "yield",
      "duration": 45.2,
      "message": "🏆 VICTORY! BattleBot Alpha defeats Iron Crusher by surrender!"
    }
  ]
}
```

---

## Additional Combat Scenarios



### Weapon-Specific Messages

**Implementation Status**: ❌ NOT Implemented

**Note**: All weapons currently use generic attack messages. Weapon-specific messages are documented below but not yet implemented.

**Practice Sword** (for testing):
```
"⚔️ {attackerName} practices a basic strike with Practice Sword for {damage} damage"
"🎯 {attackerName} lands a training blow on {defenderName} - {damage} damage"
```

**Plasma Cannon**:
```
"💥 {attackerName} fires a plasma blast at {defenderName} for {damage} damage!"
"⚡ Superheated plasma from {attackerName}'s cannon melts through {defenderName}'s defenses - {damage} damage!"
```

**Railgun**:
```
"🔫 {attackerName}'s railgun fires a high-velocity round, dealing {damage} damage to {defenderName}!"
"⚡ Electromagnetic acceleration! {attackerName}'s railgun pierces {defenderName} for {damage} damage!"
```

**Hammer**:
```
"💥 {attackerName} brings the hammer down on {defenderName} for {damage} crushing damage!"
"🔨 Devastating impact! {attackerName}'s hammer strikes {defenderName} for {damage} damage!"
```

---

## Emotional/Dramatic Variations

**Implementation Status**: ❌ NOT Implemented

**Note**: Contextual dramatic messages based on battle state are not currently implemented.

**Comeback Situations** (❌ NOT Implemented):
```
"🔥 {robotName} refuses to give up - fighting back from critical health!"
"💪 {robotName} shows incredible resilience despite heavy damage!"
```

**Domination** (❌ NOT Implemented):
```
"⚔️ {robotName} is dominating this battle!"
"💥 {robotName} overwhelms {opponentName} with superior firepower!"
```

**Even Match** (❌ NOT Implemented):
```
"⚖️ Both combatants are evenly matched!"
"🤝 This battle could go either way!"
```

---

## Implementation Notes

1. **Message Pool**: Each category should have 5-10 variations
2. **Random Selection**: Avoid repetition by tracking recently used messages
3. **Context Awareness**: Messages should reflect battle state (HP, shields, etc.)
4. **Tone Consistency**: Maintain sci-fi combat theme throughout
5. **Clarity**: Always include relevant numbers (damage, HP, etc.)
6. **Engagement**: Use emojis and dramatic language appropriately
7. **Localization**: Structure should support future translation

---

## Future Enhancements

- Team battle messages (2v2, 3v3)
- Environmental effects
- Status conditions (stun, slow, etc.)
- Weapon combo messages
- Achievement announcements during battle
- Spectator-specific messages
- Replay commentary mode

---

## Implementation Summary

### Two Message Systems

The codebase has **two distinct message generation systems**:

1. **Combat Simulator Messages** (`combatSimulator.ts`)
   - Used during actual battle simulation
   - Shows exact damage numbers for technical accuracy
   - Format: `💥 BattleBot Alpha hits for 45 damage with Laser Rifle (30 shield, 15 HP)`
   - Includes detailed formula breakdowns for debugging
   - Used in battle logs and technical displays

2. **Combat Message Generator** (`combatMessageGenerator.ts`)
   - Used for player-facing battle summaries
   - Uses damage descriptors instead of exact numbers
   - Format: `💥 BattleBot Alpha strikes Iron Crusher with Laser Rifle, landing a heavy strike!`
   - Multiple message variations for variety
   - More narrative and engaging

### What Works Well

- ✅ Battle start messages with ELO display
- ✅ Attack hit messages with damage descriptors
- ✅ Critical hit detection and messages
- ✅ Miss/dodge messages
- ✅ Shield absorption and break messages
- ✅ Weapon malfunction system
- ✅ Victory messages (standard, dominant, close)
- ✅ Yield/surrender messages
- ✅ ELO change messages
- ✅ Reward messages (credits, prestige, fame)

### What's Missing

- ❌ Stance information in combat log
- ❌ Elaborate counter-attack messages (only simple format)
- ❌ Shield regeneration announcements
- ❌ Weapon-specific messages (armor piercing, burst fire, etc.)
- ❌ Yield threshold warnings
- ❌ Battle status updates (heavy damage, etc.)
- ❌ Draw condition messages
- ❌ Overkill messages
- ❌ Contextual dramatic messages (comeback, domination, etc.)
- ❌ League impact announcements

### Design Decision: Damage Descriptors vs Numbers

The implementation made a key design choice to use **damage descriptors** in the message generator:
- "a devastating blow" (≥25% of max HP)
- "a heavy strike" (≥15% of max HP)
- "a solid hit" (≥10% of max HP)
- "a moderate impact" (≥5% of max HP)
- "a glancing blow" (≥2% of max HP)
- "a minor scratch" (<2% of max HP)

This creates better narrative flow and reduces number spam, while exact numbers are still available in the combat simulator's technical logs.

---

**Status**: Documentation updated to reflect actual implementation (v1.3)
**Next**: Consider implementing missing message categories if desired
**Implementation**: Two systems working in parallel - simulator (technical) and generator (narrative)

