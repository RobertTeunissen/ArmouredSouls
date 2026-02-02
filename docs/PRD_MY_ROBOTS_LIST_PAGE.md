# Product Requirements Document: My Robots List Page Design Alignment

**Last Updated**: February 2, 2026  
**Status**: Ready for Implementation  
**Owner**: Robert Teunissen  
**Epic**: Design System Implementation - Core Management Pages  
**Priority**: P0 (Highest priority - Core gameplay screen)

---

## Executive Summary

This PRD defines the requirements for overhauling the My Robots list page (`/robots`) to align with the comprehensive design system established for Armoured Souls. This page serves as the **robot roster overview** where players view and manage their collection of battle robots. It must communicate mastery, pride of ownership, and systematic management through the **Direction B (Precision)** logo state and management-appropriate visual design.

**Success Criteria**:
- My Robots page uses Direction B logo (already in Navigation)
- Robot cards display portraits (256×256px reserved space), HP/Shield bars, ELO, Win/Loss record
- Design system color palette applied (primary #58a6ff, surface colors, status colors)
- Empty state provides clear call-to-action for first robot creation
- Quick access to Weapon Shop and Create Robot functionality
- Responsive grid layout (1 column mobile, 2-3 columns desktop)
- All status information visible at a glance for fleet management

**Impact**: Establishes the central hub for robot management, reinforcing player's role as stable manager with visual pride in their robot collection.

---

## Background & Context

### Current State

**What Exists**:
- ✅ Functional robots list page at `/robots`
- ✅ Fetches robots from backend API (`/api/robots`)
- ✅ Grid layout with robot cards
- ✅ Navigation to robot detail pages
- ✅ "Create New Robot" button
- ✅ Weapon Shop button
- ✅ Empty state messaging
- ✅ Error handling and loading states
- ✅ Authentication and token handling

**Current Issues**:
- ❌ No HP/Shield status bars (critical for fleet management)
- ❌ No Win/Loss record display (missing competitive context)
- ❌ No League display (missing ranking information)
- ❌ No robot portrait space (just text-based cards)
- ❌ Limited stat display (only ELO and weapon)
- ❌ Generic card styling (not aligned with design system colors)
- ❌ Buttons use purple/green colors instead of design system palette
- ❌ No frame type badge or categorization
- ❌ No battle readiness indicator
- ❌ Missing "roster capacity" indicator (X/Y slots)

**What's Working Well**:
- ✅ Clean grid layout responsive design
- ✅ Clear card-based organization
- ✅ Intuitive navigation to detail pages
- ✅ Prominent action buttons
- ✅ Empty state with helpful messaging

### Design References

**Primary Design Documents**:
- [DESIGN_SYSTEM_AND_UX_GUIDE.md](design_ux/DESIGN_SYSTEM_AND_UX_GUIDE.md) - Section 3: My Robots Page
- [DESIGN_SYSTEM_QUICK_REFERENCE.md](design_ux/DESIGN_SYSTEM_QUICK_REFERENCE.md) - Colors, typography, card patterns
- [NAVIGATION_AND_PAGE_STRUCTURE.md](NAVIGATION_AND_PAGE_STRUCTURE.md) - Page hierarchy and structure
- [PRD_LOGIN_PAGE_DESIGN_ALIGNMENT.md](PRD_LOGIN_PAGE_DESIGN_ALIGNMENT.md) - Reference for design alignment approach
- [PRD_NAVIGATION_MENU_DESIGN_ALIGNMENT.md](PRD_NAVIGATION_MENU_DESIGN_ALIGNMENT.md) - Navigation implementation patterns

**Key Principles**:
- Logo State: **Direction B** (Precision/Management) - already in Navigation
- Emotional Target: **Pride of ownership, mastery, systematic control**
- Page Purpose: **Fleet overview and robot triage**
- Visual Theme: **Industrial management dashboard**
- Color System: Dark theme with design system palette

---

## Goals & Objectives

### Primary Goals

1. **Visual Enhancement**: Transform robot cards to display comprehensive status at a glance
2. **Design System Compliance**: Apply established color palette, typography, and component patterns
3. **Fleet Management**: Enable quick assessment of entire robot collection (HP, readiness, performance)
4. **Competitive Context**: Display ELO, League, and Win/Loss records prominently
5. **Ownership Pride**: Use larger portraits and polished styling to emphasize player investment
6. **Image System Preparation**: Reserve space for robot portraits (256×256px) for future image implementation

### Success Metrics

- **Information Density**: Display 8+ data points per robot card (name, ELO, league, HP, shield, weapon, wins/losses, readiness)
- **Visual Consistency**: 100% compliance with design system color tokens
- **Usability**: Players can identify damaged robots requiring repair in <3 seconds
- **Engagement**: Players can assess competitive standing of each robot without clicking through
- **Accessibility**: WCAG 2.1 AA compliance (color contrast, keyboard navigation, screen reader support)

### Non-Goals (Out of Scope)

- ❌ Actual robot portrait images (only reserved space with placeholder)
- ❌ Filter and sort controls (future enhancement)
- ❌ Inline editing of robot names (future enhancement)
- ❌ Bulk actions (repair all, configure all)
- ❌ Robot comparison tool (separate page)
- ❌ Frame type badges (future enhancement when multiple frames exist)
- ❌ Pagination (implement only if user has >20 robots)

---

## User Stories

### Epic: Fleet Overview & Management

**US-1: Comprehensive Robot Cards**
```
As a player
I want to see all critical information about each robot on the list page
So that I can quickly assess my fleet's status without clicking into each robot

Acceptance Criteria:
- Each robot card displays: Name, Portrait space (256×256px), ELO, League, HP bar, Shield bar, Win/Loss record, Current weapon, Battle readiness indicator
- HP bar uses color coding: Green (70-100%), Amber (30-69%), Red (0-29%)
- Shield bar displayed below HP bar with cyan color (#58a6ff)
- Battle readiness shows percentage (100% = full HP/Shield, 0% = critical)
- Win/Loss displayed as "XW-YL" format with win rate percentage
- All cards use design system colors (surface-elevated #252b38, borders, etc.)
```

**US-2: Visual Health Status**
```
As a player
I want to immediately identify which robots need repair
So that I can maintain my fleet's battle readiness

Acceptance Criteria:
- HP bar prominently displayed with color-coded status
- Red HP bar (below 30%) draws immediate attention
- Amber HP bar (30-69%) signals caution
- Green HP bar (70-100%) indicates readiness
- Battle readiness percentage displayed (derived from HP + Shield)
- Damaged robots optionally sorted to top (future: filter control)
```

**US-3: Competitive Standing Display**
```
As a player
I want to see the competitive performance of each robot
So that I can identify my strongest performers and prioritize upgrades

Acceptance Criteria:
- ELO rating displayed prominently with primary color (#58a6ff)
- Current League shown with badge or text (Bronze/Silver/Gold/etc.)
- Win/Loss record displayed as "XW-YL (Z%)" format
- Win rate percentage calculated correctly ((wins / totalBattles) × 100)
- Visual hierarchy emphasizes ELO as primary metric
```

**US-4: Robot Portrait Space Reservation**
```
As a player (future feature prep)
I want the page layout to accommodate robot images
So that when images are added, the page doesn't require redesign

Acceptance Criteria:
- Reserved space (256×256px) for robot portrait in each card
- Placeholder shows robot name initial or generic robot icon
- Card layout functional with or without actual images
- Portrait area uses surface color (#1a1f29) with border
- Future image integration requires minimal code changes
```

**US-5: Quick Actions**
```
As a player
I want quick access to common robot management actions
So that I can efficiently navigate my fleet

Acceptance Criteria:
- "View Details" button on each card navigates to /robots/:id
- Entire card clickable to view details (with hover state)
- "Create New Robot" button prominent at top of page
- "Weapon Shop" button accessible at top of page
- All buttons use design system colors (primary for main actions)
```

**US-6: Empty State Experience**
```
As a new player
I want clear guidance when I have no robots
So that I understand how to start playing

Acceptance Criteria:
- Empty state displays when robots.length === 0
- Message: "You don't have any robots yet."
- Submessage: "Create your first robot to start battling!"
- Large "Create Your First Robot" button (green/success color)
- Background uses surface color (#1a1f29) for card
- Encouraging, welcoming tone
```

**US-7: Roster Capacity Indicator**
```
As a player
I want to see how many robots I own versus my maximum capacity
So that I know when I'm approaching my limit

Acceptance Criteria:
- Header displays "My Robots (X/Y)" where X = owned, Y = max capacity
- Capacity indicator uses secondary text color (#8b949e)
- If at capacity, indicator uses warning color (#d29922)
- Future: Visual progress bar showing capacity utilization
```

---

## Functional Requirements

### FR-1: Page Layout Structure

**Page Header**:
```
┌─────────────────────────────────────────────────────────────┐
│ Navigation (Direction B logo, menu items, credits)          │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│ My Robots (X/Y)                    [🛒 Weapon Shop]         │
│                                     [+ Create New Robot]     │
└─────────────────────────────────────────────────────────────┘
```

**Robot Cards Grid**:
```
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│  Robot Card   │ │  Robot Card   │ │  Robot Card   │
└───────────────┘ └───────────────┘ └───────────────┘
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│  Robot Card   │ │  Robot Card   │ │  Robot Card   │
└───────────────┘ └───────────────┘ └───────────────┘
```

**Responsive Breakpoints**:
- Mobile (<768px): 1 column
- Tablet (768-1023px): 2 columns
- Desktop (≥1024px): 3 columns
- Large Desktop (≥1440px): 4 columns (optional)

### FR-2: Robot Card Component Specification

**Card Structure**:
```
┌─────────────────────────────────────────────────────┐
│ ┌──────────────┐  ┌─────────────────────────────┐  │
│ │              │  │ IRON FIST                   │  │
│ │  [Portrait]  │  │ ELO: 1450  │  Silver League │  │
│ │  256x256px   │  │ 23W-12L (65.7%)             │  │
│ │              │  │                             │  │
│ └──────────────┘  └─────────────────────────────┘  │
│                                                     │
│ HP:    [████████░░] 850/1000 (85%)                 │
│ Shield:[██████████] 200/200 (100%)                 │
│                                                     │
│ Weapon: Laser Rifle MK-II                          │
│ Readiness: 92%  │  Battle Ready                    │
│                                                     │
│ [ View Details → ]                                 │
└─────────────────────────────────────────────────────┘
```

**Component Hierarchy**:
1. **Card Container**
   - Background: `surface-elevated` (#252b38)
   - Border: 2px solid #3d444d (neutral gray)
   - Border Radius: 8px (rounded-lg)
   - Padding: 24px (p-6)
   - Hover: Border changes to primary (#58a6ff), subtle shadow
   - Cursor: pointer (entire card clickable)
   - Transition: 200ms ease-out

2. **Portrait Section**
   - Size: 256×256px (future: actual robot image)
   - Placeholder: Background #1a1f29 (surface), border 1px #3d444d
   - Content: Robot name initial (first letter) OR generic robot icon
   - Text: 72px font-size, bold, primary color
   - Alignment: Centered in portrait area
   - Border Radius: 8px

3. **Header Section**
   - Robot Name: H3 (text-xl), bold, primary text (#e6edf3)
   - ELO Badge: Inline, primary color (#58a6ff), bold, larger font
   - League Badge: Inline, secondary color (#8b949e), normal font
   - Win/Loss Record: Secondary text, format "XW-YL (Z%)"
   - Spacing: Minimal between elements, compact header

4. **Status Bars Section**
   - **HP Bar**:
     - Label: "HP" + current/max values + percentage
     - Bar height: 24px (h-6)
     - Background: #1a1f29 (surface)
     - Fill: Color-coded by percentage
       - 70-100%: #3fb950 (success/green)
       - 30-69%: #d29922 (warning/amber)
       - 0-29%: #f85149 (error/red)
     - Border radius: 9999px (rounded-full)
     - Transition: width 300ms ease-out
     - Text: Small (text-sm), overlaid or beside bar
   
   - **Shield Bar**:
     - Label: "Shield" + current/max values
     - Bar height: 20px (h-5, slightly smaller than HP)
     - Background: #1a1f29 (surface)
     - Fill: #58a6ff (primary/cyan-blue)
     - Border radius: 9999px (rounded-full)
     - Spacing: 8px margin-top from HP bar

5. **Equipment Section**
   - Weapon Label: "Weapon:" in secondary color
   - Weapon Name: Weapon.name or "None equipped"
   - Text size: Small (text-sm)
   - Spacing: 12px margin-top from Shield bar

6. **Readiness Section**
   - Battle Readiness: Percentage calculated from HP + Shield
   - Formula: `((currentHP/maxHP + currentShield/maxShield) / 2) * 100`
   - Display: "Readiness: XX%"
   - Status Text: "Battle Ready" (green) if ≥80%, "Damaged" (amber) if 50-79%, "Critical" (red) if <50%
   - Color coding matches status
   - Text size: Small (text-sm)

7. **Action Button**
   - Text: "View Details →"
   - Style: Secondary button (border + text, not filled)
   - Border: 1px solid primary (#58a6ff)
   - Text: Primary color
   - Hover: Background primary/10 (rgba(88, 166, 255, 0.1))
   - Full width: w-full
   - Padding: 8px vertical (py-2)
   - Margin-top: 16px from content

### FR-3: Header Section

**Title & Capacity**:
- Text: "My Robots"
- Font: H2 (text-3xl), bold, primary text color
- Capacity: Inline or below, format "(X/Y)"
- Capacity color: Secondary (#8b949e), or warning (#d29922) if at limit

**Action Buttons**:
- **Weapon Shop Button**:
  - Icon: 🛒 (shopping cart emoji)
  - Text: "Weapon Shop"
  - Color: Info (#a371f7, purple) - matches "special items" theme
  - Hover: Lighter shade
  - Position: Top-right, left of Create button
  
- **Create New Robot Button**:
  - Icon: + (plus symbol)
  - Text: "Create New Robot"
  - Color: Success (#3fb950, green) - positive action
  - Hover: Lighter shade
  - Position: Top-right, rightmost position
  - Font: Semi-bold, prominent

**Layout**:
- Flexbox: space-between (title left, buttons right)
- Responsive: Stack vertically on mobile (<768px)
- Spacing: 32px margin-bottom (mb-8)

### FR-4: Empty State

**Display Condition**: `robots.length === 0`

**Layout**:
```
┌─────────────────────────────────────────────────────┐
│                                                     │
│           You don't have any robots yet.           │
│                                                     │
│      Create your first robot to start battling!    │
│                                                     │
│        [  Create Your First Robot  ]               │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Styling**:
- Container: surface (#1a1f29), rounded-lg, large padding (p-12)
- Title: Large text (text-xl), gray-400 color, centered
- Subtitle: text-gray-500, centered, margin-bottom 24px
- Button: Large, success color, prominent
- Vertical spacing: Generous, centered alignment

### FR-5: Loading State

**Display**: During `fetchRobots()` async operation

**Layout**:
```
┌─────────────────────────────────────────────────────┐
│                                                     │
│               Loading robots...                    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Styling**:
- Full-screen height: min-h-screen
- Background: bg-background (#0a0e14)
- Text: text-xl, centered, text-white
- No spinner (follows infrastructure motion: minimal)
- Optional: Subtle fade-in animation

### FR-6: Error State

**Display**: When API fetch fails

**Layout**:
```
┌─────────────────────────────────────────────────────┐
│ ⚠️ Failed to load robots                           │
│ Please try refreshing the page.                     │
└─────────────────────────────────────────────────────┘
```

**Styling**:
- Container: bg-error-dark (#f85149 with opacity)
- Border: error color
- Icon: Warning emoji or icon
- Text: error-light color
- Padding: 16px (px-4 py-3)
- Border-radius: rounded
- Margin-bottom: 24px

---

## Design Specifications

### Color Palette

**From Design System** (tailwind.config.js):
```javascript
colors: {
  background: '#0a0e14',           // Page background
  surface: '#1a1f29',              // Card backgrounds
  'surface-elevated': '#252b38',   // Robot cards
  primary: '#58a6ff',              // ELO, actions, links
  success: '#3fb950',              // HP healthy, Create button
  warning: '#d29922',              // HP medium, capacity warning
  error: '#f85149',                // HP critical, errors
  info: '#a371f7',                 // Weapon Shop button
  'text-primary': '#e6edf3',       // Main text
  'text-secondary': '#8b949e',     // Secondary text
  'text-tertiary': '#57606a',      // Muted text
}
```

**Application**:
- Page background: `background` (#0a0e14)
- Robot cards: `surface-elevated` (#252b38)
- Card borders: #3d444d (neutral gray, ~35% lighter than surface)
- Card borders (hover): `primary` (#58a6ff)
- Robot names: `text-primary` (#e6edf3)
- Labels (HP, Shield, Weapon): `text-secondary` (#8b949e)
- ELO rating: `primary` (#58a6ff)
- Win rate: `text-secondary` (#8b949e)
- HP bar (70-100%): `success` (#3fb950)
- HP bar (30-69%): `warning` (#d29922)
- HP bar (0-29%): `error` (#f85149)
- Shield bar: `primary` (#58a6ff)
- Weapon Shop button: `info` (#a371f7)
- Create button: `success` (#3fb950)

### Typography

**Font Families** (from Design System):
- Headers: `'DIN Next', 'Inter Tight', 'Roboto Condensed', sans-serif`
- Body/UI: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`

**Type Scale**:
- Page Title "My Robots": `text-3xl font-bold` (30px, Bold)
- Robot Name: `text-xl font-bold` (20px, Bold)
- ELO/Stats: `text-base font-semibold` (16px, Semi-bold)
- Labels: `text-sm` (14px, Regular)
- Capacity: `text-base text-secondary` (16px, Regular, #8b949e)

### Spacing

**Card Spacing**:
- Grid gap: 24px (gap-6)
- Card padding: 24px (p-6)
- Section spacing within card: 12-16px (mb-3, mb-4)

**Layout Spacing**:
- Page padding: 32px horizontal, 32px vertical (px-8 py-8)
- Header margin-bottom: 32px (mb-8)
- Status bars spacing: 8px between (space-y-2)

### Motion & Transitions

**Card Hover**:
- Property: border-color, box-shadow
- Duration: 200ms
- Easing: ease-out
- Effect: Border changes to primary, subtle shadow appears

**HP/Shield Bar Fill**:
- Property: width
- Duration: 300ms
- Easing: ease-out
- Effect: Smooth fill animation when data loads

**Button Hover**:
- Property: background-color, border-color
- Duration: 200ms
- Easing: ease-out

**Loading Fade-In**:
- Property: opacity
- Duration: 200ms
- Easing: ease-out

**Reduced Motion**:
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Accessibility

**WCAG 2.1 AA Compliance**:
- Color contrast ratios: 4.5:1 minimum for text
  - Primary text (#e6edf3) on surface (#252b38): 11.3:1 ✅
  - Secondary text (#8b949e) on surface (#252b38): 4.6:1 ✅
  - Primary (#58a6ff) on surface (#252b38): 6.8:1 ✅
- Keyboard navigation:
  - Tab order: Header buttons → Robot cards → Action buttons
  - Focus indicators: Visible outline on all interactive elements
  - Enter/Space: Activates buttons and card click
- Screen reader support:
  - ARIA labels for status bars: `aria-label="HP: 850 out of 1000, 85%"`
  - Card semantic structure: `<article>` for each robot
  - Button labels: Clear, descriptive text
- Alternative text:
  - Portrait alt text: "Portrait of {robotName}" (future image implementation)

---

## Technical Implementation

### Component Architecture

**File**: `/prototype/frontend/src/pages/RobotsPage.tsx`

**Imports**:
```typescript
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
```

**New Components** (optional refactor):
- `RobotCard.tsx` - Individual robot card component
- `StatusBar.tsx` - Reusable HP/Shield bar component
- `EmptyState.tsx` - Empty state display component

### Data Structure

**Robot Interface** (extended from current):
```typescript
interface Robot {
  id: number;
  name: string;
  elo: number;
  currentLeague: string;      // NEW: League tier
  // HP/Shield
  currentHP: number;           // NEW
  maxHP: number;               // NEW
  currentShield: number;       // NEW
  maxShield: number;           // NEW
  battleReadiness: number;     // NEW: Percentage
  // Performance
  totalBattles: number;        // NEW
  wins: number;                // NEW
  losses: number;              // NEW
  // Weapon
  weaponInventoryId: number | null;
  weaponInventory: {
    weapon: {
      name: string;
      weaponType: string;
    };
  } | null;
  // Meta
  createdAt: string;
}
```

### API Requirements

**Endpoint**: `GET /api/robots`

**Current Response**: ✅ Returns robot array with basic data

**Required Additions** (backend):
- Include `currentHP`, `maxHP`, `currentShield`, `maxShield`
- Include `battleReadiness` (calculated)
- Include `totalBattles`, `wins`, `losses`
- Include `currentLeague`

**If backend doesn't have these fields yet**:
- Frontend can calculate: `battleReadiness = ((currentHP/maxHP + currentShield/maxShield) / 2) * 100`
- Frontend can derive: `winRate = (wins / totalBattles * 100).toFixed(1)`
- Use placeholder for missing data: League = "Unranked", Readiness = "N/A"

### Utility Functions

**Status Bar Color Logic**:
```typescript
const getHPColor = (currentHP: number, maxHP: number): string => {
  const percentage = (currentHP / maxHP) * 100;
  if (percentage >= 70) return 'bg-success';     // Green
  if (percentage >= 30) return 'bg-warning';     // Amber
  return 'bg-error';                             // Red
};
```

**Battle Readiness Calculation**:
```typescript
const calculateReadiness = (
  currentHP: number,
  maxHP: number,
  currentShield: number,
  maxShield: number
): number => {
  const hpPercent = (currentHP / maxHP) * 100;
  const shieldPercent = maxShield > 0 ? (currentShield / maxShield) * 100 : 100;
  return Math.round((hpPercent + shieldPercent) / 2);
};
```

**Readiness Status Text**:
```typescript
const getReadinessStatus = (readiness: number): { text: string; color: string } => {
  if (readiness >= 80) return { text: 'Battle Ready', color: 'text-success' };
  if (readiness >= 50) return { text: 'Damaged', color: 'text-warning' };
  return { text: 'Critical', color: 'text-error' };
};
```

**Win Rate Calculation**:
```typescript
const calculateWinRate = (wins: number, totalBattles: number): string => {
  if (totalBattles === 0) return '0.0';
  return ((wins / totalBattles) * 100).toFixed(1);
};
```

---

## Testing Strategy

### Unit Tests

**Component Tests** (Jest + React Testing Library):
```typescript
describe('RobotsPage', () => {
  it('should display robot cards when data is loaded', () => {
    const mockRobots = [createMockRobot()];
    render(<RobotsPage robots={mockRobots} />);
    expect(screen.getByText(mockRobots[0].name)).toBeInTheDocument();
  });
  
  it('should display empty state when no robots', () => {
    render(<RobotsPage robots={[]} />);
    expect(screen.getByText(/You don't have any robots yet/i)).toBeInTheDocument();
  });
  
  it('should navigate to robot detail on card click', () => {
    const navigate = jest.fn();
    render(<RobotsPage robots={[mockRobot]} navigate={navigate} />);
    fireEvent.click(screen.getByText(mockRobot.name));
    expect(navigate).toHaveBeenCalledWith(`/robots/${mockRobot.id}`);
  });
});
```

**Utility Function Tests**:
```typescript
describe('getHPColor', () => {
  it('returns green for HP above 70%', () => {
    expect(getHPColor(80, 100)).toBe('bg-success');
  });
  
  it('returns amber for HP between 30-69%', () => {
    expect(getHPColor(50, 100)).toBe('bg-warning');
  });
  
  it('returns red for HP below 30%', () => {
    expect(getHPColor(20, 100)).toBe('bg-error');
  });
});

describe('calculateReadiness', () => {
  it('calculates 100% when fully healthy', () => {
    expect(calculateReadiness(1000, 1000, 200, 200)).toBe(100);
  });
  
  it('calculates correctly for partial HP and shield', () => {
    expect(calculateReadiness(500, 1000, 100, 200)).toBe(50);
  });
});
```

### Integration Tests

**API Integration** (Supertest):
```typescript
describe('GET /api/robots', () => {
  it('returns robot list with all required fields', async () => {
    const response = await request(app)
      .get('/api/robots')
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(200);
    expect(response.body).toBeInstanceOf(Array);
    expect(response.body[0]).toHaveProperty('currentHP');
    expect(response.body[0]).toHaveProperty('maxHP');
    expect(response.body[0]).toHaveProperty('wins');
  });
});
```

### Manual Testing Checklist

**Visual Verification**:
- [ ] Page uses design system color palette
- [ ] Robot cards have proper spacing and layout
- [ ] HP bars display correct colors based on percentage
- [ ] Shield bars use primary color (#58a6ff)
- [ ] Typography matches design system (DIN Next/Inter)
- [ ] Buttons use correct colors (success for Create, info for Weapon Shop)
- [ ] Empty state displays correctly with no robots
- [ ] Loading state shows briefly during data fetch
- [ ] Error state displays if API fails

**Functionality Verification**:
- [ ] Robots fetch and display correctly
- [ ] Card click navigates to /robots/:id
- [ ] "View Details" button navigates to /robots/:id
- [ ] "Create New Robot" button navigates to /robots/create
- [ ] "Weapon Shop" button navigates to /weapon-shop
- [ ] HP percentage calculated correctly
- [ ] Shield percentage calculated correctly
- [ ] Win rate calculated correctly (wins / totalBattles * 100)
- [ ] Battle readiness calculated correctly
- [ ] Readiness status text matches percentage

**Responsive Design**:
- [ ] Mobile (<768px): 1 column layout
- [ ] Tablet (768-1023px): 2 columns layout
- [ ] Desktop (≥1024px): 3 columns layout
- [ ] Cards scale appropriately at all breakpoints
- [ ] Buttons stack vertically on mobile
- [ ] Navigation remains accessible

**Accessibility**:
- [ ] All interactive elements are keyboard accessible
- [ ] Tab order is logical (header → cards → buttons)
- [ ] Focus indicators visible on all focusable elements
- [ ] ARIA labels on status bars
- [ ] Color contrast meets WCAG AA standards
- [ ] Screen reader announces card content correctly
- [ ] Reduced motion preference respected

---

## Acceptance Criteria

### Definition of Done

**Visual Design**:
- ✅ Design system color palette applied (background, surface, primary, status colors)
- ✅ Typography uses system fonts (DIN Next for headers, Inter for body)
- ✅ Cards use surface-elevated (#252b38) with proper borders
- ✅ Hover states implemented with 200ms transitions
- ✅ Portrait space reserved (256×256px) with placeholder
- ✅ Spacing and layout match specifications

**Functionality**:
- ✅ Robots fetch from API and display in grid
- ✅ Each card shows: Name, Portrait space, ELO, League, HP bar, Shield bar, Win/Loss, Weapon, Readiness
- ✅ HP bar color-coded (green/amber/red) based on percentage
- ✅ Shield bar uses primary color (#58a6ff)
- ✅ Win rate calculated and displayed
- ✅ Battle readiness calculated and displayed
- ✅ Card click navigates to robot detail page
- ✅ "Create New Robot" button navigates to /robots/create
- ✅ "Weapon Shop" button navigates to /weapon-shop
- ✅ Empty state displays when no robots
- ✅ Loading state displays during fetch
- ✅ Error state displays on API failure

**Code Quality**:
- ✅ TypeScript types defined for all data structures
- ✅ No console errors or warnings
- ✅ Utility functions tested
- ✅ Component renders without errors
- ✅ Follows existing code style and conventions

**Accessibility**:
- ✅ WCAG 2.1 AA color contrast ratios met
- ✅ Keyboard navigation functional
- ✅ Focus indicators visible
- ✅ ARIA labels on status bars
- ✅ Reduced motion respected

**Performance**:
- ✅ Page loads in <1 second
- ✅ No layout shift during render
- ✅ Smooth animations (200-300ms)
- ✅ Responsive grid renders correctly

---

## Dependencies & Risks

### Dependencies

**Completed Prerequisites**:
- ✅ Navigation with Direction B logo implemented
- ✅ Design system color palette in Tailwind config
- ✅ Backend API endpoint `/api/robots` functional

**Required Before Implementation**:
- ⚠️ Backend API must return: `currentHP`, `maxHP`, `currentShield`, `maxShield`, `wins`, `losses`, `totalBattles`, `currentLeague`
- ⚠️ If backend missing fields, frontend can use placeholders or calculate from available data

**Future Dependencies** (out of scope):
- 🔮 Robot portrait images (Phase 2: Image System)
- 🔮 Frame type badges (Phase 2: Multiple frame types)
- 🔮 Filter/sort controls (Phase 2: Enhanced UX)

### Risks & Mitigation

**Risk 1: Backend API Missing Required Fields**
- **Impact**: HIGH - Core functionality depends on HP, wins/losses data
- **Mitigation**: 
  - Use mock data for development/testing
  - Add placeholder values if fields missing ("N/A", 0, etc.)
  - Backend can add fields incrementally
  - Frontend gracefully handles missing data

**Risk 2: Design System Color Tokens Not in Tailwind Config**
- **Impact**: MEDIUM - Visual design won't match specifications
- **Mitigation**: 
  - Verify Tailwind config has all required colors
  - Add missing colors before implementation
  - Use design system quick reference for color values

**Risk 3: Performance with Many Robots**
- **Impact**: LOW - Users unlikely to have >50 robots in prototype phase
- **Mitigation**: 
  - Implement pagination if >20 robots
  - Use React virtualization if needed (future)
  - Optimize re-renders with React.memo

**Risk 4: Portrait Space Looks Empty Without Images**
- **Impact**: LOW - Placeholder acceptable for Phase 1
- **Mitigation**: 
  - Use robot name initial (first letter, large font)
  - OR use generic robot icon/silhouette
  - Design layout works with or without images
  - Future image integration is seamless

---

## Implementation Plan

### Phase 1: Backend Preparation (if needed)
1. Verify `/api/robots` endpoint returns all required fields
2. Add missing fields to Robot model if needed
3. Update database seed data with sample HP/Shield/performance data
4. Test API endpoint returns correct data structure

### Phase 2: Frontend Core Implementation
1. Update Robot interface with new fields
2. Implement utility functions (getHPColor, calculateReadiness, etc.)
3. Update RobotsPage.tsx with new card layout
4. Add portrait placeholder area
5. Implement HP and Shield status bars
6. Add ELO, League, Win/Loss display
7. Add Battle Readiness indicator
8. Update button colors to match design system

### Phase 3: Visual Polish
1. Apply design system color palette
2. Add hover states and transitions
3. Verify typography matches specifications
4. Test responsive grid at all breakpoints
5. Ensure spacing matches design specs

### Phase 4: Testing & Refinement
1. Write unit tests for utility functions
2. Test with various data scenarios (0 robots, 1 robot, many robots)
3. Test with different HP/Shield percentages
4. Verify accessibility with keyboard navigation
5. Test screen reader compatibility
6. Verify color contrast ratios
7. Test reduced motion preference

### Phase 5: Documentation & Handoff
1. Update README if needed
2. Add inline code comments for complex logic
3. Screenshot before/after comparison
4. Create demo video (optional)
5. Mark PRD as "Implemented"

---

## Open Questions

1. **Backend API**: Does `/api/robots` currently return HP, Shield, and performance data?
   - If not, can these fields be added in time for implementation?
   - Should we use placeholder values temporarily?

2. **Roster Capacity**: What is the maximum number of robots a player can own?
   - Currently hardcoded or configurable?
   - Should capacity be fetched from user profile or config?

3. **League System**: Is the League field (`currentLeague`) already in the database?
   - If not, should we display "Unranked" as placeholder?
   - What are the league tier names? (Bronze, Silver, Gold, Platinum, Diamond, Master?)

4. **Battle Readiness Formula**: Is the proposed formula `((HP% + Shield%) / 2)` acceptable?
   - Should Shield be weighted differently?
   - Should there be additional factors (e.g., weapon equipped)?

5. **Empty Portrait Placeholder**: What should display in portrait space before images are implemented?
   - Robot name initial (first letter)?
   - Generic robot icon/silhouette?
   - Solid color with border?

6. **Filter/Sort Controls**: Should these be implemented in Phase 1 or deferred?
   - If implemented, what sort options? (ELO, HP, Name, Win Rate)
   - Should there be a search input?

---

## Success Criteria Verification

Before marking this PRD as complete, verify:

- [ ] All acceptance criteria met (see Definition of Done)
- [ ] Design system compliance verified (colors, typography, spacing)
- [ ] Accessibility requirements met (WCAG 2.1 AA)
- [ ] Responsive design tested at all breakpoints
- [ ] Manual testing checklist completed
- [ ] Unit tests written and passing
- [ ] Screenshot comparison shows visual improvement
- [ ] Code review approved
- [ ] No regressions in existing functionality

---

## Appendix

### Design References

**Primary Source**: [DESIGN_SYSTEM_AND_UX_GUIDE.md - Section 3: My Robots Page](design_ux/DESIGN_SYSTEM_AND_UX_GUIDE.md)

**Quick Reference**: [DESIGN_SYSTEM_QUICK_REFERENCE.md - Card Component Pattern](design_ux/DESIGN_SYSTEM_QUICK_REFERENCE.md)

**Navigation Context**: [NAVIGATION_AND_PAGE_STRUCTURE.md - Core Management Pages](NAVIGATION_AND_PAGE_STRUCTURE.md)

### Related PRDs

- [PRD_LOGIN_PAGE_DESIGN_ALIGNMENT.md](PRD_LOGIN_PAGE_DESIGN_ALIGNMENT.md) - Login page design alignment
- [PRD_NAVIGATION_MENU_DESIGN_ALIGNMENT.md](PRD_NAVIGATION_MENU_DESIGN_ALIGNMENT.md) - Navigation implementation
- [PRD_ROBOTS_PAGE_OVERHAUL.md](PRD_ROBOTS_PAGE_OVERHAUL.md) - Robot Detail page (not list page)

### Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Feb 2, 2026 | Robert Teunissen | Initial PRD created based on design system documentation |

---

**Status**: ✅ Ready for Implementation  
**Next Steps**: Review with team, begin Phase 1 (Backend Preparation)
