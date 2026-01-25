-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" VARCHAR(20) NOT NULL DEFAULT 'user',
    "currency" INTEGER NOT NULL DEFAULT 1000000,
    "elo" INTEGER NOT NULL DEFAULT 1200,
    "fame" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "robots" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "weapon_id" INTEGER,
    "firepower" INTEGER NOT NULL DEFAULT 1,
    "targeting_computer" INTEGER NOT NULL DEFAULT 1,
    "critical_circuits" INTEGER NOT NULL DEFAULT 1,
    "armor_piercing" INTEGER NOT NULL DEFAULT 1,
    "weapon_stability" INTEGER NOT NULL DEFAULT 1,
    "firing_rate" INTEGER NOT NULL DEFAULT 1,
    "armor_plating" INTEGER NOT NULL DEFAULT 1,
    "shield_generator" INTEGER NOT NULL DEFAULT 1,
    "evasion_thrusters" INTEGER NOT NULL DEFAULT 1,
    "damage_dampeners" INTEGER NOT NULL DEFAULT 1,
    "counter_protocols" INTEGER NOT NULL DEFAULT 1,
    "hull_integrity" INTEGER NOT NULL DEFAULT 1,
    "servo_motors" INTEGER NOT NULL DEFAULT 1,
    "gyro_stabilizers" INTEGER NOT NULL DEFAULT 1,
    "hydraulic_power" INTEGER NOT NULL DEFAULT 1,
    "power_core" INTEGER NOT NULL DEFAULT 1,
    "combat_algorithms" INTEGER NOT NULL DEFAULT 1,
    "threat_analysis" INTEGER NOT NULL DEFAULT 1,
    "adaptive_ai" INTEGER NOT NULL DEFAULT 1,
    "logic_cores" INTEGER NOT NULL DEFAULT 1,
    "sync_protocols" INTEGER NOT NULL DEFAULT 1,
    "support_systems" INTEGER NOT NULL DEFAULT 1,
    "formation_tactics" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "robots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weapons" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "weapon_type" VARCHAR(20) NOT NULL,
    "description" TEXT,
    "base_damage" INTEGER NOT NULL,
    "cost" INTEGER NOT NULL,
    "firepower_bonus" INTEGER NOT NULL DEFAULT 0,
    "targeting_computer_bonus" INTEGER NOT NULL DEFAULT 0,
    "critical_circuits_bonus" INTEGER NOT NULL DEFAULT 0,
    "armor_piercing_bonus" INTEGER NOT NULL DEFAULT 0,
    "weapon_stability_bonus" INTEGER NOT NULL DEFAULT 0,
    "firing_rate_bonus" INTEGER NOT NULL DEFAULT 0,
    "armor_plating_bonus" INTEGER NOT NULL DEFAULT 0,
    "shield_generator_bonus" INTEGER NOT NULL DEFAULT 0,
    "evasion_thrusters_bonus" INTEGER NOT NULL DEFAULT 0,
    "counter_protocols_bonus" INTEGER NOT NULL DEFAULT 0,
    "servo_motors_bonus" INTEGER NOT NULL DEFAULT 0,
    "gyro_stabilizers_bonus" INTEGER NOT NULL DEFAULT 0,
    "hydraulic_power_bonus" INTEGER NOT NULL DEFAULT 0,
    "power_core_bonus" INTEGER NOT NULL DEFAULT 0,
    "threat_analysis_bonus" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weapons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battles" (
    "id" SERIAL NOT NULL,
    "robot1_id" INTEGER NOT NULL,
    "robot2_id" INTEGER NOT NULL,
    "winner_id" INTEGER,
    "battle_log" JSONB NOT NULL,
    "turns_taken" INTEGER,
    "robot1_damage_dealt" INTEGER,
    "robot2_damage_dealt" INTEGER,
    "winner_reward" INTEGER,
    "loser_reward" INTEGER,
    "robot1_repair_cost" INTEGER,
    "robot2_repair_cost" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "battles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- AddForeignKey
ALTER TABLE "robots" ADD CONSTRAINT "robots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "robots" ADD CONSTRAINT "robots_weapon_id_fkey" FOREIGN KEY ("weapon_id") REFERENCES "weapons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battles" ADD CONSTRAINT "battles_robot1_id_fkey" FOREIGN KEY ("robot1_id") REFERENCES "robots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battles" ADD CONSTRAINT "battles_robot2_id_fkey" FOREIGN KEY ("robot2_id") REFERENCES "robots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battles" ADD CONSTRAINT "battles_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "robots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
