# Implementation Plan: Manual Repair Cost Reduction

## Overview

Apply a 50% discount to manual robot repairs while preserving automatic repair costs. The implementation proceeds backend-first (discount logic → audit logging → admin endpoint), then frontend (cost display → admin tab), then testing.

## Tasks

- [x] 1. Apply 50% manual repair discount in backend endpoint
  - [x] 1.1 Modify `POST /api/robots/repair-all` in `prototype/backend/src/routes/robots.ts` to apply `MANUAL_REPAIR_DISCOUNT = 0.5`
    - Add `const MANUAL_REPAIR_DISCOUNT = 0.5;` constant
    - Change `finalCost` calculation to: `const costAfterRepairBay = Math.floor(totalBaseCost * (1 - discount / 100)); const finalCost = Math.floor(costAfterRepairBay * MANUAL_REPAIR_DISCOUNT);`
    - Remove currency check — manual repairs are always allowed (balance can go negative)
    - Update response payload to include `manualRepairDiscount: 50`, `preDiscountCost: costAfterRepairBay`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.1, 4.2, 4.3_

  - [x] 1.2 Write property tests for manual discount formula
    - **Property 1: Manual discount formula** — For any valid base cost and Repair Bay discount (0–90), manual cost equals `Math.floor(Math.floor(baseCost * (1 - repairBayDiscount / 100)) * 0.5)`
    - **Validates: Requirements 1.1, 1.2, 1.3, 3.1**
    - Create `prototype/backend/tests/manualRepairDiscount.property.test.ts`
    - Use `fc.nat(1_000_000)` for baseCost, `fc.integer({min:0, max:90})` for repairBayDiscount

  - [x] 1.3 Write property tests for manual cost bounds
    - **Property 4: Manual cost ≤ automatic cost** — For any valid inputs, manual cost is at most the automatic cost
    - **Property 5: Manual cost non-negative** — For any valid inputs, manual cost ≥ 0
    - **Validates: Requirements 1.1, 6.5, 6.6**
    - Add to `prototype/backend/tests/manualRepairDiscount.property.test.ts`

  - [x] 1.4 Write unit tests for manual repair discount
    - Create `prototype/backend/tests/manualRepairDiscount.test.ts`
    - Test 50% discount on known cost (base 10000, no Repair Bay → 5000)
    - Test odd cost rounds down (base 10001 → `Math.floor(10001 * 0.5)` = 5000)
    - Test Repair Bay 90% + manual 50% stacking (base 100000 → 10000 → 5000)
    - Test Repair Bay 0% + manual 50% (edge case from Req 1.3)
    - Test zero damage → zero cost
    - Test response contains `manualRepairDiscount` and `preDiscountCost` fields
    - Test negative balance allowed (credits < cost → balance goes negative)
    - Test zero credits → balance goes negative
    - Test already-negative credits → balance goes further negative
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.1, 4.2, 4.3, 6.1, 6.2, 6.7_

- [x] 2. Update audit logging with repairType field
  - [x] 2.1 Extend `EventLogger.logRobotRepair()` in `prototype/backend/src/services/eventLogger.ts`
    - Add optional parameters: `repairType?: 'manual' | 'automatic'`, `manualRepairDiscount?: number`, `preDiscountCost?: number`
    - Include `repairType`, `manualRepairDiscount`, and `preDiscountCost` in the audit log payload when provided
    - _Requirements: 5.1, 7.1, 7.2, 7.3_

  - [x] 2.2 Pass `repairType: 'manual'` from `POST /api/robots/repair-all` in `prototype/backend/src/routes/robots.ts`
    - Call `eventLogger.logRobotRepair()` for each repaired robot with `repairType: 'manual'`, `manualRepairDiscount: 50`, and `preDiscountCost`
    - _Requirements: 5.1, 5.2, 7.1, 7.3_

  - [x] 2.3 Pass `repairType: 'automatic'` from `repairAllRobots()` in `prototype/backend/src/services/repairService.ts`
    - Update the existing `eventLogger.logRobotRepair()` call to include `repairType: 'automatic'`
    - No cost calculation changes — automatic repairs remain at full price
    - _Requirements: 2.1, 2.2, 2.3, 7.2_

  - [x] 2.4 Write property test for repair type tagging
    - **Property 6: Repair type correctly tagged** — Manual endpoint logs `repairType: "manual"`, automatic path logs `repairType: "automatic"`
    - **Validates: Requirements 7.1, 7.2**
    - Add to `prototype/backend/tests/manualRepairDiscount.property.test.ts`

  - [x] 2.5 Write property test for automatic repair cost unchanged
    - **Property 2: Automatic repair cost unchanged** — For any valid inputs, `calculateRepairCost()` output is identical with no manual discount applied
    - **Validates: Requirements 2.1, 2.2, 2.3**
    - Add to `prototype/backend/tests/manualRepairDiscount.property.test.ts`

  - [x] 2.6 Write regression unit tests for automatic repair path
    - Add to `prototype/backend/tests/manualRepairDiscount.test.ts`
    - Verify `calculateRepairCost()` output unchanged for known input/output pairs
    - Verify `repairAllRobots(true)` does not include `manualRepairDiscount` in audit payload
    - _Requirements: 2.1, 2.2, 2.3, 6.3_

- [x] 3. Checkpoint — Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Add admin audit log endpoint for repair filtering
  - [x] 4.1 Create `GET /api/admin/audit-log/repairs` endpoint in `prototype/backend/src/routes/admin.ts`
    - Accept query params: `repairType` (manual|automatic), `startDate`, `endDate`, `page`, `limit`
    - Query `auditLog` table for `eventType: 'robot_repair'`, filter by `repairType` in JSON payload
    - Join with `user` table for `stableName` and `robot` table for `robotName`
    - Return `RepairLogResponse` with events array, summary stats (totalManualRepairs, totalAutomaticRepairs, totalSavings), and pagination
    - Validate `repairType` param, return 400 for invalid values
    - _Requirements: 7.4, 7.5, 7.6_

  - [x] 4.2 Write property test for currency validation
    - **Property 3: Manual repairs always allowed (no currency gate)** — Repair always allowed regardless of balance; new balance equals currency minus discounted cost (can be negative)
    - **Validates: Requirements 4.1, 4.2, 4.3**
    - Add to `prototype/backend/tests/manualRepairDiscount.property.test.ts`

- [x] 5. Update frontend cost display on robots page
  - [x] 5.1 Update `calculateTotalRepairCost()` and button label in `prototype/frontend/src/pages/RobotsPage.tsx`
    - Add `const MANUAL_REPAIR_DISCOUNT = 0.5;`
    - Apply `Math.floor(costAfterRepairBay * MANUAL_REPAIR_DISCOUNT)` to the displayed cost
    - Button label shows the discounted cost
    - _Requirements: 3.1, 3.4_

  - [x] 5.2 Update repair confirmation modal in `prototype/frontend/src/pages/RobotsPage.tsx`
    - Show discount breakdown: Repair Bay discount %, Manual Repair Discount 50%, Final Cost
    - When Repair Bay discount is active, show both as separate line items
    - _Requirements: 3.2, 3.3_

- [x] 6. Build admin Repair Log tab
  - [x] 6.1 Add `RepairLogEvent` and `RepairLogResponse` interfaces to `prototype/frontend/src/components/admin/types.ts`
    - Define interfaces matching the backend response shape from task 4.1
    - _Requirements: 7.5_

  - [x] 6.2 Create `RepairLogTab` component in `prototype/frontend/src/components/admin/RepairLogTab.tsx`
    - Summary stats bar: Total Manual Repairs, Total Automatic Repairs, Total Savings
    - Filters: Repair Type select (All/Manual/Automatic), Start Date, End Date
    - Data table columns: Player, Robot, Repair Type (badge), Cost, Pre-Discount Cost, Savings, Timestamp
    - Pagination with Previous/Next buttons (default limit 25)
    - Loading and error states following existing admin tab patterns
    - _Requirements: 7.4, 7.5, 7.6_

  - [x] 6.3 Register `RepairLogTab` in `prototype/frontend/src/pages/AdminPage.tsx`
    - Add `'repair-log'` to `TabType` union and `VALID_TABS` array
    - Add `'repair-log': '🔧 Repair Log'` to `TAB_LABELS`
    - Import `RepairLogTab` from `../components/admin`
    - Add tab panel rendering block for `activeTab === 'repair-log'`
    - _Requirements: 7.4_

  - [x] 6.4 Export `RepairLogTab` from `prototype/frontend/src/components/admin/index.ts`
    - Add `export { RepairLogTab } from './RepairLogTab';` to barrel file
    - _Requirements: 7.4_

- [x] 7. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The discount is applied as a final multiplier after all existing discounts (Repair Bay, Medical Bay)
