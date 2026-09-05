-- Spec #53: add forward-only financial and prestige event identities.
--
-- These columns are nullable by design. Existing rows remain immutable
-- Legacy_Record values and are not backfilled, paired, or reclassified.
ALTER TABLE "financial_ledger"
  ADD COLUMN "financial_event_id" VARCHAR(191);

ALTER TABLE "audit_logs"
  ADD COLUMN "financial_event_id" VARCHAR(191),
  ADD COLUMN "source_event_id" VARCHAR(191);

-- The columns are new, so this is normally a no-op. Keep the diagnostic in the
-- migration so a restored database with pre-created values fails explicitly
-- before the uniqueness contract is installed; it never rewrites old rows.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "financial_ledger"
    WHERE "financial_event_id" IS NOT NULL
    GROUP BY "financial_event_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate financial_event_id values exist in financial_ledger';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "audit_logs"
    WHERE "financial_event_id" IS NOT NULL
    GROUP BY "event_type", "financial_event_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate (event_type, financial_event_id) values exist in audit_logs';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "audit_logs"
    WHERE "source_event_id" IS NOT NULL
    GROUP BY "event_type", "source_event_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate (event_type, source_event_id) values exist in audit_logs';
  END IF;
END $$;

CREATE UNIQUE INDEX "financial_ledger_financial_event_id_key"
  ON "financial_ledger"("financial_event_id");

CREATE UNIQUE INDEX "audit_logs_event_type_financial_event_id_key"
  ON "audit_logs"("event_type", "financial_event_id");

CREATE UNIQUE INDEX "audit_logs_event_type_source_event_id_key"
  ON "audit_logs"("event_type", "source_event_id");

CREATE INDEX "audit_logs_financial_event_id_idx"
  ON "audit_logs"("financial_event_id");

CREATE INDEX "audit_logs_source_event_id_idx"
  ON "audit_logs"("source_event_id");
