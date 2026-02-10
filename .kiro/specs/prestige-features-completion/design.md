# Prestige Features Completion - Design

**Feature Name**: prestige-features-completion  
**Created**: February 9, 2026  
**Status**: Design Complete

## Architecture Overview

This feature completes two partially implemented prestige system features through backend validation and frontend display enhancements.

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
├─────────────────────────────────────────────────────────────┤
│  FacilitiesPage.tsx                                         │
│  ├─ Display lock icons for prestige-gated levels           │
│  ├─ Show prestige requirements in tooltips                 │
│  └─ Handle prestige validation errors                      │
│                                                              │
│  FinancialReportPage.tsx                                    │
│  └─ DailyStableReport.tsx (new multiplier display)         │
│     ├─ Prestige bonus breakdown                            │
│     ├─ Merchandising multiplier calculation                │
│     └─ Streaming multiplier calculation                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/JSON
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                        Backend                               │
├─────────────────────────────────────────────────────────────┤
│  routes/facility.ts                                         │
│  └─ POST /api/facilities/:facilityType/upgrade             │
│     └─ Validate prestige requirements                      │
│                                                              │
│  routes/finances.ts                                         │
│  └─ GET /api/finances/report                               │
│     └─ Return multiplier breakdown data                    │
│                                                              │
│  config/facilities.ts                                       │
│  └─ Add prestigeRequirements field to FacilityConfig       │
│                                                              │
│  utils/economyCalculations.ts (already implemented)        │
│  ├─ getPrestigeMultiplier()                                │
│  ├─ calculateMerchandisingIncome()                         │
│  └─ calculateStreamingIncome()                             │
└─────────────────────────────────────────────────────────────┘
```

## Feature 1: Prestige Gates Implementation

### Backend Changes

#### 1.1 Update FacilityConfig Interface

**File**: `prototype/backend/src/config/facilities.ts`

Add `prestigeRequirements` field to the `FacilityConfig` interface:

```typescript
export interface FacilityConfig {
  name: string;
  description: string;
  maxLevel: number;
  costs: number[];
  operatingCosts: number[];
  benefits: string[];
  prestigeRequirements?: number[];  // NEW: Array of prestige required per level
}
```

The `prestigeRequirements` array maps to facility levels:
- Index 0 = Level 1 requirement
- Index 1 = Level 2 requirement
- etc.
- `undefined` or `0` = no prestige requirement

#### 1.2 Add Prestige Requirements to Facility Definitions

Update all 14 facility definitions in `facilities.ts` to include prestige requirements from STABLE_SYSTEM.md.

Example for Repair Bay:
```typescript
repair_bay: {
  name: 'Repair Bay',
  description: 'Reduces repair costs for damaged robots',
  maxLevel: 10,
  costs: [200000, 400000, 600000, 800000, 1000000, 1200000, 1500000, 2000000, 2500000, 3000000],
  operatingCosts: [1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500],
  benefits: [...],
  prestigeRequirements: [0, 0, 0, 1000, 0, 0, 5000, 0, 10000, 0]  // NEW
}
```

#### 1.3 Update Facility Upgrade Endpoint

**File**: `prototype/backend/src/routes/facility.ts`

Add prestige validation to the upgrade endpoint:

```typescript
router.post('/:facilityType/upgrade', authenticateToken, async (req: AuthRequest, res: Response) => {
  // ... existing code to get user, facility, config ...
  
  const targetLevel = currentLevel + 1;
  
  // NEW: Validate prestige requirement
  const config = facilityConfigs[facilityType];
  if (config.prestigeRequirements && config.prestigeRequirements[targetLevel - 1]) {
    const requiredPrestige = config.prestigeRequirements[targetLevel - 1];
    if (user.prestige < requiredPrestige) {
      return res.status(403).json({
        error: 'Insufficient prestige',
        required: requiredPrestige,
        current: user.prestige,
        message: `${config.name} Level ${targetLevel} requires ${requiredPrestige} prestige`
      });
    }
  }
  
  // ... rest of existing upgrade logic ...
});
```

#### 1.4 Update Facilities List Endpoint

**File**: `prototype/backend/src/routes/facility.ts`

Enhance GET `/api/facilities` to include prestige requirement info:

```typescript
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  // ... existing code ...
  
  const facilitiesWithInfo = facilities.map(facility => {
    const config = facilityConfigs[facility.facilityType];
    const nextLevel = facility.level + 1;
    
    // NEW: Include prestige requirement for next level
    let nextLevelPrestigeRequired = 0;
    if (config.prestigeRequirements && nextLevel <= config.maxLevel) {
      nextLevelPrestigeRequired = config.prestigeRequirements[nextLevel - 1] || 0;
    }
    
    return {
      ...facility,
      config: {
        ...config,
        nextLevelPrestigeRequired,  // NEW
        canAfford: user.currency >= config.costs[nextLevel - 1],
        hasPrestige: user.prestige >= nextLevelPrestigeRequired  // NEW
      }
    };
  });
  
  res.json({ facilities: facilitiesWithInfo, userPrestige: user.prestige });
});
```

### Frontend Changes

#### 1.5 Update FacilitiesPage Component

**File**: `prototype/frontend/src/pages/FacilitiesPage.tsx`

Add prestige requirement display:

```typescript
// In the facility card rendering:
{facility.config.nextLevelPrestigeRequired > 0 && (
  <div className={`text-sm ${user.prestige >= facility.config.nextLevelPrestigeRequired ? 'text-green-400' : 'text-red-400'}`}>
    {user.prestige >= facility.config.nextLevelPrestigeRequired ? '✓' : '🔒'} 
    Requires {facility.config.nextLevelPrestigeRequired.toLocaleString()} prestige
  </div>
)}

// Update upgrade button:
<button
  disabled={
    !facility.config.canAfford || 
    !facility.config.hasPrestige ||  // NEW
    facility.level >= facility.config.maxLevel
  }
  className={`
    ${!facility.config.hasPrestige ? 'opacity-50 cursor-not-allowed' : ''}
    ...
  `}
  title={
    !facility.config.hasPrestige 
      ? `Requires ${facility.config.nextLevelPrestigeRequired} prestige` 
      : undefined
  }
>
  Upgrade
</button>
```

#### 1.6 Handle Prestige Validation Errors

Add error handling for 403 prestige errors:

```typescript
const handleUpgrade = async (facilityType: string) => {
  try {
    await axios.post(`/api/facilities/${facilityType}/upgrade`);
    // ... success handling ...
  } catch (error: any) {
    if (error.response?.status === 403) {
      const { required, current, message } = error.response.data;
      showError(`${message}. You have ${current} prestige.`);
    } else {
      showError(error.response?.data?.error || 'Upgrade failed');
    }
  }
};
```

## Feature 2: Income Multiplier Display

### Backend Changes

#### 2.1 Enhance Financial Report Endpoint

**File**: `prototype/backend/src/routes/finances.ts`

Update GET `/api/finances/report` to include multiplier breakdown:

```typescript
router.get('/report', authenticateToken, async (req: AuthRequest, res: Response) => {
  // ... existing code to calculate report ...
  
  // NEW: Add multiplier breakdown
  const passiveIncome = await calculateDailyPassiveIncome(userId);
  const prestigeMultiplier = getPrestigeMultiplier(user.prestige);
  
  // Calculate merchandising breakdown
  const incomeGeneratorLevel = facilities.find(f => f.facilityType === 'income_generator')?.level || 0;
  const merchandisingBase = getMerchandisingBaseRate(incomeGeneratorLevel);
  const merchandisingMultiplier = 1 + (user.prestige / 10000);
  
  // Calculate streaming breakdown
  const robots = await prisma.robot.findMany({
    where: { userId },
    select: { totalBattles: true, fame: true }
  });
  const totalBattles = robots.reduce((sum, r) => sum + r.totalBattles, 0);
  const totalFame = robots.reduce((sum, r) => sum + r.fame, 0);
  const streamingBase = getStreamingBaseRate(incomeGeneratorLevel);
  const battleMultiplier = 1 + (totalBattles / 1000);
  const fameMultiplier = 1 + (totalFame / 5000);
  
  const multiplierBreakdown = {
    prestige: {
      current: user.prestige,
      multiplier: prestigeMultiplier,
      bonusPercent: Math.round((prestigeMultiplier - 1) * 100),
      nextTier: getNextPrestigeTier(user.prestige)
    },
    merchandising: {
      baseRate: merchandisingBase,
      prestigeMultiplier: merchandisingMultiplier,
      total: passiveIncome.merchandising,
      formula: `₡${merchandisingBase.toLocaleString()} × ${merchandisingMultiplier.toFixed(2)}`
    },
    streaming: {
      baseRate: streamingBase,
      battleMultiplier: battleMultiplier,
      fameMultiplier: fameMultiplier,
      totalBattles,
      totalFame,
      total: passiveIncome.streaming,
      formula: `₡${streamingBase.toLocaleString()} × ${battleMultiplier.toFixed(2)} × ${fameMultiplier.toFixed(2)}`
    }
  };
  
  res.json({
    ...existingReportData,
    multiplierBreakdown  // NEW
  });
});

// NEW: Helper function
function getNextPrestigeTier(currentPrestige: number): { threshold: number, bonus: string } | null {
  if (currentPrestige < 5000) return { threshold: 5000, bonus: '+5%' };
  if (currentPrestige < 10000) return { threshold: 10000, bonus: '+10%' };
  if (currentPrestige < 25000) return { threshold: 25000, bonus: '+15%' };
  if (currentPrestige < 50000) return { threshold: 50000, bonus: '+20%' };
  return null;  // Max tier reached
}
```

### Frontend Changes

#### 2.2 Create Multiplier Display Component

**File**: `prototype/frontend/src/components/MultiplierBreakdown.tsx` (NEW)

```typescript
interface MultiplierBreakdownProps {
  multiplierData: {
    prestige: {
      current: number;
      multiplier: number;
      bonusPercent: number;
      nextTier: { threshold: number; bonus: string } | null;
    };
    merchandising: {
      baseRate: number;
      prestigeMultiplier: number;
      total: number;
      formula: string;
    };
    streaming: {
      baseRate: number;
      battleMultiplier: number;
      fameMultiplier: number;
      totalBattles: number;
      totalFame: number;
      total: number;
      formula: string;
    };
  };
}

export default function MultiplierBreakdown({ multiplierData }: MultiplierBreakdownProps) {
  return (
    <div className="bg-gray-800 p-6 rounded-lg">
      <h3 className="text-xl font-semibold mb-4">💰 Income Multipliers</h3>
      
      {/* Prestige Bonus */}
      <div className="mb-4 p-4 bg-gray-700 rounded">
        <div className="flex justify-between items-center mb-2">
          <span className="font-semibold">Battle Winnings Prestige Bonus</span>
          <span className="text-green-400 font-bold">+{multiplierData.prestige.bonusPercent}%</span>
        </div>
        <div className="text-sm text-gray-400">
          Current Prestige: {multiplierData.prestige.current.toLocaleString()}
        </div>
        {multiplierData.prestige.nextTier && (
          <div className="text-sm text-blue-400 mt-1">
            Next tier at {multiplierData.prestige.nextTier.threshold.toLocaleString()} prestige: {multiplierData.prestige.nextTier.bonus}
          </div>
        )}
      </div>
      
      {/* Merchandising */}
      {multiplierData.merchandising.total > 0 && (
        <div className="mb-4 p-4 bg-gray-700 rounded">
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold">Merchandising Income</span>
            <span className="text-green-400 font-bold">₡{multiplierData.merchandising.total.toLocaleString()}/day</span>
          </div>
          <div className="text-sm text-gray-400">
            Formula: {multiplierData.merchandising.formula}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Base rate × (1 + prestige/10,000)
          </div>
        </div>
      )}
      
      {/* Streaming */}
      {multiplierData.streaming.total > 0 && (
        <div className="mb-4 p-4 bg-gray-700 rounded">
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold">Streaming Revenue</span>
            <span className="text-green-400 font-bold">₡{multiplierData.streaming.total.toLocaleString()}/day</span>
          </div>
          <div className="text-sm text-gray-400">
            Formula: {multiplierData.streaming.formula}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Base × (1 + battles/1,000) × (1 + fame/5,000)
          </div>
          <div className="text-xs text-gray-500">
            Total Battles: {multiplierData.streaming.totalBattles} | Total Fame: {multiplierData.streaming.totalFame.toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}
```

#### 2.3 Update FinancialReportPage

**File**: `prototype/frontend/src/pages/FinancialReportPage.tsx`

Add multiplier breakdown display:

```typescript
import MultiplierBreakdown from '../components/MultiplierBreakdown';

// In the component:
{activeTab === 'overview' && (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    {/* Left Column */}
    <div className="space-y-6">
      <DailyStableReport report={report} />
      {report.multiplierBreakdown && (
        <MultiplierBreakdown multiplierData={report.multiplierBreakdown} />  // NEW
      )}
    </div>
    
    {/* Right Column: Projections and Recommendations */}
    <div className="space-y-6">
      {/* ... existing projections ... */}
    </div>
  </div>
)}
```

## Testing Strategy

### Unit Tests

#### Backend Tests

**File**: `prototype/backend/src/__tests__/prestigeGates.test.ts` (NEW)

```typescript
describe('Prestige Gates', () => {
  test('should reject facility upgrade without sufficient prestige', async () => {
    // User with 500 prestige tries to upgrade Repair Bay to Level 4 (requires 1,000)
    const response = await request(app)
      .post('/api/facilities/repair_bay/upgrade')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);
    
    expect(response.body.error).toBe('Insufficient prestige');
    expect(response.body.required).toBe(1000);
    expect(response.body.current).toBe(500);
  });
  
  test('should allow facility upgrade with sufficient prestige', async () => {
    // User with 1,500 prestige upgrades Repair Bay to Level 4 (requires 1,000)
    const response = await request(app)
      .post('/api/facilities/repair_bay/upgrade')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    
    expect(response.body.facility.level).toBe(4);
  });
  
  test('should allow facility upgrade with no prestige requirement', async () => {
    // Upgrade to Level 2 (no prestige requirement)
    const response = await request(app)
      .post('/api/facilities/repair_bay/upgrade')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    
    expect(response.body.facility.level).toBe(2);
  });
  
  test('should return prestige requirements in facilities list', async () => {
    const response = await request(app)
      .get('/api/facilities')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    
    const repairBay = response.body.facilities.find(f => f.facilityType === 'repair_bay');
    expect(repairBay.config.nextLevelPrestigeRequired).toBeDefined();
    expect(repairBay.config.hasPrestige).toBeDefined();
  });
});
```

**File**: `prototype/backend/src/__tests__/incomeMultipliers.test.ts` (NEW)

```typescript
describe('Income Multipliers', () => {
  test('should calculate prestige multiplier correctly', () => {
    expect(getPrestigeMultiplier(0)).toBe(1.0);
    expect(getPrestigeMultiplier(5000)).toBe(1.05);
    expect(getPrestigeMultiplier(10000)).toBe(1.10);
    expect(getPrestigeMultiplier(25000)).toBe(1.15);
    expect(getPrestigeMultiplier(50000)).toBe(1.20);
  });
  
  test('should calculate merchandising income with prestige multiplier', () => {
    const income = calculateMerchandisingIncome(4, 15000);  // Level 4, 15k prestige
    const expected = 12000 * (1 + 15000/10000);  // 12000 * 2.5 = 30000
    expect(income).toBe(30000);
  });
  
  test('should calculate streaming income with battle and fame multipliers', () => {
    const income = calculateStreamingIncome(5, 500, 10000);  // Level 5, 500 battles, 10k fame
    const expected = 6000 * (1 + 500/1000) * (1 + 10000/5000);  // 6000 * 1.5 * 3.0 = 27000
    expect(income).toBe(27000);
  });
  
  test('should include multiplier breakdown in financial report', async () => {
    const response = await request(app)
      .get('/api/finances/report')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    
    expect(response.body.multiplierBreakdown).toBeDefined();
    expect(response.body.multiplierBreakdown.prestige).toBeDefined();
    expect(response.body.multiplierBreakdown.merchandising).toBeDefined();
    expect(response.body.multiplierBreakdown.streaming).toBeDefined();
  });
});
```

#### Frontend Tests

**File**: `prototype/frontend/src/components/__tests__/MultiplierBreakdown.test.tsx` (NEW)

```typescript
describe('MultiplierBreakdown', () => {
  test('should display prestige bonus correctly', () => {
    const mockData = {
      prestige: {
        current: 10000,
        multiplier: 1.10,
        bonusPercent: 10,
        nextTier: { threshold: 25000, bonus: '+15%' }
      },
      merchandising: { baseRate: 12000, prestigeMultiplier: 2.0, total: 24000, formula: '₡12,000 × 2.00' },
      streaming: { baseRate: 6000, battleMultiplier: 1.5, fameMultiplier: 2.0, totalBattles: 500, totalFame: 5000, total: 18000, formula: '₡6,000 × 1.50 × 2.00' }
    };
    
    render(<MultiplierBreakdown multiplierData={mockData} />);
    
    expect(screen.getByText('+10%')).toBeInTheDocument();
    expect(screen.getByText('10,000')).toBeInTheDocument();
    expect(screen.getByText(/Next tier at 25,000/)).toBeInTheDocument();
  });
  
  test('should display merchandising breakdown', () => {
    // ... test merchandising display ...
  });
  
  test('should display streaming breakdown', () => {
    // ... test streaming display ...
  });
});
```

### Integration Tests

**File**: `prototype/backend/src/__tests__/integration/prestigeFeatures.test.ts` (NEW)

```typescript
describe('Prestige Features Integration', () => {
  test('should enforce prestige gates end-to-end', async () => {
    // Create user with 500 prestige
    const user = await createTestUser({ prestige: 500 });
    
    // Try to upgrade facility requiring 1,000 prestige
    const response = await request(app)
      .post('/api/facilities/repair_bay/upgrade')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(403);
    
    // Increase user prestige
    await updateUserPrestige(user.id, 1500);
    
    // Retry upgrade - should succeed
    const response2 = await request(app)
      .post('/api/facilities/repair_bay/upgrade')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);
    
    expect(response2.body.facility.level).toBe(4);
  });
  
  test('should display income multipliers correctly', async () => {
    // Create user with prestige and income generator
    const user = await createTestUser({ prestige: 15000 });
    await createFacility(user.id, 'income_generator', 4);
    
    // Get financial report
    const response = await request(app)
      .get('/api/finances/report')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);
    
    // Verify multiplier breakdown
    expect(response.body.multiplierBreakdown.prestige.current).toBe(15000);
    expect(response.body.multiplierBreakdown.merchandising.total).toBeGreaterThan(0);
  });
});
```

### Test Coverage Goals

- Backend prestige validation: >90% coverage
- Backend multiplier calculations: >90% coverage (already implemented, add tests)
- Frontend components: >80% coverage
- Integration tests: Cover all critical user flows

## Correctness Properties

### Property 1: Prestige Gate Enforcement
**Validates: Requirements 1.1, 1.5**

For all facility upgrades:
- If prestige requirement exists for target level AND user prestige < requirement → upgrade MUST fail with 403
- If no prestige requirement OR user prestige >= requirement → upgrade MAY succeed (subject to other validations)

```typescript
// Property test
property('prestige gates are enforced', 
  arbitrary.facilityType(),
  arbitrary.level(1, 10),
  arbitrary.prestige(0, 100000),
  (facilityType, targetLevel, userPrestige) => {
    const config = facilityConfigs[facilityType];
    const required = config.prestigeRequirements?.[targetLevel - 1] || 0;
    
    const result = attemptUpgrade(facilityType, targetLevel, userPrestige);
    
    if (required > 0 && userPrestige < required) {
      return result.status === 403 && result.error === 'Insufficient prestige';
    }
    return true;  // Other validations may still fail
  }
);
```

### Property 2: Multiplier Calculation Accuracy
**Validates: Requirements 2.1, 2.2, 2.3**

For all prestige/fame values:
- Prestige multiplier MUST match documented tiers
- Merchandising income MUST equal base × (1 + prestige/10000)
- Streaming income MUST equal base × (1 + battles/1000) × (1 + fame/5000)

```typescript
// Property test
property('income multipliers are calculated correctly',
  arbitrary.prestige(0, 100000),
  arbitrary.battles(0, 10000),
  arbitrary.fame(0, 50000),
  (prestige, battles, fame) => {
    // Test prestige multiplier
    const expectedPrestigeMultiplier = 
      prestige >= 50000 ? 1.20 :
      prestige >= 25000 ? 1.15 :
      prestige >= 10000 ? 1.10 :
      prestige >= 5000 ? 1.05 : 1.0;
    
    expect(getPrestigeMultiplier(prestige)).toBe(expectedPrestigeMultiplier);
    
    // Test merchandising
    const merchBase = 12000;
    const expectedMerch = Math.round(merchBase * (1 + prestige / 10000));
    expect(calculateMerchandisingIncome(4, prestige)).toBe(expectedMerch);
    
    // Test streaming
    const streamBase = 6000;
    const expectedStream = Math.round(streamBase * (1 + battles / 1000) * (1 + fame / 5000));
    expect(calculateStreamingIncome(5, battles, fame)).toBe(expectedStream);
    
    return true;
  }
);
```

### Property 3: UI Consistency
**Validates: Requirements 1.3, 1.4, 2.4, 2.5**

For all facility displays:
- If prestige requirement > user prestige → lock icon MUST be shown
- If prestige requirement <= user prestige → checkmark MUST be shown
- Multiplier breakdown values MUST match backend calculations

## Implementation Notes

### Backward Compatibility

- Existing facilities without prestige requirements continue to work
- `prestigeRequirements` field is optional in FacilityConfig
- Frontend gracefully handles missing multiplier data

### Performance Considerations

- Prestige validation adds minimal overhead (single comparison)
- Multiplier calculations already exist, just exposing data
- No additional database queries required

### Error Handling

- 403 status for prestige validation failures (distinct from 400 bad request)
- Clear error messages with current vs required prestige
- Frontend displays user-friendly error notifications

## Documentation Updates

After implementation, update:
1. `docs/PRD_PRESTIGE_AND_FAME.md` - Mark User Stories 6 and 7 as "Implemented"
2. `docs/PRESTIGE_FAME_ANALYSIS.md` - Update implementation status
3. `docs/PRD_FACILITIES_PAGE_OVERHAUL.md` - Mark Section 6 as "Implemented"
4. `docs/PRD_INCOME_DASHBOARD.md` - Mark Phase 7 as "Implemented"
5. Add test coverage report to documentation

## Deployment Checklist

- [ ] All unit tests passing (>80% coverage)
- [ ] All integration tests passing
- [ ] Property-based tests passing
- [ ] Backend changes deployed
- [ ] Frontend changes deployed
- [ ] Database migration (if needed - none required for this feature)
- [ ] Documentation updated
- [ ] User-facing changelog updated
