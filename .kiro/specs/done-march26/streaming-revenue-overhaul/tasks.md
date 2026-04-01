# Implementation Plan: Streaming Revenue Overhaul

## Overview

This implementation plan converts the streaming revenue system from daily passive income (Income Generator L3+) to per-battle rewards. The implementation follows a phased approach to minimize risk and ensure thorough testing at each stage.

Key implementation areas:
1. Create Streaming Studio facility configuration
2. Implement streaming revenue calculation service
3. Integrate with battle orchestrators (1v1, Tag Team, Tournament)
4. Remove streaming from Income Generator
5. Add display and analytics tracking
6. Update Facility Advisor for ROI analysis

## Tasks

- [x] 1. Create Streaming Studio facility configuration
  - Add Streaming Studio to FACILITY_TYPES array in `prototype/backend/src/config/facilities.ts`
  - Configure 10 levels with costs: [100000, 200000, ..., 1000000]
  - Configure prestige requirements: [0, 0, 0, 1000, 2500, 5000, 10000, 15000, 25000, 50000]
  - Configure operating costs: level × 100
  - Set implemented: true
  - _Requirements: 4.1, 4.7, 5.2, 5.6, 6.1-6.8_

- [ ] 2. Implement streaming revenue calculation service
  - [x] 2.1 Create streamingRevenueService.ts with core calculation functions
    - Create `prototype/backend/src/services/streamingRevenueService.ts`
    - Implement `calculateStreamingRevenue()` for 1v1 battles
    - Implement `calculateTagTeamStreamingRevenue()` for Tag Team battles
    - Implement `getStreamingStudioLevel()` helper
    - Implement `awardStreamingRevenue()` to update user balance
    - Use formula: 1000 × (1 + battles/1000) × (1 + fame/5000) × (1 + level×0.1)
    - _Requirements: 1.2, 2.1, 3.1, 4.7_
  
  - [x] 2.2 Write property test for streaming revenue formula
    - **Property 1: Streaming Revenue Formula Correctness**
    - **Validates: Requirements 1.2, 2.1, 3.1, 4.7**
  
  - [x] 2.3 Write property test for battle count calculation
    - **Property 4: Battle Count Includes All Battle Types**
    - **Validates: Requirements 2.7**
  
  - [x] 2.4 Write property test for studio multiplier stable-wide application
    - **Property 6: Studio Multiplier Applies Stable-Wide**
    - **Validates: Requirements 4.8**

- [ ] 3. Integrate streaming revenue with 1v1 battle orchestrator
  - [x] 3.1 Modify processBattle() in battleOrchestrator.ts
    - Import streamingRevenueService
    - After updateRobotStats(), call calculateStreamingRevenue() for both robots
    - Skip calculation if isByeMatch is true
    - Call awardStreamingRevenue() for both robots
    - Add streamingRevenue1 and streamingRevenue2 to battle_complete event payload
    - Add terminal log: "[Streaming] RobotName earned ₡X,XXX from Battle #123"
    - _Requirements: 1.1, 1.6, 1.8, 9.1-9.6_
  
  - [x] 3.2 Write property test for streaming revenue awarded to all participants
    - **Property 2: Streaming Revenue Awarded to All Battle Participants**
    - **Validates: Requirements 1.1, 1.6, 1.7**
  
  - [x] 3.3 Write property test for no streaming revenue on bye matches
    - **Property 3: No Streaming Revenue for Bye Matches**
    - **Validates: Requirements 1.8**
  
  - [x] 3.4 Write unit tests for battle orchestrator integration
    - Test streaming revenue is calculated after battle
    - Test bye matches don't award streaming revenue
    - Test streaming revenue is added to audit log
    - Test terminal log contains streaming revenue
    - _Requirements: 1.1, 1.8, 9.1-9.6_

- [ ] 4. Integrate streaming revenue with Tag Team battle orchestrator
  - [x] 4.1 Modify Tag Team orchestrator to calculate streaming revenue
    - Import streamingRevenueService
    - After battle completion, call calculateTagTeamStreamingRevenue()
    - Award one payment per team (not per robot)
    - Add terminal log showing which robots' stats were used
    - _Requirements: 7.1-7.6_
  
  - [x] 4.2 Write property test for Tag Team max value selection
    - **Property 10: Tag Team Uses Maximum Values**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**
  
  - [x] 4.3 Write property test for Tag Team separate calculations
    - **Property 11: Tag Team Separate Calculations**
    - **Validates: Requirements 7.5**
  
  - [x] 4.4 Write property test for Tag Team single payment
    - **Property 12: Tag Team Single Payment Per Team**
    - **Validates: Requirements 7.6**

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Remove streaming revenue from Income Generator
  - [x] 6.1 Update Income Generator facility configuration
    - Modify benefits array in `prototype/backend/src/config/facilities.ts`
    - Remove all streaming revenue mentions
    - Update description to note streaming is now per-battle via Streaming Studio
    - _Requirements: 13.1-13.8_
  
  - [x] 6.2 Delete old streaming revenue functions from economyCalculations.ts
    - Delete `calculateStreamingIncome()` function
    - Delete `getStreamingBaseRate()` function
    - Update `calculateDailyPassiveIncome()` to only calculate merchandising
    - Remove streaming from all passive income calculations
    - _Requirements: 13.1-13.8_
  
  - [x] 6.3 Write property test for Income Generator no longer providing streaming
    - **Property 18: Income Generator No Longer Provides Streaming Revenue**
    - **Validates: Requirements 13.1-13.8**
  
  - [x] 6.4 Write unit tests for passive income calculations
    - Test Income Generator only provides merchandising
    - Test streaming revenue is not included in passive income
    - _Requirements: 13.1-13.8_

- [ ] 7. Add streaming revenue to battle log display
  - [x] 7.1 Update battle log UI component
    - Modify `prototype/frontend/src/components/BattleLog.tsx`
    - Add streaming revenue section after battle outcome
    - Display: "📺 Streaming Revenue: ₡X,XXX (Base: ₡1,000 × Battles: X.XX × Fame: X.XX × Studio: X.XX)"
    - For Tag Team, show which robot's stats were used
    - _Requirements: 8.1-8.8_
  
  - [x] 7.2 Write property test for battle log contains streaming revenue data
    - **Property 13: Battle Log Contains Streaming Revenue Data**
    - **Validates: Requirements 8.1-8.8**

- [ ] 8. Add streaming revenue tracking and analytics
  - [x] 8.1 Create database migration for robot_streaming_revenue table
    - Create migration file in `prototype/backend/prisma/migrations/`
    - Add RobotStreamingRevenue model to schema.prisma
    - Fields: id, robotId, cycleNumber, streamingRevenue, battlesInCycle, createdAt
    - Add unique constraint on [robotId, cycleNumber]
    - _Requirements: 15.1-15.7, 18.1-18.7_
  
  - [x] 8.2 Create robotAnalyticsService.ts for tracking
    - Create `prototype/backend/src/services/robotAnalyticsService.ts`
    - Implement `trackStreamingRevenue()` function
    - Implement `getRobotStreamingAnalytics()` function
    - Call from streamingRevenueService after awarding revenue
    - _Requirements: 15.1-15.7, 18.1-18.7, 19.1-19.7_
  
  - [x] 8.3 Write property test for streaming revenue tracked per robot per cycle
    - **Property 19: Streaming Revenue Tracked Per Robot Per Cycle**
    - **Validates: Requirements 15.1-15.7, 18.1-18.7, 19.1-19.7**

- [ ] 9. Update cycle summary and CSV export
  - [x] 9.1 Add streaming revenue to cycle summary display
    - Modify cycle execution service to aggregate streaming revenue
    - Add streaming revenue line item to cycle summary table
    - Display total streaming revenue earned across all battles
    - _Requirements: 11.1-11.9_
  
  - [x] 9.2 Add streaming_revenue column to cycle CSV export
    - Modify `prototype/backend/src/services/cycleCsvExportService.ts`
    - Add streaming_revenue column to CSV header
    - Populate with revenue earned per battle
    - Show ₡0 for bye matches
    - _Requirements: 10.1-10.7_
  
  - [x] 9.3 Write property test for cycle summary includes streaming revenue
    - **Property 16: Cycle Summary Includes Total Streaming Revenue**
    - **Validates: Requirements 11.1-11.9**
  
  - [x] 9.4 Write property test for CSV contains streaming revenue column
    - **Property 15: Cycle CSV Contains Streaming Revenue Column**
    - **Validates: Requirements 10.1-10.7**

- [ ] 10. Update financial report integration
  - [x] 10.1 Add streaming revenue to daily financial report
    - Modify financial report generation
    - Add streaming revenue as separate line item under "Revenue Streams"
    - Display: "Streaming (per battle): ₡XX,XXX (from YY battles)"
    - Include in total daily revenue calculation
    - _Requirements: 12.1-12.7_
  
  - [x] 10.2 Write property test for financial report includes streaming revenue
    - **Property 17: Financial Report Includes Streaming Revenue**
    - **Validates: Requirements 12.1-12.7**

- [x] 11. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Integrate with Facility Advisor for ROI analysis
  - [x] 12.1 Add Streaming Studio to Facility Advisor
    - Modify `prototype/backend/src/services/facilityRecommendationService.ts`
    - Add Streaming Studio analysis to facility recommendations
    - Calculate current streaming revenue per battle (average)
    - Calculate projected revenue increase at next level
    - Calculate break-even point in number of battles
    - Calculate estimated payback period in days
    - Show 30-day projected returns comparison
    - _Requirements: 17.1-17.9_
  
  - [x] 12.2 Write property test for Facility Advisor provides Streaming Studio ROI
    - **Property 21: Facility Advisor Provides Streaming Studio ROI**
    - **Validates: Requirements 17.1-17.9**

- [ ] 13. Add tournament streaming revenue support
  - [x] 13.1 Integrate streaming revenue with tournament battles
    - Modify tournament battle processing
    - Award streaming revenue for all tournament rounds
    - Skip streaming revenue for tournament byes
    - Include in tournament battle logs and cycle summary
    - _Requirements: 16.1-16.7_
  
  - [x] 13.2 Write property test for tournament battles award streaming revenue
    - **Property 20: Tournament Battles Award Streaming Revenue**
    - **Validates: Requirements 16.1-16.7**

- [ ] 14. Add Streaming Studio operating costs to daily financial calculations
  - [x] 14.1 Update daily operating cost calculations
    - Modify operating cost service to include Streaming Studio
    - Calculate: level × 100 credits per day
    - Include in daily financial report
    - _Requirements: 5.6, 5.9_
  
  - [x] 14.2 Write property test for Streaming Studio operating costs
    - **Property 8: Streaming Studio Operating Cost Formula**
    - **Validates: Requirements 5.6, 5.9**

- [ ] 15. Add prestige requirement validation for Streaming Studio upgrades
  - [x] 15.1 Implement prestige validation in facility upgrade logic
    - Check prestige requirements before allowing upgrades
    - Display error message with required prestige amount if insufficient
    - _Requirements: 6.1-6.9_
  
  - [x] 15.2 Write property test for prestige requirements enforced
    - **Property 9: Streaming Studio Prestige Requirements**
    - **Validates: Requirements 6.1-6.9**

- [ ] 16. Write property test for upgrade cost formula
  - [x] 16.1 Write property test for Streaming Studio upgrade costs
    - **Property 7: Streaming Studio Upgrade Cost Formula**
    - **Validates: Requirements 5.2**

- [ ] 17. Write property test for stats updated before calculation
  - [x] 17.1 Write property test for stats updated before streaming revenue calculation
    - **Property 5: Stats Updated Before Streaming Revenue Calculation**
    - **Validates: Requirements 2.8, 3.7, 3.8**

- [ ] 18. Write property test for terminal log contains streaming revenue
  - [x] 18.1 Write property test for terminal log contains streaming revenue
    - **Property 14: Terminal Log Contains Streaming Revenue**
    - **Validates: Requirements 9.1-9.6**

- [x] 19. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 20. Update documentation
  - [x] 20.1 Update PRD_ECONOMY_SYSTEM.md
    - Update revenue streams section with per-battle streaming formula
    - Add Streaming Studio facility documentation
    - Remove streaming from Income Generator description
    - Update economic balance examples
    - _Requirements: 19.1-19.4_
  
  - [x] 20.2 Update STABLE_SYSTEM.md
    - Add Streaming Studio specifications
    - Update facility comparison tables
    - _Requirements: 19.5, 19.11_
  
  - [x] 20.3 Update in-game help text and tooltips
    - Update facility tooltips for Income Generator and Streaming Studio
    - Update financial report help text
    - Add streaming revenue explanation
    - _Requirements: 19.6, 19.7, 19.10_

## Notes

- Tasks marked with `*` are optional property-based tests and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties across all inputs
- Unit tests validate specific examples and edge cases
- The implementation follows a phased approach: facility → calculation → integration → display → analytics
