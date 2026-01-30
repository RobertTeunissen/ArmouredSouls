# Combat Message Catalog

**Date**: January 30, 2026  
**Status**: Draft for Review  
**Purpose**: Textual descriptions for battle log events

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

## Message Categories

### 1. Battle Initialization

**Battle Start**
```
"⚔️ Battle commences! {robot1Name} (ELO {elo1}) vs {robot2Name} (ELO {elo2})"
"📍 Arena: {leagueType} League - {leagueInstance}"
"⚙️ {robot1Name} enters in {stance1} stance wielding {weapon1Name}"
"⚙️ {robot2Name} enters in {stance2} stance wielding {weapon2Name}"
```

**Stance Information**
```
"🛡️ {robotName} adopts a defensive stance, prioritizing survival"
"⚔️ {robotName} takes an aggressive offensive stance, focusing on damage"
"⚖️ {robotName} maintains a balanced stance, ready to adapt"
```

---

### 2. Attack Actions

**Successful Hit - No Shield**
```
"💥 {attackerName} strikes {defenderName} with {weaponName} for {damage} damage!"
"⚡ {attackerName}'s {weaponName} connects, dealing {damage} damage to {defenderName}!"
"🔪 {attackerName} slashes {defenderName} with {weaponName} for {damage} damage!"
```

**Successful Hit - Partial Shield Absorption**
```
"💥 {attackerName} hits {defenderName} with {weaponName} for {totalDamage} damage. {shieldDamage} absorbed by energy shield, {hpDamage} to hull!"
"⚡ {attackerName}'s {weaponName} penetrates {defenderName}'s shield! {shieldDamage} shield damage, {hpDamage} hull damage!"
"🛡️ {defenderName}'s shield absorbs {shieldDamage} damage but {hpDamage} gets through to the hull!"
```

**Successful Hit - Full Shield Absorption**
```
"🛡️ {attackerName}'s {weaponName} strikes {defenderName}'s shield for {damage} damage - shield holds!"
"⚡ {defenderName}'s energy shield absorbs the full {damage} damage from {attackerName}'s attack!"
```

**Critical Hit**
```
"💢 CRITICAL HIT! {attackerName}'s {weaponName} finds a weak point, dealing {damage} damage to {defenderName}!"
"🎯 Perfect strike! {attackerName} lands a critical hit with {weaponName} for {damage} damage!"
"💥 DEVASTATING! {attackerName}'s critical strike with {weaponName} inflicts {damage} damage!"
```

**Critical Hit with Shield**
```
"💢 CRITICAL HIT! {attackerName}'s {weaponName} penetrates {defenderName}'s defenses! {shieldDamage} shield, {hpDamage} hull damage!"
"🎯 Critical strike! {attackerName}'s {weaponName} overwhelms {defenderName}'s shield - {totalDamage} total damage!"
```

---

### 3. Miss/Dodge Actions

**Miss - Attacker Error**
```
"❌ {attackerName} swings {weaponName} but misses {defenderName} completely!"
"⚠️ {attackerName}'s {weaponName} attack goes wide - no damage!"
"🎯 {attackerName} aims {weaponName} but the shot misses {defenderName}!"
```

**Dodge - Defender Evasion**
```
"💨 {defenderName} dodges {attackerName}'s {weaponName} attack!"
"🏃 {defenderName}'s evasion thrusters activate - {attackerName}'s attack misses!"
"⚡ {defenderName} nimbly evades {attackerName}'s {weaponName}!"
```

---

### 4. Counter-Attack Actions

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

**Shield Break**
```
"🛡️💥 {robotName}'s energy shield has been depleted!"
"⚡❌ {robotName}'s shields are down - hull is exposed!"
"🔴 WARNING: {robotName}'s energy shield has failed!"
```

**Shield Regeneration**
```
"🛡️⚡ {robotName}'s power core recharges {amount} shield points"
"⚡✨ {robotName}'s shields regenerate {amount} points"
"🔋 {robotName}'s energy shield restores {amount} capacity"
```

**Shield Overload (if applicable)**
```
"🛡️💥 {robotName}'s shield generator overloads from excessive damage!"
"⚡⚠️ {robotName}'s shields buckle under the assault - temporary shutdown!"
```

---

### 6. Special Weapon Properties

**Armor Piercing (Railgun, etc.)**
```
"🔫 {attackerName}'s {weaponName} pierces {defenderName}'s armor, ignoring {percentage}% of defenses!"
"⚡ Armor-piercing round! {attackerName}'s {weaponName} bypasses {defenderName}'s plating!"
```

**Burst Fire (Machine Gun)**
```
"🔫🔫🔫 {attackerName} unleashes a burst of fire from {weaponName}!"
"💥 Three-round burst! {attackerName}'s {weaponName} peppers {defenderName} for {damage1}, {damage2}, {damage3} damage!"
```

**Energy Discharge (Ion Beam, etc.)**
```
"⚡💥 {attackerName}'s {weaponName} discharges, disabling {defenderName}'s shields for {duration} seconds!"
"🔵 Ion beam impact! {defenderName}'s energy systems disrupted!"
```

**Close Range Bonus (Shotgun)**
```
"💥 Point-blank shot! {attackerName}'s {weaponName} deals devastating {damage} damage at close range!"
"🔫 {attackerName} closes the distance - {weaponName} deals extra damage!"
```

**Shield Damage (Plasma weapons)**
```
"⚡🛡️ {attackerName}'s {weaponName} is especially effective against {defenderName}'s energy shield!"
"💙 Plasma discharge! {attackerName}'s {weaponName} deals bonus damage to shields!"
```

---

### 7. Yield/Surrender Events

**Yield Threshold Reached**
```
"⚠️ {robotName}'s hull integrity critical - yield threshold reached!"
"🏳️ {robotName} signals intent to yield - HP at {percentage}%!"
```

**Yield Accepted**
```
"🏳️ {robotName} yields! Battle ends with {winnerName} victorious!"
"✋ {robotName} surrenders at {currentHP}/{maxHP} HP. {winnerName} wins!"
"🛑 {robotName} concedes defeat. {winnerName} emerges victorious!"
```

**Yield Rejected (if opponent continues attacking)**
```
"⚔️ {attackerName} shows no mercy - attack continues despite yield signal!"
"💥 {attackerName} presses the advantage despite {defenderName}'s surrender attempt!"
```

---

### 8. Destruction/KO Events

**Robot Destroyed**
```
"💀 {robotName} has been destroyed! Hull integrity at 0%!"
"💥 {robotName}'s systems fail - robot disabled!"
"🔴 KNOCKOUT! {robotName} is down!"
```

**Overkill**
```
"💥💥 OVERKILL! {attackerName}'s {weaponName} deals {damage} damage to the already-destroyed {defenderName}!"
"⚡⚡ Excessive force! {attackerName} continues assault on disabled {defenderName}!"
```

---

### 9. Battle Status Updates

**Heavy Damage**
```
"⚠️ {robotName} is heavily damaged - {currentHP}/{maxHP} HP remaining!"
"🔴 {robotName} at critical health: {percentage}%!"
"💔 {robotName}'s hull integrity severely compromised!"
```

**Moderate Damage**
```
"⚠️ {robotName} has taken significant damage - {currentHP}/{maxHP} HP!"
"🟠 {robotName} health: {percentage}%"
```

**Light Damage**
```
"✅ {robotName} still in good condition - {currentHP}/{maxHP} HP"
"🟢 {robotName} sustains minor damage: {percentage}% HP"
```

**No Damage Taken**
```
"💪 {robotName} remains at full health!"
"🛡️ {robotName}'s defenses hold strong - no damage taken!"
```

---

### 10. Draw Conditions

**Time Limit Reached**
```
"⏱️ DRAW! Maximum battle time reached - both combatants survive!"
"⏰ Time expires! Battle ends in a draw."
"🤝 Stalemate! Neither robot could secure victory before time ran out."
```

**Draw with Different HP**
```
"⏱️ DRAW! Time limit reached. {robot1Name}: {hp1}/{maxHP1} HP, {robot2Name}: {hp2}/{maxHP2} HP"
"⏰ Battle concludes in a draw. {robot1Name} at {percentage1}%, {robot2Name} at {percentage2}%"
```

---

### 11. Battle End - Victory

**Victory by Destruction**
```
"🏆 VICTORY! {winnerName} defeats {loserName} by destruction!"
"👑 {winnerName} emerges victorious - {loserName} destroyed!"
"⚔️ {winnerName} wins! {loserName} has been neutralized!"
```

**Victory by Yield**
```
"🏆 VICTORY! {winnerName} defeats {loserName} by surrender!"
"👑 {winnerName} wins as {loserName} yields!"
"✋ {loserName} surrenders - {winnerName} is victorious!"
```

**Close Victory**
```
"🏆 NARROW VICTORY! {winnerName} defeats {loserName} by the slimmest margin!"
"⚔️ Hard-fought victory! {winnerName} wins with only {hp} HP remaining!"
"💪 {winnerName} barely survives to claim victory over {loserName}!"
```

**Dominant Victory**
```
"🏆 DOMINANT VICTORY! {winnerName} crushes {loserName} with {hp}/{maxHP} HP remaining!"
"👑 FLAWLESS! {winnerName} defeats {loserName} while taking minimal damage!"
"⚔️ OVERWHELMING! {winnerName} destroys {loserName} at {percentage}% health!"
```

---

### 12. Battle Statistics Summary

**Final Stats**
```
"📊 Battle Duration: {duration} seconds"
"📊 {robot1Name}: {damage1} damage dealt, {damageTaken1} damage received"
"📊 {robot2Name}: {damage2} damage dealt, {damageTaken2} damage received"
"📊 Total attacks: {robot1Name} ({attacks1}), {robot2Name} ({attacks2})"
"📊 Critical hits: {robot1Name} ({crits1}), {robot2Name} ({crits2})"
"📊 Counter-attacks: {robot1Name} ({counters1}), {robot2Name} ({counters2})"
```

**ELO Changes**
```
"📈 {winnerName}: {oldELO} → {newELO} (+{change} ELO)"
"📉 {loserName}: {oldELO} → {newELO} ({change} ELO)"
```

**Rewards**
```
"💰 {winnerName} receives ₡{reward} + {bonusReward} bonus"
"💰 {loserName} receives ₡{reward} (participation reward)"
```

**League Impact**
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

**Comeback Situations**:
```
"🔥 {robotName} refuses to give up - fighting back from critical health!"
"💪 {robotName} shows incredible resilience despite heavy damage!"
```

**Domination**:
```
"⚔️ {robotName} is dominating this battle!"
"💥 {robotName} overwhelms {opponentName} with superior firepower!"
```

**Even Match**:
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

**Status**: Draft for owner review  
**Next**: Finalize message selection and add to PRD  
**Implementation**: Create message generator service

