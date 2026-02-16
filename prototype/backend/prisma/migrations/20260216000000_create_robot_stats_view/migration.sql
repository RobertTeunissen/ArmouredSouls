-- CreateMaterializedView: robot_current_stats
-- Aggregates current robot statistics from the battles table for fast leaderboard queries

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
  -- Damage statistics
  COALESCE(SUM(CASE WHEN b.robot1_id = r.id THEN b.robot1_damage_dealt ELSE 0 END), 0) +
  COALESCE(SUM(CASE WHEN b.robot2_id = r.id THEN b.robot2_damage_dealt ELSE 0 END), 0) as total_damage_dealt,
  COALESCE(SUM(CASE WHEN b.robot1_id = r.id THEN b.robot2_damage_dealt ELSE 0 END), 0) +
  COALESCE(SUM(CASE WHEN b.robot2_id = r.id THEN b.robot1_damage_dealt ELSE 0 END), 0) as total_damage_received,
  -- Kills (opponent destroyed)
  COUNT(DISTINCT CASE WHEN b.robot1_id = r.id AND b.robot2_final_hp = 0 THEN b.id END) +
  COUNT(DISTINCT CASE WHEN b.robot2_id = r.id AND b.robot1_final_hp = 0 THEN b.id END) as total_kills,
  -- Earnings
  COALESCE(SUM(CASE 
    WHEN b.robot1_id = r.id AND b.winner_id = r.id THEN b.winner_reward
    WHEN b.robot1_id = r.id AND b.winner_id != r.id THEN b.loser_reward
    WHEN b.robot2_id = r.id AND b.winner_id = r.id THEN b.winner_reward
    WHEN b.robot2_id = r.id AND b.winner_id != r.id THEN b.loser_reward
    ELSE 0
  END), 0) as total_credits_earned,
  COALESCE(SUM(CASE WHEN b.robot1_id = r.id THEN b.robot1_fame_awarded ELSE 0 END), 0) +
  COALESCE(SUM(CASE WHEN b.robot2_id = r.id THEN b.robot2_fame_awarded ELSE 0 END), 0) as total_fame_earned,
  -- Last battle timestamp
  MAX(b.created_at) as last_battle_at
FROM robots r
LEFT JOIN battles b ON (b.robot1_id = r.id OR b.robot2_id = r.id)
GROUP BY r.id, r.name, r.user_id, r.elo;

-- Create indexes for common queries
CREATE INDEX idx_robot_stats_elo ON robot_current_stats(current_elo DESC);
CREATE INDEX idx_robot_stats_win_rate ON robot_current_stats(win_rate DESC);
CREATE INDEX idx_robot_stats_user ON robot_current_stats(user_id);
CREATE INDEX idx_robot_stats_battles ON robot_current_stats(total_battles DESC);
CREATE INDEX idx_robot_stats_kills ON robot_current_stats(total_kills DESC);
CREATE INDEX idx_robot_stats_damage_dealt ON robot_current_stats(total_damage_dealt DESC);
