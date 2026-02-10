# Prestige Features Completion - Tasks

**Feature Name**: prestige-features-completion  
**Created**: February 9, 2026  
**Status**: Ready for Implementation

## Task List

### Phase 1: Backend - Prestige Gates

- [x] 1. Update FacilityConfig interface
  - [x] 1.1 Add `prestigeRequirements?: number[]` field to FacilityConfig interface in `prototype/backend/src/config/facilities.ts`
  - [x] 1.2 Add JSDoc comments explaining the field format

- [-] 2. Add prestige requirements to all facility definitions
  - [x] 2.1 Add prestigeRequirements to Repair Bay (L4: 1000, L7: 5000, L9: 10000)
  - [ ] 2.2 Add prestigeRequirements to Training Facility (L4: 1000, L7: 5000, L9: 10000)
  - [ ] 2.3 Add prestigeRequirements to Weapons Workshop (L4: 1500, L7: 5000, L9: 10000)
  - [ ] 2.4 Add prestigeRequirements to Research Lab (L4: 2000, L7: 7500, L9: 15000)
  - [ ] 2.5 Add prestigeRequirements to Medical Bay (L4: 2000, L7: 7500, L9: 15000)
  - [ ] 2.6 Add prestigeRequirements to Roster Expansion (L4: 1000, L7: 5000, L9: 10000)
  - [ ] 2.7 Add prestigeRequirements to Coaching Staff (L3: 2000, L6: 5000, L9: 10000)
  - [ ] 2.8 Add prestigeRequirements to Booking Office (all levels 1-10)
  - [ ] 2.9 Add prestigeRequirements to Combat Training Academy (L3: 2000, L5: 4000, L7: 7000, L9: 10000, L10: 15000)
  - [ ] 2.10 Add prestigeRequirements to Defense Training Academy (L3: 2000, L5: 4000, L7: 7000, L9: 10000, L10: 15000)
  - [ ] 2.11 Add prestigeRequirements to Mobility Training Academy (L3: 2000, L5: 4000, L7: 7000, L9: 10000, L10: 15000)
  - [ ] 2.12 Add prestigeRequirements to AI Training Academy (L3: 2000, L5: 4000, L7: 7000, L9: 10000, L10: 15000)
  - [ ] 2.13 Add prestigeRequirements to Income Generator (L4: 3000, L7: 7500, L9: 15000)
  - [ ] 2.14 Verify Storage Facility has no prestige requirements (empty array or undefined)

- [ ] 3. Update facility upgrade endpoint with prestige validation
  - [ ] 3.1 Add prestige requirement check in POST `/api/facilities/:facilityType/upgrade` in `prototype/backend/src/routes/facility.ts`
  - [ ] 3.2 Return 403 status with detailed error when prestige insufficient
  - [ ] 3.3 Include required, current, and message fields in error response

- [ ] 4. Update facilities list endpoint
  - [ ] 4.1 Add `nextLevelPrestigeRequired` field to facility response in GET `/api/facilities`
  - [ ] 4.2 Add `hasPrestige` boolean field to facility response
  - [ ] 4.3 Include `userPrestige` in response root

### Phase 2: Backend - Income Multiplier API

- [ ] 5. Create helper function for next prestige tier
  - [ ] 5.1 Create `getNextPrestigeTier()` function in `prototype/backend/src/utils/economyCalculations.ts`
  - [ ] 5.2 Return null when max tier (50,000+) reached

- [ ] 6. Enhance financial report endpoint
  - [ ] 6.1 Add multiplier breakdown calculation to GET `/api/finances/report` in `prototype/backend/src/routes/finances.ts`
  - [ ] 6.2 Include prestige multiplier breakdown (current, multiplier, bonusPercent, nextTier)
  - [ ] 6.3 Include merchandising breakdown (baseRate, prestigeMultiplier, total, formula)
  - [ ] 6.4 Include streaming breakdown (baseRate, battleMultiplier, fameMultiplier, totalBattles, totalFame, total, formula)

### Phase 3: Frontend - Prestige Gates UI

- [-] 7. Update FacilitiesPage component
  - [ ] 7.1 Display prestige requirement text for next level in `prototype/frontend/src/pages/FacilitiesPage.tsx`
  - [ ] 7.2 Show lock icon (🔒) when prestige insufficient
  - [ ] 7.3 Show checkmark (✓) when prestige sufficient
  - [ ] 7.4 Disable upgrade button when prestige insufficient
  - [ ] 7.5 Add tooltip showing prestige requirement on disabled button

- [ ] 8. Add prestige validation error handling
  - [ ] 8.1 Handle 403 status in upgrade error handler
  - [ ] 8.2 Display user-friendly error message with current vs required prestige
  - [ ] 8.3 Refresh facilities list after error to show updated state

### Phase 4: Frontend - Income Multiplier Display

- [-] 9. Create MultiplierBreakdown component
  - [ ] 9.1 Create `prototype/frontend/src/components/MultiplierBreakdown.tsx`
  - [ ] 9.2 Add prestige bonus section with current prestige and bonus percentage
  - [ ] 9.3 Add next tier display (if not at max)
  - [ ] 9.4 Add merchandising income section with formula breakdown
  - [ ] 9.5 Add streaming income section with formula breakdown
  - [ ] 9.6 Style with consistent gray-800/gray-700 theme

- [x] 10. Update FinancialReportPage
  - [ ] 10.1 Import MultiplierBreakdown component in `prototype/frontend/src/pages/FinancialReportPage.tsx`
  - [ ] 10.2 Add MultiplierBreakdown to overview tab below DailyStableReport
  - [ ] 10.3 Conditionally render only if multiplierBreakdown data exists
  - [ ] 10.4 Update FinancialReport type to include multiplierBreakdown field

### Phase 5: Testing - Backend

- [-] 11. Write prestige gates unit tests
  - [ ] 11.1 Create `prototype/backend/src/__tests__/prestigeGates.test.ts`
  - [ ] 11.2 Test rejection of upgrade without sufficient prestige
  - [ ] 11.3 Test successful upgrade with sufficient prestige
  - [ ] 11.4 Test upgrade with no prestige requirement
  - [ ] 11.5 Test prestige requirements in facilities list response
  - [ ] 11.6 Verify >90% code coverage for prestige validation logic

- [-] 12. Write income multiplier unit tests
  - [ ] 12.1 Create `prototype/backend/src/__tests__/incomeMultipliers.test.ts`
  - [ ] 12.2 Test getPrestigeMultiplier() for all tiers (0, 5k, 10k, 25k, 50k)
  - [ ] 12.3 Test calculateMerchandisingIncome() with various prestige values
  - [ ] 12.4 Test calculateStreamingIncome() with various battle/fame values
  - [ ] 12.5 Test multiplier breakdown in financial report response
  - [ ] 12.6 Verify >90% code coverage for multiplier calculations

### Phase 6: Testing - Frontend

- [ ] 13. Write MultiplierBreakdown component tests
  - [ ] 13.1 Create `prototype/frontend/src/components/__tests__/MultiplierBreakdown.test.tsx`
  - [ ] 13.2 Test prestige bonus display
  - [ ] 13.3 Test next tier display
  - [ ] 13.4 Test merchandising breakdown display
  - [ ] 13.5 Test streaming breakdown display
  - [ ] 13.6 Verify >80% code coverage

- [ ] 14. Write FacilitiesPage prestige gates tests
  - [ ] 14.1 Create or update `prototype/frontend/src/pages/__tests__/FacilitiesPage.test.tsx`
  - [ ] 14.2 Test lock icon display when prestige insufficient
  - [ ] 14.3 Test checkmark display when prestige sufficient
  - [ ] 14.4 Test upgrade button disabled state
  - [ ] 14.5 Test error message display on 403 response
  - [ ] 14.6 Verify >80% code coverage

### Phase 7: Testing - Integration & Property-Based

- [ ] 15. Write integration tests
  - [ ] 15.1 Create `prototype/backend/src/__tests__/integration/prestigeFeatures.test.ts`
  - [ ] 15.2 Test end-to-end prestige gate enforcement
  - [ ] 15.3 Test end-to-end income multiplier display
  - [ ] 15.4 Test prestige increase allowing previously blocked upgrade

- [ ] 16. Write property-based tests (PBT)
  - [ ] 16.1 Create `prototype/backend/src/__tests__/properties/prestigeGates.property.test.ts`
  - [ ] 16.2 Write property test for prestige gate enforcement (Property 1)
  - [ ] 16.3 Write property test for multiplier calculation accuracy (Property 2)
  - [ ] 16.4 Run PBT with 100+ random test cases per property

### Phase 8: Documentation & Deployment

- [ ] 17. Update documentation
  - [ ] 17.1 Mark User Stories 6 and 7 as "Implemented" in `docs/prd_core/PRD_PRESTIGE_AND_FAME.md`
  - [ ] 17.2 Update implementation status in `docs/PRESTIGE_FAME_ANALYSIS.md`
  - [ ] 17.3 Mark Section 6 as "Implemented" in `docs/PRD_FACILITIES_PAGE_OVERHAUL.md`
  - [ ] 17.4 Mark Phase 7 as "Implemented" in `docs/PRD_INCOME_DASHBOARD.md`
  - [ ] 17.5 Add test coverage report to documentation

- [ ] 18. Final verification
  - [ ] 18.1 Run all tests and verify >80% overall coverage
  - [ ] 18.2 Run backend server and verify no errors
  - [ ] 18.3 Run frontend and manually test prestige gates
  - [ ] 18.4 Manually test income multiplier display
  - [ ] 18.5 Verify all 14 facilities have correct prestige requirements
  - [ ] 18.6 Create summary of changes for user-facing changelog

## Estimated Effort

- Phase 1 (Backend Prestige Gates): 3-4 hours
- Phase 2 (Backend Multiplier API): 2-3 hours
- Phase 3 (Frontend Prestige Gates): 2-3 hours
- Phase 4 (Frontend Multiplier Display): 3-4 hours
- Phase 5 (Backend Testing): 4-5 hours
- Phase 6 (Frontend Testing): 3-4 hours
- Phase 7 (Integration & PBT): 3-4 hours
- Phase 8 (Documentation): 2-3 hours

**Total**: 22-30 hours (3-4 days)

## Dependencies

- No database migrations required
- No external library additions required
- Requires existing economyCalculations.ts functions (already implemented)
- Requires existing Prisma schema (User.prestige, Robot.fame fields exist)

## Success Criteria

- [ ] All prestige-gated facilities enforce requirements correctly
- [ ] Zero facility upgrades succeed without meeting prestige requirements
- [ ] Income Dashboard displays all multiplier breakdowns
- [ ] All tests passing with >80% coverage
- [ ] Documentation updated to reflect implementation status
- [ ] Manual testing confirms UI displays correct information
