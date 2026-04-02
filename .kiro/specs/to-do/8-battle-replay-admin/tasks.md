# Implementation Plan: Battle Replay/Revert Admin Feature

## Overview

This implementation plan converts the battle replay/revert admin feature design into actionable coding tasks. The feature enables admins to revert and replay current-cycle battles that had bugs, atomically undoing all battle effects and optionally re-running with corrected code.

Implementation uses TypeScript throughout (backend services, API routes, frontend components) following existing project patterns.

## Tasks

- [ ] 1. Database schema changes and error codes
  - [ ] 1.1 Add Battle model fields for revert tracking
    - Add `revertedAt`, `revertedBy`, `replayOfBattleId` fields to Battle model in Prisma schema
    - Add self-relation for replay chain
    - Add indexes for new fields
    - Run `npx prisma migrate dev` to generate migration
    - _Requirements: 2.7, 3.4_

  - [ ] 1.2 Create BattleRevertErrorCode enum
    - Create `prototype/backend/src/errors/battleRevertError.ts`
    - Define error codes: BATTLE_NOT_FOUND, BATTLE_ALREADY_REVERTED, CLOSED_CYCLE_BATTLE, UNSUPPORTED_BATTLE_TYPE, REVERT_NOT_COMPLETED, REVERT_TRANSACTION_FAILED, REPLAY_TRANSACTION_FAILED
    - Create BattleRevertError class extending AppError
    - _Requirements: 1.8, 1.9, 1.10, 5.6_

- [ ] 2. Implement BattleRevertService
  - [ ] 2.1 Create BattleRevertService with validation methods
    - Create `prototype/backend/src/services/battleRevertService.ts`
    - Implement `validateBattle()` method checking: battle exists, not already reverted, is from current cycle
    - Implement `getCurrentCycleNumber()` and `getBattleCycleNumber()` helpers
    - _Requirements: 1.8, 1.9, 1.10, 2.1_

  - [ ] 2.2 Implement calculatePreview method
    - Load battle with participants, robots, and users
    - Calculate reverted stats for each robot (ELO, HP, fame, wins/losses, damage stats)
    - Calculate reverted stats for each user (currency, prestige, totalBattles, totalWins)
    - Include tag team stats for tag_team battles
    - Include KotH stats for koth battles
    - Count audit logs to mark as reverted
    - Identify match record to reset
    - Return complete RevertPreview object
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.11_

  - [ ]* 2.3 Write property test for preview completeness
    - **Property 1: Preview Completeness**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.11**

  - [ ]* 2.4 Write property test for closed-cycle rejection
    - **Property 2: Closed-Cycle Rejection**
    - **Validates: Requirements 1.10, 2.1**

  - [ ] 2.5 Implement executeRevert method
    - Wrap all operations in Prisma transaction with Serializable isolation
    - Restore robot stats to pre-battle values (ELO, HP, shield, fame, wins/losses/draws, damage stats, kills)
    - Handle tag team stats restoration for tag_team battles
    - Handle KotH stats restoration for koth battles
    - Restore user stats (currency, prestige, totalBattles, totalWins)
    - Mark Battle record with revertedAt and revertedBy
    - Mark associated AuditLog entries with reverted: true
    - Reset match record status to "scheduled" and clear battleId
    - Create audit log entry with eventType "battle_reverted"
    - Handle transaction rollback on failure
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11_

  - [ ]* 2.6 Write property test for revert atomicity
    - **Property 3: Revert Atomicity**
    - **Validates: Requirements 2.2, 2.10**

  - [ ]* 2.7 Write property test for revert restores pre-battle state
    - **Property 4: Revert Restores Pre-Battle State**
    - **Validates: Requirements 2.3, 2.4, 2.5, 2.6**

  - [ ]* 2.8 Write property test for revert marks affected records
    - **Property 5: Revert Marks Affected Records**
    - **Validates: Requirements 2.7, 2.8, 2.9, 2.11**

- [ ] 3. Checkpoint - Verify BattleRevertService
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement BattleReplayService
  - [ ] 4.1 Create BattleReplayService with replay method
    - Create `prototype/backend/src/services/battleReplayService.ts`
    - Implement `replayBattle()` method
    - Validate battle is reverted before replay
    - Load original robot configurations from BattleParticipant records
    - _Requirements: 3.1, 3.2, 3.9_

  - [ ] 4.2 Implement orchestrator dispatch
    - Call appropriate orchestrator based on battleType: leagueBattleOrchestrator, tournamentBattleOrchestrator, tagTeamBattleOrchestrator, kothBattleOrchestrator
    - Create new Battle record with replayOfBattleId linking to original
    - Create new BattleParticipant records
    - Update Robot and User stats as normal battle execution
    - Create AuditLog entries with eventType "battle_complete" for each robot
    - Create AuditLog entry with eventType "battle_replayed"
    - _Requirements: 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [ ]* 4.3 Write property test for replay uses original configuration
    - **Property 6: Replay Uses Original Configuration**
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [ ]* 4.4 Write property test for replay creates valid battle
    - **Property 7: Replay Creates Valid Battle**
    - **Validates: Requirements 3.4, 3.5, 3.6, 3.7, 3.8**

- [ ] 5. Implement battle type handling
  - [ ] 5.1 Add league battle revert support
    - Handle ScheduledLeagueMatch status reversion
    - Handle league point changes
    - _Requirements: 5.1_

  - [ ] 5.2 Add tournament battle revert support
    - Handle ScheduledTournamentMatch status reversion
    - Ensure bracket progression is NOT affected
    - _Requirements: 5.2_

  - [ ] 5.3 Add tag team battle revert support
    - Handle ScheduledTagTeamMatch status reversion
    - Handle all 4 robot participants
    - Restore tag team specific stats
    - _Requirements: 5.3_

  - [ ] 5.4 Add KotH battle revert support
    - Handle ScheduledKothMatch status reversion
    - Handle 5-6 robot participants
    - Restore KotH specific stats
    - _Requirements: 5.4_

  - [ ]* 5.5 Write property test for battle type handling
    - **Property 8: Battle Type Handling**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

- [ ] 6. Checkpoint - Verify battle type support
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement Admin API routes
  - [ ] 7.1 Add revert preview endpoint
    - Add GET `/api/admin/battles/:id/revert-preview` route
    - Require admin role authentication
    - Call battleRevertService.validateBattle and calculatePreview
    - Return RevertPreview or appropriate error response
    - _Requirements: 1.1-1.11, 6.1_

  - [ ] 7.2 Add revert execution endpoint
    - Add POST `/api/admin/battles/:id/revert` route
    - Require admin role authentication
    - Call battleRevertService.executeRevert
    - Return RevertResult or appropriate error response
    - _Requirements: 2.1-2.11, 6.2_

  - [ ] 7.3 Add replay execution endpoint
    - Add POST `/api/admin/battles/:id/replay` route
    - Require admin role authentication
    - Call battleReplayService.replayBattle
    - Return ReplayResult or appropriate error response
    - _Requirements: 3.1-3.9, 6.3_

  - [ ]* 7.4 Write property test for admin authorization
    - **Property 9: Admin Authorization**
    - **Validates: Requirements 6.1, 6.2, 6.3**

  - [ ]* 7.5 Write property test for audit completeness
    - **Property 10: Audit Completeness**
    - **Validates: Requirements 6.4, 6.5, 6.6**

- [ ] 8. Implement BattleRevertTab frontend component
  - [ ] 8.1 Create BattleRevertTab component structure
    - Create `prototype/frontend/src/components/admin/BattleRevertTab.tsx`
    - Add battle ID input field with numeric validation
    - Add "Load Preview" button
    - Implement state management for preview, loading, error, and result
    - _Requirements: 4.1, 4.2_

  - [ ] 8.2 Implement preview display
    - Display cycle number and current-cycle status prominently
    - Show warning message for closed-cycle battles with disabled buttons
    - Display battle info (type, winner, duration)
    - Show participants table with before/after comparison columns
    - Display affected audit logs count
    - Show match record status
    - _Requirements: 4.3, 4.4, 4.5, 4.6_

  - [ ] 8.3 Implement action buttons and result display
    - Add "Revert Battle" button (disabled until preview loaded)
    - Add "Revert and Replay" button (executes revert then replay)
    - Show loading indicator during operations
    - Display success message with summary on revert completion
    - Display new battle ID with link on replay completion
    - Display error messages with details on failure
    - _Requirements: 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11_

  - [ ] 8.4 Integrate BattleRevertTab into admin panel
    - Add "Battle Revert" tab to admin panel navigation
    - Wire up tab routing
    - _Requirements: 4.1_

  - [ ]* 8.5 Write unit tests for BattleRevertTab
    - Test button disabled states
    - Test closed-cycle warning display
    - Test before/after comparison rendering
    - Test loading and error states
    - _Requirements: 4.1-4.11_

- [ ] 9. Checkpoint - Verify frontend integration
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Integration tests and documentation
  - [ ] 10.1 Write integration tests for revert/replay flow
    - Test complete revert and replay flow for league battle
    - Test rejection for closed-cycle battle
    - Test all battle types (league, tournament, tag_team, koth)
    - Test transaction rollback on failure
    - _Requirements: All_

  - [ ] 10.2 Update ERROR_CODES.md documentation
    - Add BattleRevertErrorCode entries to `docs/guides/ERROR_CODES.md`
    - Document error scenarios and responses
    - _Requirements: 1.8, 1.9, 1.10, 5.6_

  - [ ] 10.3 Update ADMIN_PANEL_GUIDE.md documentation
    - Add section for Battle Revert tab usage in `docs/guides/ADMIN_PANEL_GUIDE.md`
    - Document workflow for reverting and replaying battles
    - _Requirements: 4.1-4.11_

  - [ ] 10.4 Update DATABASE_SCHEMA.md documentation
    - Document new Battle fields (revertedAt, revertedBy, replayOfBattleId) in `docs/prd_core/DATABASE_SCHEMA.md`
    - _Requirements: 2.7, 3.4_

  - [ ] 10.5 Update PRD_ADMIN_PAGE.md documentation
    - Add Battle Revert tab documentation to `docs/prd_pages/PRD_ADMIN_PAGE.md`
    - _Requirements: 4.1-4.11_

- [ ] 11. Final verification
  - [ ] 11.1 Run verification criteria from requirements
    - Verify revert endpoint exists and is admin-protected
    - Verify revert service handles all battle types
    - Verify audit log events created for revert actions
    - Verify frontend tab component exists
    - Verify integration test covers revert flow
    - Verify closed cycle check is enforced
    - _Requirements: All verification criteria_

  - [ ] 11.2 Final checkpoint - Ensure all tests pass
    - Run full test suite
    - Verify all acceptance criteria are met
    - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The implementation uses TypeScript throughout, following existing project patterns
