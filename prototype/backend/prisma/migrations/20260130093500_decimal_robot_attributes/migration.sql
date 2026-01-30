-- AlterTable: Change all 23 robot attributes from INTEGER to DECIMAL(5,2)
-- This migration converts integer values to decimal format (e.g., 25 -> 25.00)
-- No data loss occurs as integers convert cleanly to decimals

-- Combat Systems (6 attributes)
ALTER TABLE "robots" ALTER COLUMN "combat_power" SET DATA TYPE DECIMAL(5,2);
ALTER TABLE "robots" ALTER COLUMN "combat_power" SET DEFAULT 1.00;

ALTER TABLE "robots" ALTER COLUMN "targeting_systems" SET DATA TYPE DECIMAL(5,2);
ALTER TABLE "robots" ALTER COLUMN "targeting_systems" SET DEFAULT 1.00;

ALTER TABLE "robots" ALTER COLUMN "critical_systems" SET DATA TYPE DECIMAL(5,2);
ALTER TABLE "robots" ALTER COLUMN "critical_systems" SET DEFAULT 1.00;

ALTER TABLE "robots" ALTER COLUMN "penetration" SET DATA TYPE DECIMAL(5,2);
ALTER TABLE "robots" ALTER COLUMN "penetration" SET DEFAULT 1.00;

ALTER TABLE "robots" ALTER COLUMN "weapon_control" SET DATA TYPE DECIMAL(5,2);
ALTER TABLE "robots" ALTER COLUMN "weapon_control" SET DEFAULT 1.00;

ALTER TABLE "robots" ALTER COLUMN "attack_speed" SET DATA TYPE DECIMAL(5,2);
ALTER TABLE "robots" ALTER COLUMN "attack_speed" SET DEFAULT 1.00;

-- Defensive Systems (5 attributes)
ALTER TABLE "robots" ALTER COLUMN "armor_plating" SET DATA TYPE DECIMAL(5,2);
ALTER TABLE "robots" ALTER COLUMN "armor_plating" SET DEFAULT 1.00;

ALTER TABLE "robots" ALTER COLUMN "shield_capacity" SET DATA TYPE DECIMAL(5,2);
ALTER TABLE "robots" ALTER COLUMN "shield_capacity" SET DEFAULT 1.00;

ALTER TABLE "robots" ALTER COLUMN "evasion_thrusters" SET DATA TYPE DECIMAL(5,2);
ALTER TABLE "robots" ALTER COLUMN "evasion_thrusters" SET DEFAULT 1.00;

ALTER TABLE "robots" ALTER COLUMN "damage_dampeners" SET DATA TYPE DECIMAL(5,2);
ALTER TABLE "robots" ALTER COLUMN "damage_dampeners" SET DEFAULT 1.00;

ALTER TABLE "robots" ALTER COLUMN "counter_protocols" SET DATA TYPE DECIMAL(5,2);
ALTER TABLE "robots" ALTER COLUMN "counter_protocols" SET DEFAULT 1.00;

-- Chassis & Mobility (5 attributes)
ALTER TABLE "robots" ALTER COLUMN "hull_integrity" SET DATA TYPE DECIMAL(5,2);
ALTER TABLE "robots" ALTER COLUMN "hull_integrity" SET DEFAULT 1.00;

ALTER TABLE "robots" ALTER COLUMN "servo_motors" SET DATA TYPE DECIMAL(5,2);
ALTER TABLE "robots" ALTER COLUMN "servo_motors" SET DEFAULT 1.00;

ALTER TABLE "robots" ALTER COLUMN "gyro_stabilizers" SET DATA TYPE DECIMAL(5,2);
ALTER TABLE "robots" ALTER COLUMN "gyro_stabilizers" SET DEFAULT 1.00;

ALTER TABLE "robots" ALTER COLUMN "hydraulic_systems" SET DATA TYPE DECIMAL(5,2);
ALTER TABLE "robots" ALTER COLUMN "hydraulic_systems" SET DEFAULT 1.00;

ALTER TABLE "robots" ALTER COLUMN "power_core" SET DATA TYPE DECIMAL(5,2);
ALTER TABLE "robots" ALTER COLUMN "power_core" SET DEFAULT 1.00;

-- AI Processing (4 attributes)
ALTER TABLE "robots" ALTER COLUMN "combat_algorithms" SET DATA TYPE DECIMAL(5,2);
ALTER TABLE "robots" ALTER COLUMN "combat_algorithms" SET DEFAULT 1.00;

ALTER TABLE "robots" ALTER COLUMN "threat_analysis" SET DATA TYPE DECIMAL(5,2);
ALTER TABLE "robots" ALTER COLUMN "threat_analysis" SET DEFAULT 1.00;

ALTER TABLE "robots" ALTER COLUMN "adaptive_ai" SET DATA TYPE DECIMAL(5,2);
ALTER TABLE "robots" ALTER COLUMN "adaptive_ai" SET DEFAULT 1.00;

ALTER TABLE "robots" ALTER COLUMN "logic_cores" SET DATA TYPE DECIMAL(5,2);
ALTER TABLE "robots" ALTER COLUMN "logic_cores" SET DEFAULT 1.00;

-- Team Coordination (3 attributes)
ALTER TABLE "robots" ALTER COLUMN "sync_protocols" SET DATA TYPE DECIMAL(5,2);
ALTER TABLE "robots" ALTER COLUMN "sync_protocols" SET DEFAULT 1.00;

ALTER TABLE "robots" ALTER COLUMN "support_systems" SET DATA TYPE DECIMAL(5,2);
ALTER TABLE "robots" ALTER COLUMN "support_systems" SET DEFAULT 1.00;

ALTER TABLE "robots" ALTER COLUMN "formation_tactics" SET DATA TYPE DECIMAL(5,2);
ALTER TABLE "robots" ALTER COLUMN "formation_tactics" SET DEFAULT 1.00;
