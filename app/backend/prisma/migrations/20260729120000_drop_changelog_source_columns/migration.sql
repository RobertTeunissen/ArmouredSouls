-- Changelog auto-generation removed: entries are now authored by an admin only.
-- `source_type` / `source_ref` existed solely to track deploy-generated drafts
-- and to support the generator's idempotency lookup, so both columns and the
-- index over `source_ref` are dropped.

DROP INDEX IF EXISTS "changelog_entries_source_ref_idx";

ALTER TABLE "changelog_entries"
  DROP COLUMN IF EXISTS "source_type",
  DROP COLUMN IF EXISTS "source_ref";
