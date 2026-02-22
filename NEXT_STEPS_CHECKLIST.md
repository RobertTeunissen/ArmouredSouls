# Next Steps Checklist

## Immediate Actions

### 1. Run Test Suite ⚠️
```bash
cd prototype/backend
npm test
```

**Expected Results:**
- ✓ All property-based tests should pass
- ✓ Streaming revenue calculations 10× higher
- ⚠️ Some tests may need manual review (see below)

---

### 2. Review Test Results

If tests fail, check:
- [ ] Are the failures in updated test files?
- [ ] Do expected values need adjustment?
- [ ] Are there any edge cases not covered?

**Files to Review Manually:**
- [ ] `tests/economyCalculations.test.ts`
- [ ] `tests/roiCalculatorService.test.ts`
- [ ] `tests/facilityRecommendationService.test.ts`

---

### 3. Run Database Migration

```bash
cd prototype/backend
psql -d armoured_souls_dev < prisma/migrations/rename_income_generator_to_merchandising_hub.sql
```

**Verify:**
- [ ] All `income_generator` records renamed to `merchandising_hub`
- [ ] No data loss
- [ ] Facility levels preserved

---

### 4. Regenerate Prisma Client

```bash
cd prototype/backend
npx prisma generate
```

---

### 5. Test in Development

**Facilities Page:**
- [ ] Merchandising Hub displays correctly
- [ ] Streaming Studio displays correctly
- [ ] Costs match new economics
- [ ] Benefits text is accurate

**ROI Calculator:**
- [ ] Merchandising Hub calculations correct
- [ ] Streaming Studio calculations correct
- [ ] Break-even times match documentation

**In-Game Testing:**
- [ ] Purchase Merchandising Hub L1
- [ ] Verify daily income (₡5K base)
- [ ] Verify operating cost (₡200/day)
- [ ] Purchase Streaming Studio L1
- [ ] Fight a battle
- [ ] Verify streaming revenue (2× multiplier)

---

## Verification Checklist

### Code Changes
- [x] Backend services updated
- [x] Frontend components updated
- [x] Test files updated
- [x] Documentation created

### Test Files
- [x] streamingRevenueFormula.property.test.ts
- [x] battleLogStreamingRevenue.property.test.ts
- [x] facilityAdvisorStreamingStudioROI.property.test.ts
- [ ] economyCalculations.test.ts (manual review)
- [ ] roiCalculatorService.test.ts (manual review)
- [ ] facilityRecommendationService.test.ts (manual review)

### Database
- [ ] Migration SQL file created
- [ ] Migration executed
- [ ] Data verified

### Documentation
- [x] FACILITIES_ECONOMICS_IMPLEMENTATION.md
- [x] STREAMING_STUDIO_100_PERCENT_ANALYSIS.md
- [x] TEST_FILES_UPDATE_STATUS.md
- [x] IMPLEMENTATION_SUMMARY.md
- [x] NEXT_STEPS_CHECKLIST.md (this file)

---

## Success Criteria

### Tests
- [ ] All tests pass
- [ ] No regressions
- [ ] New economics verified

### Functionality
- [ ] Facilities purchasable
- [ ] Income calculated correctly
- [ ] Operating costs applied
- [ ] ROI calculator accurate

### Balance
- [ ] Merchandising Hub: ~31 cycle break-even
- [ ] Streaming Studio (3 robots): ~17 cycle break-even
- [ ] Streaming Studio (2 robots): ~25 cycle break-even

---

## If Tests Fail

### Common Issues

**1. Revenue values too high/low**
- Check multiplier is 1.0 (not 0.1)
- Verify formula: `1 + (level × 1.0)`
- Update expected values in tests

**2. Facility name errors**
- Check for `income_generator` references
- Should be `merchandising_hub`
- Update all references

**3. Operating cost errors**
- Check formula: `level × ₡200`
- Was: `₡1K + (level-1) × ₡500`
- Update test expectations

### Debug Commands

```bash
# Find remaining 0.1 references
grep -r "* 0.1" tests/

# Find income_generator references
grep -r "income_generator" tests/

# Run specific test
npm test -- streamingRevenueFormula.property.test.ts

# Run with verbose output
npm test -- --verbose
```

---

## After Everything Passes

### 1. Commit Changes
```bash
git add .
git commit -m "feat: Update Streaming Studio to 100% per level, rename Income Generator to Merchandising Hub

- Streaming Studio multiplier: 0.1 → 1.0 (10× increase)
- L1: 2× (double), L2: 3× (triple), L10: 11× multiplier
- Break-even: 17-25 cycles for 2-3 robot strategies

- Merchandising Hub (renamed from Income Generator)
- Investment: ₡150K per level (was ₡400K+)
- Income: ₡5K per level (linear)
- Operating cost: ₡200 per level (was ₡1K+)
- Break-even: ~31 cycles

- Updated all backend services and routes
- Updated frontend components
- Updated test files with new multiplier
- Created comprehensive documentation"
```

### 2. Create PR
- Include documentation links
- Highlight break-even improvements
- Note test coverage

### 3. Deploy
- Run migration on production
- Monitor for issues
- Verify player feedback

---

## Documentation Reference

- **Complete Details:** FACILITIES_ECONOMICS_IMPLEMENTATION.md
- **Break-Even Analysis:** STREAMING_STUDIO_100_PERCENT_ANALYSIS.md
- **Test Status:** TEST_FILES_UPDATE_STATUS.md
- **Quick Reference:** IMPLEMENTATION_SUMMARY.md

---

## Questions?

Refer to the documentation files above for:
- Detailed implementation notes
- Break-even calculations
- Test update procedures
- Migration instructions

**Status: Ready for Testing** ✓
