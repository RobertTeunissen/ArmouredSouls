-- CreateIndex
-- Add unique constraint on robots table for userId and name combination
-- This ensures each user can only have one robot with a given name
CREATE UNIQUE INDEX "robots_user_id_name_key" ON "robots"("user_id", "name");
