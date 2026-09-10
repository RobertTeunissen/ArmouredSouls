-- Spec #54: make every required JSON field explicit before delegating to the
-- original arithmetic validator. PostgreSQL NULL boolean semantics otherwise
-- let missing nested fields bypass an OR-based rejection expression.
ALTER FUNCTION finance_report_breakdown_is_valid(JSONB, TEXT)
  RENAME TO finance_report_breakdown_is_valid_legacy;

CREATE FUNCTION finance_report_breakdown_is_valid(
  p_metadata JSONB,
  p_expected_transaction_type TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
  item JSONB;
  component JSONB;
  mode_value TEXT;
BEGIN
  IF NOT COALESCE(
    jsonb_typeof(p_metadata) = 'object'
    AND p_metadata->>'transactionType' = p_expected_transaction_type
    AND p_metadata->>'schemaVersion' = '1'
    AND jsonb_typeof(p_metadata->'formula') = 'string' AND p_metadata->>'formula' <> ''
    AND jsonb_typeof(p_metadata->'formulaVersion') = 'string' AND p_metadata->>'formulaVersion' <> ''
    AND jsonb_typeof(p_metadata->'sourceEventId') = 'string' AND p_metadata->>'sourceEventId' <> ''
    AND jsonb_typeof(p_metadata->'finalAmount') = 'number'
    AND jsonb_typeof(p_metadata->'inputs') = 'array'
    AND jsonb_typeof(p_metadata->'modifiers') = 'array'
    AND jsonb_typeof(p_metadata->'rounding') = 'object'
    AND jsonb_typeof(p_metadata->'rounding'->'precision') = 'number'
    AND jsonb_typeof(p_metadata->'rounding'->'operationOrder') = 'array'
    AND p_metadata->'rounding'->>'mode' IN ('none', 'round', 'floor', 'ceil', 'trunc')
    AND p_metadata->'rounding'->>'scope' IN ('per_item', 'aggregate'), FALSE) THEN
    RETURN FALSE;
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_metadata->'inputs') LOOP
    IF NOT COALESCE(
      jsonb_typeof(item) = 'object'
      AND jsonb_typeof(item->'name') = 'string' AND item->>'name' <> ''
      AND jsonb_typeof(item->'value') IN ('null', 'string', 'boolean', 'number')
      AND jsonb_typeof(item->'unit') = 'string' AND item->>'unit' <> ''
      AND jsonb_typeof(item->'source') = 'string' AND item->>'source' <> '', FALSE) THEN
      RETURN FALSE;
    END IF;
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(p_metadata->'modifiers') LOOP
    IF NOT COALESCE(
      jsonb_typeof(item) = 'object'
      AND jsonb_typeof(item->'name') = 'string' AND item->>'name' <> ''
      AND jsonb_typeof(item->'value') = 'number'
      AND jsonb_typeof(item->'unit') = 'string' AND item->>'unit' <> ''
      AND jsonb_typeof(item->'source') = 'string' AND item->>'source' <> ''
      AND jsonb_typeof(item->'applied') = 'boolean', FALSE) THEN
      RETURN FALSE;
    END IF;
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(p_metadata->'rounding'->'operationOrder') LOOP
    IF NOT COALESCE(jsonb_typeof(item) = 'string' AND item #>> '{}' <> '', FALSE) THEN
      RETURN FALSE;
    END IF;
  END LOOP;

  IF p_expected_transaction_type = 'battle_income' THEN
    IF NOT COALESCE(
      jsonb_typeof(p_metadata->'mode') = 'string' AND p_metadata->>'mode' <> ''
      AND jsonb_typeof(p_metadata->'tier') IN ('string', 'number')
      AND jsonb_typeof(p_metadata->'outcome') = 'string' AND p_metadata->>'outcome' <> ''
      AND jsonb_typeof(p_metadata->'placement') IN ('null', 'number')
      AND jsonb_typeof(p_metadata->'participationFloor') = 'number'
      AND jsonb_typeof(p_metadata->'winComponent') = 'number'
      AND jsonb_typeof(p_metadata->'teamSize') = 'number'
      AND p_metadata->>'stableAggregation' = 'stable'
      AND jsonb_typeof(p_metadata->'isBye') = 'boolean', FALSE) THEN
      RETURN FALSE;
    END IF;
    mode_value := p_metadata->>'mode';
    IF mode_value IN ('koth', 'grand_melee') AND p_metadata->>'outcome' = 'placement' THEN
      IF jsonb_typeof(p_metadata->'placementRewardComponents') <> 'array' OR jsonb_array_length(p_metadata->'placementRewardComponents') = 0 THEN
        RETURN FALSE;
      END IF;
      FOR component IN SELECT value FROM jsonb_array_elements(p_metadata->'placementRewardComponents') LOOP
        IF NOT COALESCE(
          jsonb_typeof(component) = 'object'
          AND component->>'mode' = mode_value
          AND jsonb_typeof(component->'robotId') = 'number'
          AND jsonb_typeof(component->'tier') IN ('string', 'number')
          AND jsonb_typeof(component->'placement') = 'number'
          AND jsonb_typeof(component->'credits') = 'number'
          AND jsonb_typeof(component->'tierBaseReward') = 'number'
          AND jsonb_typeof(component->'modeBaseMultiplier') = 'number'
          AND jsonb_typeof(component->'placementMultiplier') = 'number', FALSE) THEN
          RETURN FALSE;
        END IF;
        IF mode_value = 'koth' AND NOT COALESCE(
          jsonb_typeof(component->'zoneScore') = 'number'
          AND jsonb_typeof(component->'zoneTime') = 'number'
          AND jsonb_typeof(component->'uncontestedScore') = 'number'
          AND jsonb_typeof(component->'zoneDominanceBonus') = 'boolean'
          AND jsonb_typeof(component->'zoneDominanceMultiplier') = 'number', FALSE) THEN
          RETURN FALSE;
        END IF;
        IF mode_value = 'grand_melee' AND NOT COALESCE(
          jsonb_typeof(component->'totalParticipants') = 'number'
          AND jsonb_typeof(component->'participationFloorApplied') = 'boolean'
          AND jsonb_typeof(component->'participationFloorMultiplier') = 'number', FALSE) THEN
          RETURN FALSE;
        END IF;
      END LOOP;
    ELSIF p_metadata ? 'placementRewardComponents' THEN
      RETURN FALSE;
    END IF;
  ELSIF p_expected_transaction_type = 'streaming_revenue' THEN
    IF NOT COALESCE(
      jsonb_typeof(p_metadata->'battleId') IN ('string', 'number')
      AND jsonb_typeof(p_metadata->'robotId') = 'number'
      AND jsonb_typeof(p_metadata->'mode') = 'string' AND p_metadata->>'mode' <> ''
      AND jsonb_typeof(p_metadata->'eligible') = 'boolean' AND p_metadata->>'eligible' = 'true'
      AND jsonb_typeof(p_metadata->'baseAmount') = 'number'
      AND jsonb_typeof(p_metadata->'battleMultiplier') = 'number'
      AND jsonb_typeof(p_metadata->'fameMultiplier') = 'number'
      AND jsonb_typeof(p_metadata->'studioMultiplier') = 'number'
      AND jsonb_typeof(p_metadata->'totalRevenue') = 'number', FALSE) THEN
      RETURN FALSE;
    END IF;
  ELSIF p_expected_transaction_type = 'repair_cost' THEN
    IF NOT COALESCE(
      p_metadata->>'repairType' IN ('manual', 'automatic')
      AND jsonb_typeof(p_metadata->'robotId') = 'number'
      AND jsonb_typeof(p_metadata->'baseQuote') = 'number'
      AND jsonb_typeof(p_metadata->'damageRepaired') = 'number'
      AND jsonb_typeof(p_metadata->'repairBayLevel') = 'number'
      AND jsonb_typeof(p_metadata->'activeRobotCount') = 'number'
      AND jsonb_typeof(p_metadata->'repairBayDiscountPercent') = 'number'
      AND jsonb_typeof(p_metadata->'manualRepairDiscountPercent') = 'number'
      AND jsonb_typeof(p_metadata->'quoteBeforeManualDiscount') = 'number'
      AND jsonb_typeof(p_metadata->'perRobotCharge') = 'number', FALSE) THEN
      RETURN FALSE;
    END IF;
  ELSE
    RETURN FALSE;
  END IF;

  RETURN COALESCE(finance_report_breakdown_is_valid_legacy(p_metadata, p_expected_transaction_type), FALSE);
END;
$$;
