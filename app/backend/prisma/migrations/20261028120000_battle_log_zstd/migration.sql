-- zstd-compressed combat logs (services/battle/battleLogCodec.ts).
-- battle_log_zst: one zstd frame of the log's JSON. battle_log_meta: small
-- uncompressed descriptor (codec, level, raw size, KotH/GM storage marker).
-- The jsonb battle_log column stays as a read-only fallback until its last
-- log passes the retention window; a later migration drops it.

-- AlterTable
ALTER TABLE "battles" ADD COLUMN     "battle_log_meta" JSONB,
ADD COLUMN     "battle_log_zst" BYTEA;

-- The bytes are already compressed: store them out of line without letting
-- pglz try (and fail) to compress them again. Prisma does not model column
-- storage, so this does not affect the migrate-diff drift check.
ALTER TABLE "battles" ALTER COLUMN "battle_log_zst" SET STORAGE EXTERNAL;
