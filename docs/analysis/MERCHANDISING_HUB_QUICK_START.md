# Merchandising Hub - Quick Start Guide

## What Changed?

The "Income Generator" facility has been renamed to "Merchandising Hub" with significantly improved economics:

### At a Glance

| Level | Investment | Daily Income | Operating Cost | Net/Day | Break-even |
|-------|-----------|--------------|----------------|---------|------------|
| L1 | ₡150K | ₡5K | ₡200 | ₡4.8K | ~31 cycles |
| L2 | ₡450K total | ₡10K | ₡400 | ₡9.6K | ~47 cycles |
| L3 | ₡900K total | ₡15K | ₡600 | ₡14.4K | ~63 cycles |

*Note: Income scales with prestige (1% per 100 prestige), so actual break-even is faster*

## Migration Steps

### 1. Run Database Migration

```bash
cd prototype/backend
psql -d your_database_name < prisma/migrations/rename_income_generator_to_merchandising_hub.sql
```

Or if using the default database:
```bash
psql -d armoured_souls_dev < prisma/migrations/rename_income_generator_to_merchandising_hub.sql
```

### 2. Update Test Files (Optional)

If you want to run tests, update the test files:

```bash
cd prototype/backend
./scripts/update-test-files.sh
```

Or manually find and replace in test files:
- `income_generator` → `merchandising_hub`
- Old cost values → New cost values

### 3. Restart Services

```bash
# Backend
cd prototype/backend
npm run dev

# Frontend (in another terminal)
cd prototype/frontend
npm run dev
```

### 4. Verify Changes

1. Open the app in your browser
2. Navigate to Facilities page
3. Confirm you see "Merchandising Hub" instead of "Income Generator"
4. Check that the 💰 icon displays correctly
5. Verify new costs and income values

## What to Test

### Backend
- [ ] Facility purchase works with new costs
- [ ] Daily income calculation uses new formula
- [ ] Operating costs are ₡200 per level
- [ ] ROI calculator shows correct break-even
- [ ] Cycle processing awards correct merchandising income

### Frontend
- [ ] Facility displays as "Merchandising Hub"
- [ ] Icon shows 💰
- [ ] Costs display correctly (₡150K, ₡300K, ₡450K, etc.)
- [ ] Income displays correctly (₡5K, ₡10K, ₡15K, etc.)
- [ ] ROI calculator works
- [ ] Tooltips and help text updated

## Rollback Plan

If you need to rollback:

1. Revert database migration:
```sql
UPDATE facilities 
SET facility_type = 'income_generator' 
WHERE facility_type = 'merchandising_hub';
```

2. Revert code changes:
```bash
git revert <commit-hash>
```

## Support

If you encounter issues:

1. Check `MERCHANDISING_HUB_MIGRATION.md` for detailed migration info
2. Check `MERCHANDISING_HUB_IMPLEMENTATION_COMPLETE.md` for complete change list
3. Review compilation errors - pre-existing errors in `leagueRebalancingService.ts` are unrelated

## Key Files Changed

**Backend:**
- `src/config/facilities.ts` - Facility config
- `src/utils/economyCalculations.ts` - Economy formulas
- `src/services/roiCalculatorService.ts` - ROI calculations
- `src/routes/finances.ts` - Finance routes

**Frontend:**
- `src/pages/FacilitiesPage.tsx` - Main page
- `src/components/FacilityIcon.tsx` - Icon mapping
- `src/components/FacilityROICalculator.tsx` - ROI calculator

**Database:**
- `prisma/migrations/rename_income_generator_to_merchandising_hub.sql` - Migration script
