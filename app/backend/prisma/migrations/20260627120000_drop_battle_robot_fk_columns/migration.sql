-- Drop robot1_id / robot2_id FK constraints, indexes, and columns.
-- All battle queries now use battle_participants for robot lookups.
-- All battle creation no longer writes these columns.

-- Drop FK constraints
ALTER TABLE "battles" DROP CONSTRAINT IF EXISTS "battles_robot1_id_fkey";
ALTER TABLE "battles" DROP CONSTRAINT IF EXISTS "battles_robot2_id_fkey";

-- Drop indexes
DROP INDEX IF EXISTS "battles_robot1_id_idx";
DROP INDEX IF EXISTS "battles_robot2_id_idx";

-- Drop columns
ALTER TABLE "battles" DROP COLUMN IF EXISTS "robot1_id";
ALTER TABLE "battles" DROP COLUMN IF EXISTS "robot2_id";
