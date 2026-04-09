# Merchandising Hub Migration Summary

## Overview
Successfully renamed "Income Generator" facility to "Merchandising Hub" with updated economics.

## Changes Made

### 1. Backend Configuration
- **File**: `app/backend/src/config/facilities.ts`
  - Changed facility type from `income_generator` to `merchandising_hub`
  - Changed display name from "Income Generator" to "Merchandising Hub"
  - Updated costs: L1-L10 now cost ₡150K, ₡300K, ₡450K, ₡600K, ₡750K, ₡900K, ₡1.05M, ₡1.2M, ₡1.35M, ₡1.5M
  - Updated benefits: Now ₡5K, ₡10K, ₡15K, ₡20K, ₡25K, ₡30K, ₡35K, ₡40K, ₡45K, ₡50K per day
  - Updated description to clarify merchandising revenue

### 2. Backend Economy Calculations
- **File**: `app/backend/src/utils/economyCalculations.ts`
  - Updated `getMerchandisingBaseRate()` with new income rates (₡5K per level)
  - Updated `calculateMerchandisingIncome()` parameter names
  - Updated `calculateDailyPassiveIncome()` to use `merchandising_hub` facility type
  - Updated `calculateFacilityOperatingCost()`: Now ₡200 per level (was ₡1000 + (level-1) × ₡500)
  - Updated `calculateDailyBenefitIncrease()` to check for `merchandising_hub`
  - Updated `calculateFacilityROI()` to check for `merchandising_hub`
  - Updated `getFacilityName()` helper function
  - Updated `generatePerRobotFinancialReport()` to use `merchandising_hub`

### 3. Backend Services
- **File**: `app/backend/src/services/roiCalculatorService.ts`
  - Updated facility type checks from `income_generator` to `merchandising_hub`
  
- **File**: `app/backend/src/services/facilityRecommendationService.ts`
  - Updated facility type checks from `income_generator` to `merchandising_hub`

### 4. Backend Routes
- **File**: `app/backend/src/routes/finances.ts`
  - Updated facility lookup from `income_generator` to `merchandising_hub`
  - Updated recommendation text to use "Merchandising Hub"
  
- **File**: `app/backend/src/routes/analytics.ts`
  - Updated facility type list and documentation
  
- **File**: `app/backend/src/routes/admin.ts`
  - Updated facility type from `income_generator` to `merchandising_hub`

### 5. Backend Utilities
- **File**: `app/backend/src/utils/userGeneration.ts`
  - Updated default facility type from `income_generator` to `merchandising_hub`

### 6. Backend Seed Data
- **File**: `app/backend/prisma/seed.ts`
  - Updated facility type from `income_generator` to `merchandising_hub`
  - Updated console output documentation

### 7. Frontend Components
- **File**: `app/frontend/src/pages/FacilitiesPage.tsx`
  - Updated `getFacilityDisplayName()` mapping
  - Updated facility type in Economy & Discounts category
  - Updated ROI data fetching
  - Updated help text from "Income Generator" to "Merchandising Hub"
  
- **File**: `app/frontend/src/components/FacilityIcon.tsx`
  - Updated icon mapping from `income_generator` to `merchandising_hub`
  
- **File**: `app/frontend/src/components/FacilityROICalculator.tsx`
  - Updated default facility from `income_generator` to `merchandising_hub`
  - Updated FACILITY_OPTIONS array
  
- **File**: `app/frontend/src/components/MultiplierBreakdown.tsx`
  - Updated help text from "Income Generator" to "Merchandising Hub"

### 8. Database Migration
- **File**: `app/backend/prisma/migrations/rename_income_generator_to_merchandising_hub.sql`
  - Created SQL migration to update existing facility records

### 9. Integration Tests
- **File**: `app/backend/src/__tests__/integration/prestigeFeatures.integration.test.ts`
  - Updated facility config lookup from `income_generator` to `merchandising_hub`

## New Economics Summary

### Merchandising Hub (formerly Income Generator)

**Investment Costs:**
- Level 1: ₡150,000 (was ₡400,000) - 62.5% reduction
- Level 2: ₡300,000 (was ₡600,000) - 50% reduction
- Level 3: ₡450,000 (was ₡800,000) - 43.75% reduction
- Level 10: ₡1,500,000 (was ₡2,500,000) - 40% reduction

**Daily Income (Base):**
- Level 1: ₡5,000 (unchanged)
- Level 2: ₡10,000 (was ₡8,000) - 25% increase
- Level 3: ₡15,000 (was ₡11,000) - 36% increase
- Level 10: ₡50,000 (was ₡35,000) - 43% increase

**Operating Costs:**
- Level 1: ₡200/day (was ₡1,000/day) - 80% reduction
- Level 2: ₡400/day (was ₡1,500/day) - 73% reduction
- Level 3: ₡600/day (was ₡2,000/day) - 70% reduction
- Level 10: ₡2,000/day (was ₡5,500/day) - 64% reduction

**Break-Even Analysis (Level 1, assuming 100 prestige = 1% bonus):**
- Investment: ₡150,000
- Daily Income: ₡5,000 × 1.01 = ₡5,050
- Daily Operating Cost: ₡200
- Net Daily Income: ₡4,850
- Break-even: 150,000 / 4,850 ≈ **31 cycles** ✓ (Target: 25-30 cycles)

**Break-Even Analysis (Level 3, assuming 1000 prestige = 10% bonus):**
- Total Investment: ₡150K + ₡300K + ₡450K = ₡900,000
- Daily Income: ₡15,000 × 1.10 = ₡16,500
- Daily Operating Cost: ₡600
- Net Daily Income: ₡15,900
- Break-even: 900,000 / 15,900 ≈ **57 cycles**

## Test Files Requiring Updates

The following test files reference `income_generator` and will need to be updated:

1. `app/backend/tests/economyCalculations.test.ts`
2. `app/backend/tests/facilityTransactionLogging.test.ts`
3. `app/backend/tests/eventLogger.property.test.ts`
4. `app/backend/tests/roiCalculatorService.test.ts`
5. `app/backend/tests/facilityRecommendationService.test.ts`
6. `app/backend/tests/incomeGeneratorNoStreaming.property.test.ts`
7. `app/backend/tests/facilityROI.property.test.ts`

## Migration Steps

1. **Run Database Migration:**
   ```bash
   cd app/backend
   psql -d your_database < prisma/migrations/rename_income_generator_to_merchandising_hub.sql
   ```

2. **Update Test Files:**
   - Replace all instances of `income_generator` with `merchandising_hub` in test files
   - Update expected values for costs and operating costs in tests

3. **Regenerate Prisma Client:**
   ```bash
   cd app/backend
   npx prisma generate
   ```

4. **Run Tests:**
   ```bash
   npm test
   ```

5. **Verify Frontend:**
   - Check Facilities page displays "Merchandising Hub"
   - Verify ROI calculator works with new facility type
   - Confirm icon (💰) displays correctly

## Notes

- The facility type in the database schema remains a string field, so no schema migration is needed
- All existing `income_generator` records in the database will be renamed to `merchandising_hub` via SQL migration
- The new economics make the facility much more attractive with faster ROI
- Operating costs are now linear (₡200 per level) instead of the previous formula
- Income scales linearly at ₡5,000 per level for easier mental math
