import {
  BATTLE_MODES,
  COVERAGE_MANIFEST,
  checkDirectWriterCoverage,
  validateCoverageManifest,
} from './factories/coverageManifest';

describe('Spec 53 Coverage_Manifest baseline', () => {
  it('uses the real User.currency field and the exact twelve-value taxonomy', () => {
    expect(COVERAGE_MANIFEST.currencyField).toBe('User.currency');
    expect(COVERAGE_MANIFEST.transactionTaxonomy).toEqual([
      'battle_income',
      'streaming_revenue',
      'repair_cost',
      'facility_upgrade',
      'weapon_purchase',
      'weapon_sale',
      'weapon_refinement',
      'robot_creation',
      'attribute_upgrade',
      'achievement_reward',
      'passive_income',
      'operating_costs',
    ]);
  });

  it('represents every required boundary with typed source and identity data', () => {
    expect(validateCoverageManifest()).toEqual([]);
    expect(COVERAGE_MANIFEST.battleModes).toEqual(BATTLE_MODES);
    expect(COVERAGE_MANIFEST.entries.length).toBeGreaterThan(30);
    expect(COVERAGE_MANIFEST.prestigeSources).toHaveLength(9);
    expect(COVERAGE_MANIFEST.prestigeWriters).toHaveLength(6);
    expect(COVERAGE_MANIFEST.prestigeWriters.map((writer) => writer.currentSource.symbol)).toEqual([
      'awardPrestigeToUser',
      'processKothBattle',
      'processGrandMeleeBattle',
      'AchievementService.checkAndAward',
      'performAccountReset',
      'resetCompetitiveAndEconomicState',
    ]);
    expect(COVERAGE_MANIFEST.prestigeWriters.filter((writer) => writer.kind === 'positive-award')).toHaveLength(4);
    expect(COVERAGE_MANIFEST.prestigeWriters.filter((writer) => writer.kind === 'lifecycle-reset')).toHaveLength(2);
    expect(COVERAGE_MANIFEST.settlementEntryPoints).toHaveLength(5);
    expect(COVERAGE_MANIFEST.subscriptionBoundary.eventTypes).toEqual(BATTLE_MODES);
    expect(COVERAGE_MANIFEST.lifecycleBoundaries).toHaveLength(5);
    expect(COVERAGE_MANIFEST.adminCompatibilitySurfaces).toHaveLength(10);
    expect(COVERAGE_MANIFEST.testTiers.map((tier) => tier.tier)).toEqual([
      'unit',
      'integration',
      'heavy',
      'frontend',
      'e2e',
    ]);
    expect(COVERAGE_MANIFEST.noUiBoundary.unchangedFiles).toContain(
      'app/frontend/src/pages/CycleSummaryPage.tsx',
    );
    expect(COVERAGE_MANIFEST.noUiBoundary.playerGuideValidation).toBe(
      'app/backend/tests/guide/content-validation.test.ts',
    );
  });

  it('covers the five actual resolveByeEvent caller boundaries across all nine modes', () => {
    expect(COVERAGE_MANIFEST.byeCallerBoundaries).toHaveLength(5);

    const modes = new Set(
      COVERAGE_MANIFEST.byeCallerBoundaries.flatMap((caller) => caller.modes),
    );
    expect([...modes].sort()).toEqual([...BATTLE_MODES].sort());
    expect(COVERAGE_MANIFEST.byeCallerBoundaries.map((caller) => caller.currentSource.symbol)).toEqual([
      'processByeBattle',
      'resolveTeamLeagueBye',
      'resolveTagTeamBye',
      'completeByeMatch',
      'resolvePlacementBye',
    ]);
  });

  it('fails when a new direct User.currency mutation is not in the frozen baseline', () => {
    const result = checkDirectWriterCoverage();

    expect(result.unmanifested).toEqual([]);
    expect(result.missingFromSource).toEqual([]);
    expect(result.discovered.length).toBe(5);
    expect(result.discovered).not.toContainEqual(expect.objectContaining({
      file: 'app/backend/src/routes/user.ts',
    }));
    expect(result.discovered).not.toContainEqual(expect.objectContaining({
      file: 'app/backend/src/services/onboarding/onboardingService.ts',
    }));
    expect(result.discovered).toContainEqual({
      file: 'app/backend/src/services/financial/creditMutationService.ts',
      operation: 'set',
      occurrence: 1,
    });
  });

  it('keeps repair, subscription, lifecycle, and UI boundaries explicit', () => {
    expect(COVERAGE_MANIFEST.repairSpendSource).toMatchObject({
      eventType: 'robot_repair',
      chargedAmountField: 'creditsCharged',
      subtypeField: 'repairType',
      allowedSubtypes: ['manual', 'automatic'],
    });
    expect(COVERAGE_MANIFEST.subscriptionBoundary.financialOutput).toBe('none');
    expect(COVERAGE_MANIFEST.lifecycleBoundaries.every((boundary) => boundary.financialOutput === 'none')).toBe(true);
    expect(COVERAGE_MANIFEST.directWriterPolicy.excludedPaths).toContain('app/backend/src/shared');
    expect(COVERAGE_MANIFEST.noUiBoundary.deferredConcepts).toEqual([
      'Income_Dashboard',
      'Cycle_Summary',
      'Financial_Page_Follow_On',
    ]);
  });
});
