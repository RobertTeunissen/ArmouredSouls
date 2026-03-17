-- Revert weapon bonus rebalance for 6 weapons whose spatial attributes
-- (hydraulicSystems, servoMotors, gyroStabilizers) are now active in the
-- 2D Combat Arena. Ion Beam flavour fix (shieldCapacity → combatPower) is kept.
-- Magnitudes preserved, prices unchanged.

-- Energy Blade: combatPower +4 → hydraulicSystems +4
UPDATE "weapons"
SET "combat_power_bonus" = 0,
    "hydraulic_systems_bonus" = 4
WHERE "name" = 'Energy Blade';

-- Plasma Blade: combatPower +5 → hydraulicSystems +5
UPDATE "weapons"
SET "combat_power_bonus" = 0,
    "hydraulic_systems_bonus" = 5
WHERE "name" = 'Plasma Blade';

-- Power Sword: penetration +7 → hydraulicSystems +7, criticalSystems +5 → counterProtocols +5, weaponControl +4 → gyroStabilizers +4
UPDATE "weapons"
SET "penetration_bonus" = 0,
    "critical_systems_bonus" = 0,
    "weapon_control_bonus" = 0,
    "hydraulic_systems_bonus" = 7,
    "counter_protocols_bonus" = 5,
    "gyro_stabilizers_bonus" = 4
WHERE "name" = 'Power Sword';

-- Battle Axe: penetration +6 → hydraulicSystems +6, attackSpeed -2 → servoMotors -2
UPDATE "weapons"
SET "penetration_bonus" = 0,
    "attack_speed_bonus" = 0,
    "hydraulic_systems_bonus" = 6,
    "servo_motors_bonus" = -2
WHERE "name" = 'Battle Axe';

-- Heavy Hammer: penetration +8 → hydraulicSystems +8, attackSpeed -3 → servoMotors -3
UPDATE "weapons"
SET "penetration_bonus" = 0,
    "attack_speed_bonus" = 0,
    "hydraulic_systems_bonus" = 8,
    "servo_motors_bonus" = -3
WHERE "name" = 'Heavy Hammer';

-- Reactive Shield: evasionThrusters -2 → servoMotors -2
UPDATE "weapons"
SET "evasion_thrusters_bonus" = 0,
    "servo_motors_bonus" = -2
WHERE "name" = 'Reactive Shield';
