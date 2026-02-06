# Product Requirements Document: Battle History Page Overhaul

**Project**: Armoured Souls  
**Document Type**: Product Requirements Document (PRD)  
**Version**: 1.1  
**Date**: February 5, 2026  
**Author**: GitHub Copilot  
**Status**: Reviewed

---

## Version History
- v1.0 - Initial draft by GitHub Copilot (February 5, 2026)
- v1.1 - Review done by Robert Teunissen (February 6, 2026)

---

## Executive Summary

The Battle History Page (`/battle-history`) is a critical player-facing feature that provides match history, performance tracking, and strategic insights. The current implementation suffers from poor information density with large colored blocks consuming excessive vertical space, showing only 3 battles on a laptop screen. This PRD outlines comprehensive improvements to transform the page into an efficient, scannable interface that aligns with the Armoured Souls design system.

**Key Goals:**
- Dramatically improve information density (target: 8-10 battles per screen vs. current 3)

--> Is this enough? 3 robots each fighting one league match and two tournament matches is already 9 matches each day/cycle!

- Reduce visual noise from oversized colored blocks
- Enhance scannability with compact, tabular layout
- Align with design system (Direction B logo, proper color palette)
- Add filtering, sorting, and search capabilities
- Improve mobile responsiveness
- Maintain quick access to detailed battle reports


**Problem Statement:**  
Players need to review multiple battles to analyze performance patterns, but the current UI only shows 3 battles per screen on a laptop due to large green/red blocks. This forces excessive scrolling and makes pattern recognition difficult.

---

## Current State Analysis

### What the Battle History Page Does

The Battle History Page displays a paginated list of a player's robot battle results, showing:
- Battle outcome (Victory/Defeat/Draw)
- Participating robots (player's robot and opponent)
- Battle statistics (ELO change, rewards, duration, HP)
- Tournament information (when applicable)
- Link to detailed battle report

**Current Data Displayed Per Battle**:
- Outcome badge (VICTORY/DEFEAT/DRAW)
- Date and time
- Player's robot name and opponent's robot name
- Opponent's username
- ELO change (with +/- indicator)
- Reward amount (credits)
- Battle duration
- ELO progression (before → after)
- Final HP percentages (both robots)
- Battle ID
- Tournament information (if applicable)
- "View Detailed Battle Report" button

### Current Implementation Strengths

✅ **Comprehensive Data**: All relevant battle information is present  
✅ **Clear Outcome Indication**: Victory/defeat immediately visible  
✅ **Tournament Highlighting**: Tournament battles have yellow border and badge  
✅ **Pagination**: Handles large battle histories efficiently  
✅ **Direct Battle Links**: Can view detailed reports  
✅ **Responsive Grid**: Adapts to different screen sizes  

### Current Pain Points & Priority Issues

#### 1. **Poor Information Density** ⭐ CRITICAL PRIORITY
- **Issue**: Each battle occupies ~250-300px of vertical height due to:
  - Large padding (p-4 on outer container)
  - Full-width layout with extensive spacing
  - Multi-row layout for information that could be columnar
  - Oversized text (2xl for outcome)
  - Extensive detailed stats section
- **Impact**: Only 3 battles visible on 1080p laptop screen (1920×1080)
- **User Feedback**: "Not practical" - cannot see enough battles at once
- **Solution**: Compact table-based or card-based layout targeting 80-100px per battle

#### 2. **Overwhelming Color Blocks** ⭐ HIGH PRIORITY
- **Issue**: Full background colors (bg-green-900, bg-red-900) create visual noise
- **Current Colors**:
  - Victory: `bg-green-900 border-green-600 text-green-400`
  - Defeat: `bg-red-900 border-red-600 text-red-400`
  - Draw: `bg-gray-700 border-gray-500 text-gray-400`
- **Impact**: Makes page feel "shouty" and hard to scan quickly
- **Design System Misalignment**: Should use surface colors with subtle accent borders
- **Solution**: Neutral background with colored left border accent (4px)

#### 3. **No Filtering or Sorting**
- **Issue**: Cannot filter by:
  - Outcome (wins/losses/draws)
  - Battle type (league match vs. tournament)
  - Date range
  - Opponent
  - Robot
- **Impact**: Cannot analyze specific subsets of battles
- **Solution**: Filter controls and sorting options

#### 4. **Inefficient Information Layout**
- **Issue**: Information spread across multiple rows when it could be tabular
- **Example**: "ELO Change" section shows `1500 → 1525` which could be more compact
- **Impact**: Wastes vertical space
- **Solution**: Tabular layout with compact columns

#### 5. **Missing Quick Stats Summary**
- **Issue**: No aggregate statistics at page top
- **Impact**: Cannot see overall performance at a glance
- **Solution**: Summary card showing W/L/D record, average ELO change, total credits earned

#### 6. **Large "View Detailed Battle Report" Button**
- **Issue**: Full-width button for every battle adds 40-50px height
- **Impact**: Contributes to poor density
- **Solution**: Make entire battle row clickable or use small icon button

#### 7. **Design System Misalignment**
- **Issue**: Using Tailwind defaults (gray-900, gray-800) instead of design system colors
- **Design System Colors**:
  - Background: `#0a0e14` (Deep space black)
  - Surface: `#1a1f29` (Dark panel)
  - Surface Elevated: `#252b38` (Raised cards)
  - Primary: `#58a6ff` (Cyan-blue)
  - Success: `#3fb950` (Green)
  - Warning: `#d29922` (Amber)
  - Error: `#f85149` (Red)
- **Solution**: Update to use design system color palette

#### 8. **No Mobile Optimization**
- **Issue**: Layout doesn't optimize well for narrow screens
- **Impact**: Poor mobile experience
- **Solution**: Responsive table/card switching

---

## Proposed Battle History Page Structure

### Layout Options Analysis

#### Option A: Compact Table Layout (RECOMMENDED)
**Best for desktop, moderate information density, excellent scannability**

```
┌────────────────────────────────────────────────────────────────────┐
│ Battle History                                      [Filter] [Sort] │
├────────────────────────────────────────────────────────────────────┤
│ Summary: 45 Wins / 23 Losses / 2 Draws | Avg ELO: +12.5           │
└────────────────────────────────────────────────────────────────────┘

┌──┬─────────┬────────────────────────┬────────────┬─────────┬────────┐
│  │ Outcome │ Matchup                │ Date       │ ELO     │ Reward │
├──┼─────────┼────────────────────────┼────────────┼─────────┼────────┤
│🏆│VICTORY  │ MyBot vs OpponentBot   │ Feb 5 14:30│ +25     │ ₡1,000 │
│  │         │ Owner: PlayerName      │            │1525→1550│        │
├──┼─────────┼────────────────────────┼────────────┼─────────┼────────┤
│  │DEFEAT   │ MyBot2 vs EnemyBot     │ Feb 5 12:15│ -18     │ ₡500   │
│  │         │ Owner: OtherPlayer     │            │1543→1525│        │
└──┴─────────┴────────────────────────┴────────────┴─────────┴────────┘

Target height per battle: 60-80px
Expected visible battles (1080p): 8-10 battles
```

--> I want to see a difference between match types. Is it a league match or a tournament match? Which type of tournament? Maybe a 2v2? Should also be possible to sort on them. 

#### Option B: Compact Card Layout (ALTERNATIVE)
**Good for mobile, balanced approach**

```
┌────────────────────────────────────────────────────────────┐
│ ▌VICTORY    MyBot vs OpponentBot (PlayerName)    Feb 5     │
│  +25 ELO (1525→1550) | ₡1,000 | Duration: 45s   [View →]  │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ ▌DEFEAT     MyBot2 vs EnemyBot (OtherPlayer)     Feb 5     │
│  -18 ELO (1543→1525) | ₡500 | Duration: 52s     [View →]  │
└────────────────────────────────────────────────────────────┘

Target height per battle: 70-90px
Expected visible battles (1080p): 7-9 battles
```

### Selected Approach: Hybrid Layout

**Desktop (≥1024px)**: Compact table layout  
**Tablet (768-1023px)**: Compact card layout  
**Mobile (<768px)**: Full card layout with stacked information

---

## Detailed Design Specifications

### Page Structure

```
/battle-history Page Layout (Revised)

├── Navigation Bar (global)
├── Page Header
│   ├── Page Title: "Battle History"
│   ├── Summary Statistics Card
│   │   ├── Total Battles
│   │   ├── W/L/D Record (with percentages)
│   │   └── Current Win Streak (if applicable)
│   └── Controls Row
│       ├── Filter Controls (dropdown/toggles)
│       │   ├── Outcome Filter: All / Wins / Losses / Draws
│       │   ├── Type Filter: All / League / Tournament
│       │   └── Date Range Filter
│       ├── Sort Controls
│       │   ├── Date (newest/oldest)
│       │   ├── ELO Change (highest/lowest)
│       │   └── Duration (longest/shortest)
│       └── Search Input (robot name, opponent)
├── Battle List Section
│   ├── Compact Battle Cards (clickable)
│   │   ├── Left Border Accent (4px) - colored by outcome
│   │   ├── Tournament Badge (if applicable)
│   │   ├── Outcome Badge (compact)
│   │   ├── Matchup Information (robot names, owner)
│   │   ├── Date/Time
│   │   ├── ELO Change (with progression)
│   │   ├── Reward Amount
│   │   ├── Duration
│   │   └── Quick Stats (HP, Battle ID)
│   └── Empty State (if no battles match filter)
└── Pagination Controls
    ├── Previous/Next Buttons
    ├── Page Number Display
    └── Results Per Page Selector (20/50/100)
```

--> For statistics, differentiate between league matches and tournaments.

### Component Specifications

#### 1. Summary Statistics Card

**Purpose**: Provide at-a-glance performance overview

**Content**:
- Total Battles: Count of all battles
- Win/Loss/Draw Record: e.g., "45W / 23L / 2D (64.3% win rate)"
- Average ELO Change: e.g., "+12.5 avg" (color-coded: green if positive, red if negative)
- Total Credits Earned: e.g., "₡45,000 earned from battles"
- Current Win/Loss Streak: e.g., "5-game win streak 🔥" or "2-game loss streak"

**Visual Design**:
```jsx
<div className="bg-surface-elevated border border-gray-700 rounded-lg p-4 mb-6">
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    <div>
      <div className="text-sm text-secondary">Total Battles</div>
      <div className="text-2xl font-bold text-primary">70</div>
    </div>
    <div>
      <div className="text-sm text-secondary">Record</div>
      <div className="text-2xl font-bold">
        <span className="text-success">45W</span> / 
        <span className="text-error">23L</span> / 
        <span className="text-tertiary">2D</span>
      </div>
      <div className="text-xs text-tertiary">64.3% win rate</div>
    </div>
    <div>
      <div className="text-sm text-secondary">Avg ELO Change</div>
      <div className="text-2xl font-bold text-success">+12.5</div>
    </div>
    <div>
      <div className="text-sm text-secondary">Credits Earned</div>
      <div className="text-2xl font-bold">₡45,000</div>
    </div>
  </div>
</div>
```

#### 2. Filter and Sort Controls

**Purpose**: Allow users to narrow down battle list

**Filter Options**:
- **Outcome**: All / Wins / Losses / Draws
- **Battle Type**: All / League Match / Tournament
- **Date Range**: Last 7 days / Last 30 days / All Time / Custom
- **Robot**: Dropdown to filter by specific robot (if player has multiple)

**Sort Options**:
- **Date**: Newest First (default) / Oldest First
- **ELO Change**: Highest Gains / Highest Losses
- **Duration**: Longest / Shortest
- **Reward**: Highest / Lowest

**Visual Design**:
```jsx
<div className="flex flex-wrap gap-3 mb-4">
  <select className="bg-surface border border-gray-700 rounded px-3 py-2 text-sm">
    <option>All Outcomes</option>
    <option>Wins Only</option>
    <option>Losses Only</option>
    <option>Draws Only</option>
  </select>
  
  <select className="bg-surface border border-gray-700 rounded px-3 py-2 text-sm">
    <option>All Types</option>
    <option>League Match</option>
    <option>Tournament</option>
  </select>
  
  <select className="bg-surface border border-gray-700 rounded px-3 py-2 text-sm">
    <option>Sort: Newest First</option>
    <option>Sort: Oldest First</option>
    <option>Sort: Highest ELO Gain</option>
    <option>Sort: Biggest ELO Loss</option>
  </select>
  
  <input 
    type="text" 
    placeholder="Search robot or opponent..."
    className="bg-surface border border-gray-700 rounded px-3 py-2 text-sm flex-1 min-w-[200px]"
  />
</div>
```

#### 3. Compact Battle Card (Desktop Layout)

**Purpose**: Display battle information in minimal vertical space

**Target Height**: 70-80px per battle

**Visual Design**:
```jsx
<div 
  onClick={() => navigate(`/battle/${battle.id}`)}
  className={`
    bg-surface-elevated border border-gray-700 rounded-lg p-3 mb-2
    hover:bg-surface hover:border-primary/50 cursor-pointer transition-colors
    ${isTournament ? 'border-l-4 border-l-warning' : ''}
    ${outcome === 'win' ? 'border-l-4 border-l-success' : ''}
    ${outcome === 'loss' ? 'border-l-4 border-l-error' : ''}
    ${outcome === 'draw' ? 'border-l-4 border-l-tertiary' : ''}
  `}
>
  <div className="flex items-center gap-4">
    {/* Outcome Badge */}
    <div className="flex-shrink-0 w-20">
      <div className={`
        text-xs font-bold px-2 py-1 rounded text-center
        ${outcome === 'win' ? 'bg-success/20 text-success' : ''}
        ${outcome === 'loss' ? 'bg-error/20 text-error' : ''}
        ${outcome === 'draw' ? 'bg-tertiary/20 text-tertiary' : ''}
      `}>
        {outcome === 'win' ? 'VICTORY' : outcome === 'loss' ? 'DEFEAT' : 'DRAW'}
      </div>
      {isTournament && (
        <div className="text-xs text-warning mt-1 text-center">🏆 Tournament</div>
      )}
    </div>
    
    {/* Matchup */}
    <div className="flex-1 min-w-0">
      <div className="font-medium text-sm truncate">
        <span className="text-primary">{myRobot.name}</span>
        <span className="text-tertiary mx-2">vs</span>
        <span>{opponent.name}</span>
      </div>
      <div className="text-xs text-secondary truncate">
        Owner: {opponent.user.username}
      </div>
    </div>
    
    {/* Date */}
    <div className="flex-shrink-0 w-24 text-xs text-secondary">
      {formatDate(battle.createdAt)}
    </div>
    
    {/* ELO Change */}
    <div className="flex-shrink-0 w-24">
      <div className={`text-sm font-bold ${eloChange >= 0 ? 'text-success' : 'text-error'}`}>
        {eloChange > 0 ? '+' : ''}{eloChange}
      </div>
      <div className="text-xs text-tertiary">
        {battle.robot1ELOBefore} → {battle.robot1ELOAfter}
      </div>
    </div>
    
    {/* Reward */}
    <div className="flex-shrink-0 w-20 text-right">
      <div className="text-sm font-medium">₡{reward.toLocaleString()}</div>
      <div className="text-xs text-tertiary">{formatDuration(battle.durationSeconds)}</div>
    </div>
    
    {/* View Icon */}
    <div className="flex-shrink-0 w-8 text-center">
      <span className="text-primary">→</span>
    </div>
  </div>
</div>
```

**Collapsed Additional Stats** (optional, expand on hover/click):
- Final HP percentages
- Battle ID
- Tournament round information

#### 4. Mobile Battle Card

**Purpose**: Stack information vertically for narrow screens

**Target Height**: 120-150px per battle

**Visual Design**:
```jsx
<div className={`
  bg-surface-elevated border border-gray-700 rounded-lg p-4 mb-3
  border-l-4 ${getOutcomeBorderColor(outcome)}
`}>
  {/* Header Row */}
  <div className="flex items-center justify-between mb-2">
    <div className={`text-sm font-bold ${getOutcomeTextColor(outcome)}`}>
      {getOutcomeText(outcome)}
    </div>
    <div className="text-xs text-secondary">
      {formatDate(battle.createdAt)}
    </div>
  </div>
  
  {/* Matchup Row */}
  <div className="mb-2">
    <div className="text-sm font-medium">
      <span className="text-primary">{myRobot.name}</span>
      <span className="text-tertiary mx-2">vs</span>
      <span>{opponent.name}</span>
    </div>
    <div className="text-xs text-secondary">
      {opponent.user.username}
    </div>
  </div>
  
  {/* Stats Row */}
  <div className="flex justify-between text-xs">
    <div>
      <span className="text-tertiary">ELO:</span>
      <span className={`ml-1 font-bold ${eloChange >= 0 ? 'text-success' : 'text-error'}`}>
        {eloChange > 0 ? '+' : ''}{eloChange}
      </span>
    </div>
    <div>
      <span className="text-tertiary">Reward:</span>
      <span className="ml-1 font-medium">₡{reward.toLocaleString()}</span>
    </div>
    <div>
      <span className="text-tertiary">Duration:</span>
      <span className="ml-1">{formatDuration(battle.durationSeconds)}</span>
    </div>
  </div>
</div>
```

#### 5. Empty State

**Purpose**: Handle cases where no battles match filters

**Visual Design**:
```jsx
<div className="bg-surface-elevated border border-gray-700 rounded-lg p-12 text-center">
  <div className="text-6xl mb-4 opacity-30">⚔️</div>
  <h3 className="text-xl font-bold mb-2">No Battles Found</h3>
  <p className="text-secondary mb-4">
    {hasActiveFilters 
      ? "Try adjusting your filters to see more results."
      : "Your first match is coming soon!"}
  </p>
  {hasActiveFilters && (
    <button 
      onClick={clearFilters}
      className="px-4 py-2 bg-primary hover:bg-primary-light rounded transition-colors"
    >
      Clear Filters
    </button>
  )}
</div>
```

---

## Design System Alignment

### Color Palette Updates

**Current (Misaligned)**:
```css
background: gray-900    /* #111827 - Tailwind default */
cards: gray-800         /* #1F2937 - Tailwind default */
borders: gray-700       /* #374151 - Tailwind default */
```

**Target (Design System)**:
```css
background: #0a0e14     /* Deep space black */
surface: #1a1f29        /* Dark panel */
surface-elevated: #252b38  /* Raised cards */
primary: #58a6ff        /* Cyan-blue */
success: #3fb950        /* Green */
warning: #d29922        /* Amber */
error: #f85149          /* Red */
text-primary: #e6edf3   /* Off-white */
text-secondary: #8b949e /* Gray */
text-tertiary: #57606a  /* Muted gray */
```

### Logo Usage

**Current**: No logo on page (only in navigation)  
**Target**: Direction B logo in navigation (already implemented globally)

**Design Rationale**:
- Battle History is a management/analysis screen
- Direction B (Precision) logo reinforces mastery and control
- No need for Direction C (Energized) logo - this is not a peak emotional moment

### Typography

**Current**: Generally follows hierarchy, but outcome text is oversized  
**Target**:
- Page Title (H1): `text-3xl font-bold` (30px)
- Section Headers: `text-xl font-medium` (20px)
- Battle Outcome Badge: `text-xs font-bold` (12px) - REDUCED from current 2xl
- Body Text: `text-sm` (14px)
- Labels: `text-xs` (12px)

### Motion

**Current**: No animations  
**Target**: Subtle hover effects
- Battle card hover: Lift 2px, change border color (150ms ease-out)
- Button hover: Background color transition (200ms ease-out)
- No idle animations

---

## Proposed UX Improvements 

### Phase 1: Critical Layout Overhaul 

#### 1.1 Implement Compact Battle Card Layout ⭐ CRITICAL
**Problem Solved**: Dramatically increase information density

**Implementation**:
- Redesign battle card to use horizontal layout
- Reduce padding from `p-4` to `p-3`
- Change outcome from `text-2xl` to `text-xs` badge
- Remove full-width "View Detailed Battle Report" button
- Make entire card clickable
- Target: 70-80px height per battle (down from ~250px)

**Expected Result**: 8-10 battles visible on 1080p screen (vs. current 3)

--> Battle cards or table structure?

#### 1.2 Replace Full Background Colors with Border Accents ⭐ HIGH PRIORITY
**Problem Solved**: Reduce visual noise, improve scannability

**Implementation**:
- Change from full background color to neutral surface color
- Add 4px left border with outcome color
- Use subtle background tint (e.g., `bg-success/10`) on hover only

**Color Mapping**:
- Victory: Left border `border-l-success` (#3fb950)
- Defeat: Left border `border-l-error` (#f85149)
- Draw: Left border `border-l-tertiary` (#57606a)
- Tournament: Additional yellow left border overlay or badge

#### 1.3 Update to Design System Color Palette
**Problem Solved**: Visual consistency with rest of application

**Implementation**:
- Replace `gray-900` → `background` (#0a0e14)
- Replace `gray-800` → `surface` (#1a1f29)
- Replace `gray-700` → `surface-elevated` (#252b38)
- Update accent colors to design system values
- Update text colors to design system typography

#### 1.4 Add Summary Statistics Card
**Problem Solved**: No at-a-glance performance overview

**Implementation**:
- Create new component `BattleHistorySummary`
- Fetch aggregate statistics from backend (or compute client-side)
- Display above battle list
- Show: Total battles, W/L/D record, avg ELO, total credits, current streak

#### 1.5 Make Battle Cards Clickable
**Problem Solved**: Remove bulky full-width button

**Implementation**:
- Wrap entire card in clickable div with `cursor-pointer`
- Add hover state (subtle lift, border color change)
- Navigate to `/battle/${battle.id}` on click
- Remove individual "View Detailed Battle Report" button
- Add small arrow icon on right side as visual cue

### Phase 2: Filtering and Sorting 

#### 2.1 Implement Outcome Filter
**Problem Solved**: Cannot view only wins or losses

**Implementation**:
- Add dropdown/toggle buttons for All/Wins/Losses/Draws
- Filter battles client-side initially
- Update URL params to persist filter state
- Show active filter count badge

#### 2.2 Implement Battle Type Filter
**Problem Solved**: Cannot separate league matches from tournaments

**Implementation**:
- Add filter for battle type (All/League/Tournament)
- Highlight tournaments differently (yellow border or badge)
- Show count of each type in filter

#### 2.3 Implement Sort Controls
**Problem Solved**: Cannot sort by ELO change or duration

**Implementation**:
- Add sort dropdown with options:
  - Date (newest first / oldest first)
  - ELO change (highest gain / biggest loss)
  - Duration (longest / shortest)
  - Reward (highest / lowest)
- Sort battles client-side
- Persist sort preference in localStorage

#### 2.4 Add Search Functionality
**Problem Solved**: Cannot quickly find battles against specific opponent

**Implementation**:
- Add search input field
- Search by: opponent robot name, opponent username, player's robot name
- Debounce search input (300ms)
- Highlight matching text in results (optional)

#### 2.5 Results Per Page Selector
**Problem Solved**: Default 20 per page may still require pagination

**Implementation**:
- Add dropdown to select 20/50/100 results per page
- Update pagination controls accordingly
- Store preference in localStorage
- Consider infinite scroll as alternative (Phase 3)

### Phase 3: Enhanced Visibility and Polish 

#### 3.1 Responsive Mobile Layout
**Problem Solved**: Table layout doesn't work well on mobile

**Implementation**:
- Use CSS Grid/Flexbox breakpoints
- Desktop (≥1024px): Horizontal compact cards
- Tablet (768-1023px): Slightly taller cards
- Mobile (<768px): Stacked vertical cards
- Test on various screen sizes

#### 3.2 Loading States and Skeleton Screens
**Problem Solved**: Current loading state is basic text

**Implementation**:
- Add skeleton loading cards while fetching
- Maintain layout structure during load
- Show loading spinner for page changes
- Implement optimistic UI updates if possible

#### 3.3 Tournament Badge Enhancement
**Problem Solved**: Tournament battles should be more prominent

**Implementation**:
- Add gold/yellow trophy icon badge
- Show tournament name and round (e.g., "Finals")
- Consider special styling for championship matches
- Link to tournament bracket/standings (future feature)

#### 3.4 Performance Optimizations
**Problem Solved**: Potential performance issues with large battle lists

**Implementation**:
- Implement virtual scrolling for large result sets (if needed)
- Memoize battle card components
- Optimize re-renders with React.memo
- Consider pagination vs. infinite scroll trade-offs

#### 3.5 Export/Share Functionality
**Problem Solved**: Cannot export battle history data

**Implementation** (Future consideration):
- Add "Export as CSV" button
- Add "Share battle link" for individual battles
- Copy link to clipboard with toast notification
- Generate shareable battle statistics card (image)

---

## Implementation Plan

### Phase 1: Foundation 
**Goal**: Fix critical information density and visual noise issues

**Tasks**:
- [ ] Design and implement compact battle card component
- [ ] Replace full background colors with border accent system
- [ ] Update entire page to use design system color palette
- [ ] Add summary statistics card at page top
- [ ] Make battle cards fully clickable (remove individual buttons)
- [ ] Implement responsive layout (desktop/tablet/mobile)
- [ ] Update typography to reduce outcome badge size

**Success Metrics**:
- 8-10 battles visible on 1080p screen (vs. current 3)
- Visual noise reduced by 70%
- Click-through rate to detailed battle reports maintained or increased

**Risk**: Low - mostly frontend refactoring

### Phase 2: Functionality 
**Goal**: Add filtering, sorting, and search capabilities

**Tasks**:
- [ ] Implement outcome filter (All/Wins/Losses/Draws)
- [ ] Implement battle type filter (All/League/Tournament)
- [ ] Implement sort controls (date, ELO, duration, reward)
- [ ] Add search input with debouncing
- [ ] Add results per page selector
- [ ] Persist filter/sort state in URL params and localStorage
- [ ] Add "Clear Filters" button
- [ ] Implement empty state for no results

**Success Metrics**:
- 80%+ of users engage with at least one filter
- Average time to find specific battle reduced by 50%

**Risk**: Low - standard filtering/sorting implementation

### Phase 3: Polish (Week 3)
**Goal**: Enhance user experience with polish and optimization

**Tasks**:
- [ ] Implement loading skeletons
- [ ] Add hover animations and micro-interactions
- [ ] Optimize performance for large battle lists
- [ ] Enhanced tournament badge styling
- [ ] Add export functionality (CSV)
- [ ] Comprehensive cross-browser testing
- [ ] Accessibility audit (keyboard navigation, screen readers)
- [ ] Mobile device testing

**Success Metrics**:
- 95%+ of interactions feel smooth and responsive
- No performance degradation with 1000+ battles
- WCAG AA accessibility compliance

**Risk**: Low

---

## Technical Considerations

### Frontend (React/TypeScript)

#### State Management
- Use React hooks (`useState`, `useEffect`) for local state
- Consider React Query for data fetching and caching (future)
- Store filter/sort preferences in localStorage
- Update URL params to make filters shareable

#### Component Structure
```
BattleHistoryPage.tsx (main)
├── BattleHistorySummary.tsx (new)
├── BattleHistoryFilters.tsx (new)
├── BattleHistoryList.tsx (new)
│   └── BattleCard.tsx (refactored)
│       ├── BattleCardDesktop.tsx
│       └── BattleCardMobile.tsx
└── BattleHistoryPagination.tsx (existing, may refactor)
```

#### Performance Optimizations
- Memoize battle cards with `React.memo`
- Use `useMemo` for filtered/sorted battle lists
- Debounce search input (300ms)
- Consider virtualization for very large lists (react-window/react-virtualized)
- Lazy load detailed battle data on card click

#### Responsive Design
- Use Tailwind breakpoints (sm:, md:, lg:, xl:)
- Test on common viewport sizes:
  - Mobile: 375px, 414px
  - Tablet: 768px, 1024px
  - Desktop: 1280px, 1920px

### Backend (Node.js/Prisma)

#### API Enhancements (Optional)

**Current Endpoint**: `GET /api/matchmaking/history?page={page}&pageSize={pageSize}`

**Potential Enhancements** (if filtering/sorting moves to backend):
```
GET /api/matchmaking/history?
  page=1
  &pageSize=20
  &outcome=win                    // Filter by outcome
  &battleType=league              // Filter by type
  &sortBy=eloChange               // Sort field
  &sortOrder=desc                 // Sort direction
  &search=OpponentName            // Search term
  &robotId=123                    // Filter by specific robot
```

**Aggregate Statistics Endpoint** (new):
```
GET /api/matchmaking/history/stats
Response: {
  totalBattles: 70,
  wins: 45,
  losses: 23,
  draws: 2,
  winRate: 0.643,
  avgELOChange: 12.5,
  totalCreditsEarned: 45000,
  currentStreak: { type: "win", count: 5 }
}
```

**Decision**: Start with client-side filtering/sorting (simpler, no backend changes). Move to backend if performance becomes an issue with large datasets.

### Database

**No schema changes required** for Phase 1-2.

**Potential future enhancements**:
- Add indexes on `createdAt`, `winnerId` for faster queries
- Consider materialized view for aggregate statistics

### Testing Strategy

#### Unit Tests
- Battle card rendering with different outcomes
- Filter logic (outcome, type, search)
- Sort logic (date, ELO, duration)
- Date formatting utilities
- ELO change calculation

#### Integration Tests
- Fetch battle history and display
- Pagination controls
- Filter interaction updates list
- Click battle card navigates correctly

#### Manual Testing
- Visual regression testing (before/after screenshots)
- Cross-browser testing (Chrome, Firefox, Safari, Edge)
- Mobile device testing (iOS Safari, Android Chrome)
- Accessibility testing (keyboard navigation, screen reader)
- Performance testing (1000+ battle list)

---

## Design Mockups and Examples

### Before vs. After Comparison

#### Current Implementation (Before)
```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  VICTORY                              Feb 5, 14:30        │ │  MyBot                        VS             OpponentBot  │
│  You                                               Player1 │
│                                                            │
│  ELO: +25          Reward: ₡1,000      Duration: 45s      │
│                                                            │
│  ───────────────────────────────────────────────────────  │
│  ELO Change: 1525 → 1550                                   │
│  Final HP: 75%                                             │
│  Opponent HP: 0%                                           │
│  Battle ID: #12345                                         │
│                                                            │
│  ───────────────────────────────────────────────────────  │
│  [        View Detailed Battle Report        ]            │
│                                                            │
└────────────────────────────────────────────────────────────┘
                    ~280px height
```

#### Proposed Implementation (After)
```
┌──┬─────────┬────────────────────────┬────────────┬─────────┬────────┬──┐
│🏅│VICTORY  │ MyBot vs OpponentBot   │ Feb 5 14:30│ +25     │ ₡1,000 │→ │
│  │         │ Owner: Player1         │            │1525→1550│ 45s    │  │
└──┴─────────┴────────────────────────┴────────────┴─────────┴────────┴──┘
                    ~70px height
```

**Space Saved**: 75% reduction in height (280px → 70px)  
**Battles Visible**: 3 → 10 on 1080p screen

### Color System Comparison

#### Current (Misaligned)
```css
/* Victory */
background-color: rgb(20, 83, 45);   /* bg-green-900 */
border-color: rgb(22, 163, 74);      /* border-green-600 */
color: rgb(74, 222, 128);            /* text-green-400 */

/* Defeat */
background-color: rgb(127, 29, 29);  /* bg-red-900 */
border-color: rgb(220, 38, 38);      /* border-red-600 */
color: rgb(248, 113, 113);           /* text-red-400 */
```

#### Proposed (Design System Aligned)
```css
/* Victory */
background-color: #252b38;           /* surface-elevated */
border-left: 4px solid #3fb950;      /* success */
badge-bg: rgba(63, 185, 80, 0.2);    /* success/20 */
badge-text: #3fb950;                 /* success */

/* Defeat */
background-color: #252b38;           /* surface-elevated */
border-left: 4px solid #f85149;      /* error */
badge-bg: rgba(248, 81, 73, 0.2);    /* error/20 */
badge-text: #f85149;                 /* error */
```

### Responsive Behavior

#### Desktop (≥1024px)
```
┌─────────────────────────────────────────────────────────────┐
│ Battle History                       [Filter ▼] [Sort ▼]    │
├─────────────────────────────────────────────────────────────┤
│ Summary: 45W / 23L / 2D | Avg ELO: +12.5 | ₡45,000 earned  │
├─────────────────────────────────────────────────────────────┤
│ ▌VICTORY  MyBot vs OpponentBot (Player1)  Feb 5  +25  ₡1K →│
│ ▌DEFEAT   MyBot vs EnemyBot (Player2)     Feb 4  -18  ₡500→│
│ ▌VICTORY  MyBot vs Robot3 (Player3)       Feb 3  +20  ₡1K →│
│ ...                                                          │
└─────────────────────────────────────────────────────────────┘
```

#### Mobile (<768px)
```
┌──────────────────────────────┐
│ Battle History               │
├──────────────────────────────┤
│ 45W / 23L / 2D               │
│ Avg ELO: +12.5               │
├──────────────────────────────┤
│ [Filter ▼] [Sort ▼]          │
├──────────────────────────────┤
│ ▌VICTORY    Feb 5 14:30      │
│  MyBot vs OpponentBot        │
│  +25 ELO | ₡1,000            │
├──────────────────────────────┤
│ ▌DEFEAT     Feb 4 12:15      │
│  MyBot vs EnemyBot           │
│  -18 ELO | ₡500              │
├──────────────────────────────┤
│ ...                          │
└──────────────────────────────┘
```

---

## Success Criteria

### Must Have (Phase 1)
- ✅ 8-10 battles visible on 1080p screen (vs. current 3)
- ✅ Background colors replaced with subtle border accents
- ✅ Design system color palette implemented
- ✅ Summary statistics card added
- ✅ Battle cards fully clickable
- ✅ Responsive layout (desktop/tablet/mobile)

### Should Have (Phase 2)
- ✅ Outcome filter working (All/Wins/Losses/Draws)
- ✅ Battle type filter working (All/League/Tournament)
- ✅ Sort controls functional (date, ELO, duration, reward)
- ✅ Search functionality implemented
- ✅ Filter state persisted (URL params and localStorage)

### Nice to Have (Phase 3)
- ✅ Loading skeletons implemented
- ✅ Smooth hover animations
- ✅ Performance optimized for large lists
- ✅ Export functionality working
- ✅ WCAG AA accessibility compliance

--> This is all not implemented, only use ✅ when it's already implemented

---

## Open Questions & Answers

**Q: Should filtering and sorting happen on backend or frontend?**  
A: Start with frontend (client-side) for simplicity since we're already fetching paginated results. Move to backend only if performance becomes an issue with very large datasets (1000+ battles).

**Q: Should we implement infinite scroll instead of pagination?**  
A: Keep pagination for Phase 1-2. Infinite scroll can be considered in Phase 3 as an alternative, but pagination is more predictable and accessible.

**Q: How should tournament battles be highlighted?**  
A: Use yellow left border accent in addition to outcome color, plus small trophy icon badge. Consider special styling for championship/final matches.

**Q: Should we show robot portraits in the compact view?**  
A: No - portraits take significant space. Reserve portraits for detailed battle report view. Use robot names only in compact view.

**Q: What happens if user has no battles yet?**  
A: Show empty state with friendly message: "No battles yet. Your first match is coming soon!" Include illustration (crossed swords icon).

**Q: Should summary statistics be persistent or collapsible?**  
A: Persistent (always visible) at top of page. They're valuable context and don't take much space.

**Q: How to handle very long robot names or usernames?**  
A: Truncate with ellipsis using CSS (`truncate` class). Show full name on hover (tooltip).

**Q: Should battle cards have different styling for player's robot winning vs. losing?**  
A: Yes - left border color already indicates outcome. Consider subtle icon (trophy for win, X for loss) next to outcome badge.

---

## Appendix A: Component Code Examples

### BattleHistorySummary Component

```typescript
interface SummaryStats {
  totalBattles: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  avgELOChange: number;
  totalCreditsEarned: number;
  currentStreak?: { type: 'win' | 'loss'; count: number };
}

const BattleHistorySummary: React.FC<{ stats: SummaryStats }> = ({ stats }) => {
  return (
    <div className="bg-surface-elevated border border-gray-700 rounded-lg p-4 mb-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Battles */}
        <div>
          <div className="text-sm text-secondary">Total Battles</div>
          <div className="text-2xl font-bold text-primary">{stats.totalBattles}</div>
        </div>
        
        {/* Record */}
        <div>
          <div className="text-sm text-secondary">Record</div>
          <div className="text-2xl font-bold">
            <span className="text-success">{stats.wins}W</span>
            {' / '}
            <span className="text-error">{stats.losses}L</span>
            {stats.draws > 0 && (
              <>
                {' / '}
                <span className="text-tertiary">{stats.draws}D</span>
              </>
            )}
          </div>
          <div className="text-xs text-tertiary">
            {(stats.winRate * 100).toFixed(1)}% win rate
          </div>
        </div>
        
        {/* Average ELO Change */}
        <div>
          <div className="text-sm text-secondary">Avg ELO Change</div>
          <div className={`text-2xl font-bold ${stats.avgELOChange >= 0 ? 'text-success' : 'text-error'}`}>
            {stats.avgELOChange > 0 ? '+' : ''}{stats.avgELOChange.toFixed(1)}
          </div>
        </div>
        
        {/* Credits Earned */}
        <div>
          <div className="text-sm text-secondary">Credits Earned</div>
          <div className="text-2xl font-bold">₡{stats.totalCreditsEarned.toLocaleString()}</div>
        </div>
      </div>
      
      {/* Current Streak */}
      {stats.currentStreak && stats.currentStreak.count >= 3 && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium
            ${stats.currentStreak.type === 'win' ? 'bg-success/20 text-success' : 'bg-error/20 text-error'}`}>
            <span>{stats.currentStreak.count}-game {stats.currentStreak.type} streak</span>
            {stats.currentStreak.type === 'win' && <span>🔥</span>}
          </div>
        </div>
      )}
    </div>
  );
};
```

### CompactBattleCard Component

```typescript
interface CompactBattleCardProps {
  battle: BattleHistory;
  myRobotId: number;
  onClick: () => void;
}

const CompactBattleCard: React.FC<CompactBattleCardProps> = ({ battle, myRobotId, onClick }) => {
  const { myRobot, opponent, outcome, eloChange } = getMatchData(battle, myRobotId);
  const reward = getReward(battle, myRobotId);
  const isTournament = battle.battleType === 'tournament';
  
  const getBorderColor = () => {
    if (isTournament) return 'border-l-warning';
    switch (outcome) {
      case 'win': return 'border-l-success';
      case 'loss': return 'border-l-error';
      case 'draw': return 'border-l-tertiary';
      default: return 'border-l-gray-700';
    }
  };
  
  const getOutcomeBadgeClass = () => {
    switch (outcome) {
      case 'win': return 'bg-success/20 text-success';
      case 'loss': return 'bg-error/20 text-error';
      case 'draw': return 'bg-tertiary/20 text-tertiary';
      default: return 'bg-gray-700 text-gray-400';
    }
  };
  
  return (
    <div 
      onClick={onClick}
      className={`
        bg-surface-elevated border border-gray-700 rounded-lg p-3 mb-2
        border-l-4 ${getBorderColor()}
        hover:bg-surface hover:border-primary/50 cursor-pointer 
        transition-all duration-150 ease-out
        hover:translate-y-[-2px]
      `}
    >
      {/* Desktop Layout */}
      <div className="hidden md:flex items-center gap-4">
        {/* Outcome Badge */}
        <div className="flex-shrink-0 w-20">
          <div className={`text-xs font-bold px-2 py-1 rounded text-center ${getOutcomeBadgeClass()}`}>
            {outcome === 'win' ? 'VICTORY' : outcome === 'loss' ? 'DEFEAT' : 'DRAW'}
          </div>
          {isTournament && (
            <div className="text-xs text-warning mt-1 text-center">🏆</div>
          )}
        </div>
        
        {/* Matchup */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">
            <span className="text-primary">{myRobot.name}</span>
            <span className="text-tertiary mx-2">vs</span>
            <span>{opponent.name}</span>
          </div>
          <div className="text-xs text-secondary truncate">
            {opponent.user.username}
          </div>
        </div>
        
        {/* Date */}
        <div className="flex-shrink-0 w-24 text-xs text-secondary">
          {formatDateTime(battle.createdAt)}
        </div>
        
        {/* ELO Change */}
        <div className="flex-shrink-0 w-24">
          <div className={`text-sm font-bold ${eloChange >= 0 ? 'text-success' : 'text-error'}`}>
            {eloChange > 0 ? '+' : ''}{eloChange}
          </div>
          <div className="text-xs text-tertiary">
            {battle.robot1ELOBefore} → {battle.robot1ELOAfter}
          </div>
        </div>
        
        {/* Reward */}
        <div className="flex-shrink-0 w-20 text-right">
          <div className="text-sm font-medium">₡{reward.toLocaleString()}</div>
          <div className="text-xs text-tertiary">{formatDuration(battle.durationSeconds)}</div>
        </div>
        
        {/* Arrow Icon */}
        <div className="flex-shrink-0 w-8 text-center text-primary">
          →
        </div>
      </div>
      
      {/* Mobile Layout */}
      <div className="md:hidden">
        {/* Header Row */}
        <div className="flex items-center justify-between mb-2">
          <div className={`text-xs font-bold px-2 py-1 rounded ${getOutcomeBadgeClass()}`}>
            {outcome === 'win' ? 'VICTORY' : outcome === 'loss' ? 'DEFEAT' : 'DRAW'}
            {isTournament && ' 🏆'}
          </div>
          <div className="text-xs text-secondary">
            {formatDateTime(battle.createdAt)}
          </div>
        </div>
        
        {/* Matchup Row */}
        <div className="mb-2">
          <div className="text-sm font-medium">
            <span className="text-primary">{myRobot.name}</span>
            <span className="text-tertiary mx-2">vs</span>
            <span>{opponent.name}</span>
          </div>
          <div className="text-xs text-secondary">{opponent.user.username}</div>
        </div>
        
        {/* Stats Row */}
        <div className="flex justify-between text-xs">
          <div>
            <span className="text-tertiary">ELO: </span>
            <span className={`font-bold ${eloChange >= 0 ? 'text-success' : 'text-error'}`}>
              {eloChange > 0 ? '+' : ''}{eloChange}
            </span>
          </div>
          <div>
            <span className="text-tertiary">₡</span>
            <span className="font-medium">{reward.toLocaleString()}</span>
          </div>
          <div className="text-tertiary">
            {formatDuration(battle.durationSeconds)}
          </div>
        </div>
      </div>
    </div>
  );
};
```

---

## Appendix B: Accessibility Considerations

### Keyboard Navigation
- All interactive elements must be keyboard accessible
- Battle cards: Tab to focus, Enter/Space to activate
- Filters: Tab through controls, Arrow keys for dropdowns
- Pagination: Tab to buttons, Enter to activate

### Screen Reader Support
- Semantic HTML (use `<button>`, `<select>`, `<table>` appropriately)
- ARIA labels for icon-only buttons
- ARIA live regions for filter result counts
- Battle outcome announced clearly (e.g., "Victory against OpponentBot")

### Color Contrast
- All text must meet WCAG AA standards (4.5:1 for normal text, 3:1 for large text)
- Don't rely solely on color to convey information (use icons, text)
- Test with color blindness simulators

### Focus Indicators
- Visible focus outline on all interactive elements
- Use `focus-visible` utility to hide mouse focus, show keyboard focus

---

## Appendix C: Performance Benchmarks

### Target Metrics
- Initial page load: <2 seconds
- Filter application: <100ms
- Sort operation: <100ms
- Search debounce: 300ms
- Pagination: <500ms

### Optimization Strategies
- Memoize battle cards with React.memo
- Use useMemo for filtered/sorted lists
- Debounce search input
- Virtual scrolling for 1000+ battles (if needed)
- Code splitting for battle detail modal

---

**End of Document**
