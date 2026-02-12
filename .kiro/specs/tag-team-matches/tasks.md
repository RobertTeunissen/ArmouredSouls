# Implementation Plan: Tag Team Matches

## Overview

This implementation plan breaks down the Tag Team Matches feature into discrete coding tasks. The approach follows a layered implementation strategy: database schema → core services → battle integration → UI components → testing. Each task builds on previous work to ensure incremental progress with testable milestones.

The implementation integrates with existing systems (matchmaking, battle orchestrator, league management) while maintaining separation of concerns through dedicated tag team services.

## Tasks

- [x] 1. Database schema and models
  - [x] 1.1 Create TagTeam and TagTeamMatch Prisma models
    - Add TagTeam model with fields: id, stableId, activeRobotId, reserveRobotId, tagTeamLeague, tagTeamLeagueId, tagTeamLeaguePoints, cyclesInTagTeamLeague, win/loss/draw counters, timestamps
    - Add TagTeamMatch model with fields: id, team1Id, team2Id, tagTeamLeague, scheduledFor, status, battleId, createdAt
    - Add unique constraint on (activeRobotId, reserveRobotId) and check constraint for different robots
    - Add indexes for stable, league, robots, scheduled time, and status
    - _Requirements: 1.4, 6.2, 6.7_
  
  - [x] 1.2 Extend Battle model for tag team support
    - Add battleType field (enum: 'league', 'tournament', 'tag_team')
    - Add tag team robot fields: team1ActiveRobotId, team1ReserveRobotId, team2ActiveRobotId, team2ReserveRobotId
    - Add tag-out timestamp fields: team1TagOutTime, team2TagOutTime
    - Add index on battleType
    - _Requirements: 3.1, 3.3, 7.2_
  
  - [x] 1.3 Extend Robot model with tag team statistics
    - Add fields: totalTagTeamBattles, totalTagTeamWins, totalTagTeamLosses, totalTagTeamDraws, timesTaggedIn, timesTaggedOut
    - Set default values to 0 for all new fields
    - _Requirements: 10.8_
  
  - [x] 1.4 Create database migration and apply schema changes
    - Generate Prisma migration for all schema changes
    - Test migration on development database
    - Verify all indexes are created correctly
    - _Requirements: All database-related requirements_

- [x] 2. Tag Team Management Service
  - [x] 2.1 Implement team creation and validation
    - Create TagTeamService class with createTeam method
    - Validate both robots are from same stable
    - Validate both robots meet battle readiness (HP ≥75%, HP > yield threshold, weapons equipped)
    - Check for duplicate teams (same robot pair)
    - Check roster limit (max teams = roster size / 2)
    - Return validation errors with specific messages
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  
  - [x] 2.2 Write property test for team validation
    - **Property 1: Team Creation Validation**
    - **Validates: Requirements 1.2, 1.3**
  
  - [x] 2.3 Implement team retrieval and listing
    - Add getTeamById method
    - Add getTeamsByStable method
    - Include robot details in responses
    - _Requirements: 9.1, 9.2_
  
  - [x] 2.4 Implement team disbanding
    - Add disbandTeam method
    - Remove team from database
    - Verify robots become available for new teams
    - _Requirements: 9.7_
  
  - [x] 2.5 Write property test for team configuration round trip
    - **Property 2: Team Configuration Round Trip**
    - **Validates: Requirements 1.4**
  
  - [x] 2.6 Write property test for team creation limit
    - **Property 3: Team Creation Limit**
    - **Validates: Requirements 1.5**
  
  - [x] 2.7 Write property test for team disbanding
    - **Property 26: Team Disbanding**
    - **Validates: Requirements 9.7**

- [x] 3. Tag Team Readiness and ELO Calculation
  - [x] 3.1 Implement team readiness checking
    - Add checkTeamReadiness method
    - Validate both robots: HP ≥75%, HP > yield threshold, all weapons equipped
    - Return detailed readiness status for each robot
    - _Requirements: 8.1, 8.2, 8.3_
  
  - [x] 3.2 Write property test for readiness validation
    - **Property 23: Tag Team Readiness Validation**
    - **Validates: Requirements 8.1, 8.2, 8.3**
  
  - [x] 3.3 Implement combined ELO calculation
    - Add calculateCombinedELO method
    - Sum active robot ELO + reserve robot ELO
    - Cache result on team object
    - _Requirements: 2.1_
  
  - [x] 3.4 Write property test for combined ELO
    - **Property 4: Combined ELO Calculation**
    - **Validates: Requirements 2.1**

- [x] 4. Tag Team Matchmaking Service
  - [x] 4.1 Implement cycle counter and scheduling logic
    - Add global cycle counter tracking
    - Add shouldRunTagTeamMatchmaking method (returns true for odd cycles)
    - Integrate with existing daily cycle system
    - _Requirements: 2.7, 2.8_
  
  - [x] 4.2 Write property test for cycle scheduling
    - **Property 37: Tag Team Cycle Scheduling**
    - **Validates: Requirements 2.7, 2.8**
  
  - [x] 4.3 Implement eligible team querying
    - Add getEligibleTeams method
    - Filter by league and instance
    - Exclude teams with unready robots
    - Exclude teams already scheduled for matches
    - _Requirements: 8.4_
  
  - [x] 4.4 Write property test for unready team exclusion
    - **Property 24: Unready Team Exclusion**
    - **Validates: Requirements 8.4**
  
  - [x] 4.5 Implement team pairing algorithm
    - Add pairTeams method
    - Match teams within ±300 combined ELO
    - Fallback to ±600 if no ±300 match exists
    - Deprioritize recent opponents (last 5 matches)
    - Exclude same-stable matchups
    - Create bye-team for odd numbers
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6_
  
  - [x] 4.6 Write property test for ELO-based matching
    - **Property 5: ELO-Based Team Matching**
    - **Validates: Requirements 2.2**
  
  - [x] 4.7 Write property test for same-stable exclusion
    - **Property 6: Same-Stable Exclusion**
    - **Validates: Requirements 2.6**
  
  - [x] 4.8 Write property test for recent opponent deprioritization
    - **Property 7: Recent Opponent Deprioritization**
    - **Validates: Requirements 2.4**
  
  - [x] 4.9 Implement match scheduling
    - Add scheduleMatches method
    - Create TagTeamMatch records with scheduledFor timestamp
    - Set status to 'scheduled'
    - _Requirements: 2.7_

- [x] 5. Checkpoint - Verify matchmaking works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Tag Team Battle Orchestrator
  - [x] 6.1 Extend battle orchestrator for tag team battles
    - Add executeBattle method for tag team matches
    - Initialize battle with both teams' active robots
    - Set battleType to 'tag_team'
    - Store team robot IDs in battle record
    - _Requirements: 3.1_
  
  - [x] 6.2 Implement tag-out detection and handling
    - Monitor active robot HP during combat simulation
    - Trigger tag-out when HP ≤ yield threshold OR HP ≤ 0
    - Record tag-out event with timestamp and reason
    - Remove yielding/destroyed robot from combat
    - _Requirements: 3.2, 3.3, 3.4_
  
  - [x] 6.3 Write property test for tag-out triggers
    - **Property 8: Tag-Out Trigger Conditions**
    - **Validates: Requirements 3.3**
  
  - [x] 6.4 Implement reserve robot activation
    - Activate reserve robot when tag-out occurs
    - Set reserve robot HP to 100%
    - Reset all weapon cooldowns to 0
    - Continue battle with reserve robot
    - _Requirements: 3.5_
  
  - [x] 6.5 Write property test for reserve robot initial state
    - **Property 9: Reserve Robot Initial State**
    - **Validates: Requirements 3.5**
  
  - [x] 6.6 Implement win/loss/draw conditions
    - Declare winner when both opposing robots are down
    - Declare draw if both teams lose both robots simultaneously
    - Declare draw if battle time limit exceeded
    - _Requirements: 3.6, 3.7, 3.8_
  
  - [x] 6.7 Write property test for team defeat condition
    - **Property 10: Team Defeat Condition**
    - **Validates: Requirements 3.6**
  
  - [x] 6.8 Write property test for battle timeout draw
    - **Property 11: Battle Timeout Draw**
    - **Validates: Requirements 3.8**

- [x] 7. Tag Team Battle Rewards and Costs
  - [x] 7.1 Implement reward calculation
    - Calculate credits: 2x standard league rewards for tier and outcome
    - Apply to wins, losses, and draws
    - Award credits to stable
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [x] 7.2 Write property test for reward multiplier
    - **Property 12: Tag Team Reward Multiplier**
    - **Validates: Requirements 4.1, 4.2, 4.3**
  
  - [x] 7.3 Implement repair cost calculation
    - Calculate repair costs for both robots based on damage
    - Apply Repair Bay discount
    - Apply 2x destruction multiplier for destroyed robots
    - Calculate costs based on actual damage for yielded robots
    - _Requirements: 4.4, 4.5, 4.6, 4.7_
  
  - [x] 7.4 Write property test for repair costs
    - **Property 13: Repair Cost Calculation**
    - **Validates: Requirements 4.4, 4.5, 4.6, 4.7**
  
  - [x] 7.5 Implement ELO updates for all four robots
    - Calculate ELO changes using K=32 formula
    - Use combined team ELO as basis for expected outcome
    - Update ELO for all four robots (both teams)
    - _Requirements: 5.1, 5.2, 5.7_
  
  - [x] 7.6 Write property test for four-robot ELO updates
    - **Property 14: Four-Robot ELO Updates**
    - **Validates: Requirements 5.1, 5.2**
  
  - [x] 7.7 Write property test for shared ELO rating
    - **Property 17: Shared ELO Rating**
    - **Validates: Requirements 5.7**
  
  - [x] 7.8 Implement tag team league point awards
    - Award +3 points per robot for wins
    - Deduct -1 point per robot for losses (minimum 0)
    - Award +1 point to all four robots for draws
    - _Requirements: 5.3, 5.4, 5.5_
  
  - [x] 7.9 Write property test for league point awards
    - **Property 15: Tag Team League Point Awards**
    - **Validates: Requirements 5.3, 5.4, 5.5**
  
  - [x] 7.10 Write property test for league point separation
    - **Property 16: League Point Separation**
    - **Validates: Requirements 5.6**

- [x] 8. Tag Team Prestige and Fame
  - [x] 8.1 Implement prestige awards
    - Calculate prestige: 1.6x standard individual match prestige for tier
    - Bronze: +8, Silver: +16, Gold: +32, Platinum: +48, Diamond: +80, Champion: +120
    - Award prestige to stable on wins
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_
  
  - [x] 8.2 Write property test for prestige calculation
    - **Property 27: Prestige Award Calculation**
    - **Validates: Requirements 10.1-10.6**
  
  - [x] 8.3 Implement contribution-based fame awards
    - Calculate fame based on damage dealt and survival time
    - Award fame proportionally to each robot's contribution
    - _Requirements: 10.7_
  
  - [x] 8.4 Write property test for contribution-based fame
    - **Property 28: Contribution-Based Fame**
    - **Validates: Requirements 10.7**
  
  - [x] 8.5 Implement tag team statistics tracking
    - Increment totalTagTeamBattles for all four robots
    - Increment wins/losses/draws based on outcome
    - Increment timesTaggedIn for reserve robots that activated
    - Increment timesTaggedOut for active robots that yielded/destroyed
    - _Requirements: 10.8_
  
  - [x] 8.6 Write property test for statistics tracking
    - **Property 29: Tag Team Statistics Tracking**
    - **Validates: Requirements 10.8**

- [x] 9. Checkpoint - Verify battle execution works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Tag Team League Management
  - [x] 10.1 Implement initial team placement
    - Place new teams in Bronze league (bronze_1 instance)
    - Set initial league points to 0
    - Set cycles counter to 0
    - _Requirements: 6.2_
  
  - [x] 10.2 Write property test for initial placement
    - **Property 18: New Team Initial Placement**
    - **Validates: Requirements 6.2**
  
  - [x] 10.3 Implement league rebalancing
    - Run rebalancing every other cycle (odd cycles only)
    - Promote top 10% of eligible teams (≥5 cycles in tier, ≥10 teams in tier)
    - Demote bottom 10% of eligible teams (≥5 cycles in tier, ≥10 teams in tier)
    - Skip promotion for Champion tier
    - Skip demotion for Bronze tier
    - _Requirements: 6.3, 6.4_
  
  - [x] 10.4 Write property test for rebalancing percentages
    - **Property 19: League Rebalancing Percentages**
    - **Validates: Requirements 6.3, 6.4**
  
  - [x] 10.5 Implement tier change resets
    - Reset tag team league points to 0 on promotion/demotion
    - Reset cycles counter to 0 on promotion/demotion
    - _Requirements: 6.5, 6.6_
  
  - [x] 10.6 Write property test for tier change resets
    - **Property 20: Tier Change Resets**
    - **Validates: Requirements 6.5, 6.6**
  
  - [x] 10.7 Implement league instance management
    - Enforce maximum 50 teams per instance
    - Create new instance when 51st team would be added
    - Balance teams across instances when deviation >20
    - _Requirements: 6.7, 6.8_
  
  - [x] 10.8 Write property test for instance capacity
    - **Property 21: League Instance Capacity**
    - **Validates: Requirements 6.7, 6.8**
  
  - [x] 10.9 Implement league standings
    - Add getStandings method for league and instance
    - Sort by league points (descending), then ELO (descending)
    - Include team rank calculation
    - _Requirements: 9.3_
  
  - [x] 10.10 Write property test for separate standings
    - **Property 34: Separate League Standings**
    - **Validates: Requirements 11.6**

- [x] 11. Tag Team Battle Logs and Combat Messages
  - [x] 11.1 Extend combat message generator for tag events
    - Add message templates for tag-out events (yield and destruction)
    - Add message templates for tag-in events (reserve activation)
    - Include robot names and context in messages
    - _Requirements: 7.6_
  
  - [x] 11.2 Implement battle log generation
    - Record all combat events with timestamps
    - Record tag-out events with reason (yield or destruction)
    - Record tag-in events with reserve robot state
    - Store complete log in battle record
    - _Requirements: 7.1, 7.2, 7.3_
  
  - [x] 11.3 Write property test for battle log completeness
    - **Property 22: Battle Log Completeness**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.6**

- [x] 12. Multi-Match Scheduling and Execution
  - [x] 12.1 Implement multi-match scheduling
    - Allow robots to be scheduled for both 1v1 and tag team matches
    - Track all scheduled matches per robot
    - _Requirements: 11.1_
  
  - [x] 12.2 Write property test for multi-match scheduling
    - **Property 30: Multi-Match Scheduling**
    - **Validates: Requirements 11.1**
  
  - [x] 12.3 Implement match processing order
    - Process 1v1 matches first in each cycle
    - Process tag team matches second in each cycle
    - _Requirements: 11.4_
  
  - [x] 12.4 Write property test for processing order
    - **Property 33: Match Processing Order**
    - **Validates: Requirements 11.4**
  
  - [x] 12.5 Implement cumulative damage tracking
    - Apply damage from 1v1 match to robot HP
    - Apply damage from tag team match to robot HP
    - Track total damage across all matches in cycle
    - _Requirements: 11.2_
  
  - [x] 12.6 Write property test for cumulative damage
    - **Property 31: Cumulative Damage Application**
    - **Validates: Requirements 11.2**
  
  - [x] 12.7 Implement dynamic eligibility checking
    - Check robot readiness before each match
    - Exclude robots that became unready due to earlier matches
    - _Requirements: 11.3_
  
  - [x] 12.8 Write property test for dynamic eligibility
    - **Property 32: Dynamic Eligibility After Damage**
    - **Validates: Requirements 11.3**

- [x] 13. Bye-Team Implementation
  - [x] 13.1 Create bye-team configuration
    - Define bye-robot 1 (id: -1, ELO: 1000)
    - Define bye-robot 2 (id: -2, ELO: 1000)
    - Define bye-team (id: -1, combined ELO: 2000)
    - Set minimal stats for bye-robots
    - _Requirements: 2.5, 12.1, 12.2_
  
  - [x] 13.2 Implement bye-team battle execution
    - Execute normal battle against bye-team
    - Use predictable bye-robot behavior
    - _Requirements: 12.3_
  
  - [x] 13.3 Write property test for bye-team battles
    - **Property 35: Bye-Team Full Rewards**
    - **Property 36: Bye-Team Normal Penalties**
    - **Validates: Requirements 12.4, 12.5**

- [x] 14. Checkpoint - Verify complete battle cycle works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. API Endpoints
  - [x] 15.1 Implement team management endpoints
    - POST /api/tag-teams - Create new team
    - GET /api/tag-teams - List teams for current user's stable
    - GET /api/tag-teams/:id - Get team details
    - DELETE /api/tag-teams/:id - Disband team
    - Add authentication and authorization
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 9.7_
  
  - [x] 15.2 Write unit tests for team management endpoints
    - Test team creation with valid data
    - Test validation errors
    - Test authorization checks
  
  - [x] 15.3 Implement match listing endpoints
    - GET /api/matches/upcoming - Include tag team matches with indicator
    - GET /api/matches/history - Include tag team matches with indicator
    - Add battleType field to responses
    - _Requirements: 9.4, 9.5_
  
  - [x] 15.4 Write property test for match list inclusion
    - **Property 25: Match List Inclusion**
    - **Validates: Requirements 9.4, 9.5**
  
  - [x] 15.5 Implement tag team standings endpoint
    - GET /api/tag-teams/leagues/:tier/standings - Get standings for tier
    - Include team rank, combined ELO, league points, win/loss record
    - Support pagination
    - _Requirements: 9.3_
  
  - [x] 15.6 Implement battle log endpoint
    - GET /api/battles/:id/log - Include tag events in response
    - Format tag-out and tag-in events clearly
    - _Requirements: 7.1, 7.2, 7.3_
  
  - [x] 15.7 Implement admin endpoints
    - POST /api/admin/tag-teams/matchmaking - Manually trigger tag team matchmaking
    - POST /api/admin/tag-teams/battles - Manually execute tag team battles
    - POST /api/admin/tag-teams/rebalance - Manually trigger league rebalancing
    - Add admin authentication

- [x] 16. Frontend UI Components
  - [x] 16.1 Create tag team management page
    - Display list of user's tag teams
    - Show team status (ready/unready)
    - Show both robots' details (name, portrait, ELO, HP)
    - Add "Create Team" button
    - Add "Disband Team" button per team
    - _Requirements: 9.1, 9.2, 9.6_
  
  - [x] 16.2 Create team creation modal
    - Display eligible robots (battle ready)
    - Allow selection of active and reserve robots
    - Show validation errors
    - Submit team creation
    - _Requirements: 1.1, 1.2, 1.3_
  
  - [x] 16.3 Extend match list components
    - Add "Tag Team" indicator badge to tag team matches
    - Display both team members in match card
    - Show combined ELO
    - Update upcoming matches component
    - Update battle history component
    - _Requirements: 9.4, 9.5, 9.8, 9.9_
  
  - [x] 16.4 Create tag team standings page
    - Display standings for all tag team league tiers
    - Show team rank, robots, combined ELO, league points, record
    - Highlight user's teams
    - Add tier tabs (Bronze, Silver, Gold, Platinum, Diamond, Champion)
    - _Requirements: 9.3_
  
  - [x] 16.5 Extend battle log display
    - Add tag-out event visualization
    - Add tag-in event visualization
    - Show which robot was active at each point
    - Highlight tag transitions
    - _Requirements: 7.4, 7.5_
  
  - [x] 16.6 Add tag team readiness warnings
    - Display warnings on tag team management page
    - Display warnings on robot detail page
    - Display warnings on dashboard
    - Show specific readiness failures per robot
    - _Requirements: 8.5, 8.6_
  
  - [x] 16.7 Update dashboard to include tag team matches
    - Show upcoming tag team matches
    - Show recent tag team battle results
    - Add "Tag Team" section or integrate with existing match displays
    - _Requirements: 9.8, 9.9_

- [x] 17. Integration Testing
  - [x] 17.1 Write integration test for complete tag team cycle
    - Create teams → Run matchmaking → Execute battles → Verify results
    - Test with multiple teams across different leagues
    - Verify ELO updates, league points, credits, repair costs
  
  - [x] 17.2 Write integration test for multi-match cycle
    - Schedule robot for both 1v1 and tag team match
    - Execute both matches
    - Verify cumulative damage and dynamic eligibility
  
  - [x] 17.3 Write integration test for league rebalancing
    - Create teams with varying league points
    - Run rebalancing
    - Verify promotions, demotions, and resets
  
  - [x] 17.4 Write integration test for bye-team handling
    - Create odd number of teams
    - Run matchmaking
    - Verify bye-team match creation and execution

- [x] 18. Final checkpoint - Complete system verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at major milestones
- Property tests validate universal correctness properties (minimum 100 iterations each)
- Unit tests validate specific examples and edge cases
- Integration tests verify end-to-end workflows
- The implementation follows a bottom-up approach: database → services → battle logic → API → UI
- Tag team matches run every other cycle (odd cycles only) to reduce server load
- Robots can participate in both 1v1 and tag team matches in the same cycle
- ELO is shared between match types, but league points are separate
