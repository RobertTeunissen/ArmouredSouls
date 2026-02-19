-- Remove unused fields from User table
ALTER TABLE "users" DROP COLUMN IF EXISTS "total_battles";
ALTER TABLE "users" DROP COLUMN IF EXISTS "total_wins";
ALTER TABLE "users" DROP COLUMN IF EXISTS "highest_elo";

-- Remove unused fields from Battle table  
ALTER TABLE "battles" DROP COLUMN IF EXISTS "user_id";
ALTER TABLE "battles" DROP COLUMN IF EXISTS "robot1_repair_cost";
ALTER TABLE "battles" DROP COLUMN IF EXISTS "robot2_repair_cost";
ALTER TABLE "battles" DROP COLUMN IF EXISTS "robot1_final_shield";
ALTER TABLE "battles" DROP COLUMN IF EXISTS "robot2_final_shield";
