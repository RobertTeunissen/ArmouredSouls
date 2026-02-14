# Design Document: Robot Detail Page Visual Enhancement

## Overview

This design document specifies the comprehensive redesign of the Robot Detail Page (`/robots/:id`) to transform it from a functional but visually basic interface into a sophisticated robot management hub. The redesign introduces a tabbed architecture to organize information, an interactive upgrade planner for strategic decision-making, detailed performance analytics across competitive contexts, and visual polish aligned with the Direction B (Precision/Engineering) aesthetic.

### Key Design Goals

1. **Information Architecture**: Implement tabbed interface to separate concerns (Overview, Battle Config, Upgrades, Stats)
2. **Strategic Planning**: Provide interactive upgrade planner with cost preview and experimentation capability
3. **Performance Insights**: Display comprehensive statistics broken down by league, tournament, and tag team battles
4. **Visual Cohesion**: Apply Direction B aesthetic with proper typography, color coding, icons, and micro-animations
5. **Accessibility**: Maintain WCAG 2.1 AA compliance throughout all enhancements

### Design Principles

- **Managerial Control**: Reinforce player's role as manager through systematic information presentation
- **Purposeful Motion**: All animations respond to user action, no idle motion
- **Visual Hierarchy**: Use typography, color, and spacing to guide attention
- **Engineering Aesthetic**: Brushed metal feel, precision, technical clarity
- **Progressive Disclosure**: Show overview first, details on demand

## Architecture

### Component Hierarchy

```
RobotDetailPage
├── PageHeader
│   ├── RobotPortrait (512×512px)
│   ├── RobotIdentity (name, owner, league, ELO)
│   └── QuickStats (HP, shield, battle readiness)
├── TabNavigation
│   ├── OverviewTab (default, public)
│   ├── BattleConfigTab (owner-only)
│   ├── UpgradesTab (owner-only)
│   └── StatsTab (public)
└── TabContent
    ├── OverviewTabContent
    │   ├── StatisticalRankings
    │   ├── PerformanceByContext (leagues, tournaments, tag teams)
    │   ├── RecentBattles (last 10)
    │   └── UpcomingMatches
    ├── BattleConfigTabContent
    │   ├── LoadoutSelector
    │   ├── WeaponSlots
    │   ├── StanceSelector
    │   └── YieldThresholdSlider
    ├── UpgradesTabContent
    │   ├── UpgradePlanner
    │   ├── AttributeUpgradeRow × 23
    │   ├── CostSummary
    │   └── CommitControls
    └── StatsTabContent
        └── EffectiveStatsDisplay
```

### State Management

The page manages several key state concerns:

1. **Active Tab State**: Which tab is currently displayed
2. **Upgrade Plan State**: Pending attribute upgrades before commit
3. **Configuration State**: Current loadout, stance, yield settings
4. **Data Fetching State**: Loading states for robot data, statistics, matches

### Data Flow

```
User Action → Component Event → State Update → UI Re-render
                                      ↓
                              API Call (if needed)
                                      ↓
                              Backend Processing
                                      ↓
                              Response → State Update → UI Re-render
```

### Visibility Rules

**Public Sections** (visible to all users):
- Page Header
- Overview Tab
- Stats Tab

**Owner-Only Sections** (visible only to robot owner):
- Battle Config Tab
- Upgrades Tab
- Commit/Reset controls in Upgrades Tab

## Components and Interfaces

### 1. TabNavigation Component

**Purpose**: Provides tab switching interface for organizing page content

**Props**:
```typescript
interface TabNavigationProps {
  activeTab: 'overview' | 'battle-config' | 'upgrades' | 'stats';
  onTabChange: (tab: string) => void;
  isOwner: boolean;
}
```

**Visual Design**:
- Horizontal tab bar with 4 tabs
- Active tab: primary color background (#58a6ff), white text
- Inactive tabs: surface-elevated background, secondary text
- Owner-only tabs hidden when `isOwner === false`
- Tab icons: 📊 Overview, ⚔️ Battle Config, ⬆️ Upgrades, 📈 Stats
- Smooth transition animation (150ms) on tab change
- Underline indicator on active tab

**Behavior**:
- Click tab to switch content
- Keyboard navigation: Arrow keys to move between tabs, Enter to select
- URL updates with tab parameter (e.g., `/robots/1?tab=upgrades`)
- Tab state persists on page refresh

### 2. StatisticalRankings Component

**Purpose**: Displays robot's rank in various categories compared to all robots

**Props**:
```typescript
interface StatisticalRankingsProps {
  robotId: number;
  rankings: {
    combatCategory: { rank: number; total: number; percentile: number };
    defenseCategory: { rank: number; total: number; percentile: number };
    chassisCategory: { rank: number; total: number; percentile: number };
    aiCategory: { rank: number; total: number; percentile: number };
    teamCategory: { rank: number; total: number; percentile: number };
    totalDamageDealt: { rank: number; total: number; percentile: number };
    winRate: { rank: number; total: number; percentile: number };
    elo: { rank: number; total: number; percentile: number };
    kdRatio: { rank: number; total: number; percentile: number };
  };
}
```

**Visual Design**:
- Grid layout: 3 columns on desktop, 2 on tablet, 1 on mobile
- Each ranking card shows:
  - Category icon (32×32px) with category color
  - Category name
  - Rank display: "#15 of 247"
  - Percentile badge (top 10%, top 25%, top 50%, etc.)
  - Visual progress bar showing position
- Top 10%: Gold badge
- Top 25%: Silver badge
- Top 50%: Bronze badge
- Below 50%: No badge

**Data Calculation**:
- Rankings calculated server-side based on current robot stats
- Cached for performance (refresh every 5 minutes)
- Percentile: `(1 - (rank - 1) / total) * 100`

### 3. PerformanceByContext Component

**Purpose**: Shows performance statistics broken down by league, tournament, and tag team battles

**Props**:
```typescript
interface PerformanceByContextProps {
  robotId: number;
  leagueStats: Array<{
    leagueName: string;
    leagueIcon: string;
    wins: number;
    losses: number;
    draws: number;
    winRate: number;
    damageDealt: number;
    damageTaken: number;
    eloChange: number;
  }>;
  tournamentStats: Array<{
    tournamentName: string;
    tournamentDate: string;
    placement: number;
    totalParticipants: number;
    wins: number;
    losses: number;
    damageDealt: number;
    damageTaken: number;
  }>;
  tagTeamStats: {
    totalBattles: number;
    wins: number;
    losses: number;
    draws: number;
    winRate: number;
    damageDealt: number;
    damageTaken: number;
  };
}
```

**Visual Design**:
- Three sections: Leagues, Tournaments, Tag Teams
- Each section collapsible/expandable
- League cards show:
  - League icon and name
  - W-L-D record with win rate percentage
  - Damage dealt/taken bar chart
  - ELO change indicator (green for positive, red for negative)
- Tournament cards show:
  - Tournament name and date
  - Placement badge (1st, 2nd, 3rd with medals, others with number)
  - Battle record
  - Damage statistics
- Tag Team section shows:
  - Aggregate statistics across all tag team battles
  - Win rate visualization
  - Damage comparison chart

### 4. RecentBattles Component

**Purpose**: Displays last 10 battles with key details

**Props**:
```typescript
interface RecentBattlesProps {
  battles: Array<{
    battleId: number;
    opponentName: string;
    opponentPortrait: string;
    result: 'win' | 'loss' | 'draw';
    battleType: 'league' | 'tournament' | 'tag-team';
    date: string;
    damageDealt: number;
    damageTaken: number;
    eloChange: number;
    teammates?: string[]; // For tag team battles
    opponentTeam?: string[]; // For tag team battles
  }>;
}
```

**Visual Design**:
- Compact list view with alternating row colors
- Each battle row shows:
  - Robot portraits (64×64px): player robot vs opponent
  - Result badge: "WIN" (green), "LOSS" (red), "DRAW" (amber)
  - Battle type icon
  - Date (relative: "2 hours ago", "3 days ago")
  - Damage dealt/taken (compact: "1,250 / 890")
  - ELO change with +/- indicator
  - "View Log" link
- Tag team battles show team composition on hover
- Color-coded left border: green for wins, red for losses, amber for draws

### 5. UpcomingMatches Component

**Purpose**: Shows scheduled matches with battle readiness warnings

**Props**:
```typescript
interface UpcomingMatchesProps {
  matches: Array<{
    matchId: number;
    opponentName?: string;
    opponentPortrait?: string;
    scheduledTime: string;
    battleType: 'league' | 'tournament' | 'tag-team';
    leagueContext?: string;
    tournamentContext?: string;
    teammates?: string[]; // For tag team
    opponentTeam?: string[]; // For tag team
  }>;
  battleReadiness: {
    isReady: boolean;
    warnings: string[];
  };
}
```

**Visual Design**:
- Card-based layout
- Each match card shows:
  - Battle type badge
  - Scheduled time (countdown if within 24 hours)
  - Opponent info (if known) or "TBD"
  - League/tournament context
  - Battle readiness indicator
- Warning states:
  - Red warning icon if HP < 50%
  - Yellow warning icon if no weapons equipped
  - Orange warning icon if not battle-ready
- Tag team matches show teammate names
- "No upcoming matches" empty state with illustration

### 6. UpgradePlanner Component

**Purpose**: Interactive interface for planning attribute upgrades before committing

**Props**:
```typescript
interface UpgradePlannerProps {
  robot: Robot;
  currentCredits: number;
  discounts: {
    workshopDiscount: number; // e.g., 0.20 for 20%
    bulkDiscount: number;
  };
  academyCaps: {
    combat: number;
    defense: number;
    chassis: number;
    ai: number;
    team: number;
  };
  onCommit: (upgrades: UpgradePlan) => Promise<void>;
  onReset: () => void;
}

interface UpgradePlan {
  [attributeName: string]: {
    currentLevel: number;
    plannedLevel: number;
    cost: number;
  };
}
```

**Visual Design**:
- Single scrollable view showing all 23 attributes
- Organized by 5 categories with category headers
- Each attribute row shows:
  - Attribute icon (24×24px) with category color
  - Attribute name
  - Current level
  - +/- buttons for planning
  - Planned level (if different from current)
  - Cost per upgrade
  - Total cost for this attribute
- Category headers show:
  - Category icon (32×32px)
  - Category name
  - Academy cap indicator
  - Total planned cost for category
- Bottom sticky panel shows:
  - Total planned cost (all attributes)
  - Current credits
  - Remaining credits after upgrades
  - "Commit Upgrades" button (primary, disabled if insufficient credits)
  - "Reset Plan" button (secondary)

**Behavior**:
- Click + to increment planned level
- Click - to decrement planned level
- + button disabled when reaching academy cap
- Real-time cost calculation with discounts applied
- Visual feedback: planned changes highlighted in blue
- Confirmation modal before committing (shows summary)

### 7. EffectiveStatsDisplay Component

**Purpose**: Concise display of effective attribute values with modifier impact

**Props**:
```typescript
interface EffectiveStatsDisplayProps {
  robot: Robot;
  effectiveStats: {
    [attributeName: string]: {
      base: number;
      weaponBonus: number;
      loadoutModifier: number;
      stanceModifier: number;
      totalModifier: number;
      effective: number;
    };
  };
}
```

**Visual Design**:
- Compact table organized by 5 categories
- Each attribute row shows:
  - Attribute icon and name
  - Base value
  - Total modifier percentage (e.g., "+35%")
  - Effective value (bold, larger font)
  - Expand icon for details
- Expanded view shows:
  - Weapon bonus breakdown
  - Loadout modifier
  - Stance modifier
  - Calculation formula
- Color coding:
  - Positive modifiers: green text
  - Negative modifiers: red text
  - Significant modifiers (>20%): highlighted background
- Category headers with category color background

## Data Models

### Robot Extended Model

```typescript
interface RobotExtended {
  // Base robot data
  id: number;
  name: string;
  ownerId: number;
  ownerName: string;
  frameId: number;
  portraitUrl: string;
  
  // Combat state
  currentHP: number;
  maxHP: number;
  currentShield: number;
  maxShield: number;
  battleReadiness: number;
  
  // Configuration
  loadoutType: 'single' | 'weapon_shield' | 'two_handed' | 'dual_wield';
  mainWeaponId: number | null;
  offhandWeaponId: number | null;
  stance: 'offensive' | 'defensive' | 'balanced';
  yieldThreshold: number;
  
  // Attributes (23 total)
  combatPower: number;
  targetingSystems: number;
  // ... (all 23 attributes)
  
  // Performance metrics
  elo: number;
  currentLeague: string;
  leaguePoints: number;
  totalBattles: number;
  wins: number;
  losses: number;
  draws: number;
  damageDealtLifetime: number;
  damageTakenLifetime: number;
  kills: number;
  
  // Economic
  totalRepairsPaid: number;
  currentRepairCost: number;
}
```

### Rankings Model

```typescript
interface RobotRankings {
  robotId: number;
  lastUpdated: Date;
  rankings: {
    combatCategory: RankingEntry;
    defenseCategory: RankingEntry;
    chassisCategory: RankingEntry;
    aiCategory: RankingEntry;
    teamCategory: RankingEntry;
    totalDamageDealt: RankingEntry;
    winRate: RankingEntry;
    elo: RankingEntry;
    kdRatio: RankingEntry;
  };
}

interface RankingEntry {
  rank: number;
  total: number;
  percentile: number;
  value: number; // The actual stat value
}
```

### Performance Context Model

```typescript
interface PerformanceContext {
  robotId: number;
  leagues: LeaguePerformance[];
  tournaments: TournamentPerformance[];
  tagTeam: TagTeamPerformance;
}

interface LeaguePerformance {
  leagueName: string;
  leagueIcon: string;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  damageDealt: number;
  damageTaken: number;
  eloChange: number;
  battlesPlayed: number;
}

interface TournamentPerformance {
  tournamentId: number;
  tournamentName: string;
  tournamentDate: Date;
  placement: number;
  totalParticipants: number;
  wins: number;
  losses: number;
  damageDealt: number;
  damageTaken: number;
}

interface TagTeamPerformance {
  totalBattles: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  damageDealt: number;
  damageTaken: number;
}
```

### Upgrade Plan Model

```typescript
interface UpgradePlan {
  robotId: number;
  plannedUpgrades: AttributeUpgrade[];
  totalCost: number;
  discountsApplied: {
    workshopDiscount: number;
    bulkDiscount: number;
  };
}

interface AttributeUpgrade {
  attributeName: string;
  currentLevel: number;
  plannedLevel: number;
  costPerLevel: number;
  totalCost: number;
  academyCap: number;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Default Tab Selection

*For any* page load of the Robot Detail Page, the Overview tab should be the active tab by default.

**Validates: Requirements 1.2**

### Property 2: Owner-Only Tab Access Control

*For any* robot and any user, when the user is not the robot owner, the Battle Config and Upgrades tabs should not be visible or accessible.

**Validates: Requirements 1.6, 6.1**

### Property 3: Tab State Persistence

*For any* tab selection and any subsequent page interaction, the selected tab should remain active until explicitly changed by the user.

**Validates: Requirements 1.7**

### Property 4: Active Tab Visual Indication

*For any* active tab, the tab element should have distinct visual styling (primary color background, white text) that differs from inactive tabs.

**Validates: Requirements 1.8**

### Property 5: Rank Display Format

*For any* robot ranking, the displayed rank should follow the format "#X of Y" where X is the robot's position and Y is the total number of robots.

**Validates: Requirements 2.3**

### Property 6: Percentile Badge Display

*For any* robot ranking, when the percentile is in the top 10%, a gold badge should be displayed; when in the top 25%, a silver badge; when in the top 50%, a bronze badge.

**Validates: Requirements 2.4**

### Property 7: Rankings Reflect Current Stats

*For any* robot, when attribute values change, the displayed rankings should update to reflect the new calculated positions.

**Validates: Requirements 2.5**

### Property 8: League Participation Display

*For any* robot, all leagues in which the robot has participated (battles > 0) should be displayed in the Performance by Context section.

**Validates: Requirements 3.1**

### Property 9: Tournament Participation Display

*For any* robot, all tournaments in which the robot has participated should be displayed in the Performance by Context section.

**Validates: Requirements 3.4**

### Property 10: Empty State Messages

*For any* robot with zero battles in a specific context (league, tournament, or tag team), the system should display "No battles yet" for that context.

**Validates: Requirements 3.8**

### Property 11: Recent Battles Count Limit

*For any* robot, the Recent Battles section should display at most 10 battles, ordered by date descending (most recent first).

**Validates: Requirements 4.1**

### Property 12: Battle Result Color Coding

*For any* displayed battle, the result indicator should use green for wins, red for losses, and amber for draws.

**Validates: Requirements 4.5**

### Property 13: Tag Team Battle Information Display

*For any* tag team battle, the display should include teammate names and opponent team composition in addition to standard battle information.

**Validates: Requirements 4.8**

### Property 14: Upcoming Matches Display Completeness

*For any* robot, all scheduled matches (league, tournament, and tag team) with future scheduled times should be displayed in the Upcoming Matches section.

**Validates: Requirements 5.1**

### Property 15: Battle Readiness Warnings

*For any* robot with HP below 50% or no weapons equipped, visual warnings should be displayed in the Upcoming Matches section.

**Validates: Requirements 5.5**

### Property 16: Chronological Match Sorting

*For any* set of upcoming matches, the matches should be sorted by scheduled time in ascending order (soonest first).

**Validates: Requirements 5.7**

### Property 17: Tag Team Match Information Display

*For any* upcoming tag team match, the display should include teammate robot names and opponent team composition.

**Validates: Requirements 5.8**

### Property 18: HP and Shield Bar Color Coding

*For any* robot, when HP is 70-100%, the HP bar should be green (#3fb950); when 30-69%, amber (#d29922); when 1-29%, red (#f85149).

**Validates: Requirements 6.6**

### Property 19: Configuration Change Feedback

*For any* configuration change (loadout, stance, yield), the effective stats display should update immediately to reflect the new values.

**Validates: Requirements 6.8**

### Property 20: Modifier Color Coding

*For any* attribute modifier, positive modifiers should be displayed in green text and negative modifiers in red text.

**Validates: Requirements 7.4**

### Property 21: Expandable Details Functionality

*For any* attribute in the Stats tab, clicking the expand icon should reveal detailed modifier breakdown, and clicking again should collapse it.

**Validates: Requirements 7.5**

### Property 22: Significant Modifier Highlighting

*For any* attribute with a total modifier greater than 20% (positive or negative), the attribute row should have visual highlighting.

**Validates: Requirements 7.7**

### Property 23: Upgrade Plan Increment

*For any* attribute below its academy cap, clicking the + button should increment the planned level by 1 and update the total cost preview.

**Validates: Requirements 8.3**

### Property 24: Upgrade Plan Decrement

*For any* attribute with a planned level greater than its current level, clicking the - button should decrement the planned level by 1 and update the total cost preview.

**Validates: Requirements 8.4**

### Property 25: Discount Application to Costs

*For any* planned upgrade, the displayed cost should equal the base cost multiplied by (1 - workshop discount) multiplied by (1 - bulk discount).

**Validates: Requirements 8.5, 9.3**

### Property 26: Running Total Cost Calculation

*For any* set of planned upgrades, the displayed total cost should equal the sum of all individual upgrade costs after discounts.

**Validates: Requirements 8.6, 9.4**

### Property 27: Remaining Credits Calculation

*For any* upgrade plan, the displayed remaining credits should equal current credits minus total planned upgrade cost.

**Validates: Requirements 8.7**

### Property 28: Reset Plan Functionality

*For any* upgrade plan with planned changes, clicking the "Reset Plan" button should clear all planned upgrades and reset the total cost to zero.

**Validates: Requirements 8.9**

### Property 29: Academy Cap Button Disabling

*For any* attribute at its academy cap, the + button should be disabled and not respond to clicks.

**Validates: Requirements 8.10**

### Property 30: Insufficient Credits Button Disabling

*For any* upgrade plan where total cost exceeds current credits, the "Commit Upgrades" button should be disabled.

**Validates: Requirements 8.11**

### Property 31: Discount Display Visibility

*For any* upgrade scenario where discounts are applicable (workshop discount > 0 or bulk discount > 0), the discount percentages should be displayed alongside costs.

**Validates: Requirements 9.2**

### Property 32: Real-Time Cost Updates

*For any* change to the upgrade plan (adding or removing planned upgrades), all cost displays (individual, total, remaining credits) should update within 100ms.

**Validates: Requirements 9.5**

### Property 33: Reduced Motion Respect

*For any* user with prefers-reduced-motion enabled, all animations should be disabled or reduced to instant transitions.

**Validates: Requirements 10.7**

### Property 34: Contrast Ratio Compliance

*For any* text element on the page, the contrast ratio between text color and background color should be at least 4.5:1.

**Validates: Requirements 10.8**

## Error Handling

### Client-Side Error Handling

**Tab Navigation Errors**:
- If tab state becomes invalid (e.g., owner-only tab accessed by non-owner), redirect to Overview tab
- Display error toast: "Access denied. Redirected to Overview."

**Data Loading Errors**:
- If robot data fails to load, display error state with retry button
- If rankings fail to load, show cached data with "Data may be outdated" warning
- If performance context fails to load, show empty state with "Unable to load statistics" message

**Upgrade Plan Errors**:
- If cost calculation fails, disable Commit button and show error message
- If academy cap data is unavailable, disable all + buttons and show warning
- If credit balance is unavailable, show warning and disable Commit button

**Configuration Change Errors**:
- If loadout change fails, revert to previous state and show error toast
- If stance change fails, revert to previous state and show error toast
- If yield threshold change fails, revert to previous value and show error toast

### Server-Side Error Handling

**Rankings Calculation Errors**:
- If ranking calculation fails, return cached rankings with `lastUpdated` timestamp
- If no cached data exists, return null rankings with appropriate error code
- Log error for investigation

**Performance Context Errors**:
- If league stats query fails, return empty array for leagues
- If tournament stats query fails, return empty array for tournaments
- If tag team stats query fails, return zero values for tag team performance
- Partial failures should not prevent other data from loading

**Upgrade Commit Errors**:
- If insufficient credits, return 400 error with message
- If attribute at cap, return 400 error with message
- If database update fails, rollback transaction and return 500 error
- If partial update occurs, rollback all changes and return error

**Access Control Errors**:
- If non-owner attempts to access owner-only data, return 403 error
- If robot not found, return 404 error
- If user not authenticated, return 401 error

### Error Recovery Strategies

**Optimistic UI Updates**:
- Configuration changes update UI immediately, revert on error
- Upgrade plan changes update UI immediately, no server call until commit
- Tab changes are client-side only, no error recovery needed

**Retry Logic**:
- Failed data fetches retry up to 3 times with exponential backoff
- Failed upgrade commits do not auto-retry (user must manually retry)
- Failed configuration changes retry once automatically

**Graceful Degradation**:
- If rankings unavailable, hide rankings section
- If performance context unavailable, show basic stats only
- If icons fail to load, show text labels only
- If animations fail, fall back to instant transitions

## Testing Strategy

### Unit Testing

**Component Tests**:
- Test each component renders with valid props
- Test component behavior with edge case props (empty arrays, null values, extreme numbers)
- Test event handlers fire correctly
- Test conditional rendering based on props
- Test accessibility attributes (ARIA labels, roles, etc.)

**State Management Tests**:
- Test tab state changes correctly
- Test upgrade plan state updates correctly
- Test cost calculations are accurate
- Test state persistence across re-renders

**Utility Function Tests**:
- Test ranking calculation functions
- Test cost calculation functions with various discount scenarios
- Test date formatting functions
- Test color selection functions based on thresholds

### Property-Based Testing

Each correctness property should be implemented as a property-based test with minimum 100 iterations. Tests should be tagged with the property number and text for traceability.

**Example Property Test Structure**:
```typescript
// Feature: robot-detail-page-visual-enhancement, Property 12: Battle Result Color Coding
test('battle result color coding', () => {
  fc.assert(
    fc.property(
      fc.record({
        result: fc.constantFrom('win', 'loss', 'draw'),
        // ... other battle properties
      }),
      (battle) => {
        const { container } = render(<BattleRow battle={battle} />);
        const resultElement = container.querySelector('[data-testid="battle-result"]');
        
        if (battle.result === 'win') {
          expect(resultElement).toHaveClass('text-success');
        } else if (battle.result === 'loss') {
          expect(resultElement).toHaveClass('text-error');
        } else {
          expect(resultElement).toHaveClass('text-warning');
        }
      }
    ),
    { numRuns: 100 }
  );
});
```

**Property Test Coverage**:
- Properties 1-34 should each have a dedicated property-based test
- Tests should generate random valid inputs using fast-check or similar library
- Tests should verify the property holds for all generated inputs
- Tests should be tagged with feature name and property number

### Integration Testing

**Tab Navigation Integration**:
- Test switching between tabs updates URL and content
- Test owner-only tabs are hidden for non-owners
- Test tab state persists across page interactions

**Upgrade Planner Integration**:
- Test planning multiple upgrades updates total cost correctly
- Test committing upgrades calls API with correct payload
- Test resetting plan clears all planned changes
- Test insufficient credits disables commit button

**Performance Context Integration**:
- Test loading robot with league participation displays league stats
- Test loading robot with tournament participation displays tournament stats
- Test loading robot with no participation displays empty states

**Configuration Integration**:
- Test changing loadout updates effective stats
- Test changing stance updates effective stats
- Test changing yield threshold updates repair cost preview

### End-to-End Testing

**Owner User Flow**:
1. Navigate to owned robot detail page
2. Verify all tabs are visible
3. Switch to Upgrades tab
4. Plan several upgrades
5. Verify total cost updates
6. Commit upgrades
7. Verify success message and updated attributes

**Non-Owner User Flow**:
1. Navigate to another user's robot detail page
2. Verify only Overview and Stats tabs are visible
3. View rankings and performance statistics
4. Verify no owner-only controls are present

**Battle Readiness Flow**:
1. Navigate to robot with low HP
2. Verify warnings in Upcoming Matches
3. Navigate to Battle Config tab
4. Verify HP bar is red
5. Verify battle readiness indicator shows not ready

### Visual Regression Testing

**Screenshot Comparisons**:
- Capture screenshots of each tab in various states
- Compare against baseline screenshots
- Flag any visual differences for review

**Responsive Design Testing**:
- Test layout at desktop, tablet, and mobile breakpoints
- Verify tab navigation works on all screen sizes
- Verify tables/cards adapt to smaller screens

**Accessibility Testing**:
- Run automated accessibility audits (axe, Lighthouse)
- Test keyboard navigation through all interactive elements
- Test screen reader compatibility
- Verify color contrast ratios meet WCAG 2.1 AA standards

### Performance Testing

**Load Time Metrics**:
- Page should load in < 2 seconds on 3G connection
- Tab switches should occur in < 100ms
- Upgrade plan updates should occur in < 50ms

**Data Volume Testing**:
- Test with robots having 100+ battles
- Test with robots in 10+ leagues
- Test with robots having 20+ upcoming matches
- Verify performance remains acceptable

**Animation Performance**:
- Verify animations maintain 60fps
- Test on lower-end devices
- Verify reduced motion preference is respected

## Implementation Notes

### Technology Stack

**Frontend**:
- React 18+ for component architecture
- TypeScript for type safety
- Tailwind CSS for styling
- Framer Motion for animations (optional, can use CSS)
- React Query for data fetching and caching
- Zustand or Context API for state management

**Testing**:
- Jest for unit tests
- React Testing Library for component tests
- fast-check for property-based tests
- Playwright or Cypress for E2E tests
- axe-core for accessibility testing

### Performance Optimizations

**Data Fetching**:
- Use React Query for automatic caching and background refetching
- Implement stale-while-revalidate strategy for rankings (cache for 5 minutes)
- Lazy load tab content (only fetch data when tab is activated)
- Prefetch likely next tab on hover

**Rendering Optimizations**:
- Use React.memo for expensive components
- Implement virtual scrolling for large battle lists (if > 50 battles)
- Debounce upgrade plan updates (50ms)
- Use CSS transforms for animations (GPU-accelerated)

**Bundle Size**:
- Code-split by tab (lazy load tab components)
- Tree-shake unused icon components
- Optimize images (WebP format, responsive sizes)
- Minimize CSS (PurgeCSS with Tailwind)

### Accessibility Considerations

**Keyboard Navigation**:
- Tab key navigates through interactive elements in logical order
- Arrow keys navigate between tabs
- Enter/Space activates buttons and toggles
- Escape closes modals and expanded details

**Screen Reader Support**:
- ARIA labels for all interactive elements
- ARIA live regions for dynamic content updates
- ARIA expanded/collapsed states for expandable sections
- Semantic HTML (nav, main, section, article)

**Visual Accessibility**:
- 4.5:1 contrast ratio for all text
- Focus indicators visible on all interactive elements
- Color is not the only means of conveying information (icons + text)
- Text remains readable when zoomed to 200%

### Migration Strategy

**Phase 1: Tab Infrastructure** (Week 1)
- Implement tab navigation component
- Set up routing with tab parameter
- Create tab content containers
- Test tab switching and state persistence

**Phase 2: Overview Tab** (Week 2)
- Implement statistical rankings component
- Implement performance by context component
- Implement recent battles component
- Implement upcoming matches component
- Test data loading and display

**Phase 3: Upgrades Tab** (Week 3)
- Implement upgrade planner component
- Implement cost calculation logic
- Implement commit/reset functionality
- Test upgrade planning and committing

**Phase 4: Stats Tab** (Week 4)
- Implement effective stats display component
- Implement expandable details
- Test stat calculations and display

**Phase 5: Battle Config Tab** (Week 5)
- Migrate existing battle config components to new tab
- Update styling to match design system
- Test configuration changes

**Phase 6: Visual Polish** (Week 6)
- Implement all icons and visual assets
- Apply color coding throughout
- Implement micro-animations
- Test accessibility and visual regression

**Phase 7: Testing & Refinement** (Week 7)
- Complete property-based test suite
- Run E2E tests
- Perform accessibility audit
- Fix bugs and polish UX

**Phase 8: Deployment** (Week 8)
- Deploy to staging
- User acceptance testing
- Deploy to production
- Monitor for issues

### Future Enhancements

**Phase 9+** (Post-Launch):
- Add filtering/sorting to recent battles
- Add battle history charts (ELO over time, damage trends)
- Add comparison mode (compare two robots side-by-side)
- Add export functionality (export stats as CSV/PDF)
- Add customizable dashboard (user can choose which stats to display)
- Add real-time updates (WebSocket for live match updates)
- Add mobile-optimized layouts
- Add dark/light theme toggle
