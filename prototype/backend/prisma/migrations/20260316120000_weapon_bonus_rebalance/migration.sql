-- Weapon Bonus Rebalance: swap dead/mismatched bonuses to live attributes
-- 7 weapons modified, magnitudes preserved, prices unchanged

-- Energy Blade: hydraulicSystems +4 → combatPower +4
UPDATE "Weapon"
SET "hydraulic_systems_bonus" = 0,
    "combat_power_bonus" = 4
WHERE "name" = 'Energy Blade';

-- Plasma Blade: hydraulicSystems +5 → combatPower +5
UPDATE "Weapon"
SET "hydraulic_systems_bonus" = 0,
    "combat_power_bonus" = 5
WHERE "name" = 'Plasma Blade';

-- Power Sword: hydraulicSystems +7 → penetration +7, counterProtocols +5 → criticalSystems +5, gyroStabilizers +4 → weaponControl +4
UPDATE "Weapon"
SET "hydraulic_systems_bonus" = 0,
    "counter_protocols_bonus" = 0,
    "gyro_stabilizers_bonus" = 0,
    "penetration_bonus" = 7,
    "critical_systems_bonus" = 5,
    "weapon_control_bonus" = 4
WHERE "name" = 'Power Sword';

-- Battle Axe: hydraulicSystems +6 → penetration +6, servoMotors -2 → attackSpeed -2
UPDATE "Weapon"
SET "hydraulic_systems_bonus" = 0,
    "servo_motors_bonus" = 0,
    "penetration_bonus" = 6,
    "attack_speed_bonus" = -2
WHERE "name" = 'Battle Axe';

-- Heavy Hammer: hydraulicSystems +8 → penetration +8, servoMotors -3 → attackSpeed -3
UPDATE "Weapon"
SET "hydraulic_systems_bonus" = 0,
    "servo_motors_bonus" = 0,
    "penetration_bonus" = 8,
    "attack_speed_bonus" = -3
WHERE "name" = 'Heavy Hammer';

-- Reactive Shield: servoMotors -2 → evasionThrusters -2
UPDATE "Weapon"
SET "servo_motors_bonus" = 0,
    "evasion_thrusters_bonus" = -2
WHERE "name" = 'Reactive Shield';

-- Ion Beam: shieldCapacity +8 → combatPower +8
UPDATE "Weapon"
SET "shield_capacity_bonus" = 0,
    "combat_power_bonus" = 8
WHERE "name" = 'Ion Beam';
