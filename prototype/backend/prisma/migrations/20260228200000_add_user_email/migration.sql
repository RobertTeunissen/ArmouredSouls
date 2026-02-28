-- AlterTable: Add optional email column to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" VARCHAR(20);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");
