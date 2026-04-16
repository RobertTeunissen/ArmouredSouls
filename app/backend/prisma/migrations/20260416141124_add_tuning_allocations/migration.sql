-- CreateTable
CREATE TABLE "tuning_allocations" (
    "id" SERIAL NOT NULL,
    "robot_id" INTEGER NOT NULL,
    "combat_power" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "targeting_systems" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "critical_systems" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "penetration" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "weapon_control" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "attack_speed" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "armor_plating" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "shield_capacity" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "evasion_thrusters" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "damage_dampeners" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "counter_protocols" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "hull_integrity" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "servo_motors" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "gyro_stabilizers" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "hydraulic_systems" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "power_core" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "combat_algorithms" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "threat_analysis" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "adaptive_ai" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "logic_cores" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "sync_protocols" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "support_systems" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "formation_tactics" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tuning_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tuning_allocations_robot_id_key" ON "tuning_allocations"("robot_id");

-- CreateIndex
CREATE INDEX "tuning_allocations_robot_id_idx" ON "tuning_allocations"("robot_id");

-- AddForeignKey
ALTER TABLE "tuning_allocations" ADD CONSTRAINT "tuning_allocations_robot_id_fkey" FOREIGN KEY ("robot_id") REFERENCES "robots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
