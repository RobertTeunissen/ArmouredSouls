# Implementation Plan: Repair Bay Multi-Robot Discount System

## Overview

This implementation updates the Repair Bay discount formula to include a multi-robot bonus and consolidates all repair cost calculations into a single canonical function. The new formula is: `discount = repairBayLevel × (5 + activeRobotCount)`, capped at 90%.

## Tasks

- [x] 1. Update canonical repair cost calculation function
  - [x] 1.1 Add activeRobotCount parameter to calculateRepairCost in robotCalculations.ts
    - Add new parameter with default value of 0 for backward compatibility
    - Update discount calculation to use new formula: `repairBayLevel × (5 + activeRobotCount)`
    - Apply 90% cap to the calculated discount
    - Ensure Medical Bay reduction logic remains unchanged
    - _Requirements: 1.1, 1.2, 1.3, 3.1, 3.2, 3.4_

  - [x] 1.2 Write property test for multi-robot discount formula with cap
    - **Property 1: Multi-Robot Discount Formula with Cap**
    - **Validates: Requirements 1.1, 1.2, 1.3**

  - [x] 1.3 Write property test for Medical Bay reduction preservation
    - **Property 3: Medical Bay Reduction Preserved**
    - **Validates: Requirements 3.4, 8.4**

  - [x] 1.4 Write property test for attribute-sum formula consistency
    - **Property 4: Attribute-Sum Formula Consistency**
    - **Validates: Requirements 8.3**

  - [x] 1.5 Write unit tests for backward compatibility
    - Test that missing activeRobotCount parameter defaults to 0
    - Test specific discount examples from requirements
    - _Requirements: 3.2, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 2. Remove duplicate repair cost functions
  - [x] 2.1 Remove calculateRepairCostWithDiscounts from economyCalculations.ts
    - Delete the duplicate function entirely
    - Update any imports that reference this function
    - _Requirements: 8.10_

  - [x] 2.2 Remove calculateRepairCost from tagTeamBattleOrchestrator.ts
    - Delete the local repair cost function
    - Import calculateRepairCost and calculateAttributeSum from robotCalculations.ts
    - _Requirements: 8.11_

- [x] 3. Update repair service to query robot count
  - [x] 3.1 Add robot count query to repairService.ts
    - Query active robot count for each user (exclude "Bye Robot")
    - Pass robot count to calculateRepairCost function
    - Update discount reporting to reflect new formula
    - _Requirements: 2.1, 2.2, 2.3, 7.1, 7.2, 7.3_

  - [x] 3.2 Write property test for robot count includes all robots
    - **Property 2: Robot Count Includes All Robots**
    - **Validates: Requirements 2.1, 2.2, 2.3**

- [x] 4. Update tag team battle orchestrator
  - [x] 4.1 Replace local repair cost calculation with canonical function
    - Convert robot damage to attribute-sum formula parameters
    - Calculate sumOfAllAttributes using calculateAttributeSum
    - Calculate damagePercent and hpPercent from robot state
    - Call canonical calculateRepairCost with all parameters including activeRobotCount
    - _Requirements: 8.6_

  - [x] 4.2 Write integration test for tag team repair cost consistency
    - Verify tag team battles use canonical function
    - Verify repair costs match league battle costs for same damage
    - _Requirements: 8.6_

- [x] 5. Update battle orchestrator for league battles
  - [x] 5.1 Ensure league battles use canonical function with robot count
    - Verify battleOrchestrator.ts calls calculateRepairCost correctly
    - Add robot count query if not already present
    - Pass activeRobotCount parameter to repair cost calculation
    - _Requirements: 8.7_

  - [x] 5.2 Write integration test for league battle repair cost consistency
    - Verify league battles use canonical function
    - _Requirements: 8.7_

- [x] 6. Update tournament service (if applicable)
  - [x] 6.1 Ensure tournament battles use canonical function with robot count
    - Check if tournamentService.ts calculates repair costs
    - If yes, update to use canonical function with activeRobotCount
    - If no, skip this task
    - _Requirements: 8.8_

- [x] 7. Update auto-repair functionality
  - [x] 7.1 Ensure all 3 auto-repair triggers use canonical function
    - Verify repairAllRobots function uses canonical calculateRepairCost
    - Ensure robot count is queried and passed for each user
    - Verify all 3 cycle repair triggers (post-league, post-tag-team, post-tournament) use same function
    - _Requirements: 8.9_

  - [x] 7.2 Write property test for repair cost consistency across battle types
    - **Property 5: Repair Cost Consistency Across Battle Types**
    - **Validates: Requirements 8.6, 8.7, 8.8, 8.9**

- [x] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Update documentation
  - [x] 9.1 Update STABLE_SYSTEM.md with new Repair Bay formula
    - Update Repair Bay facility description
    - Add examples showing multi-robot discount calculations
    - Update ROI analysis to reflect multi-robot benefits
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 9.2 Update PRD_FACILITIES_PAGE.md with new benefits display
    - Update Repair Bay benefits description
    - Add multi-robot discount explanation
    - _Requirements: 5.4_

  - [x] 9.3 Update PRD_ECONOMY_SYSTEM.md with new discount formula
    - Update all repair cost calculation examples
    - Update Repair Bay discount formula documentation
    - Update ROI analysis sections
    - _Requirements: 5.5, 5.9, 5.10_

  - [x] 9.4 Update PRD_BATTLE_STANCES_AND_YIELD.md with new formula
    - Update repair cost calculation examples
    - Update Repair Bay discount references
    - _Requirements: 5.6_

  - [x] 9.5 Add warning about 90% discount cap
    - Document when further investment provides no benefit
    - Add examples of cap scenarios
    - _Requirements: 5.7, 5.8_

- [x] 10. Final checkpoint - Verify all requirements met
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based tests and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (minimum 100 iterations each)
- Unit tests validate specific examples and edge cases
- Integration tests verify consistency across all battle types and auto-repair triggers
- The consolidation removes duplicate code and ensures all repair costs are calculated consistently
