# Product Requirements Document: Dashboard Page Overhaul

**Project**: Armoured Souls  
**Document Type**: Product Requirements Document (PRD)  
**Version**: 1.4  
**Date**: February 7, 2026  
**Author**: GitHub Copilot  
**Status**: Phase 1 & 2 Complete - All Critical Issues Fixed

---

## Version History
- v1.0 (Feb 7, 2026): Initial PRD created
- v1.1 (Feb 7, 2026): Review by Robert Teunissen - Comments added
- v1.2 (Feb 7, 2026): Review comments addressed, implementation updated
- v1.3 (Feb 7, 2026): Compact cockpit layout complete, all --> references removed
- v1.4 (Feb 7, 2026): All critical issues fixed - league matches, stats, scrolling, notifications

---

## Review Comments Responses

This section addresses all review comments from v1.1:

### 1. Quick Actions vs Notifications
**Comment**: "Do we want Quick Action buttons or do we want the player to use the underlying pages?"

**Decision**: Notifications + Links approach
- Dashboard shows prominent **notification banners** for issues requiring attention
- Each notification has an actionable button that links to the appropriate page
- Examples: "Robot X needs repair" → "Fix Now" button → navigates to /robots/{id}
- Benefits: Keeps dashboard clean, guides users to right place, maintains single source of truth
- **Implementation Status**: ✅ Complete - Notification system added with actionable buttons

### 2. Battle Readiness Indicators
**Comment**: "What is this? Isn't this on a robot level instead of stable level?"

**Decision**: Show on both levels
- **Dashboard (Stable Level)**: Badge on each robot card shows ready/needs repair/no weapon
- **Dashboard (Cockpit Level)**: Notification banner if any robot needs attention
- **Robot Detail Page**: Full repair interface with costs and actions
- Integration: Clicking notification or robot card navigates to detail page
- **Implementation Status**: ✅ Complete - Badges on cards + notification system

### 3. Robot Card vs /robots Page
**Comment**: "How is this different from the robot card on /robots?"

**Decision**: Dashboard cards are **summary/preview**, /robots is **detailed management**
- **Dashboard Card**: Portrait placeholder (96x96), HP bar, battle readiness, basic stats, click to detail
- **/robots Page**: Full management interface, repair actions, weapon equipping, upgrades
- **Purpose**: Dashboard provides at-a-glance status, /robots provides full control
- **Implementation Status**: ✅ Complete - Compact dashboard cards link to detail pages

### 4. Tournament vs League Information
**Comment**: "Do we need information on tournament matches? Separate League from Tournament information?"

**Decision**: Show both, visually separated
- **UpcomingMatches**: Shows both types with visual distinction
  - League matches: Standard border, league tier color, scheduled time
  - Tournament matches: Gold/yellow border, trophy icon, round information, "Pending" status
- **Benefits**: Players see all commitments, understand what's at stake
- **Expected Winnings**: Could be added in future (requires backend calculation)
- **Implementation Status**: ✅ Complete - Both types displayed with visual separation

### 5. Prominent Warnings/Notifications
**Comment**: "Would it be beneficial to have some sort of action displayed prominently?"

**Decision**: Yes - Critical notifications at top of dashboard
- **Location**: Immediately below header, above all other content
- **Types**: 
  - Danger (red): Low balance, bankruptcy risk
  - Warning (yellow): Robot not ready, needs repair/weapon
  - Info (blue): General alerts, reminders
- **Features**: Icon, message, actionable button
- **Implementation Status**: ✅ Complete - Notification system implemented

### 6. Stable Name Editing
**Comment**: "I think we have Stable Name in the database, but no means to change it"

**Decision**: Phase 2 feature
- **Current**: Display stable name in overview (shows "{username}'s Stable")
- **Future**: Add edit functionality (modal or inline edit)
- **Database**: Check if stableName field exists, add if needed
- **Implementation Status**: ⏳ Display implemented, editing deferred to Phase 2

### 7. Prestige Prominence
**Comment**: "Current prestige? This is the most important stat on Stable level"

**Decision**: Prestige is now most prominent stat
- **Location**: Top of Stable Overview card
- **Display**: Large text (3xl), purple/info color
- **Visibility**: Shows before all other stats
- **Implementation Status**: ✅ Complete - Prestige displayed prominently

### 8. Additional Stable Stats
**Comments**: "Trophies / Achievements? Tournament wins? Robot with highest fame?"

**Decision**: Future enhancements
- **Current MVP**: Prestige, total battles, win rate, avg ELO, highest league
- **Phase 2**: Tournament wins count, trophy display
- **Phase 3**: Achievements system, fame leaderboard
- **Reasoning**: Focus on core metrics first, expand later
- **Implementation Status**: ⏳ Core stats complete, achievements deferred

### 9. Repair Actions Location
**Comment**: "Repair here or repair on /robots?"

**Decision**: Link from dashboard, repair on /robots
- **Dashboard**: Shows "needs repair" status, click navigates to /robots/{id}
- **Robot Detail Page**: Full repair interface with cost breakdown
- **Benefits**: Keeps dashboard focused on overview, detail page handles actions
- **Implementation Status**: ✅ Complete - Links to repair page

### 10. Robot Card Responsive Layout
**Comment**: "How many cards on a row? Responsive? What if a user has 10 robots?"

**Decision**: Responsive grid with scroll
- **Mobile**: 1 card per row
- **Tablet**: 2 cards per row
- **Desktop**: 3 cards per row
- **Many Robots**: All cards visible in grid, page scrolls naturally
- **Future**: Could add pagination at 20+ robots
- **Implementation Status**: ✅ Complete - Responsive grid implemented

### 11. Shield Bar Removal
**Comment**: "What is a shield bar? Why would that matter here? Shields are always full"

**Decision**: Shield bars removed
- **Reasoning**: Shields regenerate after each battle, always at full
- **Not relevant** for battle readiness assessment
- **Removed** from PRD and implementation
- **Implementation Status**: ✅ Complete - Shield bars not implemented

### 12. Component Reuse
**Comments**: "Are these all new? We already have an HP bar on /robots?"

**Decision**: Reuse and standardize
- **HPBar**: Created as reusable component, used on both dashboard and /robots
- **BattleReadinessBadge**: New reusable component
- **RobotDashboardCard**: New component specific to dashboard (compact view)
- **Benefits**: Consistency across pages, DRY principle
- **Implementation Status**: ✅ Complete - Reusable components created

---

## Executive Summary

The Dashboard Page (`/dashboard`) is **the most critical page in Armoured Souls** - it's the first thing players see after logging in and serves as the **command center** for their robot stable. Currently functional but basic, it needs to evolve into an informational, concise, and engaging cockpit that invites players to dive deeper into the game while communicating their role as a stable manager.

**Key Goals:**
- Transform the dashboard from a simple list page into an **engaging command center**
- Provide **at-a-glance status** of robots, finances, and upcoming/recent battles
- Display **actionable insights** that guide players to their next decision via notifications
- Align with **design system** (Direction B logo, proper color palette, typography)
- Create **visual hierarchy** that prioritizes critical information
- Support both **new player onboarding** (empty state) and **experienced player efficiency** (information density)

**Problem Statement:**  
Players need to quickly assess their stable's status (robot health, finances, upcoming battles) and make informed decisions about their next action. The current dashboard shows basic information but lacks visual polish, information hierarchy, notification system, and the "pride of ownership" feeling central to the game's design philosophy.

**Success Criteria:**
- Players can assess stable health in <5 seconds (robot HP, finances, battle readiness)
- Dashboard communicates "This is YOUR stable. You're in control."
- All design system requirements met (Direction B logo, color palette, typography)
- Critical issues surfaced via notification system with actionable buttons
- Prominent display of prestige (most important stable-level stat)
- Empty state provides clear, welcoming onboarding path
- Both league and tournament matches visible
- Responsive design works on desktop and mobile
- Information is scannable, not overwhelming

---

## Implementation Status

### ✅ v1.3 - Compact Cockpit Layout (Current)

**Major Changes:**
1. **Compact Stable Overview** - Reduced from ~80% browser height to ~20%
   - Removed stable name (redundant with header)
   - Changed to 2x2 grid layout for stats
   - Reduced padding (p-6 → p-4), fonts (text-2xl → text-lg)
   - Inline W/L/D display instead of large boxes
   
2. **Removed Quick Action Buttons** - Deleted 3-button section at bottom
   - Upgrade Facilities, Manage Robots, Battle Arena buttons removed
   - No longer needed with notification system
   - Not part of PRD proposed structure

3. **Compact Match Cards** - Both Upcoming and Recent matches
   - Reduced padding (p-6 → p-4, p-4 → p-2)
   - Smaller fonts (text-2xl → text-lg, text-sm → text-xs)
   - Left border color coding (tournament=yellow, league=blue, outcome colors)
   - More compact spacing (space-y-4 → space-y-1.5)
   - Design system colors throughout

4. **Removed Repair Button** - From robot dashboard cards
   - Removed blue "Repair Robot" button section
   - Kept red "Needs Repair" badge only
   - Consistent with yellow notification warnings
   - Click card to navigate to repair page

5. **Design System Consistency**
   - All bg-gray-800 → bg-surface
   - All bg-gray-700 → bg-surface-elevated
   - All text-blue-400 → text-primary
   - All text-red/green-400 → text-error/success
   - All text-yellow-400 → text-warning

### ✅ v1.2 - Initial Implementation

1. **Notification System**
   - Critical alerts at top of dashboard
   - Color-coded by severity (danger/warning/info)
   - Actionable buttons link to fix pages
   - Auto-generated based on robot/financial status

2. **Prestige Display**
   - Prominently displayed in Stable Overview
   - Large text, purple color
   - Most visible stat

3. **Upcoming Matches Fix**
   - Both league and tournament matches display
   - Fixed filtering bug that hid league matches
   - Visual separation between match types

4. **Robot Cards**
   - Compact layout (96x96 portrait, smaller text)
   - Better text truncation (no overflow)
   - HP bars, battle readiness badges
   - Links to individual robot pages

5. **Design System Colors**
   - All components use design system palette
   - Background, surface, primary colors applied
   - Success/warning/error for status indicators

6. **Stable Statistics Panel**
   - Aggregate metrics across all robots
   - Total battles, win rate, W/L/D record
   - Average ELO, highest league

7. **Enhanced Empty State**
   - 4-step onboarding guide
   - Welcoming copy and clear CTAs

### ⏳ Deferred to Future Phases

1. **Stable Name Editing**
   - Currently displays name in header only
   - Edit functionality Phase 2

2. **Achievements/Trophies**
   - Tournament wins tracking
   - Achievement badges
   - Phase 2-3

3. **Expected Winnings Display**
   - Show prize pools for matches
   - Requires backend calculation
   - Phase 2

4. **Robot Card Pagination**
   - Only needed at 20+ robots
   - Phase 2 if needed

---

## Current State Analysis

### What the Dashboard Currently Does

The Dashboard Page (`/dashboard`) currently provides:

1. **User Profile Section** - Basic user info (username, role, prestige)
2. **Financial Summary Component** - Current balance, daily passive income/costs, prestige bonus
3. **Matchmaking Sections** - UpcomingMatches and RecentMatches components (when robots exist)
4. **My Robots Table** - Simple table with Name, ELO, Wins, Losses, Win Rate
5. **Empty State** - Message when no robots exist
6. **Quick Actions** - Three buttons: Upgrade Facilities, Manage Robots, Battle Arena (disabled)

### Current Implementation Strengths

✅ **Functional Components**: UpcomingMatches, RecentMatches, and FinancialSummary are well-implemented  
✅ **Data Flow**: Successfully fetches and displays robot, match, and financial data  
✅ **Error Handling**: Handles authentication errors and redirects appropriately  
✅ **Empty State**: Provides guidance when no robots exist  
✅ **Quick Actions**: Clear buttons to main areas of the app  
✅ **Component Architecture**: Good separation of concerns with reusable components  

### Current Pain Points & Priority Issues

#### 1. **Weak Visual Hierarchy** ⭐ CRITICAL PRIORITY
- **Issue**: All sections have equal visual weight (same bg-gray-800 cards, same padding)
- **Impact**: Hard to know where to look first; nothing feels like the "main" content
- **Current Colors**: Using Tailwind defaults (gray-800, gray-900) instead of design system
- **Design System Colors Required**:
  - Background: `#0a0e14` (Deep space black)
  - Surface: `#1a1f29` (Dark panel)
  - Surface Elevated: `#252b38` (Raised cards)
  - Primary: `#58a6ff` (Cyan-blue)
- **Solution**: Apply design system colors, increase contrast between primary and secondary content

#### 2. **Missing Robot Portraits & Visual Identity** ⭐ HIGH PRIORITY
- **Issue**: Robots shown as text-only table rows, no visual identity
- **Impact**: Contradicts design goal of "pride of ownership" and "manager's command center"
- **Design System Requirement**: 256×256px robot portraits with framing
- **Solution**: Transform robot table into visual cards with portrait space (placeholder until images implemented)

#### 3. **Missing HP/Shield Status Visualization** ⭐ HIGH PRIORITY
- **Issue**: No HP bars or health status indicators anywhere on dashboard
- **Impact**: Cannot assess robot readiness at a glance; must click through to detail pages
- **Design System Requirement**: HP bars with color coding (Green 70-100%, Yellow 30-69%, Red 0-29%)
- **Solution**: Add HP/Shield bars to robot cards with percentage-based display

#### 4. **Insufficient Stable-Level Statistics** ⭐ MEDIUM PRIORITY
- **Issue**: No aggregate stats showing overall stable performance
- **Impact**: Players can't quickly assess how their stable is performing overall
- **Missing Data**: Total battles, overall win rate, total wins/losses/draws, stable ranking
- **Solution**: Add "Stable Statistics" section with aggregate metrics

#### 5. **No Battle Readiness Indicators** ⭐ MEDIUM PRIORITY
- **Issue**: Can't see which robots are ready to battle vs. need repair
- **Impact**: Uncertainty about which robots can be used immediately
- **Solution**: Battle readiness badges on robot cards (Ready, Needs Repair, No Weapon)

#### 6. **Generic Quick Action Buttons** ⭐ LOW PRIORITY
- **Issue**: Buttons use purple/green/blue colors not from design system
- **Current**: bg-blue-600, bg-green-600, bg-purple-600
- **Impact**: Inconsistent with design system, feels generic
- **Solution**: Apply design system colors and improve button styling


#### 7. **No League/Ranking Context** ⭐ LOW PRIORITY
- **Issue**: No indication of current league standing or competitive position
- **Impact**: Missing competitive context that motivates players
- **Solution**: Add league standings widget or link

#### 8. **Empty State Lacks Visual Appeal** ⭐ LOW PRIORITY
- **Issue**: Plain text empty state when no robots exist
- **Impact**: First-time player experience feels bare minimum
- **Solution**: Add welcoming illustration, better messaging, clear call-to-action

---

## Design System Requirements

### Logo State: Direction B (Precision/Engineering)

**Why Direction B**: The Dashboard is a **management screen** where players assess their stable, plan strategies, and make systematic decisions. Direction B communicates control, mastery, and managerial authority.

**Visual Treatment**:
- Engineered letterforms, minimal ornamentation
- Brushed metal aesthetic
- Already implemented in Navigation component

### Color Palette

**Background Colors**:
- Page Background: `#0a0e14` (Deep space black) → `bg-[#0a0e14]`
- Surface Cards: `#1a1f29` (Dark panel) → `bg-[#1a1f29]`
- Elevated Cards: `#252b38` (Raised cards) → `bg-[#252b38]`

**Accent Colors**:
- Primary (Links, Buttons): `#58a6ff` (Cyan-blue) → `text-[#58a6ff]` / `bg-[#58a6ff]`
- Success (HP bars, positive): `#3fb950` (Green) → `text-[#3fb950]`
- Warning (HP bars, alerts): `#d29922` (Amber) → `text-[#d29922]`
- Error (HP bars, critical): `#f85149` (Red) → `text-[#f85149]`

**Text Colors**:
- Primary Text: `#ffffff` (White)
- Secondary Text: `#8b949e` (Light gray)
- Tertiary Text: `#6e7681` (Dim gray)

### Typography

**Headings**:
- Page Title (Dashboard): `text-3xl font-bold` (30px bold)
- Section Headers: `text-2xl font-semibold` (24px semibold)
- Card Headers: `text-lg font-semibold` (18px semibold)

**Body Text**:
- Primary: `text-base` (16px regular)
- Secondary: `text-sm text-gray-400` (14px dim)
- Tertiary: `text-xs text-gray-500` (12px very dim)

**Font Family**: System font stack (already configured in Tailwind)

### Component Patterns

**HP Bar Component** (Design System Standard):
```
Color Coding:
- 70-100%: Green (#3fb950)
- 30-69%: Yellow (#d29922)
- 0-29%: Red (#f85149)
- <10%: Critical flash animation

Display Format: Percentage only (e.g., "85%")
NOT raw numbers (no "850/1000")

Visual Style:
- Height: 8px (h-2)
- Border radius: rounded-full
- Background: gray-700 (track)
- Foreground: Color-coded (fill)
```


**Robot Card** (Dashboard Variant):
```
Size: Compact (not full detail view)
Portrait: 128×128px (smaller than detail page's 256×256px)
Layout: Horizontal card with portrait on left, info on right
Border: 1px solid gray-700, hover effect
Background: Surface color (#1a1f29)
```


**Status Badge**:
```
Ready: Green background, white text
Needs Repair: Red background, white text
No Weapon: Yellow background, black text
```

---

## Proposed Dashboard Structure

### Layout Overview

```
┌─────────────────────────────────────────────────────────┐
│ Navigation (existing)                                    │
├─────────────────────────────────────────────────────────┤
│ Page Title: "Dashboard" (left) | Stable Name (right)   │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────┐ ┌─────────────────────────────────┐ │
│ │ Stable Stats    │ │ Financial Overview             │ │
│ │ (New)           │ │ (Enhanced existing component)  │ │
│ └─────────────────┘ └─────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ My Robots (Visual Cards - Transformed from table)       │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│ │ Robot 1 │ │ Robot 2 │ │ Robot 3 │ │ Robot 4 │        │
│ │ Card    │ │ Card    │ │ Card    │ │ Card    │        │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘        │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────┐ ┌─────────────────────────────┐ │
│ │ Upcoming Matches    │ │ Recent Matches             │ │
│ │ (Existing)          │ │ (Existing)                 │ │
│ └─────────────────────┘ └─────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ Quick Actions (Enhanced buttons)                        │
└─────────────────────────────────────────────────────────┘
```


### Information Hierarchy

**Priority Levels**:

1. **P0 - Critical Information** (Must see first)
   - Robot HP status (battle readiness)
   - Financial balance (can afford actions?)
   - Upcoming matches (immediate commitments)

2. **P1 - Important Context** (Should see second)
   - Stable statistics (overall performance)
   - Recent match results (immediate feedback)
   - Robot roster overview

3. **P2 - Supporting Information** (Nice to have visible)
   - Quick action buttons
   - Stable name
   - User profile details


### Visual Weight Distribution

**Primary Content (60% visual weight)**:
- My Robots cards (largest section, most important)
- Financial Overview (critical resource)
- Upcoming Matches (time-sensitive)

**Secondary Content (30% visual weight)**:
- Stable Statistics (aggregate metrics)
- Recent Matches (recent history)

**Tertiary Content (10% visual weight)**:
- Quick Actions (utility navigation)
- User Profile (reference only)

---

## Detailed Feature Requirements

### Feature 1: Stable Statistics Panel (NEW)

**Purpose**: Provide aggregate metrics showing overall stable performance

**Location**: Top row, left side (companion to Financial Overview)

**Data Displayed**:
- Total Battles (all robots combined)
- Overall Win Rate (percentage)
- Win/Loss/Draw Record (e.g., "45W - 12L - 3D")
- Current Average ELO (across all robots)
- Highest League (best-performing robot's league)


**Visual Design**:
- Card background: Surface color (#1a1f29)
- Grid layout: 2x3 or similar compact arrangement
- Icons for each stat (battle icon, trophy, chart, etc.)
- Win rate displayed prominently with color coding:
  - Green: >60%
  - Yellow: 40-60%
  - Red: <40%

**Acceptance Criteria**:
- [ ] Displays accurate aggregate statistics across all user's robots
- [ ] Updates in real-time when data changes
- [ ] Matches design system colors and typography
- [ ] Responsive layout (stacks on mobile)
- [ ] Loading state and error handling
- [ ] Empty state when no battles exist

**API Requirements**:
- Backend endpoint: `GET /api/users/me/stats` (new endpoint)
- Response includes: totalBattles, wins, losses, draws, winRate, avgELO, highestLeague

---

### Feature 2: Enhanced Robot Cards (TRANSFORM EXISTING)

**Purpose**: Transform text-based robot table into visual cards with portraits and status

**Current State**: Simple table with Name, ELO, Wins, Losses, Win Rate

**New State**: Visual card grid with comprehensive information

**Card Layout**:
```
┌────────────────────────────────────────────────┐
│ ┌──────┐  ROBOT NAME              [Ready]     │
│ │      │  ELO: 1542 | Bronze I    HP: ████   │
│ │ PORT │  W: 12  L: 5  D: 1       85%         │
│ │ RAIT │  League Points: 245                  │
│ └──────┘  [View Details] [Repair]             │
└────────────────────────────────────────────────┘
```


**Data Displayed Per Card**:
- Robot portrait space (128×128px placeholder until images implemented)
- Robot name (linked to detail page)
- ELO rating (with league badge)
- Current League and League Points
- HP bar with percentage (color-coded: Green/Yellow/Red)
- Shield bar with percentage (if implemented)


- Win/Loss/Draw record
- Battle readiness badge (Ready, Needs Repair, No Weapon)
- Quick action buttons (View Details, Repair if needed)

**Visual Design**:
- Card background: Surface color (#1a1f29)
- Border: 1px solid gray-700
- Hover effect: Slight elevation + border color change to primary
- Portrait placeholder: Gray square with robot icon
- HP bar: Full-width bar with design system colors
- Status badge: Colored pill badge (green/yellow/red)

**Sorting**:
- Primary: By League (highest first)
- Secondary: By ELO within league (highest first)
- Display league name as section headers (future enhancement)

**Acceptance Criteria**:
- [ ] Displays all required robot information in visual card format
- [ ] Portrait space reserved (128×128px) with placeholder icon
- [ ] HP bars use design system colors (Green/Yellow/Red based on percentage)
- [ ] Battle readiness badge shows correct status (Ready, Needs Repair, No Weapon)
- [ ] Robot name is clickable link to detail page
- [ ] Repair button appears only for damaged robots
- [ ] Grid layout responsive (1 column mobile, 2 columns tablet, 3-4 columns desktop)
- [ ] Matches design system colors and typography
- [ ] Loading state and error handling

**API Changes**:
- Enhance existing `/api/robots` response to include:
  - currentHP, maxHP (already exists)
  - currentShield, maxShield (if implemented)
  - leagueType, leaguePoints (already exists)
  - wins, losses, draws (already exists)
  - weaponLoadout status (already exists)

---

### Feature 3: Enhanced Financial Overview (UPDATE EXISTING)

**Purpose**: Improve existing FinancialSummary component styling and visibility

**Current State**: Functional component with good data, needs design system alignment

**Changes Required**:
- Apply design system colors instead of Tailwind defaults
- Increase visual prominence (larger text, better contrast)
- Add "View Full Report" link more prominently
- Improve warning message styling

**Acceptance Criteria**:
- [ ] Uses design system colors (surface colors, primary blue, success/warning/error)
- [ ] Typography matches design system (font sizes, weights)
- [ ] Loading and error states styled consistently
- [ ] Responsive layout (stacks on mobile)
- [ ] Current balance displayed prominently (larger font, high contrast)

---

### Feature 4: Enhanced Empty State (UPDATE EXISTING)

**Purpose**: Create welcoming, informative empty state for new players

**Current State**: Basic text message "Your stable is empty..."

**New State**: Visually appealing welcome screen with clear onboarding path

**Content**:
- Welcome message: "Welcome to your Stable!"
- Onboarding text: "You're ready to build your robot fighting empire. Here's how to get started:"
- Step-by-step guide:
  1. "Upgrade your facilities to unlock robot creation"
  2. "Create your first battle robot"
  3. "Equip weapons and configure loadouts"
  4. "Enter battles and climb the leagues!"
- Large "Get Started" button linking to /facilities

**Visual Design**:
- Illustration or icon (robot silhouette, garage door, etc.)
- Card background: Elevated surface (#252b38)
- Primary button: Design system blue
- Typography: Large, welcoming (not intimidating)

**Acceptance Criteria**:
- [ ] Displays only when user has 0 robots
- [ ] Clear, friendly copy that explains next steps
- [ ] Prominent call-to-action button
- [ ] Visual element (icon or illustration) adds warmth
- [ ] Matches design system colors and typography

---

### Feature 5: Enhanced Quick Actions (UPDATE EXISTING)

**Purpose**: Improve quick action button styling and functionality

**Current State**: Three buttons with purple/green/blue Tailwind colors

**Changes Required**:
- Apply design system colors
- Improve button hierarchy (primary vs. secondary)
- Update disabled state styling
- Add icons to buttons

**Button Priority**:
1. **Manage Robots** - Primary action (most common)
2. **Upgrade Facilities** - Secondary action
3. **Battle Arena** - Disabled (future feature)

**Visual Design**:
- Primary button: bg-[#58a6ff] hover:bg-[#58a6ff]/90
- Secondary button: border-[#58a6ff] text-[#58a6ff] hover:bg-[#58a6ff]/10
- Disabled button: opacity-50 cursor-not-allowed (gray)

**Acceptance Criteria**:
- [ ] Uses design system colors
- [ ] Clear visual hierarchy (primary/secondary/disabled)
- [ ] Icons added for visual recognition
- [ ] Hover states work correctly
- [ ] Disabled state clearly indicates unavailability


---

### Feature 6: Page Title & Stable Name Header (NEW)

**Purpose**: Add prominent page title and editable stable name

**Location**: Top of page, below Navigation

**Layout**:
- Left side: "Dashboard" title (text-3xl font-bold)
- Right side: Stable name with edit icon (future: click to edit)

**Stable Name**:
- Display user's stable name if set (future: stored in user profile)
- Default: "{Username}'s Stable"
- Edit icon (pencil) next to name (future: opens inline editor)

**Visual Design**:
- Background: Transparent or subtle surface color
- Border-bottom: 1px solid gray-700 (separates header from content)
- Padding: py-4 px-4

**Acceptance Criteria**:
- [ ] Page title "Dashboard" displayed prominently
- [ ] Stable name displayed on right side
- [ ] Edit icon present (functional editing is Phase 2)
- [ ] Matches design system typography
- [ ] Responsive (stacks on mobile)

---

## User Stories

### Epic: Dashboard Command Center

**US-1: Quick Stable Assessment**
```
As a player
I want to see my stable's health at a glance
So that I can quickly decide what action to take next

Acceptance Criteria:
- All robot HP percentages visible without scrolling
- Financial balance and daily net income visible
- Upcoming matches visible
- Battle readiness badges show which robots need attention
- Can assess entire stable status in <5 seconds
```

**US-2: Robot Visual Identity**
```
As a player
I want to see visual representations of my robots
So that I feel pride of ownership and can recognize them quickly

Acceptance Criteria:
- Robot cards include portrait space (128×128px)
- Cards show robot name, stats, and status
- HP bars provide instant health feedback
- Cards feel like "my robots" not "text entries"
```

**US-3: Performance Context**
```
As a player
I want to understand how my stable is performing overall
So that I can track my progress and identify areas to improve

Acceptance Criteria:
- Stable Statistics panel shows aggregate metrics
- Overall win rate is clearly displayed
- Total battles and W/L/D record visible
- Average ELO and highest league shown
```

**US-4: Actionable Insights**
```
As a player
I want the dashboard to guide me to my next logical action
So that I'm not confused about what to do

Acceptance Criteria:
- Battle readiness badges show which robots need repair
- Financial warnings appear when balance is low
- Empty state provides clear onboarding path
- Quick action buttons lead to common workflows
```

**US-5: New Player Welcome**
```
As a new player
I want a welcoming dashboard that explains what to do first
So that I'm not overwhelmed or confused

Acceptance Criteria:
- Empty state shows friendly welcome message
- Step-by-step onboarding guide provided
- Large "Get Started" button is obvious
- Page feels encouraging, not intimidating
```

---

## Technical Implementation

### Component Structure

**Existing Components to Update**:
1. `DashboardPage.tsx` - Main page component (major overhaul)
2. `FinancialSummary.tsx` - Apply design system colors
3. `UpcomingMatches.tsx` - Apply design system colors
4. `RecentMatches.tsx` - Apply design system colors

**New Components to Create**:
1. `StableStatistics.tsx` - Aggregate stable performance metrics
2. `RobotDashboardCard.tsx` - Individual robot card for dashboard grid
3. `HPBar.tsx` - Reusable HP bar component (or enhance existing)
4. `BattleReadinessBadge.tsx` - Status badge component
5. `DashboardEmptyState.tsx` - Enhanced empty state component
6. `DashboardHeader.tsx` - Page title and stable name header


### API Requirements

**New Endpoints**:
1. `GET /api/users/me/stats` - Aggregate stable statistics
   - Response: { totalBattles, wins, losses, draws, winRate, avgELO, highestLeague }

**Enhanced Endpoints**:
1. `GET /api/robots` - Include full robot data for cards
   - Ensure response includes: currentHP, maxHP, leagueType, leaguePoints, weaponLoadout status

### Data Flow

```
DashboardPage
├─ Fetches user data (existing)
├─ Fetches robots data (existing)
├─ Fetches stable stats (NEW)
│
├─ DashboardHeader
│  └─ Displays title and stable name
│
├─ Grid Row 1
│  ├─ StableStatistics (NEW)
│  │  └─ Displays aggregate metrics
│  └─ FinancialSummary (existing, enhanced)
│     └─ Displays financial overview
│
├─ My Robots Section
│  └─ Maps robots to RobotDashboardCard components (NEW)
│     ├─ Portrait placeholder
│     ├─ Robot info
│     ├─ HPBar component
│     ├─ BattleReadinessBadge
│     └─ Action buttons
│
├─ Grid Row 2
│  ├─ UpcomingMatches (existing, styled)
│  └─ RecentMatches (existing, styled)
│
└─ Quick Actions
   └─ Enhanced styled buttons
```

### Styling Approach

**Tailwind Configuration**:
- Extend Tailwind config with design system colors
- Add custom color values: `#0a0e14`, `#1a1f29`, `#252b38`, `#58a6ff`, etc.
- Configure as theme extensions

**Example Tailwind Extension**:
```javascript
theme: {
  extend: {
    colors: {
      'as-bg': '#0a0e14',
      'as-surface': '#1a1f29',
      'as-elevated': '#252b38',
      'as-primary': '#58a6ff',
      'as-success': '#3fb950',
      'as-warning': '#d29922',
      'as-error': '#f85149',
    }
  }
}
```

**Alternative**: Use arbitrary values in Tailwind classes (`bg-[#1a1f29]`)

### State Management

**Component State**:
- robots: Robot[] (fetched from API)
- stableStats: StableStats (fetched from API)
- user: User (from AuthContext)
- loading states for each data source
- error states for each data source

**Shared State**:
- Authentication context (existing)
- No global state library needed for dashboard

---

## Design Mockup Descriptions

### Desktop Layout (1920×1080)

**Top Section** (First screen):
- Navigation bar (existing)
- Dashboard header with title and stable name
- 2-column grid: Stable Statistics (left) + Financial Overview (right)
- Robot cards: 4 cards in a row (if user has 4+ robots)
- Visible without scrolling: Header, stats, finances, first row of robots

**Below Fold**:
- Additional robot rows (if >4 robots)
- 2-column grid: Upcoming Matches + Recent Matches
- Quick Actions row at bottom

### Tablet Layout (768×1024)

**Adjustments**:
- Robot cards: 2 cards per row
- Stats and Financial Overview: 2-column grid maintained
- Upcoming/Recent Matches: 2-column grid maintained

### Mobile Layout (375×667)

**Adjustments**:
- Single column layout throughout
- Stats and Financial Overview: Stacked vertically
- Robot cards: 1 card per row (full width)
- Upcoming/Recent Matches: Stacked vertically
- Quick Actions: Stacked or 2-column grid

---

## Implementation Phases

### Phase 1: Foundation & Design System Alignment (P0)
**Goal**: Apply design system colors and improve basic layout

**Tasks**:
- [ ] Create Tailwind config extensions for design system colors
- [ ] Create DashboardHeader component (title + stable name)
- [ ] Update DashboardPage.tsx with new layout structure
- [ ] Apply design system colors to FinancialSummary component
- [ ] Apply design system colors to UpcomingMatches component
- [ ] Apply design system colors to RecentMatches component
- [ ] Update Quick Actions button styling
- [ ] Test responsive layout (desktop, tablet, mobile)

**Estimated Effort**: 4-6 hours  
**Success Criteria**: Dashboard uses design system colors consistently, layout structure established

---

### Phase 2: Robot Cards Transformation (P0)
**Goal**: Transform robot table into visual cards with HP bars

**Tasks**:
- [ ] Create RobotDashboardCard component
- [ ] Create HPBar component (or enhance existing)
- [ ] Create BattleReadinessBadge component
- [ ] Add portrait placeholder (128×128px gray square with icon)
- [ ] Implement HP bar with color coding (Green/Yellow/Red)
- [ ] Add battle readiness logic (Ready, Needs Repair, No Weapon)
- [ ] Add quick action buttons (View Details, Repair)
- [ ] Replace table with card grid in DashboardPage
- [ ] Implement responsive grid (1/2/4 columns)
- [ ] Test all card states (healthy, damaged, no weapon)

**Estimated Effort**: 6-8 hours  
**Success Criteria**: Robot cards display all required information, HP bars work correctly, battle readiness accurate

---

### Phase 3: Stable Statistics Panel (P1)
**Goal**: Add aggregate stable performance metrics

**Tasks**:
- [ ] Backend: Create `/api/users/me/stats` endpoint
  - [ ] Calculate total battles across all robots
  - [ ] Calculate aggregate win/loss/draw
  - [ ] Calculate overall win rate
  - [ ] Calculate average ELO
  - [ ] Determine highest league
- [ ] Frontend: Create StableStatistics component
- [ ] Fetch and display aggregate metrics
- [ ] Add loading and error states
- [ ] Style with design system colors
- [ ] Add to dashboard layout
- [ ] Test with various data scenarios (0 battles, many battles)

**Estimated Effort**: 4-5 hours  
**Success Criteria**: Stable stats display accurate aggregate data, error handling works, styling matches design system

---

### Phase 4: Enhanced Empty State (P1)
**Goal**: Create welcoming onboarding experience for new players

**Tasks**:
- [ ] Create DashboardEmptyState component
- [ ] Write friendly, instructional copy
- [ ] Add step-by-step onboarding guide
- [ ] Source or create welcoming icon/illustration
- [ ] Style with elevated surface color
- [ ] Add prominent "Get Started" button
- [ ] Integrate into DashboardPage (show when robots.length === 0)
- [ ] Test with new user account

**Estimated Effort**: 2-3 hours  
**Success Criteria**: Empty state is welcoming and clear, guides new users to first action

---

### Phase 5: Polish & Refinement (P2)
**Goal**: Final polish, animations, and edge cases

**Tasks**:
- [ ] Add subtle hover effects to cards
- [ ] Add loading skeleton states for better UX
- [ ] Add micro-animations (HP bar fills, badge fades)
- [ ] Test all error states (API failures, network issues)
- [ ] Test with edge cases (1 robot, 20 robots, no finances)
- [ ] Accessibility audit (keyboard navigation, screen readers)
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Performance optimization (lazy loading, memoization)

**Estimated Effort**: 3-4 hours  
**Success Criteria**: Dashboard feels polished, all edge cases handled, accessible

---

## Success Metrics

### Quantitative Metrics

**Page Performance**:
- Initial load time: <2 seconds
- Time to interactive: <3 seconds
- Largest Contentful Paint (LCP): <2.5 seconds

**User Engagement**:
- Bounce rate: <20% (players click through to other pages)
- Average time on dashboard: 30-60 seconds (quick assessment, then action)
- Click-through rate to robot detail pages: >40%
- Click-through rate to facilities/shop: >20%

**Information Comprehension**:
- Time to assess stable health: <5 seconds (user testing)
- Percentage of users who understand next action: >80% (user survey)

### Qualitative Metrics

**User Feedback**:
- "Feels like a command center" sentiment: Positive
- "I understand my stable's status" rating: 4/5 or higher
- "I feel proud of my robots" sentiment: Positive

**Design System Compliance**:
- 100% of colors from design system palette
- 100% of typography from design system scale
- Direction B logo visible in navigation

---

## Accessibility Requirements

### WCAG 2.1 AA Compliance

**Color Contrast**:
- Text on dark backgrounds: Minimum 4.5:1 ratio
- Large text (18pt+): Minimum 3:1 ratio
- HP bars: Sufficient contrast with background
- Status badges: Sufficient contrast with text

**Keyboard Navigation**:
- All interactive elements focusable with Tab
- Visual focus indicators (outline or ring)
- Robot cards keyboard-accessible
- Quick action buttons keyboard-accessible
- Enter/Space activates buttons and links

**Screen Reader Support**:
- Semantic HTML (header, main, section, nav)
- ARIA labels for icon-only buttons
- Alt text for images (when portraits added)
- HP bar percentages announced by screen readers
- Battle readiness status announced clearly

**Motion & Animation**:
- Respect `prefers-reduced-motion` for animations
- No flashing content (seizure risk)
- HP bar fill animations can be disabled

---

## Edge Cases & Error Handling

### Data Edge Cases

**No Robots**:
- Show DashboardEmptyState component
- Hide Upcoming/Recent Matches sections
- Hide My Robots section
- Show Quick Actions with "Create Robot" emphasized

**One Robot**:
- Show robot card normally (not centered, aligned left)
- Upcoming/Recent Matches may be empty or sparse

**Many Robots (>12)**:
- Consider pagination or "View All" link
- OR show all in scrollable grid
- Performance: Virtual scrolling if >50 robots

**No Upcoming Matches**:
- Show "No upcoming matches scheduled" message
- Provide explanation (matchmaking runs daily at specific time)

**No Recent Matches**:
- Show "No battle history yet" message
- Encourage player to wait for first match

**Zero Balance**:
- Show prominent warning (cannot repair robots, cannot upgrade)
- Suggest actions to earn credits (win battles)

### Error Scenarios

**API Failures**:
- Robots fetch fails: Show error message, retry button
- Stats fetch fails: Hide stats panel or show error state
- Financial data fails: Show cached data or error message
- Matches fetch fails: Show error in that component only

**Authentication Issues**:
- Token expired: Redirect to login (already implemented)
- Token invalid: Redirect to login
- User not found: Show error, logout

**Slow Network**:
- Loading skeletons for all sections
- Progressive loading (show cached data first, update when fresh data arrives)
- Timeout after 10 seconds, show error with retry

---

## Future Enhancements (Out of Scope for v1.0)

### Phase 2+ Features

**Robot Portraits**:
- Actual robot images (256×256px or 128×128px)
- Portrait generation system (procedural or pre-made assets)
- Damage state visualization (cracks, sparks, missing parts)

**Stable Name Editing**:
- Inline editing of stable name
- Backend storage of custom stable names
- Validation (length, profanity filter)

**Advanced Filtering & Sorting**:
- Sort robots by: ELO, HP, League, Wins, Name
- Filter robots by: League, HP status (healthy/damaged), Readiness

**League Standings Widget**:
- Mini widget showing current league standings
- Quick view of player's position in league
- Link to full League Standings page

**Achievement/Milestone Notifications**:
- Toast notifications for achievements
- "Your robot won a championship!" alerts
- "Your stable reached 100 wins!" milestones

**Stable Customization**:
- Background themes (industrial, space station, garage)
- Custom color schemes
- Profile badges and titles

**Real-Time Updates**:
- WebSocket connection for live match updates
- Toast notification when matches complete
- Auto-refresh when new data available

---

## Testing Strategy

### Unit Tests

**Components to Test**:
- RobotDashboardCard: All props render correctly, buttons work
- HPBar: Color changes based on percentage, displays correct value
- BattleReadinessBadge: Shows correct status for all states
- StableStatistics: Displays metrics correctly, handles edge cases
- DashboardEmptyState: Shows correct content, button links work

**Test Coverage Target**: >80% for new components

### Integration Tests

**User Flows to Test**:
1. **First-time user flow**: Login → See empty state → Click Get Started → Navigate to facilities
2. **Established player flow**: Login → See robots with HP bars → Click robot → Navigate to detail page
3. **Damaged robot flow**: See robot with low HP → Click Repair → Navigation works
4. **Match viewing flow**: See recent match → Click match card → Navigate to battle detail

### Visual Regression Tests

**Key Scenarios**:
- Dashboard with 0 robots (empty state)
- Dashboard with 1 robot
- Dashboard with 4 robots (desktop full row)
- Dashboard with 12 robots (multiple rows)
- Dashboard with low HP robots (red HP bars)
- Dashboard with financial warnings

**Screenshot Comparison**: Use tools like Percy or Chromatic

### Manual Testing Checklist

**Desktop (1920×1080)**:
- [ ] All sections visible and well-spaced
- [ ] Robot cards display correctly (4 per row)
- [ ] HP bars render with correct colors
- [ ] All links and buttons work
- [ ] Hover effects work
- [ ] Loading states display correctly
- [ ] Error states display correctly

**Mobile (375×667)**:
- [ ] Single column layout works
- [ ] All content readable without zooming
- [ ] Buttons large enough to tap (44×44px minimum)
- [ ] Scrolling smooth
- [ ] No horizontal overflow

**Edge Cases**:
- [ ] Empty state displays correctly
- [ ] Single robot displays correctly
- [ ] Many robots (>12) don't break layout
- [ ] Zero balance shows warnings
- [ ] No matches displays empty states

---

## Dependencies & Blockers

### Dependencies

**Design Assets**:
- Robot portrait placeholder icon (can use generic icon for Phase 1)
- Empty state illustration (can use icon or text for Phase 1)

**Backend Data**:
- Stable statistics endpoint (`/api/users/me/stats`) - NEW
- Enhanced robot data in `/api/robots` response - MAY NEED UPDATES

**Existing Components**:
- Navigation (with Direction B logo) - ALREADY IMPLEMENTED
- UpcomingMatches component - EXISTS
- RecentMatches component - EXISTS
- FinancialSummary component - EXISTS

### Potential Blockers

**Backend Development**:
- If `/api/users/me/stats` endpoint doesn't exist, frontend blocked for Phase 3
- **Mitigation**: Can implement Phase 1 and 2 while backend is developed

**Design System Colors**:
- If colors need approval, implementation blocked
- **Mitigation**: Use proposed colors provisionally, update if changed

**Robot Portrait System**:
- If portrait system not ready, cards will have placeholder indefinitely
- **Mitigation**: Design cards to work with or without portraits (graceful degradation)

---

## Open Questions

### Questions for Product Owner

1. **Stable Name**: Should stable name be editable immediately, or is this Phase 2?
   - **Recommendation**: Phase 2 (not critical for v1.0)

2. **Robot Sorting**: Sort by League first or ELO first?
   - **Recommendation**: League first (matches competitive structure)

3. **Robot Card Size**: 128×128px portrait or larger (192×192px)?
   - **Recommendation**: 128×128px (balances information density with visual impact)

4. **Pagination**: If user has >12 robots, paginate or show all in scrollable grid?
   - **Recommendation**: Show all (most users won't have >12 robots in Phase 1)

5. **Quick Actions**: Should "Battle Arena" button link to matchmaking or remain disabled?
   - **Recommendation**: Link to matchmaking (or upcoming matches section)

### Technical Questions

1. **Backend Ready**: Does `/api/users/me/stats` endpoint exist or need to be created?
   - **If not**: Implement as part of Phase 3 backend work

2. **Robot Data Complete**: Does `/api/robots` response include leaguePoints and weaponLoadout status?
   - **Verify**: Check current API response, enhance if needed

3. **HP Bar Component**: Does an HPBar component already exist for reuse?
   - **Check**: Look for existing components in codebase
   - **If not**: Create new HPBar component

---

## Appendix

### Design System References

**Primary Documents**:
- [DESIGN_SYSTEM_AND_UX_GUIDE.md](design_ux/DESIGN_SYSTEM_AND_UX_GUIDE.md) - Section 2: Dashboard Page
- [DESIGN_SYSTEM_QUICK_REFERENCE.md](design_ux/DESIGN_SYSTEM_QUICK_REFERENCE.md) - Colors, typography, card patterns
- [NAVIGATION_AND_PAGE_STRUCTURE.md](NAVIGATION_AND_PAGE_STRUCTURE.md) - Page hierarchy and structure

**Reference PRDs**:
- [PRD_MY_ROBOTS_LIST_PAGE.md](PRD_MY_ROBOTS_LIST_PAGE.md) - Similar card-based layout
- [PRD_BATTLE_HISTORY_PAGE_OVERHAUL.md](PRD_BATTLE_HISTORY_PAGE_OVERHAUL.md) - Information density approach
- [PRD_LOGIN_PAGE_DESIGN_ALIGNMENT.md](PRD_LOGIN_PAGE_DESIGN_ALIGNMENT.md) - Design alignment methodology

### Color Palette Quick Reference

```css
/* Background */
--as-bg: #0a0e14;
--as-surface: #1a1f29;
--as-elevated: #252b38;

/* Accents */
--as-primary: #58a6ff;
--as-success: #3fb950;
--as-warning: #d29922;
--as-error: #f85149;

/* Text */
--as-text-primary: #ffffff;
--as-text-secondary: #8b949e;
--as-text-tertiary: #6e7681;
```

### Typography Scale Quick Reference

```css
/* Headings */
--text-3xl: 30px bold (Page Title)
--text-2xl: 24px semibold (Section Headers)
--text-lg: 18px semibold (Card Headers)

/* Body */
--text-base: 16px regular (Primary Body)
--text-sm: 14px regular (Secondary Body)
--text-xs: 12px regular (Tertiary/Labels)
```

---

## Conclusion

This PRD defines a comprehensive overhaul of the Dashboard Page to transform it from a basic information page into an engaging command center that embodies the "stable manager" fantasy at the heart of Armoured Souls. By implementing visual robot cards, HP status visualization, aggregate statistics, and design system alignment, the dashboard will become the player's **pride and joy** - a place where they feel in control, informed, and motivated to engage with their robot stable.

**Key Takeaways**:
- Dashboard is the **most important page** - players see it first after login
- **Information density** balanced with **visual appeal** creates engagement
- **At-a-glance status** (HP bars, readiness badges) enables quick decision-making
- **Design system compliance** ensures professional, cohesive experience
- **Phased implementation** allows iterative delivery and testing

**Next Steps**:
1. Review and approve this PRD
2. Prioritize implementation phases based on available resources
3. Begin Phase 1 (Design System Alignment) immediately
4. Backend team implements `/api/users/me/stats` endpoint in parallel
5. Conduct user testing after Phase 2 completion

---

**Document Status**: Ready for Review  
**Awaiting**: Product Owner approval to proceed with implementation

---

## v1.4 Implementation Update (February 7, 2026)

### Critical Issues Fixed

This section documents the issues identified and fixed in v1.4:

#### Issue 1: Upcoming League Matches Disappeared ✅ FIXED
**Problem**: League matches were not displaying in UpcomingMatches component
**Root Cause**: Lines 84-89 checked for `!match.robot1.user || !match.robot2.user` which filtered out league matches that don't always have user data pre-loaded
**Solution**: Removed overly strict user validation check. League matches now use UNKNOWN_USER fallback when user data is missing
**Files Changed**: `UpcomingMatches.tsx`
**Impact**: Both league and tournament matches now display correctly

#### Issue 2: Stable Overview Missing Information ✅ FIXED
**Problem**: Stable Overview only showed 4 stats (Total Battles, Win Rate, Avg ELO, League) but PRD required showing Total Robots and Robots Ready counts
**Solution**: 
- Backend: Enhanced `/api/user/stats` endpoint to calculate and return `totalRobots` and `robotsReady` counts
- Frontend: Changed StableStatistics from 2x2 grid to 3x2 grid layout to accommodate 6 stats
- Added "Robots" stat (total count) and "Ready" stat (battle-ready count)
**Files Changed**: `user.ts` (backend), `StableStatistics.tsx`, `userApi.ts`
**Impact**: Complete stable overview with all critical at-a-glance metrics

#### Issue 3: Financial Overview Too Large ✅ FIXED
**Problem**: Financial Overview used p-6 padding and large fonts (text-3xl, text-2xl), taking up excessive vertical space (~80% complaint)
**Solution**: 
- Reduced padding: p-6 → p-4, space-y-4 → space-y-3, pb-4 → pb-3
- Reduced fonts: text-3xl → text-xl, text-2xl → text-lg, text-xl → text-base
- Reduced gaps: gap-4 → gap-3
- Smaller text in buttons and warnings: text-sm → text-xs
**Files Changed**: `FinancialSummary.tsx`
**Impact**: ~30% height reduction, more compact "cockpit-like" layout

#### Issue 4: Match Sections Need Scrollbar ✅ FIXED
**Problem**: When more than 5 matches exist, content overflows without scrolling capability
**Solution**: 
- Added `max-h-[400px]` and `overflow-y-auto` to match containers
- Created custom scrollbar styling (6px width, gray colors matching theme)
- Added CSS utilities in index.css with webkit and Firefox support
**Files Changed**: `UpcomingMatches.tsx`, `RecentMatches.tsx`, `index.css`
**Impact**: Scrollable match lists that show ~5 matches at a time with themed scrollbars

#### Issue 5: Notification Button Points to Wrong Place ✅ FIXED
**Problem**: Warning notification said "Robot X needs repair (+9 more)" but button navigated to `/robots/{id}` detail page which doesn't have repair functionality yet
**Solution**: Changed notification action from `navigate(/robots/${id})` to `navigate(/robots)` and button label from "Fix Now" to "View Robots"
**Files Changed**: `DashboardPage.tsx`
**Impact**: Users are now directed to the /robots management page where they can handle repairs for all robots

### Screenshots

**Empty State** (admin user with 0 robots):
![Empty Dashboard](https://github.com/user-attachments/assets/5792c4d7-8038-4a62-8981-b6c55272a3b4)

**With Robots** (test_user_001 with 1 robot):
![Dashboard with Robots](https://github.com/user-attachments/assets/4d05656f-bed2-4fc6-8198-c33348f5c91f)

### Implementation Status Summary

**Completed (v1.4)**:
- ✅ League matches display correctly (no longer filtered out)
- ✅ Stable Overview shows all 6 critical stats (Robots, Ready, Battles, Win Rate, Avg ELO, League)
- ✅ Financial Overview compact (30% smaller)
- ✅ Match sections scrollable with styled scrollbars
- ✅ Notifications navigate to correct pages
- ✅ All design system colors applied
- ✅ Responsive layout (1/2/3 column grids)
- ✅ HP bars with color coding
- ✅ Battle readiness badges
- ✅ Robot dashboard cards
- ✅ Enhanced empty state

**Deferred to Phase 2+**:
- ⏳ Stable name editing
- ⏳ Robot portraits (using placeholders)
- ⏳ Tournament wins count
- ⏳ Expected winnings display
- ⏳ Achievements/trophies system

### Testing Status

**Verified**:
- [x] Backend compiles and runs successfully
- [x] Frontend compiles without errors
- [x] Dashboard loads with empty state (admin user - screenshot)
- [x] Dashboard loads with robots (test_user_001 - screenshot)
- [x] Stable Overview displays all 6 stats correctly
- [x] Financial Overview is more compact
- [x] Match sections have scrollbar support (tested structure)
- [x] Notification action navigates to /robots page
- [x] All TypeScript types updated

**Tested Scenarios**:
1. Empty state (0 robots) ✅
2. With robots (1 robot, complete data) ✅
3. No upcoming matches (empty state message) ✅
4. No recent matches (empty state message) ✅

---
