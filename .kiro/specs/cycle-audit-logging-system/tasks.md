# Implementation Plan: Cycle-Based Audit Logging and Analytics System

## Overview

This plan implements a pure event sourcing architecture for cycle-based audit logging and analytics. The implementation is divided into 4 phases, each delivering frontend-visible functionality for early testing.

## Tasks

- [x] 1. Phase 1: Core Event Infrastructure + Basic Analytics (Week 1)
  - [x] 1.1 Create database schema for event sourcing
    - Create audit_logs table with JSONB payload
    - Create cycle_snapshots table
    - Add indexes for efficient querying
    - Update Prisma schema
    - _Requirements: 9.3, 10.1_
  
  - [x] 1.2 Implement EventLogger service
    - Create EventLogger interface and implementation
    - Implement sequence number generation per cycle
    - Add event validation and schema checking
    - Implement batch event insertion for performance
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_
  
  - [x] 1.3 Write property test for event logging completeness
    - **Property 1: Event Logging Completeness**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10**
  
  - [x] 1.4 Write property test for event metadata consistency
    - **Property 2: Event Metadata Consistency**
    - **Validates: Requirements 9.3, 15.1, 15.2, 15.3**
  
  - [x] 1.5 Migrate battle events to event log
    - Write migration script to convert Battle table rows to events
    - Test migration with existing data
    - Verify data integrity after migration
    - _Requirements: 11.5_
  
  - [x] 1.6 Update battle orchestrator to log events
    - Modify battleOrchestrator.ts to emit battle_complete events
    - Remove Battle table inserts
    - Add event logging for ELO changes, damage, rewards
    - _Requirements: 2.3, 2.4, 2.5_
  
  - [x] 1.7 Implement CycleSnapshotService
    - Create service to aggregate events per cycle
    - Implement snapshot creation at cycle end
    - Add snapshot retrieval methods
    - _Requirements: 10.1, 10.5_
  
  - [x] 1.8 Write property test for cycle snapshot consistency
    - **Property 4: Cycle Snapshot Consistency**
    - **Validates: Requirements 10.1, 10.5**
  
  - [x] 1.9 Create basic analytics API endpoint
    - GET /api/analytics/stable/:userId/summary?lastNCycles=10
    - Return income, expenses, net profit for last N cycles
    - Query audit_logs and cycle_snapshots
    - _Requirements: 12.1_
  
  - [x] 1.10 Write unit tests for analytics API
    - Test summary endpoint with known data
    - Test edge cases (no data, single cycle, etc.)
    - _Requirements: 12.1_
  
  - [x] 1.11 Create frontend component for cycle summary
    - Display last 10 cycles income/expenses
    - Show net profit trend
    - Add simple chart visualization
    - _Requirements: 6.1, 6.3_

- [x] 2. Checkpoint - Verify Phase 1 deliverables
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Phase 2: Historical Comparisons + Trend Charts (Week 2)
  - [x] 3.1 Implement comparison service
    - Create ComparisonService for historical comparisons
    - Implement cycle-to-cycle comparison logic
    - Calculate deltas and percentage changes
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [x] 3.2 Write property test for historical comparison correctness
    - **Property 8: Historical Comparison Correctness**
    - **Validates: Requirements 6.1, 6.3**
  
  - [x] 3.3 Add comparison API endpoint
    - GET /api/analytics/comparison?userId=X&current=Y&comparison=Z
    - Return current vs historical metrics with deltas
    - Handle missing data gracefully
    - _Requirements: 6.4, 12.4_
  
  - [x] 3.4 Write property test for insufficient data handling
    - **Property 17: Insufficient Data Handling**
    - **Validates: Requirements 6.4**
  
  - [x] 3.5 Implement trend analysis service
    - Create TrendAnalysisService for time-series data
    - Implement moving average calculations
    - Add trend line computation
    - _Requirements: 7.5_
  
  - [x] 3.6 Add trend data API endpoint
    - GET /api/analytics/trends?userId=X&metric=Y&cycleRange=[A,B]
    - Return time-series data formatted for graphing
    - Support multiple metrics (income, expenses, net profit)
    - _Requirements: 12.5_
  
  - [x] 3.7 Write property test for time-series data completeness
    - **Property 9: Time-Series Data Completeness**
    - **Validates: Requirements 7.1, 7.3, 12.5**
  
  - [x] 3.8 Create frontend comparison component
    - Display yesterday vs week ago comparison
    - Show deltas and percentage changes
    - Add trend charts for income/expenses
    - _Requirements: 6.2, 6.3_

- [x] 4. Checkpoint - Verify Phase 2 deliverables
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Phase 3: Robot Analytics + ELO Progression (Week 3)
  - [x] 5.1 Implement robot performance queries
    - Query audit_logs for robot-specific events
    - Aggregate battle stats per robot
    - Calculate win rates and earnings
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  
  - [x] 5.2 Add robot performance API endpoint
    - GET /api/analytics/robot/:robotId/performance?cycleRange=[A,B]
    - Return ELO progression, win rate, earnings
    - Include damage dealt/received stats
    - _Requirements: 12.2_
  
  - [x] 5.3 Implement metric progression service
    - Extract metric changes from battle_complete events
    - Build time-series data for multiple metrics (ELO, fame, damage, wins, losses, draws, kills, etc.)
    - Calculate moving averages and trends for any metric
    - Support metrics: elo, fame, damageDealt, damageReceived, wins, losses, draws, kills, creditsEarned
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  
  - [x] 5.4 Write property test for metric progression continuity
    - **Property 6: Metric Progression Continuity** (generalized from ELO)
    - **Validates: Requirements 7.2, 7.3**
  
  - [x] 5.5 Add metric progression API endpoint
    - GET /api/analytics/robot/:robotId/metric/:metricName?cycleRange=[A,B]
    - Support multiple metrics: elo, fame, damageDealt, damageReceived, wins, losses, draws, kills, creditsEarned
    - Return metric data points for each cycle with moving averages
    - Support filtering and aggregation
    - _Requirements: 7.1, 7.3, 7.4_
  
  - [x] 5.6 Create materialized view for current robot stats
    - Create current_robot_stats materialized view
    - Aggregate battle stats from audit_logs
    - Add refresh logic at cycle end
    - _Requirements: 10.3_
  
  - [x] 5.7 Create frontend robot performance dashboard
    - Display robot stats (battles, wins, losses, ELO)
    - Show ELO progression graph
    - Add damage and earnings charts
    - _Requirements: 7.1, 7.3, 12.2_

- [x] 6. Checkpoint - Verify Phase 3 deliverables
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Phase 4: Facility ROI + Investment Recommendations (Week 4)
  - [x] 7.1 Implement facility transaction logging
    - Add event logging to facility purchase/upgrade endpoints
    - Log facility_purchase and facility_upgrade events
    - Include cost and level changes
    - _Requirements: 1.6, 5.1_
  
  - [x] 7.2 Implement passive income logging
    - Add passive income calculation to cycle execution
    - Log passive_income events with merchandising/streaming breakdown
    - Include facility level and user stats
    - _Requirements: 1.3, 1.4, 5.2_
  
  - [x] 7.3 Implement operating costs logging
    - Add operating costs calculation to cycle execution
    - Log operating_costs events with facility breakdown
    - Include total cost per cycle
    - _Requirements: 1.5, 5.4_
  
  - [x] 7.4 Implement ROI calculator service
    - Create ROICalculatorService for facility analysis
    - Calculate total investment, returns, and net ROI
    - Compute breakeven cycle and time-to-payoff
    - _Requirements: 5.5, 8.2_
  
  - [x] 7.5 Write property test for facility ROI calculation accuracy
    - **Property 7: Facility ROI Calculation Accuracy**
    - **Validates: Requirements 5.5, 8.2**
  
  - [x] 7.6 Add facility ROI API endpoint
    - GET /api/analytics/facility/:userId/roi?facilityType=X
    - Return investment cost, returns, ROI, breakeven
    - Include historical income and discount data
    - _Requirements: 12.3_
  
  - [x] 7.7 Implement facility recommendation service
    - Analyze last N cycles for facility performance
    - Identify facilities with positive ROI
    - Rank recommendations by projected ROI
    - _Requirements: 8.3, 8.5_
  
  - [x] 7.8 Write property test for investment recommendation ranking
    - **Property 22: Investment Recommendation Ranking**
    - **Validates: Requirements 8.3, 8.5**
  
  - [x] 7.9 Add facility recommendations API endpoint
    - GET /api/analytics/facility/:userId/recommendations?lastNCycles=10
    - Return ranked facility recommendations
    - Include ROI projections and payoff estimates
    - _Requirements: 8.5_
  
  - [x] 7.10 Create frontend facility investment advisor
    - Display current facility ROI
    - Show investment recommendations
    - Add ROI projection charts
    - _Requirements: 8.2, 8.3, 8.5, 12.3_

- [x] 8. Checkpoint - Verify Phase 4 deliverables
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Final Integration and Polish
  - [x] 9.1 Implement cycle execution timing
    - Add cycle_start, cycle_step_complete, cycle_complete events
    - Log step durations and total cycle time
    - Track trigger type (manual vs scheduled)
    - _Requirements: 11.1, 11.2, 15.1, 15.2, 15.3_
  
  - [x] 9.2 Write property test for cycle step duration recording
    - **Property 15: Cycle Step Duration Recording**
    - **Validates: Requirements 15.2, 15.3**
  
  - [x] 9.3 Implement cycle performance monitoring
    - Create service to detect performance degradation
    - Identify slow steps and trends
    - Add alerting for degradation
    - _Requirements: 15.4_
  
  - [x] 9.4 Write property test for performance degradation detection
    - **Property 16: Performance Degradation Detection**
    - **Validates: Requirements 15.4**
  
  - [x] 9.5 Implement data integrity validation
    - Create validation service for credit sum consistency
    - Add sequence number continuity checks
    - Implement integrity report generation
    - _Requirements: 9.2, 9.4_
  
  - [x] 9.6 Write property test for credit change audit trail
    - **Property 3: Credit Change Audit Trail**
    - **Validates: Requirements 9.4**
  
  - [x] 9.7 Add query service with filtering
    - Implement QueryService for event retrieval
    - Support filtering by cycle, user, robot, event type
    - Add pagination and sorting
    - _Requirements: 9.5_
  
  - [x] 9.8 Write property test for event queryability
    - **Property 5: Event Queryability**
    - **Validates: Requirements 9.2, 9.5**
  
  - [x] 9.9 Create admin dashboard for system health
    - Display cycle performance metrics
    - Show data integrity status
    - Add event log statistics
    - _Requirements: 15.4, 15.5_
  
  - [x] 9.10 Final testing and documentation
    - Run all property tests and unit tests
    - Verify all requirements are met
    - Update API documentation
    - Create user guide for analytics features

- [x] 10. Final Checkpoint - Complete system verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based tests that can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after each phase
- Property tests validate universal correctness properties (100+ iterations each)
- Unit tests validate specific examples and edge cases
- Each phase delivers frontend-visible functionality for early user feedback
