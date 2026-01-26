/*
  Warnings:

  - You are about to drop the column `armor_piercing` on the `robots` table. All the data in the column will be lost.
  - You are about to drop the column `critical_circuits` on the `robots` table. All the data in the column will be lost.
  - You are about to drop the column `firepower` on the `robots` table. All the data in the column will be lost.
  - You are about to drop the column `firing_rate` on the `robots` table. All the data in the column will be lost.
  - You are about to drop the column `hydraulic_power` on the `robots` table. All the data in the column will be lost.
  - You are about to drop the column `shield_generator` on the `robots` table. All the data in the column will be lost.
  - You are about to drop the column `targeting_computer` on the `robots` table. All the data in the column will be lost.
  - You are about to drop the column `weapon_id` on the `robots` table. All the data in the column will be lost.
  - You are about to drop the column `weapon_stability` on the `robots` table. All the data in the column will be lost.
  - You are about to drop the column `elo` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `fame` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `armor_piercing_bonus` on the `weapons` table. All the data in the column will be lost.
  - You are about to drop the column `critical_circuits_bonus` on the `weapons` table. All the data in the column will be lost.
  - You are about to drop the column `firepower_bonus` on the `weapons` table. All the data in the column will be lost.
  - You are about to drop the column `firing_rate_bonus` on the `weapons` table. All the data in the column will be lost.
  - You are about to drop the column `hydraulic_power_bonus` on the `weapons` table. All the data in the column will be lost.
  - You are about to drop the column `shield_generator_bonus` on the `weapons` table. All the data in the column will be lost.
  - You are about to drop the column `targeting_computer_bonus` on the `weapons` table. All the data in the column will be lost.
  - You are about to drop the column `weapon_stability_bonus` on the `weapons` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "robots" DROP CONSTRAINT "robots_weapon_id_fkey";

-- AlterTable
ALTER TABLE "robots" DROP COLUMN "armor_piercing",
DROP COLUMN "critical_circuits",
DROP COLUMN "firepower",
DROP COLUMN "firing_rate",
DROP COLUMN "hydraulic_power",
DROP COLUMN "shield_generator",
DROP COLUMN "targeting_computer",
DROP COLUMN "weapon_id",
DROP COLUMN "weapon_stability",
ADD COLUMN     "attack_speed" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "combat_power" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "critical_systems" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "elo" INTEGER NOT NULL DEFAULT 1200,
ADD COLUMN     "hydraulic_systems" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "penetration" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "shield_capacity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "targeting_systems" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "weapon_control" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "weapon_inventory_id" INTEGER;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "elo",
DROP COLUMN "fame",
ALTER COLUMN "currency" SET DEFAULT 2000000;

-- AlterTable
ALTER TABLE "weapons" DROP COLUMN "armor_piercing_bonus",
DROP COLUMN "critical_circuits_bonus",
DROP COLUMN "firepower_bonus",
DROP COLUMN "firing_rate_bonus",
DROP COLUMN "hydraulic_power_bonus",
DROP COLUMN "shield_generator_bonus",
DROP COLUMN "targeting_computer_bonus",
DROP COLUMN "weapon_stability_bonus",
ADD COLUMN     "attack_speed_bonus" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "combat_power_bonus" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "critical_systems_bonus" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "hydraulic_systems_bonus" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "penetration_bonus" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shield_capacity_bonus" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "targeting_systems_bonus" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "weapon_control_bonus" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "weapon_inventory" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "weapon_id" INTEGER NOT NULL,
    "purchased_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weapon_inventory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "robots" ADD CONSTRAINT "robots_weapon_inventory_id_fkey" FOREIGN KEY ("weapon_inventory_id") REFERENCES "weapon_inventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weapon_inventory" ADD CONSTRAINT "weapon_inventory_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weapon_inventory" ADD CONSTRAINT "weapon_inventory_weapon_id_fkey" FOREIGN KEY ("weapon_id") REFERENCES "weapons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
