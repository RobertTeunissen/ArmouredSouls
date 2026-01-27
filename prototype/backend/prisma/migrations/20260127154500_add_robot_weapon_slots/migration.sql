-- AlterTable: Add weapon slot columns and loadout type to robots table
ALTER TABLE "robots" ADD COLUMN "main_weapon_id" INTEGER;
ALTER TABLE "robots" ADD COLUMN "offhand_weapon_id" INTEGER;
ALTER TABLE "robots" ADD COLUMN "loadout_type" VARCHAR(20) NOT NULL DEFAULT 'single';

-- AddForeignKey: Link main_weapon_id to weapon_inventory
ALTER TABLE "robots" ADD CONSTRAINT "robots_main_weapon_id_fkey" FOREIGN KEY ("main_weapon_id") REFERENCES "weapon_inventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Link offhand_weapon_id to weapon_inventory
ALTER TABLE "robots" ADD CONSTRAINT "robots_offhand_weapon_id_fkey" FOREIGN KEY ("offhand_weapon_id") REFERENCES "weapon_inventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
