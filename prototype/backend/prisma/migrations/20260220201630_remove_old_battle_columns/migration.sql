-- Drop materialized view that depends on old battle columns
DROP MATERIALIZED VIEW IF EXISTS robot_current_stats CASCADE;

-- Remove old per-robot columns from battles table
-- These are now stored in the battle_participants table

-- Remove prestige and fame columns
ALTER TABLE "battles" DROP COLUMN IF EXISTS "robot1_prestige_awarded";
ALTER TABLE "battles" DROP COLUMN IF EXISTS "robot2_prestige_awarded";
ALTER TABLE "battles" DROP COLUMN IF EXISTS "robot1_fame_awarded";
ALTER TABLE "battles" DROP COLUMN IF EXISTS "robot2_fame_awarded";

-- Remove final state columns
ALTER TABLE "battles" DROP COLUMN IF EXISTS "robot1_final_hp";
ALTER TABLE "battles" DROP COLUMN IF EXISTS "robot2_final_hp";
ALTER TABLE "battles" DROP COLUMN IF EXISTS "robot1_yielded";
ALTER TABLE "battles" DROP COLUMN IF EXISTS "robot2_yielded";
ALTER TABLE "battles" DROP COLUMN IF EXISTS "robot1_destroyed";
ALTER TABLE "battles" DROP COLUMN IF EXISTS "robot2_destroyed";

-- Remove damage tracking columns
ALTER TABLE "battles" DROP COLUMN IF EXISTS "robot1_damage_dealt";
ALTER TABLE "battles" DROP COLUMN IF EXISTS "robot2_damage_dealt";

-- Recreate materialized view using BattleParticipant table
CREATE MATERIALIZED VIEW robot_current_stats AS
SELECT 
  r.id as robot_id,
  r.name as robot_name,
  r.user_id,
  -- Current ELO from robot table
  r.elo as current_elo,
  -- Battle statistics
  COUNT(DISTINCT b.id) as total_battles,
  COUNT(DISTINCT CASE WHEN b.winner_id = r.id THEN b.id END) as wins,
  COUNT(DISTINCT CASE WHEN b.winner_id IS NULL THEN b.id END) as draws,
  COUNT(DISTINCT CASE WHEN b.winner_id IS NOT NULL AND b.winner_id != r.id THEN b.id END) as losses,
  -- Win rate
  CASE WHEN COUNT(DISTINCT b.id) > 0 
    THEN CAST(COUNT(DISTINCT CASE WHEN b.winner_id = r.id THEN b.id END) AS FLOAT) / COUNT(DISTINCT b.id)
    ELSE 0 
  END as win_rate,
  -- Damage statistics from BattleParticipant
  COALESCE(SUM(bp.damage_dealt), 0) as total_damage_dealt,
  COALESCE(SUM(
    CASE 
      WHEN bp.robot_id = r.id THEN (
        SELECT COALESCE(SUM(bp2.damage_dealt), 0)
        FROM battle_participants bp2
        WHERE bp2.battle_id = bp.battle_id AND bp2.robot_id != r.id
      )
      ELSE 0
    END
  ), 0) as total_damage_received,
  -- Kills (opponent destroyed) from BattleParticipant
  COUNT(DISTINCT CASE 
    WHEN EXISTS (
      SELECT 1 FROM battle_participants bp_opp
      WHERE bp_opp.battle_id = b.id 
        AND bp_opp.robot_id != r.id 
        AND bp_opp.destroyed = true
        AND b.winner_id = r.id
    ) THEN b.id 
  END) as total_kills,
  -- Earnings from BattleParticipant
  COALESCE(SUM(bp.credits), 0) as total_credits_earned,
  COALESCE(SUM(bp.fame_awarded), 0) as total_fame_earned,
  -- Last battle timestamp
  MAX(b.created_at) as last_battle_at
FROM robots r
LEFT JOIN battles b ON (b.robot1_id = r.id OR b.robot2_id = r.id)
LEFT JOIN battle_participants bp ON (bp.battle_id = b.id AND bp.robot_id = r.id)
GROUP BY r.id, r.name, r.user_id, r.elo;

-- Create indexes for common queries
CREATE INDEX idx_robot_stats_elo ON robot_current_stats(current_elo DESC);
CREATE INDEX idx_robot_stats_win_rate ON robot_current_stats(win_rate DESC);
CREATE INDEX idx_robot_stats_user ON robot_current_stats(user_id);
CREATE INDEX idx_robot_stats_battles ON robot_current_stats(total_battles DESC);
CREATE INDEX idx_robot_stats_kills ON robot_current_stats(total_kills DESC);
CREATE INDEX idx_robot_stats_damage_dealt ON robot_current_stats(total_damage_dealt DESC);
