import type { RobotAttributeKey } from '../types/robot';

/**
 * Short player-facing explanation of what each robot attribute does in combat.
 *
 * Shown as hover/focus tooltips on the Upgrade Planner (#572). Wording follows
 * the in-game guide article `robots/attributes-overview.md`; keep the two in
 * sync when an attribute's behaviour changes. Formulas live in
 * `docs/game-systems/PRD_ROBOT_ATTRIBUTES.md`, not here.
 */
export const ROBOT_ATTRIBUTE_DESCRIPTIONS: Readonly<Record<RobotAttributeKey, string>> = {
  // Combat Systems
  combatPower: 'Increases base damage for all attacks. The primary damage-scaling attribute.',
  targetingSystems: 'Improves hit chance and precision, so fewer of your attacks miss. Also raises critical hit chance.',
  criticalSystems: 'Increases the chance of landing a critical hit for bonus damage.',
  penetration: "Bypasses part of the opponent's armor and shields.",
  weaponControl: 'Reduces the chance your weapon malfunctions (0% at level 50) and adds a smaller damage bonus.',
  attackSpeed: 'Reduces the cooldown between attacks, so your robot strikes more often.',

  // Defensive Systems
  armorPlating: 'Reduces damage that reaches your hull, as a percentage of each hit.',
  shieldCapacity: 'Sets the size of your energy shield, a buffer that absorbs damage before your hull. Resets after every fight.',
  evasionThrusters: 'Gives a chance to dodge incoming attacks. Ranged robots also get a longer escape burst after being hit in melee.',
  damageDampeners: 'Reduces all incoming damage a little and cuts the extra damage from critical hits.',
  counterProtocols: 'Gives a chance to strike back immediately when attacked, whether the attack hits or misses.',

  // Chassis & Mobility
  hullIntegrity: "Sets your robot's maximum HP. Hull damage persists after battle until repaired.",
  servoMotors: 'Sets movement speed in the arena: close distance faster or keep your preferred weapon range.',
  gyroStabilizers: 'Lowers the opponent\'s hit chance, speeds up turning, and reduces backstab and flanking damage against you.',
  hydraulicSystems: 'Boosts damage up close: up to +75% at melee range and +25% at short range (level 50). No effect at mid or long range.',
  powerCore: 'Drives how fast your energy shield regenerates during battle.',

  // AI Processing
  combatAlgorithms: 'Improves decision quality: better hit chance at higher levels, more direct movement, and a shorter patience window.',
  threatAnalysis: 'Improves positioning and turning to prevent backstabs. Above level 25 it also reduces backstab and flanking damage taken.',
  adaptiveAI: 'Builds up hit and damage bonuses each time your robot misses or takes damage. Bonuses are halved while HP is above 70%.',
  logicCores: 'Boosts damage at range (up to +75% long, +50% mid at level 50) and gives accuracy and damage bonuses when HP gets low.',

  // Team Coordination
  syncProtocols: 'Dual-wield builds deal bonus damage when both weapons are ready together. Also improves team coordination.',
  supportSystems: 'Passively boosts shield regeneration during combat. In team modes, helps buff nearby allies.',
  formationTactics: 'Reduces damage taken while your robot is near the arena edge. In team modes, improves formation positioning.',
};
