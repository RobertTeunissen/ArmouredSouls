-- CreateTable
CREATE TABLE "weapon_refinement" (
    "id" SERIAL NOT NULL,
    "weapon_inventory_id" INTEGER NOT NULL,
    "tier" VARCHAR(16) NOT NULL,
    "magnitude" INTEGER NOT NULL,
    "target_attribute" VARCHAR(64),
    "cost_paid" INTEGER NOT NULL,
    "slot_index" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weapon_refinement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "weapon_refinement_weapon_inventory_id_idx" ON "weapon_refinement"("weapon_inventory_id");

-- CreateIndex
CREATE UNIQUE INDEX "weapon_refinement_inv_slot_unique" ON "weapon_refinement"("weapon_inventory_id", "slot_index");

-- AddForeignKey
ALTER TABLE "weapon_refinement" ADD CONSTRAINT "weapon_refinement_weapon_inventory_id_fkey" FOREIGN KEY ("weapon_inventory_id") REFERENCES "weapon_inventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
