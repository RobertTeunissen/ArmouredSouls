-- AlterTable: Add optional email column to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" VARCHAR(50);

-- Ensure email column is VARCHAR(50) even if it was previously created with a smaller size
ALTER TABLE "users" ALTER COLUMN "email" TYPE VARCHAR(50);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");
