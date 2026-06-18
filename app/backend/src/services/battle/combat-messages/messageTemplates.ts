/**
 * Combat Message Templates
 * All static narrative message template arrays used by the message generators.
 * Pure data — no logic.
 */

// ── Battle Start Messages ────────────────────────────────────────────

export const battleStartMessagesGeneric = [
  '⚔️ Battle commences! {robot1Name} vs {robot2Name}',
  '💥 Arena match starting: {robot1Name} vs {robot2Name}',
  '⚔️ {robot1Name} and {robot2Name} take their positions in the arena!',
  '💫 Battle systems online: {robot1Name} vs {robot2Name} engaging now',
  '⚡ Arena secured. Combatants ready: {robot1Name} vs {robot2Name}',
];

export const battleStartMessagesLeague = [
  '⚔️ Battle commences! {robot1Name} (ELO {robot1ELO}) vs {robot2Name} (ELO {robot2ELO})',
  '🎯 {robot1Name} and {robot2Name} enter the arena for {leagueType} league combat!',
  '⚡ The arena lights up as {robot1Name} faces {robot2Name} in {leagueType} league!',
  '🏟️ {robot1Name} (ELO {robot1ELO}) challenges {robot2Name} (ELO {robot2ELO}) to battle!',
  '🔥 Combat initialized: {robot1Name} vs {robot2Name} - {leagueType} league match',
  '🎪 The crowd watches as {robot1Name} confronts {robot2Name} in {leagueType} league!',
];

export const battleStartMessagesTournament = [
  '🏆 Tournament bout! {robot1Name} vs {robot2Name} - only one advances!',
  '⚔️ Tournament match: {robot1Name} faces {robot2Name} in elimination combat!',
  '🎯 The tournament bracket brings {robot1Name} against {robot2Name}!',
  '💥 Elimination round! {robot1Name} vs {robot2Name} - no draws allowed!',
  '🏟️ The crowd roars as {robot1Name} and {robot2Name} clash in the tournament!',
];

export const battleStartMessagesTagTeam = [
  '🤝 Tag Team Battle! {team1Name} vs {team2Name}!',
  "⚔️ Tag team combat begins! {team1Name} sends {robot1Name} against {team2Name}'s {robot2Name}!",
  '🏟️ The arena opens for tag team warfare: {team1Name} ({robot1Name} & {robot3Name}) vs {team2Name} ({robot2Name} & {robot4Name})!',
  '💥 Tag team showdown! {team1Name} vs {team2Name} - four robots, one victor!',
  '🤝 Teams ready! {team1Name} leads with {robot1Name}, {team2Name} leads with {robot2Name}!',
];

// ── Stance Messages (3 variations per stance) ─────────────────────────
export const stanceMessages: Record<string, string[]> = {
  offensive: [
    '⚔️ {robotName} takes an aggressive offensive stance, focusing on damage',
    '🔥 {robotName} powers up weapons systems - offensive mode engaged!',
    '💢 {robotName} locks targeting systems to maximum aggression!',
  ],
  defensive: [
    '🛡️ {robotName} adopts a defensive stance, prioritizing survival',
    '🛡️ {robotName} reinforces shields and activates damage dampeners!',
    '🛡️ {robotName} hunkers down behind reinforced plating - defense mode!',
  ],
  balanced: [
    '⚖️ {robotName} maintains a balanced stance, ready to adapt',
    '⚖️ {robotName} calibrates systems for balanced combat readiness',
    '⚖️ {robotName} holds steady - all systems at standard output',
  ],
};

// ── Attack Hit Messages (12 variations) ────────────────────────────────
export const hitMessages = [
  '💥 {attackerName} strikes {defenderName} with {weaponName}, landing {damageDescriptor}!',
  "⚡ {attackerName}'s {weaponName} connects, dealing {damageDescriptor} to {defenderName}!",
  '🔪 {attackerName} slashes {defenderName} with {weaponName}, inflicting {damageDescriptor}!',
  '🎯 {attackerName} lands {damageDescriptor} on {defenderName} with {weaponName}!',
  "💢 {attackerName}'s {weaponName} finds its mark - {damageDescriptor} to {defenderName}!",
  '⚔️ {attackerName} drives {weaponName} into {defenderName} for {damageDescriptor}!',
  '🔥 {weaponName} tears into {defenderName} - {attackerName} delivers {damageDescriptor}!',
  '💪 {attackerName} successfully hits {defenderName} with {weaponName}, causing {damageDescriptor}!',
  "⚡ Direct hit! {attackerName}'s {weaponName} deals {damageDescriptor} to {defenderName}!",
  '🎯 {attackerName} scores {damageDescriptor} against {defenderName} using {weaponName}!',
  "💥 {weaponName} impacts {defenderName}'s hull - {damageDescriptor} from {attackerName}!",
  '🔪 {attackerName} executes a clean strike on {defenderName} with {weaponName}, inflicting {damageDescriptor}!',
];

// ── Critical Hit Messages (12 variations) ──────────────────────────────
export const criticalHitMessages = [
  "💢 CRITICAL HIT! {attackerName}'s {weaponName} finds a weak point - catastrophic damage to {defenderName}!",
  '🎯 Perfect strike! {attackerName} lands a critical hit with {weaponName} - devastating impact!',
  "💥 DEVASTATING! {attackerName}'s critical strike with {weaponName} overwhelms {defenderName}!",
  "⚡ CRITICAL! {attackerName} exploits a vulnerability in {defenderName}'s defenses!",
  "🔥 MASSIVE DAMAGE! {attackerName}'s {weaponName} scores a critical hit on {defenderName}!",
  "💢 CRITICAL STRIKE! {attackerName}'s {weaponName} tears through {defenderName}'s armor!",
  '🎯 Precision attack! {attackerName} targets a critical system on {defenderName} with {weaponName}!',
  '💥 EXCEPTIONAL! {attackerName} delivers a punishing critical blow with {weaponName}!',
  "⚡ DEVASTATING CRITICAL! {attackerName}'s {weaponName} finds the perfect angle - {defenderName} reels from the impact!",
  "🔥 CRITICAL DAMAGE! {attackerName}'s {weaponName} strikes a vulnerable point on {defenderName}!",
  '💢 CRUSHING BLOW! {attackerName} lands a critical strike that staggers {defenderName}!',
  "🎯 PINPOINT ACCURACY! {attackerName}'s {weaponName} exploits a weak spot perfectly!",
];

// ── Miss Messages (12 variations) ──────────────────────────────────────
export const missMessages = [
  '❌ {attackerName} swings {weaponName} but misses {defenderName} completely!',
  "⚠️ {attackerName}'s {weaponName} attack goes wide - no damage!",
  '🎯 {attackerName} aims {weaponName} but the shot misses {defenderName}!',
  "💨 {defenderName} dodges {attackerName}'s {weaponName} attack effortlessly!",
  "🏃 {defenderName} evades {attackerName}'s {weaponName} with quick reflexes!",
  "⚡ {defenderName} weaves out of range as {attackerName}'s {weaponName} strikes empty air!",
  "❌ {attackerName}'s {weaponName} fails to connect - {defenderName} too quick!",
  "💨 Evasion successful! {defenderName} sidesteps {attackerName}'s {weaponName}!",
  "🏃 {defenderName}'s thrusters engage - {attackerName}'s attack misses!",
  '⚠️ {attackerName} miscalculates - {weaponName} hits nothing but air!',
  "❌ {defenderName} anticipates the attack and dodges {attackerName}'s {weaponName}!",
  "💨 Clean evasion! {defenderName} avoids {attackerName}'s {weaponName} entirely!",
];

// ── Shield Messages ────────────────────────────────────────────────────
export const shieldAbsorbMessages = [
  "🛡️ {defenderName}'s energy shield absorbs the impact from {attackerName}'s {weaponName}!",
  "⚡ {defenderName}'s shields hold strong against {attackerName}'s {weaponName}!",
  "🛡️ Energy shield flares as {defenderName} deflects {attackerName}'s attack!",
  "⚡ {defenderName}'s shield takes the hit - hull integrity maintained!",
  "🛡️ Defensive systems engaged! {defenderName}'s shield blocks {attackerName}'s {weaponName}!",
];

export const shieldBreakMessages = [
  "🛡️💥 {robotName}'s energy shield has been depleted!",
  "⚡❌ {robotName}'s shields are down - hull is exposed!",
  "🔴 WARNING: {robotName}'s energy shield has failed!",
  '💥 Shield generator offline! {robotName} is vulnerable!',
  "⚠️ Critical: {robotName}'s protective shields have collapsed!",
];

// ── Shield Regeneration Messages (5 variations) ────────────────────────
export const shieldRegenMessages = [
  "🛡️⚡ {robotName}'s power core recharges shields",
  "⚡✨ {robotName}'s shields regenerate during the lull in combat",
  "🔋 {robotName}'s energy shield restores capacity",
  "🛡️ {robotName}'s defensive systems recover shield energy",
  "⚡ {robotName}'s shield generator hums back to life",
];

// ── Malfunction Messages (6 variations) ────────────────────────────────
export const malfunctionMessages = [
  "⚙️ MALFUNCTION! {robotName}'s {weaponName} jams and fails to fire!",
  "⚠️ SYSTEM ERROR! {robotName}'s targeting systems glitch - attack aborted!",
  "🔧 TECHNICAL FAILURE! {robotName}'s {weaponName} malfunctions mid-attack!",
  "⚡ POWER SURGE! {robotName}'s weapon systems temporarily offline!",
  "💥 CRITICAL ERROR! {robotName}'s {weaponName} overheats and shuts down!",
  "⚙️ MECHANICAL FAULT! {robotName}'s attack systems fail at a critical moment!",
];

// ── Counter-Attack Messages (8 variations for success) ─────────────────
export const counterSuccessMessages = [
  "🔄 {defenderName} counters {attackerName}'s attack with {weaponName} for {damageDescriptor}!",
  '⚔️ Counter-attack! {defenderName} retaliates with {weaponName}, dealing {damageDescriptor} to {attackerName}!',
  '💫 {defenderName} parries and counters with {weaponName}, striking {attackerName} for {damageDescriptor}!',
  '🔄 Quick reflexes! {defenderName} turns defense into offense with {weaponName}!',
  "⚔️ {defenderName} exploits an opening and counters with {weaponName} - {damageDescriptor}!",
  "💫 {defenderName}'s counter protocols activate - {weaponName} strikes back at {attackerName}!",
  '🔄 Reversal! {defenderName} catches {attackerName} off-guard with a {weaponName} counter!',
  '⚔️ {defenderName} reads the attack and retaliates with {weaponName} for {damageDescriptor}!',
];

// ── Counter-Attack Miss Messages (6 variations) ────────────────────────
export const counterMissMessages = [
  "🔄❌ {defenderName} counters but {weaponName} misses {attackerName}!",
  '⚔️❌ {defenderName} retaliates with {weaponName} but fails to connect!',
  "💫❌ {defenderName}'s counter protocols activate but {weaponName} swings wide of {attackerName}!",
  '🔄❌ {defenderName} attempts a counter with {weaponName} — {attackerName} evades!',
  '⚔️❌ Counter-attack! {defenderName} strikes back with {weaponName} but misses!',
  "💫❌ {defenderName} retaliates but {attackerName} dodges the {weaponName} counter!",
];

// ── Victory Messages ───────────────────────────────────────────────────
export const victoryMessages = [
  '🏆 VICTORY! {winnerName} defeats {loserName}!',
  '👑 {winnerName} emerges victorious over {loserName}!',
  '⚔️ {winnerName} wins the battle against {loserName}!',
  '🎉 {winnerName} triumphs over {loserName}!',
  '💪 {winnerName} claims victory against {loserName}!',
  '🏆 Battle concluded: {winnerName} defeats {loserName}!',
  '👑 {winnerName} stands triumphant over the fallen {loserName}!',
  "⚔️ {loserName} falls before {winnerName}'s superior combat prowess!",
];

export const dominantVictoryMessages = [
  '🏆 DOMINANT VICTORY! {winnerName} crushes {loserName} with {hpDescriptor} remaining!',
  '👑 FLAWLESS! {winnerName} defeats {loserName} while taking minimal damage!',
  '⚔️ OVERWHELMING! {winnerName} destroys {loserName} with {hpDescriptor} to spare!',
  '💪 SUPERIOR! {winnerName} dominates {loserName} completely!',
  '🎯 PERFECT EXECUTION! {winnerName} defeats {loserName} with barely a scratch!',
  '🔥 UNSTOPPABLE! {winnerName} crushes {loserName} with overwhelming force!',
  '💥 TOTAL DOMINATION! {winnerName} obliterates {loserName} while remaining nearly undamaged!',
  '👑 MASTERFUL! {winnerName} outclasses {loserName} in every way!',
];

export const closeVictoryMessages = [
  '🏆 NARROW VICTORY! {winnerName} defeats {loserName} by the slimmest margin!',
  '⚔️ Hard-fought victory! {winnerName} wins with {hpDescriptor} remaining!',
  '💪 {winnerName} barely survives to claim victory over {loserName}!',
  '🎯 {winnerName} edges out {loserName} in a close battle!',
  '🔥 CLUTCH! {winnerName} survives by a hair to defeat {loserName}!',
  '⚡ INTENSE! {winnerName} claims victory despite being pushed to the limit!',
  '💥 CLOSE CALL! {winnerName} emerges victorious but heavily damaged!',
  '🏆 NARROW ESCAPE! {winnerName} defeats {loserName} in a nail-biting finish!',
];

// ── Yield Messages (5 variations) ──────────────────────────────────────
export const yieldMessages = [
  '🏳️ {robotName} yields! Battle ends with {winnerName} victorious!',
  '✋ {robotName} surrenders! {winnerName} wins!',
  '🛑 {robotName} concedes defeat to {winnerName}!',
  '⚠️ {robotName} signals surrender - {winnerName} emerges victorious!',
  '🏳️ {robotName} surrenders to avoid complete destruction!',
];

// ── Destruction Messages (5 variations) ────────────────────────────────
export const destructionMessages = [
  '💀 {robotName} has been destroyed! Hull integrity at 0%!',
  "💥 {robotName}'s systems fail - robot disabled!",
  '🔴 KNOCKOUT! {robotName} is down!',
  '💀 {robotName} crumbles under the assault - total system failure!',
  "💥 {robotName}'s hull breaches catastrophically - destruction confirmed!",
];

// ── Damage Status Messages ─────────────────────────────────────────────
export const heavyDamageMessages = [
  '⚠️ {robotName} is heavily damaged - hull integrity critical!',
  '🔴 {robotName} at critical health - systems failing!',
  "💔 {robotName}'s hull integrity severely compromised!",
];

export const moderateDamageMessages = [
  '⚠️ {robotName} has taken significant damage!',
  '🟠 {robotName} showing signs of wear - systems strained!',
];

export const lightDamageMessages = [
  '🟢 {robotName} sustains minor damage - still in fighting shape',
];

// ── Draw Messages (3 variations) ───────────────────────────────────────
export const drawMessages = [
  '⏱️ DRAW! Maximum battle time reached - both combatants survive!',
  '⏰ Time expires! Battle ends in a draw.',
  '🤝 Stalemate! Neither robot could secure victory before time ran out.',
];

// ── ELO Messages ───────────────────────────────────────────────────────
export const eloGainMessages = [
  '📈 {robotName}: {oldELO} → {newELO} (+{change} ELO)',
  '⬆️ {robotName} gains {change} ELO rating ({oldELO} → {newELO})',
  "📊 {robotName}'s rating increases by {change} ELO points",
  '🎯 {robotName} earns +{change} ELO (now {newELO})',
  '📈 Rating boost for {robotName}: +{change} ELO',
];

export const eloLossMessages = [
  '📉 {robotName}: {oldELO} → {newELO} ({change} ELO)',
  '⬇️ {robotName} loses {change} ELO rating ({oldELO} → {newELO})',
  "📊 {robotName}'s rating decreases by {change} ELO points",
  '📉 Rating penalty for {robotName}: {change} ELO',
  '⬇️ {robotName} drops {change} ELO points (now {newELO})',
];

// ── Reward Messages ────────────────────────────────────────────────────
export const rewardMessages = [
  '💰 {robotName} receives ₡{credits}',
  '💵 {robotName} earns ₡{credits} in battle rewards',
  '🏆 Battle earnings: ₡{credits} awarded to {robotName}',
  '💰 {robotName} collects ₡{credits} for combat participation',
];

export const prestigeMessages = [
  '⭐ {robotName} gains {prestige} prestige!',
  '✨ Prestige awarded: +{prestige} for {robotName}',
  '🌟 {robotName} earns {prestige} prestige points',
  "⭐ {robotName}'s reputation increases by {prestige} prestige",
];

export const fameMessages = [
  '🎖️ {robotName} gains {fame} fame!',
  '📣 Fame earned: +{fame} for {robotName}',
  '🏅 {robotName} receives {fame} fame points',
  "🎖️ {robotName}'s renown increases by {fame} fame",
];

// ── Tag Team Messages ──────────────────────────────────────────────────
export const tagOutYieldMessages = [
  "🏳️ {robotName} reaches their yield threshold and tags out! {teamName} calls in their reserve!",
  "✋ {robotName} yields! {teamName}'s reserve robot prepares to enter the arena!",
  "🛑 {robotName} signals for a tag-out - {teamName}'s backup is ready!",
  '⚠️ {robotName} has taken enough damage and tags out! {teamName} switches fighters!',
  '🏳️ {robotName} retreats to avoid destruction - {teamName} brings in fresh reinforcements!',
  '✋ Tag-out! {robotName} yields the arena to their teammate!',
  "🛑 {robotName} concedes and tags out - {teamName}'s reserve enters the fight!",
  '⚠️ {robotName} reaches critical damage and calls for backup!',
];

export const tagOutDestructionMessages = [
  "💥 {robotName} is destroyed! {teamName}'s reserve robot rushes to continue the fight!",
  '🔥 {robotName} falls in combat! {teamName} sends in their backup!',
  "💢 {robotName} has been eliminated! {teamName}'s reserve takes over!",
  "⚡ {robotName} is taken down! {teamName}'s second fighter enters the arena!",
  "💥 Destruction! {robotName} is out - {teamName}'s reserve steps up!",
  "🔥 {robotName} is defeated! {teamName} calls in their remaining fighter!",
  "💢 {robotName} falls! {teamName}'s backup robot charges into battle!",
  "⚡ {robotName} is eliminated from combat! {teamName}'s reserve activates!",
];

export const tagInMessages = [
  '🔄 {robotName} enters the arena for {teamName} at full strength!',
  '⚡ Fresh fighter! {robotName} tags in for {teamName} at peak condition!',
  '🎯 {robotName} joins the battle for {teamName} - weapons ready!',
  '💪 {robotName} charges into the arena to fight for {teamName}!',
  '🔄 Tag-in complete! {robotName} takes over for {teamName}!',
  '⚡ {robotName} enters combat for {teamName} with full energy!',
  '🎯 Reserve activated! {robotName} steps up for {teamName}!',
  '💪 {robotName} rushes in to continue the fight for {teamName}!',
  "🔄 {teamName}'s {robotName} enters the arena at maximum combat readiness!",
  '⚡ {robotName} tags in - {teamName} brings fresh firepower to the battle!',
];

// ── Spatial Movement Messages (3-5 variations) ─────────────────────────
export const movementMessages = [
  '🏃 {robotName} advances toward {targetName}, closing to {distance} units',
  '🏃 {robotName} repositions, now {distance} units from {targetName}',
  '💨 {robotName} dashes across the arena — {distance} units to {targetName}',
  '🏃 {robotName} maneuvers toward {targetName}, distance: {distance} units',
  '⚡ {robotName} surges forward, closing the gap to {distance} units from {targetName}',
];

// ── Range Transition Messages (3-5 variations) ────────────────────────
export const rangeTransitionMessages = [
  '📏 {robotName} enters {rangeBand} range against {targetName}',
  '📏 Distance shift! {robotName} is now at {rangeBand} range from {targetName}',
  '📏 {robotName} transitions to {rangeBand} range with {targetName}',
  '📏 Range change — {robotName} moves into {rangeBand} range of {targetName}',
];

// ── Out of Range Messages (3-5 variations) ────────────────────────────
export const outOfRangeMessages = [
  "🚫 {robotName}'s {weaponName} can't reach {targetName} at {distance} units!",
  "🚫 Out of range! {robotName}'s {weaponName} falls short — {targetName} is {distance} units away!",
  '🚫 {robotName} swings {weaponName} but {targetName} is too far at {distance} units!',
  "🚫 {robotName}'s {weaponName} misses the mark — {distance} units to {targetName}!",
];

// ── Counter Out of Range Messages (3-5 variations) ────────────────────
export const counterOutOfRangeMessages = [
  "🔄🚫 {robotName}'s counter with {weaponName} blocked — {targetName} is out of range!",
  "🔄🚫 {robotName} tries to counter with {weaponName} but {targetName} is too far away!",
  "🔄🚫 Counter failed! {robotName}'s {weaponName} can't reach {targetName}!",
  '🔄🚫 {robotName} attempts a counter-strike with {weaponName} — {targetName} out of reach!',
];

// ── Backstab Messages (3-5 variations) ────────────────────────────────
export const backstabMessages = [
  '🗡️ {attackerName} strikes {defenderName} from behind!',
  '🗡️ BACKSTAB! {attackerName} catches {defenderName} facing the wrong way!',
  "🗡️ {attackerName} exploits {defenderName}'s blind spot with a rear attack!",
  "🗡️ {defenderName} is hit from behind by {attackerName}'s surprise strike!",
];

// ── Flanking Messages (3-5 variations) ────────────────────────────────
export const flankingMessages = [
  '🎯 {attackerName} flanks {defenderName} from multiple angles!',
  '🎯 FLANKING! {attackerName} attacks {defenderName} from a wide angle!',
  '🎯 {attackerName} coordinates a flanking strike on {defenderName}!',
  '🎯 {defenderName} is caught in a crossfire — {attackerName} flanks from the side!',
];

// ── KotH Zone Enter Messages (Req 12.6) ───────────────────────────────
export const kothZoneEnterMessages = [
  '👑 {robotName} enters the control zone!',
  '👑 {robotName} pushes into the control zone — claiming territory!',
  '👑 {robotName} moves into the control zone and begins contesting!',
];

export const kothZoneEnterContestedMessages = [
  "⚔️👑 {robotName} enters the contested zone — the fight for control intensifies!",
  "⚔️👑 {robotName} charges into the zone — it's now contested!",
  '⚔️👑 {robotName} joins the zone battle — control is disputed!',
];

export const kothZoneEnterUncontestedMessages = [
  '👑✨ {robotName} takes sole control of the zone — scoring begins!',
  "👑✨ {robotName} claims the zone unopposed — points are ticking!",
  '👑✨ {robotName} secures the control zone — uncontested dominance!',
];

// ── KotH Zone Exit Messages ───────────────────────────────────────────
export const kothZoneExitMessages = [
  '🚪 {robotName} leaves the control zone',
  '🚪 {robotName} retreats from the control zone',
  '🚪 {robotName} exits the zone — relinquishing position',
];

export const kothZoneExitForcedMessages = [
  '💥🚪 {robotName} is forced out of the control zone!',
  '💥🚪 {robotName} is knocked from the zone by enemy fire!',
  '💥🚪 {robotName} is driven out of the control zone under pressure!',
];

// ── KotH Score Tick Messages ──────────────────────────────────────────
export const kothScoreTickUncontestedMessages = [
  '👑 {robotName} holds the zone unopposed — Zone Score: {score}',
  '👑 {robotName} maintains sole control — scoring at 1 pt/sec (Score: {score})',
  '👑 {robotName} dominates the zone — Zone Score climbing to {score}',
];

export const kothScoreTickContestedMessages = [
  '⚔️ The zone is contested — no points awarded this tick',
  '⚔️ Multiple robots in the zone — scoring paused!',
  '⚔️ Zone control disputed — no one scores while contested',
];

// ── KotH Kill Bonus Messages ──────────────────────────────────────────
export const kothKillBonusMessages = [
  '💀👑 {killerName} eliminates {victimName} and earns a kill bonus of {bonus} points!',
  '💀👑 {killerName} destroys {victimName} — +{bonus} Zone Score bonus!',
  '💀👑 Kill confirmed! {killerName} takes down {victimName} for {bonus} bonus points!',
];

// ── KotH Robot Eliminated Messages ────────────────────────────────────
export const kothEliminatedDestroyedMessages = [
  '💀 {robotName} has been destroyed! Final Zone Score: {score} — placed {placement}',
  '💀 {robotName} is eliminated by destruction! Zone Score: {score}',
  '💀 {robotName} falls in combat — permanently eliminated with {score} points',
];

export const kothEliminatedYieldedMessages = [
  '🏳️ {robotName} yields and is eliminated! Final Zone Score: {score}',
  '🏳️ {robotName} surrenders — removed from the match with {score} points',
  '🏳️ {robotName} concedes defeat — eliminated with Zone Score: {score}',
];

// ── KotH Passive Warning/Penalty Messages ─────────────────────────────
export const kothPassiveWarningMessages = [
  '⚠️ {robotName} has been outside the zone for 20 seconds — return to the zone!',
  '⚠️ Warning: {robotName} is lingering outside the control zone!',
  '⚠️ {robotName} risks penalties — 20 seconds outside the zone!',
];

export const kothPassivePenaltyDamageMessages = [
  "📉 {robotName} suffers a {penalty}% damage reduction for staying outside the zone",
  "📉 Passive penalty: {robotName}'s damage output reduced by {penalty}%",
  "📉 {robotName}'s weapons weaken — {penalty}% damage penalty for zone avoidance",
];

export const kothPassivePenaltyAccuracyMessages = [
  "📉🎯 {robotName} suffers a 15% accuracy penalty — 60 seconds outside the zone!",
  "📉🎯 {robotName}'s targeting systems degrade — accuracy reduced by 15%!",
  '📉🎯 Severe penalty: {robotName} loses 15% accuracy for prolonged zone avoidance!',
];

// ── KotH Zone Moving/Active Messages (Rotating Variant) ───────────────
export const kothZoneMovingMessages = [
  '🔄 The control zone is moving in {countdown} seconds!',
  '🔄 Warning: Zone relocation imminent — {countdown} seconds!',
  '🔄 The zone is about to shift — prepare to reposition in {countdown}s!',
];

export const kothZoneActiveMessages = [
  '🔄✨ The control zone has moved to a new position!',
  '🔄✨ Zone relocated — the fight shifts to a new area!',
  '🔄✨ New zone active — robots must adapt to the new position!',
];

// ── KotH Last Standing Messages ───────────────────────────────────────
export const kothLastStandingMessages = [
  '🏆 {robotName} is the last robot standing — 10 seconds to score!',
  '🏆 Only {robotName} remains — final 10-second countdown begins!',
  '🏆 {robotName} survives as the last combatant — 10 seconds left!',
];

// ── KotH Match End Messages ───────────────────────────────────────────
export const kothMatchEndScoreMessages = [
  '👑🏆 {winnerName} wins by reaching the score threshold! Final Score: {score}',
  '👑🏆 Score threshold reached! {winnerName} claims victory with {score} points!',
  '👑🏆 {winnerName} dominates the zone and wins with {score} Zone Score!',
];

export const kothMatchEndTimeMessages = [
  "⏱️👑 Time's up! {winnerName} wins with the highest Zone Score: {score}",
  '⏱️👑 Match time expired — {winnerName} leads with {score} points!',
  '⏱️👑 Time limit reached! {winnerName} takes the crown with {score} Zone Score!',
];

export const kothMatchEndLastStandingMessages = [
  '🏆👑 Last standing phase ends! {winnerName} wins with Zone Score: {score}',
  '🏆👑 {winnerName} claims victory as the last robot standing — Score: {score}',
  '🏆👑 Final countdown complete! {winnerName} wins with {score} points!',
];
