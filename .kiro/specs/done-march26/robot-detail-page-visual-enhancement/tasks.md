# Implementation Plan: Robot Detail Page Visual Enhancement

## Overview

This implementation plan transforms the Robot Detail Page (`/robots/:id`) into a comprehensive robot management hub with a tabbed interface, interactive upgrade planner, detailed performance analytics, and visual polish aligned with the Direction B (Precision/Engineering) aesthetic. The implementation follows an incremental approach, building core infrastructure first, then adding features tab-by-tab, with testing integrated throughout.

## Tasks

- [ ] 1. Set up tab infrastructure and routing
  - Create TabNavigation component with 4 tabs (Overview, Battle Config, Upgrades, Stats)
  - Implement URL-based tab state management (e.g., `/robots/:id?tab=upgrades`)
  - Add tab visibility logic (hide owner-only tabs for non-owners)
  - Implement keyboard navigation (arrow keys between tabs, Enter to select)
  - Apply Direction B visual styling to tabs (active: primary color, inactive: surface-elevated)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [ ]* 1.1 Write property tests for tab infrastructure
  - **Property 1: Default Tab Selection** - For any page load, Overview tab should be active by default
  - **Property 2: Owner-Only Tab Access Control** - For any non-owner user, Battle Config and Upgrades tabs should not be visible
  - **Property 3: Tab State Persistence** - For any tab selection, the selected tab should remain active until explicitly changed
  - **Property 4: Active Tab Visual Indication** - For any active tab, distinct visual styling should be applied
  - **Validates: Requirements 1.2, 1.6, 1.7, 1.8**

- [ ] 2. Implement Overview Tab - Statistical Rankings component
  - [ ] 2.1 Create StatisticalRankings component with grid layout
    - Display rankings for 5 attribute categories (Combat, Defense, Chassis, AI, Team)
    - Display rankings for 4 performance metrics (Total Damage Dealt, Win Rate, ELO, K/D Ratio)
    - Show rank as "#X of Y" format with percentile calculation
    - Add visual badges (gold for top 10%, silver for top 25%, bronze for top 50%)
    - Include category icons (32×32px) with category color coding
    - Implement responsive grid (3 columns desktop, 2 tablet, 1 mobile)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 2.2 Write property tests for statistical rankings
    - **Property 5: Rank Display Format** - For any robot ranking, display should follow "#X of Y" format
    - **Property 6: Percentile Badge Display** - For any ranking, correct badge should be displayed based on percentile
    - **Property 7: Rankings Reflect Current Stats** - For any robot, rankings should update when attribute values change
    - **Validates: Requirements 2.3, 2.4, 2.5**

- [ ] 3. Implement Overview Tab - Performance by Context component
  - [ ] 3.1 Create PerformanceByContext component with three sections
    - Implement league performance cards (wins, losses, draws, win rate, damage dealt/taken, ELO change)
    - Implement tournament performance cards (placement, W-L record, damage stats)
    - Implement tag team performance section (aggregate statistics)
    - Add collapsible/expandable sections for each context type
    - Display "No battles yet" for contexts with zero participation
    - Use visual cards with league/tournament icons
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [ ]* 3.2 Write property tests for performance context
    - **Property 8: League Participation Display** - For any robot with league battles, all leagues should be displayed
    - **Property 9: Tournament Participation Display** - For any robot with tournament battles, all tournaments should be displayed
    - **Property 10: Empty State Messages** - For any robot with zero battles in a context, "No battles yet" should be displayed
    - **Validates: Requirements 3.1, 3.4, 3.8**

- [ ] 4. Implement Overview Tab - Recent Battles and Upcoming Matches
  - [ ] 4.1 Create RecentBattles component
    - Display last 10 battles in compact list view
    - Show opponent name, result badge, battle type, date, damage dealt/taken, ELO change
    - Implement color-coded result indicators (green for wins, red for losses, amber for draws)
    - Add color-coded left border for each battle row
    - Display tag team information (teammates, opponent team) for tag team battles
    - Add "View Full Battle Log" link for each battle
    - Add "View All Battles" link to complete history
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [ ] 4.2 Create UpcomingMatches component
    - Display all scheduled matches (league, tournament, tag team)
    - Show opponent info, scheduled time, battle type, context
    - Implement countdown display for matches within 24 hours
    - Add battle readiness warnings (red for HP < 50%, yellow for no weapons)
    - Display tag team information (teammates, opponent team composition)
    - Show "No upcoming matches" empty state with illustration
    - Sort matches chronologically (soonest first)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

  - [ ]* 4.3 Write property tests for battles and matches
    - **Property 11: Recent Battles Count Limit** - For any robot, at most 10 battles should be displayed, ordered by date descending
    - **Property 12: Battle Result Color Coding** - For any battle, correct color should be used for result indicator
    - **Property 13: Tag Team Battle Information Display** - For any tag team battle, teammate and opponent team info should be displayed
    - **Property 14: Upcoming Matches Display Completeness** - For any robot, all scheduled future matches should be displayed
    - **Property 15: Battle Readiness Warnings** - For any robot with HP < 50% or no weapons, warnings should be displayed
    - **Property 16: Chronological Match Sorting** - For any set of upcoming matches, matches should be sorted by scheduled time ascending
    - **Property 17: Tag Team Match Information Display** - For any upcoming tag team match, teammate and opponent team info should be displayed
    - **Validates: Requirements 4.1, 4.5, 4.8, 5.1, 5.5, 5.7, 5.8**

- [ ] 5. Checkpoint - Ensure Overview Tab is complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement Battle Config Tab
  - [ ] 6.1 Migrate existing battle configuration to new tab
    - Move weapon loadout selection with visual weapon thumbnails (128×128px)
    - Move loadout type selector with 64×64px icons (Single, Weapon+Shield, Two-Handed, Dual-Wield)
    - Move battle stance selector with 64×64px posture icons (Offensive, Defensive, Balanced)
    - Move yield threshold slider with repair cost preview
    - Display current HP and shield status with color-coded bars
    - Add battle readiness indicator
    - Ensure owner-only access control
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [ ] 6.2 Implement configuration change feedback
    - Add immediate visual feedback when configuration changes affect effective stats
    - Update effective stats display in real-time
    - Show loading states during configuration updates
    - _Requirements: 6.8_

  - [ ]* 6.3 Write property tests for battle config
    - **Property 18: HP and Shield Bar Color Coding** - For any robot, HP bar should use correct color based on HP percentage
    - **Property 19: Configuration Change Feedback** - For any configuration change, effective stats should update immediately
    - **Validates: Requirements 6.6, 6.8**

- [ ] 7. Implement Stats Tab - Effective Stats Display
  - [ ] 7.1 Create EffectiveStatsDisplay component
    - Display all 23 attributes organized by 5 categories
    - Show base value, total modifier percentage, and effective value for each attribute
    - Implement color coding (green for positive modifiers, red for negative)
    - Add expandable details showing modifier breakdown (weapons, loadout, stance)
    - Highlight attributes with significant modifiers (>20% change)
    - Use compact formatting to minimize scrolling
    - Add category headers with category color backgrounds
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ]* 7.2 Write property tests for stats display
    - **Property 20: Modifier Color Coding** - For any attribute modifier, correct color should be used (green for positive, red for negative)
    - **Property 21: Expandable Details Functionality** - For any attribute, clicking expand icon should reveal/hide detailed breakdown
    - **Property 22: Significant Modifier Highlighting** - For any attribute with modifier > 20%, visual highlighting should be applied
    - **Validates: Requirements 7.4, 7.5, 7.7**

- [ ] 8. Implement Upgrades Tab - Interactive Upgrade Planner
  - [ ] 8.1 Create UpgradePlanner component structure
    - Display all 23 attributes with current values and upgrade costs
    - Organize attributes by 5 categories with category headers
    - Show category icons (32×32px) and attribute icons (24×24px)
    - Implement single scrollable view without category folding
    - Add academy cap indicators for each category
    - _Requirements: 8.1, 8.12_

  - [ ] 8.2 Implement upgrade planning controls
    - Add +/- buttons for each attribute
    - Implement increment logic (+ button increases planned level by 1)
    - Implement decrement logic (- button decreases planned level by 1)
    - Disable + button when attribute reaches academy cap
    - Highlight planned changes in blue
    - _Requirements: 8.2, 8.3, 8.4, 8.10_

  - [ ] 8.3 Implement cost calculation and display
    - Calculate base upgrade cost for each attribute level
    - Apply workshop discount when applicable
    - Apply bulk discount when applicable
    - Display discount percentages alongside costs
    - Show final cost after all discounts for each attribute
    - Calculate running total of all planned upgrade costs
    - Display current credit balance
    - Calculate and display remaining credits after planned upgrades
    - Update all costs in real-time as upgrades are planned
    - _Requirements: 8.5, 8.6, 8.7, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

  - [ ] 8.4 Implement commit and reset controls
    - Create bottom sticky panel with cost summary
    - Add "Commit Upgrades" button (primary, disabled if insufficient credits)
    - Add "Reset Plan" button (secondary)
    - Implement reset functionality to clear all planned upgrades
    - Add confirmation modal before committing upgrades
    - Show upgrade summary in confirmation modal
    - _Requirements: 8.8, 8.9, 8.11_

  - [ ]* 8.5 Write property tests for upgrade planner
    - **Property 23: Upgrade Plan Increment** - For any attribute below cap, + button should increment planned level and update cost
    - **Property 24: Upgrade Plan Decrement** - For any attribute with planned level > current, - button should decrement and update cost
    - **Property 25: Discount Application to Costs** - For any planned upgrade, displayed cost should equal base cost with all discounts applied
    - **Property 26: Running Total Cost Calculation** - For any set of planned upgrades, total cost should equal sum of individual costs
    - **Property 27: Remaining Credits Calculation** - For any upgrade plan, remaining credits should equal current credits minus total cost
    - **Property 28: Reset Plan Functionality** - For any upgrade plan with changes, reset button should clear all planned upgrades
    - **Property 29: Academy Cap Button Disabling** - For any attribute at academy cap, + button should be disabled
    - **Property 30: Insufficient Credits Button Disabling** - For any upgrade plan where cost exceeds credits, commit button should be disabled
    - **Property 31: Discount Display Visibility** - For any scenario with applicable discounts, discount percentages should be displayed
    - **Property 32: Real-Time Cost Updates** - For any change to upgrade plan, all cost displays should update within 100ms
    - **Validates: Requirements 8.3, 8.4, 8.5, 8.6, 8.7, 8.9, 8.10, 8.11, 9.2, 9.3, 9.4, 9.5**

- [ ] 9. Checkpoint - Ensure all tabs are functional
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement visual design system throughout page
  - [ ] 10.1 Apply Direction B aesthetic and typography
    - Implement Direction B logo state throughout page
    - Apply typography hierarchy (H1: 30px, H2: 24px, H3: 20px, Body: 16px)
    - Use DIN Next or Inter Tight for headers, Inter for body text
    - Ensure consistent spacing and layout
    - _Requirements: 10.1, 10.2, 10.3_

  - [ ] 10.2 Implement color coding system
    - Apply category colors (Combat: #f85149, Defense: #58a6ff, Chassis: #3fb950, AI: #d29922, Team: #a371f7)
    - Implement HP bar color coding (green 70-100%, amber 30-69%, red 1-29%)
    - Apply result color coding (green wins, red losses, amber draws)
    - Apply modifier color coding (green positive, red negative)
    - _Requirements: 10.4_

  - [ ] 10.3 Add icons throughout interface
    - Add 32×32px category icons
    - Add 24×24px attribute icons
    - Add battle type icons
    - Add status icons (warnings, readiness, etc.)
    - Ensure icons have text labels for accessibility
    - _Requirements: 10.5, 10.10_

  - [ ] 10.4 Implement micro-animations
    - Add hover lift animations (2px/150ms) to interactive cards
    - Add transition animations (300ms) for state changes
    - Add modal scale-in animations (250ms)
    - Add tab switch animations (150ms)
    - Respect prefers-reduced-motion settings
    - _Requirements: 10.6, 10.7_

  - [ ] 10.5 Ensure accessibility compliance
    - Verify 4.5:1 minimum contrast ratio for all text
    - Add hover states and focus indicators for all interactive elements
    - Implement keyboard navigation throughout
    - Add ARIA labels for screen readers
    - Test with screen reader
    - _Requirements: 10.8, 10.9_

  - [ ]* 10.6 Write property tests for visual design
    - **Property 33: Reduced Motion Respect** - For any user with prefers-reduced-motion enabled, animations should be disabled
    - **Property 34: Contrast Ratio Compliance** - For any text element, contrast ratio should be at least 4.5:1
    - **Validates: Requirements 10.7, 10.8**

- [ ] 11. Implement data fetching and state management
  - [ ] 11.1 Set up data fetching for robot extended data
    - Fetch robot base data, combat state, configuration, attributes
    - Fetch performance metrics (ELO, league, battles, damage)
    - Implement loading states
    - Implement error handling with retry logic
    - Cache data appropriately
    - _Requirements: All data-dependent requirements_

  - [ ] 11.2 Set up data fetching for rankings
    - Fetch robot rankings for all categories and metrics
    - Implement 5-minute cache with stale-while-revalidate
    - Handle ranking calculation errors gracefully
    - Show cached data with "Data may be outdated" warning on error
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ] 11.3 Set up data fetching for performance context
    - Fetch league statistics
    - Fetch tournament statistics
    - Fetch tag team statistics
    - Handle partial failures (show available data even if some queries fail)
    - Implement empty states for contexts with no participation
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [ ] 11.4 Set up data fetching for battles and matches
    - Fetch recent battles (last 10)
    - Fetch upcoming matches (all scheduled)
    - Implement real-time updates for upcoming matches
    - Handle empty states
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3_

  - [ ] 11.5 Implement upgrade commit API integration
    - Create API endpoint call for committing upgrades
    - Handle success response (update robot data)
    - Handle error responses (insufficient credits, attribute at cap, etc.)
    - Implement optimistic UI updates with rollback on error
    - Show success/error toast messages
    - _Requirements: 8.8_

  - [ ] 11.6 Implement configuration change API integration
    - Create API calls for loadout changes
    - Create API calls for stance changes
    - Create API calls for yield threshold changes
    - Implement optimistic UI updates with rollback on error
    - Update effective stats immediately
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.8_

- [ ] 12. Implement error handling and edge cases
  - [ ] 12.1 Add client-side error handling
    - Handle invalid tab state (redirect to Overview)
    - Handle data loading failures (show error state with retry button)
    - Handle upgrade plan errors (disable commit, show error message)
    - Handle configuration change errors (revert state, show error toast)
    - _Requirements: All requirements (error handling)_

  - [ ] 12.2 Add graceful degradation
    - Hide rankings section if data unavailable
    - Show basic stats if performance context unavailable
    - Show text labels if icons fail to load
    - Fall back to instant transitions if animations fail
    - _Requirements: All requirements (graceful degradation)_

- [ ]* 13. Write integration tests
  - Test tab navigation updates URL and content
  - Test owner-only tabs are hidden for non-owners
  - Test upgrade planner planning and committing flow
  - Test configuration changes update effective stats
  - Test performance context displays correct data
  - _Requirements: All requirements (integration testing)_

- [ ]* 14. Write end-to-end tests
  - Test owner user flow (navigate, view all tabs, plan upgrades, commit)
  - Test non-owner user flow (navigate, verify only public tabs visible)
  - Test battle readiness flow (low HP warnings, battle config)
  - _Requirements: All requirements (E2E testing)_

- [ ] 15. Final checkpoint - Complete testing and polish
  - Run all unit tests, property tests, integration tests, E2E tests
  - Perform accessibility audit with axe-core
  - Test keyboard navigation throughout
  - Test responsive design at all breakpoints
  - Verify performance metrics (load time < 2s, tab switch < 100ms)
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties (minimum 100 iterations each)
- Unit tests validate specific examples and edge cases
- Integration and E2E tests validate complete user flows
- The implementation uses React 18, TypeScript, Tailwind CSS, Vitest, fast-check, and Playwright
- All animations must respect prefers-reduced-motion settings
- All interactive elements must have keyboard navigation and focus indicators
- Minimum 4.5:1 contrast ratio required for WCAG 2.1 AA compliance
