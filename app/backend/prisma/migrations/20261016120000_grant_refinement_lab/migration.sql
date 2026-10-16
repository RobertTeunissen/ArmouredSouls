-- Season 2 one-off grant: the Refinement Lab takes over the refinement tier
-- gates (hone L1, augment L3, sharpen L5, forge L8) from the Weapons Workshop.
-- Each stable gets the Refinement Lab at its current Weapons Workshop level so
-- no unlocked refinement tier is lost. Data only, no schema change.
--
-- Idempotent: an existing Refinement Lab row is never touched
-- (ON CONFLICT on the (user_id, facility_type) unique key). No ledger rows are
-- written: a grant is not a purchase.
INSERT INTO "facilities" ("user_id", "facility_type", "level", "max_level", "created_at", "updated_at")
SELECT "user_id", 'refinement_lab', "level", 10, NOW(), NOW()
FROM "facilities"
WHERE "facility_type" = 'weapons_workshop' AND "level" > 0
ON CONFLICT ("user_id", "facility_type") DO NOTHING;
