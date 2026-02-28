-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(20),
    "password_hash" VARCHAR(255) NOT NULL,
    "role" VARCHAR(20) NOT NULL DEFAULT 'user',
    "currency" INTEGER NOT NULL DEFAULT 3000000,
    "prestige" INTEGER NOT NULL DEFAULT 0,
    "championship_titles" INTEGER NOT NULL DEFAULT 0,
    "stable_name" VARCHAR(30),
    "profile_visibility" VARCHAR(10) NOT NULL DEFAULT 'public',
    "notifications_battle" BOOLEAN NOT NULL DEFAULT true,
    "notifications_league" BOOLEAN NOT NULL DEFAULT true,
    "theme_preference" VARCHAR(20) NOT NULL DEFAULT 'dark',
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
    "combat_power" DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    "targeting_systems" DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    "critical_systems" DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    "penetration" DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    "weapon_control" DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    "attack_speed" DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    "armor_plating" DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    "shield_capacity" DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    "evasion_thrusters" DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    "damage_dampeners" DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    "counter_protocols" DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    "hull_integrity" DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    "servo_motors" DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    "gyro_stabilizers" DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    "hydraulic_systems" DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    "power_core" DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    "combat_algorithms" DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    "threat_analysis" DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    "adaptive_ai" DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    "logic_cores" DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    "sync_protocols" DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    "support_systems" DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    "formation_tactics" DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    "current_hp" INTEGER NOT NULL,
    "max_hp" INTEGER NOT NULL,
    "current_shield" INTEGER NOT NULL,
    "max_shield" INTEGER NOT NULL,
    "damage_taken" INTEGER NOT NULL DEFAULT 0,
    "elo" INTEGER NOT NULL DEFAULT 1200,
    "total_battles" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "damage_dealt_lifetime" INTEGER NOT NULL DEFAULT 0,
    "damage_taken_lifetime" INTEGER NOT NULL DEFAULT 0,
    "kills" INTEGER NOT NULL DEFAULT 0,
    "current_league" VARCHAR(20) NOT NULL DEFAULT 'bronze',
    "league_id" VARCHAR(30) NOT NULL DEFAULT 'bronze_1',
    "league_points" INTEGER NOT NULL DEFAULT 0,
    "cycles_in_current_league" INTEGER NOT NULL DEFAULT 0,
    "fame" INTEGER NOT NULL DEFAULT 0,
    "titles" TEXT,
    "total_tag_team_battles" INTEGER NOT NULL DEFAULT 0,
    "total_tag_team_wins" INTEGER NOT NULL DEFAULT 0,
    "total_tag_team_losses" INTEGER NOT NULL DEFAULT 0,
    "total_tag_team_draws" INTEGER NOT NULL DEFAULT 0,
    "times_tagged_in" INTEGER NOT NULL DEFAULT 0,
    "times_tagged_out" INTEGER NOT NULL DEFAULT 0,
    "repair_cost" INTEGER NOT NULL DEFAULT 0,
    "battle_readiness" INTEGER NOT NULL DEFAULT 100,
    "total_repairs_paid" INTEGER NOT NULL DEFAULT 0,
    "yield_threshold" INTEGER NOT NULL DEFAULT 10,
    "loadout_type" VARCHAR(20) NOT NULL DEFAULT 'single',
    "stance" VARCHAR(20) NOT NULL DEFAULT 'balanced',
    "main_weapon_id" INTEGER,
    "offhand_weapon_id" INTEGER,
    "image_url" VARCHAR(255),
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
CREATE TABLE "battle_participants" (
    "id" SERIAL NOT NULL,
    "battle_id" INTEGER NOT NULL,
    "robot_id" INTEGER NOT NULL,
    "team" INTEGER NOT NULL,
    "role" VARCHAR(20),
    "credits" INTEGER NOT NULL,
    "streaming_revenue" INTEGER NOT NULL DEFAULT 0,
    "elo_before" INTEGER NOT NULL,
    "elo_after" INTEGER NOT NULL,
    "prestige_awarded" INTEGER NOT NULL DEFAULT 0,
    "fame_awarded" INTEGER NOT NULL DEFAULT 0,
    "damage_dealt" INTEGER NOT NULL DEFAULT 0,
    "final_hp" INTEGER NOT NULL,
    "yielded" BOOLEAN NOT NULL DEFAULT false,
    "destroyed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "battle_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battles" (
    "id" SERIAL NOT NULL,
    "robot1_id" INTEGER NOT NULL,
    "robot2_id" INTEGER NOT NULL,
    "winner_id" INTEGER,
    "battle_type" VARCHAR(20) NOT NULL,
    "league_type" VARCHAR(20) NOT NULL,
    "tournament_id" INTEGER,
    "tournament_round" INTEGER,
    "team1_active_robot_id" INTEGER,
    "team1_reserve_robot_id" INTEGER,
    "team2_active_robot_id" INTEGER,
    "team2_reserve_robot_id" INTEGER,
    "team1_tag_out_time" BIGINT,
    "team2_tag_out_time" BIGINT,
    "battle_log" JSONB NOT NULL,
    "duration_seconds" INTEGER NOT NULL,
    "winner_reward" INTEGER,
    "loser_reward" INTEGER,
    "team1_active_damage_dealt" INTEGER NOT NULL DEFAULT 0,
    "team1_reserve_damage_dealt" INTEGER NOT NULL DEFAULT 0,
    "team2_active_damage_dealt" INTEGER NOT NULL DEFAULT 0,
    "team2_reserve_damage_dealt" INTEGER NOT NULL DEFAULT 0,
    "team1_active_fame_awarded" INTEGER NOT NULL DEFAULT 0,
    "team1_reserve_fame_awarded" INTEGER NOT NULL DEFAULT 0,
    "team2_active_fame_awarded" INTEGER NOT NULL DEFAULT 0,
    "team2_reserve_fame_awarded" INTEGER NOT NULL DEFAULT 0,
    "robot1_elo_before" INTEGER NOT NULL,
    "robot2_elo_before" INTEGER NOT NULL,
    "robot1_elo_after" INTEGER NOT NULL,
    "robot2_elo_after" INTEGER NOT NULL,
    "elo_change" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "battles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_matches" (
    "id" SERIAL NOT NULL,
    "robot1_id" INTEGER NOT NULL,
    "robot2_id" INTEGER NOT NULL,
    "league_type" VARCHAR(20) NOT NULL,
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    "battle_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduled_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycle_metadata" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "total_cycles" INTEGER NOT NULL DEFAULT 0,
    "last_cycle_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cycle_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "cycle_number" INTEGER NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "event_timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sequence_number" INTEGER NOT NULL,
    "user_id" INTEGER,
    "robot_id" INTEGER,
    "battle_id" INTEGER,
    "payload" JSONB NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycle_snapshots" (
    "id" SERIAL NOT NULL,
    "cycle_number" INTEGER NOT NULL,
    "trigger_type" VARCHAR(20) NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "stable_metrics" JSONB NOT NULL,
    "robot_metrics" JSONB NOT NULL,
    "step_durations" JSONB NOT NULL,
    "total_battles" INTEGER NOT NULL DEFAULT 0,
    "total_credits_transacted" BIGINT NOT NULL DEFAULT 0,
    "total_prestige_awarded" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cycle_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournaments" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "tournament_type" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "current_round" INTEGER NOT NULL DEFAULT 1,
    "max_rounds" INTEGER NOT NULL,
    "total_participants" INTEGER NOT NULL,
    "winner_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_matches" (
    "id" SERIAL NOT NULL,
    "tournament_id" INTEGER NOT NULL,
    "round" INTEGER NOT NULL,
    "match_number" INTEGER NOT NULL,
    "robot1_id" INTEGER,
    "robot2_id" INTEGER,
    "winner_id" INTEGER,
    "battle_id" INTEGER,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "is_bye_match" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "tournament_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag_teams" (
    "id" SERIAL NOT NULL,
    "stable_id" INTEGER NOT NULL,
    "active_robot_id" INTEGER NOT NULL,
    "reserve_robot_id" INTEGER NOT NULL,
    "tag_team_league" VARCHAR(20) NOT NULL DEFAULT 'bronze',
    "tag_team_league_id" VARCHAR(30) NOT NULL DEFAULT 'bronze_1',
    "tag_team_league_points" INTEGER NOT NULL DEFAULT 0,
    "cycles_in_tag_team_league" INTEGER NOT NULL DEFAULT 0,
    "total_tag_team_wins" INTEGER NOT NULL DEFAULT 0,
    "total_tag_team_losses" INTEGER NOT NULL DEFAULT 0,
    "total_tag_team_draws" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tag_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag_team_matches" (
    "id" SERIAL NOT NULL,
    "team1_id" INTEGER NOT NULL,
    "team2_id" INTEGER,
    "tag_team_league" VARCHAR(20) NOT NULL,
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    "battle_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tag_team_matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_stable_name_key" ON "users"("stable_name");

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
CREATE INDEX "robots_current_league_league_id_idx" ON "robots"("current_league", "league_id");

-- CreateIndex
CREATE UNIQUE INDEX "robots_user_id_name_key" ON "robots"("user_id", "name");

-- CreateIndex
CREATE INDEX "weapon_inventory_user_id_idx" ON "weapon_inventory"("user_id");

-- CreateIndex
CREATE INDEX "weapon_inventory_weapon_id_idx" ON "weapon_inventory"("weapon_id");

-- CreateIndex
CREATE INDEX "battle_participants_battle_id_idx" ON "battle_participants"("battle_id");

-- CreateIndex
CREATE INDEX "battle_participants_robot_id_idx" ON "battle_participants"("robot_id");

-- CreateIndex
CREATE INDEX "battle_participants_battle_id_team_idx" ON "battle_participants"("battle_id", "team");

-- CreateIndex
CREATE UNIQUE INDEX "battle_participants_battle_id_robot_id_key" ON "battle_participants"("battle_id", "robot_id");

-- CreateIndex
CREATE INDEX "battles_robot1_id_idx" ON "battles"("robot1_id");

-- CreateIndex
CREATE INDEX "battles_robot2_id_idx" ON "battles"("robot2_id");

-- CreateIndex
CREATE INDEX "battles_created_at_idx" ON "battles"("created_at");

-- CreateIndex
CREATE INDEX "battles_tournament_id_idx" ON "battles"("tournament_id");

-- CreateIndex
CREATE INDEX "battles_battle_type_idx" ON "battles"("battle_type");

-- CreateIndex
CREATE INDEX "scheduled_matches_robot1_id_idx" ON "scheduled_matches"("robot1_id");

-- CreateIndex
CREATE INDEX "scheduled_matches_robot2_id_idx" ON "scheduled_matches"("robot2_id");

-- CreateIndex
CREATE INDEX "scheduled_matches_scheduled_for_status_idx" ON "scheduled_matches"("scheduled_for", "status");

-- CreateIndex
CREATE INDEX "scheduled_matches_status_idx" ON "scheduled_matches"("status");

-- CreateIndex
CREATE INDEX "audit_logs_cycle_number_idx" ON "audit_logs"("cycle_number");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_robot_id_idx" ON "audit_logs"("robot_id");

-- CreateIndex
CREATE INDEX "audit_logs_battle_id_idx" ON "audit_logs"("battle_id");

-- CreateIndex
CREATE INDEX "audit_logs_event_type_idx" ON "audit_logs"("event_type");

-- CreateIndex
CREATE INDEX "audit_logs_event_timestamp_idx" ON "audit_logs"("event_timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_cycle_number_user_id_idx" ON "audit_logs"("cycle_number", "user_id");

-- CreateIndex
CREATE INDEX "audit_logs_cycle_number_robot_id_idx" ON "audit_logs"("cycle_number", "robot_id");

-- CreateIndex
CREATE INDEX "audit_logs_cycle_number_battle_id_idx" ON "audit_logs"("cycle_number", "battle_id");

-- CreateIndex
CREATE INDEX "audit_logs_cycle_number_event_type_idx" ON "audit_logs"("cycle_number", "event_type");

-- CreateIndex
CREATE UNIQUE INDEX "audit_logs_cycle_number_sequence_number_key" ON "audit_logs"("cycle_number", "sequence_number");

-- CreateIndex
CREATE UNIQUE INDEX "cycle_snapshots_cycle_number_key" ON "cycle_snapshots"("cycle_number");

-- CreateIndex
CREATE INDEX "cycle_snapshots_cycle_number_idx" ON "cycle_snapshots"("cycle_number");

-- CreateIndex
CREATE INDEX "cycle_snapshots_start_time_idx" ON "cycle_snapshots"("start_time");

-- CreateIndex
CREATE INDEX "tournaments_status_idx" ON "tournaments"("status");

-- CreateIndex
CREATE INDEX "tournaments_winner_id_idx" ON "tournaments"("winner_id");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_matches_battle_id_key" ON "tournament_matches"("battle_id");

-- CreateIndex
CREATE INDEX "tournament_matches_tournament_id_round_idx" ON "tournament_matches"("tournament_id", "round");

-- CreateIndex
CREATE INDEX "tournament_matches_status_idx" ON "tournament_matches"("status");

-- CreateIndex
CREATE INDEX "tournament_matches_robot1_id_idx" ON "tournament_matches"("robot1_id");

-- CreateIndex
CREATE INDEX "tournament_matches_robot2_id_idx" ON "tournament_matches"("robot2_id");

-- CreateIndex
CREATE INDEX "tag_teams_stable_id_idx" ON "tag_teams"("stable_id");

-- CreateIndex
CREATE INDEX "tag_teams_tag_team_league_tag_team_league_id_idx" ON "tag_teams"("tag_team_league", "tag_team_league_id");

-- CreateIndex
CREATE INDEX "tag_teams_active_robot_id_idx" ON "tag_teams"("active_robot_id");

-- CreateIndex
CREATE INDEX "tag_teams_reserve_robot_id_idx" ON "tag_teams"("reserve_robot_id");

-- CreateIndex
CREATE UNIQUE INDEX "tag_teams_active_robot_id_reserve_robot_id_key" ON "tag_teams"("active_robot_id", "reserve_robot_id");

-- CreateIndex
CREATE INDEX "tag_team_matches_team1_id_idx" ON "tag_team_matches"("team1_id");

-- CreateIndex
CREATE INDEX "tag_team_matches_team2_id_idx" ON "tag_team_matches"("team2_id");

-- CreateIndex
CREATE INDEX "tag_team_matches_scheduled_for_status_idx" ON "tag_team_matches"("scheduled_for", "status");

-- CreateIndex
CREATE INDEX "tag_team_matches_status_idx" ON "tag_team_matches"("status");

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
ALTER TABLE "battle_participants" ADD CONSTRAINT "battle_participants_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "battles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_participants" ADD CONSTRAINT "battle_participants_robot_id_fkey" FOREIGN KEY ("robot_id") REFERENCES "robots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battles" ADD CONSTRAINT "battles_robot1_id_fkey" FOREIGN KEY ("robot1_id") REFERENCES "robots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battles" ADD CONSTRAINT "battles_robot2_id_fkey" FOREIGN KEY ("robot2_id") REFERENCES "robots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battles" ADD CONSTRAINT "battles_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_matches" ADD CONSTRAINT "scheduled_matches_robot1_id_fkey" FOREIGN KEY ("robot1_id") REFERENCES "robots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_matches" ADD CONSTRAINT "scheduled_matches_robot2_id_fkey" FOREIGN KEY ("robot2_id") REFERENCES "robots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_matches" ADD CONSTRAINT "scheduled_matches_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "battles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "robots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_robot1_id_fkey" FOREIGN KEY ("robot1_id") REFERENCES "robots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_robot2_id_fkey" FOREIGN KEY ("robot2_id") REFERENCES "robots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "robots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "battles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_teams" ADD CONSTRAINT "tag_teams_stable_id_fkey" FOREIGN KEY ("stable_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_teams" ADD CONSTRAINT "tag_teams_active_robot_id_fkey" FOREIGN KEY ("active_robot_id") REFERENCES "robots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_teams" ADD CONSTRAINT "tag_teams_reserve_robot_id_fkey" FOREIGN KEY ("reserve_robot_id") REFERENCES "robots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_team_matches" ADD CONSTRAINT "tag_team_matches_team1_id_fkey" FOREIGN KEY ("team1_id") REFERENCES "tag_teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_team_matches" ADD CONSTRAINT "tag_team_matches_team2_id_fkey" FOREIGN KEY ("team2_id") REFERENCES "tag_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_team_matches" ADD CONSTRAINT "tag_team_matches_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "battles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
