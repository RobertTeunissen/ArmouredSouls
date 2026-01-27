-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" VARCHAR(20) NOT NULL DEFAULT 'user',
    "currency" INTEGER NOT NULL DEFAULT 2000000,
    "prestige" INTEGER NOT NULL DEFAULT 0,
    "total_battles" INTEGER NOT NULL DEFAULT 0,
    "total_wins" INTEGER NOT NULL DEFAULT 0,
    "highest_elo" INTEGER NOT NULL DEFAULT 1200,
    "championship_titles" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facilities" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "facility_type" VARCHAR(50) NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "max_level" INTEGER NOT NULL DEFAULT 10,
    "active_coach" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "robots" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "frame_id" INTEGER NOT NULL DEFAULT 1,
    "paint_job" VARCHAR(100),
    "combat_power" INTEGER NOT NULL DEFAULT 1,
    "targeting_systems" INTEGER NOT NULL DEFAULT 1,
    "critical_systems" INTEGER NOT NULL DEFAULT 1,
    "penetration" INTEGER NOT NULL DEFAULT 1,
    "weapon_control" INTEGER NOT NULL DEFAULT 1,
    "attack_speed" INTEGER NOT NULL DEFAULT 1,
    "armor_plating" INTEGER NOT NULL DEFAULT 1,
    "shield_capacity" INTEGER NOT NULL DEFAULT 1,
    "evasion_thrusters" INTEGER NOT NULL DEFAULT 1,
    "damage_dampeners" INTEGER NOT NULL DEFAULT 1,
    "counter_protocols" INTEGER NOT NULL DEFAULT 1,
    "hull_integrity" INTEGER NOT NULL DEFAULT 1,
    "servo_motors" INTEGER NOT NULL DEFAULT 1,
    "gyro_stabilizers" INTEGER NOT NULL DEFAULT 1,
    "hydraulic_systems" INTEGER NOT NULL DEFAULT 1,
    "power_core" INTEGER NOT NULL DEFAULT 1,
    "combat_algorithms" INTEGER NOT NULL DEFAULT 1,
    "threat_analysis" INTEGER NOT NULL DEFAULT 1,
    "adaptive_ai" INTEGER NOT NULL DEFAULT 1,
    "logic_cores" INTEGER NOT NULL DEFAULT 1,
    "sync_protocols" INTEGER NOT NULL DEFAULT 1,
    "support_systems" INTEGER NOT NULL DEFAULT 1,
    "formation_tactics" INTEGER NOT NULL DEFAULT 1,
    "current_hp" INTEGER NOT NULL,
    "max_hp" INTEGER NOT NULL,
    "current_shield" INTEGER NOT NULL,
    "max_shield" INTEGER NOT NULL,
    "damage_taken" INTEGER NOT NULL DEFAULT 0,
    "elo" INTEGER NOT NULL DEFAULT 1200,
    "total_battles" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "damage_dealt_lifetime" INTEGER NOT NULL DEFAULT 0,
    "damage_taken_lifetime" INTEGER NOT NULL DEFAULT 0,
    "kills" INTEGER NOT NULL DEFAULT 0,
    "current_league" VARCHAR(20) NOT NULL DEFAULT 'bronze',
    "league_id" VARCHAR(30) NOT NULL DEFAULT 'bronze_1',
    "league_points" INTEGER NOT NULL DEFAULT 0,
    "fame" INTEGER NOT NULL DEFAULT 0,
    "titles" TEXT,
    "repair_cost" INTEGER NOT NULL DEFAULT 0,
    "battle_readiness" INTEGER NOT NULL DEFAULT 100,
    "total_repairs_paid" INTEGER NOT NULL DEFAULT 0,
    "yield_threshold" INTEGER NOT NULL DEFAULT 10,
    "loadout_type" VARCHAR(20) NOT NULL DEFAULT 'single',
    "stance" VARCHAR(20) NOT NULL DEFAULT 'balanced',
    "main_weapon_id" INTEGER,
    "offhand_weapon_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "robots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weapon_inventory" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "weapon_id" INTEGER NOT NULL,
    "custom_name" VARCHAR(100),
    "purchased_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weapon_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weapons" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "weapon_type" VARCHAR(20) NOT NULL,
    "base_damage" INTEGER NOT NULL,
    "cooldown" INTEGER NOT NULL,
    "cost" INTEGER NOT NULL,
    "hands_required" VARCHAR(10) NOT NULL,
    "damage_type" VARCHAR(20) NOT NULL,
    "loadout_type" VARCHAR(20) NOT NULL,
    "special_property" TEXT,
    "description" TEXT,
    "combat_power_bonus" INTEGER NOT NULL DEFAULT 0,
    "targeting_systems_bonus" INTEGER NOT NULL DEFAULT 0,
    "critical_systems_bonus" INTEGER NOT NULL DEFAULT 0,
    "penetration_bonus" INTEGER NOT NULL DEFAULT 0,
    "weapon_control_bonus" INTEGER NOT NULL DEFAULT 0,
    "attack_speed_bonus" INTEGER NOT NULL DEFAULT 0,
    "armor_plating_bonus" INTEGER NOT NULL DEFAULT 0,
    "shield_capacity_bonus" INTEGER NOT NULL DEFAULT 0,
    "evasion_thrusters_bonus" INTEGER NOT NULL DEFAULT 0,
    "damage_dampeners_bonus" INTEGER NOT NULL DEFAULT 0,
    "counter_protocols_bonus" INTEGER NOT NULL DEFAULT 0,
    "hull_integrity_bonus" INTEGER NOT NULL DEFAULT 0,
    "servo_motors_bonus" INTEGER NOT NULL DEFAULT 0,
    "gyro_stabilizers_bonus" INTEGER NOT NULL DEFAULT 0,
    "hydraulic_systems_bonus" INTEGER NOT NULL DEFAULT 0,
    "power_core_bonus" INTEGER NOT NULL DEFAULT 0,
    "combat_algorithms_bonus" INTEGER NOT NULL DEFAULT 0,
    "threat_analysis_bonus" INTEGER NOT NULL DEFAULT 0,
    "adaptive_ai_bonus" INTEGER NOT NULL DEFAULT 0,
    "logic_cores_bonus" INTEGER NOT NULL DEFAULT 0,
    "sync_protocols_bonus" INTEGER NOT NULL DEFAULT 0,
    "support_systems_bonus" INTEGER NOT NULL DEFAULT 0,
    "formation_tactics_bonus" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weapons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battles" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "robot1_id" INTEGER NOT NULL,
    "robot2_id" INTEGER NOT NULL,
    "winner_id" INTEGER,
    "battle_type" VARCHAR(20) NOT NULL,
    "league_type" VARCHAR(20) NOT NULL,
    "battle_log" JSONB NOT NULL,
    "duration_seconds" INTEGER NOT NULL,
    "winner_reward" INTEGER,
    "loser_reward" INTEGER,
    "robot1_repair_cost" INTEGER,
    "robot2_repair_cost" INTEGER,
    "robot1_final_hp" INTEGER NOT NULL,
    "robot2_final_hp" INTEGER NOT NULL,
    "robot1_final_shield" INTEGER NOT NULL,
    "robot2_final_shield" INTEGER NOT NULL,
    "robot1_yielded" BOOLEAN NOT NULL DEFAULT false,
    "robot2_yielded" BOOLEAN NOT NULL DEFAULT false,
    "robot1_destroyed" BOOLEAN NOT NULL DEFAULT false,
    "robot2_destroyed" BOOLEAN NOT NULL DEFAULT false,
    "robot1_damage_dealt" INTEGER NOT NULL,
    "robot2_damage_dealt" INTEGER NOT NULL,
    "robot1_elo_before" INTEGER NOT NULL,
    "robot2_elo_before" INTEGER NOT NULL,
    "robot1_elo_after" INTEGER NOT NULL,
    "robot2_elo_after" INTEGER NOT NULL,
    "elo_change" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "battles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_username_idx" ON "users"("username");

-- CreateIndex
CREATE INDEX "facilities_user_id_idx" ON "facilities"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "facilities_user_id_facility_type_key" ON "facilities"("user_id", "facility_type");

-- CreateIndex
CREATE INDEX "robots_user_id_idx" ON "robots"("user_id");

-- CreateIndex
CREATE INDEX "robots_elo_idx" ON "robots"("elo");

-- CreateIndex
CREATE INDEX "robots_current_league_idx" ON "robots"("current_league");

-- CreateIndex
CREATE INDEX "weapon_inventory_user_id_idx" ON "weapon_inventory"("user_id");

-- CreateIndex
CREATE INDEX "weapon_inventory_weapon_id_idx" ON "weapon_inventory"("weapon_id");

-- CreateIndex
CREATE INDEX "battles_user_id_idx" ON "battles"("user_id");

-- CreateIndex
CREATE INDEX "battles_robot1_id_idx" ON "battles"("robot1_id");

-- CreateIndex
CREATE INDEX "battles_robot2_id_idx" ON "battles"("robot2_id");

-- CreateIndex
CREATE INDEX "battles_created_at_idx" ON "battles"("created_at");

-- AddForeignKey
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "robots" ADD CONSTRAINT "robots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "robots" ADD CONSTRAINT "robots_main_weapon_id_fkey" FOREIGN KEY ("main_weapon_id") REFERENCES "weapon_inventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "robots" ADD CONSTRAINT "robots_offhand_weapon_id_fkey" FOREIGN KEY ("offhand_weapon_id") REFERENCES "weapon_inventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weapon_inventory" ADD CONSTRAINT "weapon_inventory_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weapon_inventory" ADD CONSTRAINT "weapon_inventory_weapon_id_fkey" FOREIGN KEY ("weapon_id") REFERENCES "weapons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battles" ADD CONSTRAINT "battles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battles" ADD CONSTRAINT "battles_robot1_id_fkey" FOREIGN KEY ("robot1_id") REFERENCES "robots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battles" ADD CONSTRAINT "battles_robot2_id_fkey" FOREIGN KEY ("robot2_id") REFERENCES "robots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
