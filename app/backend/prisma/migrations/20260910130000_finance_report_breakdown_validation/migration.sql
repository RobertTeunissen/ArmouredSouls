-- Spec #54: keep the database-bounded robot detail query on the same
-- fail-closed Financial_Breakdown boundary as the TypeScript report reader.
CREATE OR REPLACE FUNCTION finance_report_breakdown_is_valid(
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
  component_total NUMERIC := 0;
  mode_value TEXT;
BEGIN
  IF jsonb_typeof(p_metadata) <> 'object'
    OR p_metadata->>'transactionType' <> p_expected_transaction_type
    OR p_metadata->>'schemaVersion' <> '1'
    OR jsonb_typeof(p_metadata->'formula') <> 'string' OR p_metadata->>'formula' = ''
    OR jsonb_typeof(p_metadata->'formulaVersion') <> 'string' OR p_metadata->>'formulaVersion' = ''
    OR jsonb_typeof(p_metadata->'sourceEventId') <> 'string' OR p_metadata->>'sourceEventId' = ''
    OR jsonb_typeof(p_metadata->'finalAmount') <> 'number'
    OR jsonb_typeof(p_metadata->'inputs') <> 'array'
    OR jsonb_typeof(p_metadata->'modifiers') <> 'array'
    OR jsonb_typeof(p_metadata->'rounding') <> 'object'
  THEN
    RETURN FALSE;
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_metadata->'inputs') LOOP
    IF jsonb_typeof(item) <> 'object'
      OR jsonb_typeof(item->'name') <> 'string' OR item->>'name' = ''
      OR jsonb_typeof(item->'value') NOT IN ('null', 'string', 'boolean', 'number')
      OR jsonb_typeof(item->'unit') <> 'string' OR item->>'unit' = ''
      OR jsonb_typeof(item->'source') <> 'string' OR item->>'source' = ''
    THEN
      RETURN FALSE;
    END IF;
  END LOOP;

  FOR item IN SELECT value FROM jsonb_array_elements(p_metadata->'modifiers') LOOP
    IF jsonb_typeof(item) <> 'object'
      OR jsonb_typeof(item->'name') <> 'string' OR item->>'name' = ''
      OR jsonb_typeof(item->'value') <> 'number'
      OR jsonb_typeof(item->'unit') <> 'string' OR item->>'unit' = ''
      OR jsonb_typeof(item->'source') <> 'string' OR item->>'source' = ''
      OR jsonb_typeof(item->'applied') <> 'boolean'
    THEN
      RETURN FALSE;
    END IF;
  END LOOP;

  IF jsonb_typeof(p_metadata->'rounding'->'precision') <> 'number'
    OR (p_metadata->'rounding'->>'precision')::NUMERIC < 0
    OR (p_metadata->'rounding'->>'precision')::NUMERIC <> TRUNC((p_metadata->'rounding'->>'precision')::NUMERIC)
    OR p_metadata->'rounding'->>'mode' NOT IN ('none', 'round', 'floor', 'ceil', 'trunc')
    OR jsonb_typeof(p_metadata->'rounding'->'operationOrder') <> 'array'
    OR p_metadata->'rounding'->>'scope' NOT IN ('per_item', 'aggregate')
  THEN
    RETURN FALSE;
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_metadata->'rounding'->'operationOrder') LOOP
    IF jsonb_typeof(item) <> 'string' OR item #>> '{}' = '' THEN
      RETURN FALSE;
    END IF;
  END LOOP;

  CASE p_expected_transaction_type
    WHEN 'battle_income' THEN
      IF jsonb_typeof(p_metadata->'mode') <> 'string' OR p_metadata->>'mode' = ''
        OR jsonb_typeof(p_metadata->'tier') NOT IN ('string', 'number')
        OR jsonb_typeof(p_metadata->'outcome') <> 'string' OR p_metadata->>'outcome' = ''
        OR jsonb_typeof(p_metadata->'placement') NOT IN ('null', 'number')
        OR (jsonb_typeof(p_metadata->'placement') = 'number' AND (p_metadata->>'placement')::NUMERIC <> TRUNC((p_metadata->>'placement')::NUMERIC))
        OR jsonb_typeof(p_metadata->'participationFloor') <> 'number'
        OR jsonb_typeof(p_metadata->'winComponent') <> 'number'
        OR jsonb_typeof(p_metadata->'teamSize') <> 'number'
        OR (p_metadata->>'teamSize')::NUMERIC <= 0
        OR (p_metadata->>'teamSize')::NUMERIC <> TRUNC((p_metadata->>'teamSize')::NUMERIC)
        OR p_metadata->>'stableAggregation' <> 'stable'
        OR jsonb_typeof(p_metadata->'isBye') <> 'boolean'
      THEN
        RETURN FALSE;
      END IF;
      mode_value := p_metadata->>'mode';
      IF mode_value NOT IN ('koth', 'grand_melee') OR p_metadata->>'outcome' <> 'placement' THEN
        RETURN NOT (p_metadata ? 'placementRewardComponents');
      END IF;
      IF jsonb_typeof(p_metadata->'placementRewardComponents') <> 'array'
        OR jsonb_array_length(p_metadata->'placementRewardComponents') = 0
      THEN
        RETURN FALSE;
      END IF;
      FOR component IN SELECT value FROM jsonb_array_elements(p_metadata->'placementRewardComponents') LOOP
        IF jsonb_typeof(component) <> 'object'
          OR component->>'mode' <> mode_value
          OR jsonb_typeof(component->'robotId') <> 'number' OR (component->>'robotId')::NUMERIC <= 0 OR (component->>'robotId')::NUMERIC <> TRUNC((component->>'robotId')::NUMERIC)
          OR jsonb_typeof(component->'tier') NOT IN ('string', 'number')
          OR jsonb_typeof(component->'placement') <> 'number' OR (component->>'placement')::NUMERIC <= 0 OR (component->>'placement')::NUMERIC <> TRUNC((component->>'placement')::NUMERIC)
          OR jsonb_typeof(component->'credits') <> 'number' OR (component->>'credits')::NUMERIC < 0
          OR jsonb_typeof(component->'tierBaseReward') <> 'number' OR (component->>'tierBaseReward')::NUMERIC < 0
          OR jsonb_typeof(component->'modeBaseMultiplier') <> 'number' OR (component->>'modeBaseMultiplier')::NUMERIC < 0
          OR jsonb_typeof(component->'placementMultiplier') <> 'number' OR (component->>'placementMultiplier')::NUMERIC < 0
        THEN
          RETURN FALSE;
        END IF;
        IF mode_value = 'koth' THEN
          IF jsonb_typeof(component->'zoneScore') <> 'number' OR (component->>'zoneScore')::NUMERIC < 0
            OR jsonb_typeof(component->'zoneTime') <> 'number' OR (component->>'zoneTime')::NUMERIC < 0
            OR jsonb_typeof(component->'uncontestedScore') <> 'number' OR (component->>'uncontestedScore')::NUMERIC < 0
            OR jsonb_typeof(component->'zoneDominanceBonus') <> 'boolean'
            OR (component->>'zoneDominanceMultiplier')::NUMERIC NOT IN (1, 1.25)
            OR (component->>'zoneDominanceMultiplier')::NUMERIC <> (CASE WHEN component->>'zoneDominanceBonus' = 'true' THEN 1.25 ELSE 1 END)
          THEN
            RETURN FALSE;
          END IF;
        ELSE
          IF jsonb_typeof(component->'totalParticipants') <> 'number' OR (component->>'totalParticipants')::NUMERIC <= 0 OR (component->>'totalParticipants')::NUMERIC <> TRUNC((component->>'totalParticipants')::NUMERIC)
            OR jsonb_typeof(component->'participationFloorApplied') <> 'boolean'
            OR jsonb_typeof(component->'participationFloorMultiplier') <> 'number'
            OR (component->>'participationFloorMultiplier')::NUMERIC <> (CASE WHEN component->>'participationFloorApplied' = 'true' THEN 0.2 ELSE 0 END)
          THEN
            RETURN FALSE;
          END IF;
        END IF;
        component_total := component_total + (component->>'credits')::NUMERIC;
      END LOOP;
      RETURN component_total = (p_metadata->>'finalAmount')::NUMERIC;

    WHEN 'streaming_revenue' THEN
      RETURN jsonb_typeof(p_metadata->'battleId') IN ('string', 'number')
        AND jsonb_typeof(p_metadata->'robotId') = 'number' AND (p_metadata->>'robotId')::NUMERIC > 0 AND (p_metadata->>'robotId')::NUMERIC = TRUNC((p_metadata->>'robotId')::NUMERIC)
        AND jsonb_typeof(p_metadata->'mode') = 'string' AND p_metadata->>'mode' <> ''
        AND p_metadata->>'eligible' = 'true'
        AND jsonb_typeof(p_metadata->'baseAmount') = 'number'
        AND jsonb_typeof(p_metadata->'battleMultiplier') = 'number'
        AND jsonb_typeof(p_metadata->'fameMultiplier') = 'number'
        AND jsonb_typeof(p_metadata->'studioMultiplier') = 'number'
        AND jsonb_typeof(p_metadata->'totalRevenue') = 'number';

    WHEN 'repair_cost' THEN
      RETURN p_metadata->>'repairType' IN ('manual', 'automatic')
        AND jsonb_typeof(p_metadata->'robotId') = 'number' AND (p_metadata->>'robotId')::NUMERIC > 0 AND (p_metadata->>'robotId')::NUMERIC = TRUNC((p_metadata->>'robotId')::NUMERIC)
        AND jsonb_typeof(p_metadata->'baseQuote') = 'number'
        AND jsonb_typeof(p_metadata->'damageRepaired') = 'number'
        AND jsonb_typeof(p_metadata->'repairBayLevel') = 'number' AND (p_metadata->>'repairBayLevel')::NUMERIC >= 0 AND (p_metadata->>'repairBayLevel')::NUMERIC = TRUNC((p_metadata->>'repairBayLevel')::NUMERIC)
        AND jsonb_typeof(p_metadata->'activeRobotCount') = 'number' AND (p_metadata->>'activeRobotCount')::NUMERIC >= 0 AND (p_metadata->>'activeRobotCount')::NUMERIC = TRUNC((p_metadata->>'activeRobotCount')::NUMERIC)
        AND jsonb_typeof(p_metadata->'repairBayDiscountPercent') = 'number'
        AND jsonb_typeof(p_metadata->'manualRepairDiscountPercent') = 'number'
        AND jsonb_typeof(p_metadata->'quoteBeforeManualDiscount') = 'number'
        AND jsonb_typeof(p_metadata->'perRobotCharge') = 'number';
  END CASE;
  RETURN FALSE;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$;
