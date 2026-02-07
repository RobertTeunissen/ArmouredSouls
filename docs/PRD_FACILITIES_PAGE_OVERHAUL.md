# Product Requirements Document: Facilities Page UX Overhaul

**Project**: Armoured Souls  
**Document Type**: Product Requirements Document (PRD)  
**Version**: 1.0  
**Date**: February 7, 2026  
**Author**: GitHub Copilot  
**Status**: Draft - Implementation Planning  
**Owner**: Robert Teunissen  
**Epic**: Facilities System & Stable Management UX  
**Priority**: P2 (Medium Priority - UX Enhancement)

---

## Version History
- v1.0 - Initial PRD created (February 7, 2026)
  - Documented current implementation status
  - Defined logical facility groupings
  - Specified image requirements
  - Outlined UX improvement plan

---

## Executive Summary

The Facilities Page (`/facilities`) is a critical economic and progression interface where players invest in their stable's infrastructure to unlock discounts, expand capacity, and increase attribute caps. Currently, the page displays all 14 facility types in a basic 2-column grid without clear organization or visual hierarchy. This PRD defines requirements for improving the UX through logical grouping, clear implementation status, and visual enhancements.

**Key Design Challenges:**
- **Lack of Organization**: 14 facilities displayed in flat list without logical grouping
- **Implementation Clarity**: Users need to know which facilities are functional vs. planned
- **Visual Identity**: No icons or imagery to help distinguish facility types
- **Information Density**: Each facility card repeats similar information patterns
- **Progression Tracking**: Difficult to see overall stable development at a glance

**Success Criteria**: 
- Facilities are logically grouped by function (Economy, Capacity, Training, Future Features)
- Implementation status is immediately visible (implemented vs. not yet implemented)
- Users can quickly identify which facilities to prioritize based on their strategy
- Visual design aligns with Armoured Souls design system
- Image requirements are documented for future asset creation
- Page maintains responsive design on mobile and desktop

**Impact**: Establishes clear organization and visual hierarchy for the primary stable management interface, improving player understanding of facility benefits and investment decisions.

---

## Background & Context

### Current State

#### ✅ **Fully Implemented**

**Backend System:**
- ✅ Complete facility configuration: 14 facilities defined in `/prototype/backend/src/config/facilities.ts`
- ✅ Database schema: User facilities stored in database
- ✅ Backend API: `GET /api/facilities` (returns all facilities with user's current levels)
- ✅ Backend API: `POST /api/facilities/upgrade` (upgrade facility)
- ✅ Upgrade cost calculation and validation
- ✅ Currency validation (prevents upgrade if insufficient funds)
- ✅ Level progression tracking (0-10 levels per facility, some have 9 levels)
- ✅ Benefit calculation and display

**Frontend - Basic Interface:**
- ✅ FacilitiesPage component (`/prototype/frontend/src/pages/FacilitiesPage.tsx`)
- ✅ 2-column grid layout (responsive: 1 column on mobile, 2 on desktop)
- ✅ Current level vs max level display for each facility
- ✅ Current benefit and next level benefit display
- ✅ Upgrade cost display with currency formatting
- ✅ "Effect not yet implemented" badge for non-functional facilities
- ✅ Purchase button with loading state and disabled state
- ✅ Insufficient credits validation and error message
- ✅ Maximum level reached indicator
- ✅ Real-time refresh after upgrade (facilities list and user balance)

**Facility Types & Implementation Status:**

**Implemented (7 facilities):**
1. ✅ **Training Facility** - Discount on attribute upgrades (5%-50%)
2. ✅ **Weapons Workshop** - Discount on weapon purchases (5%-50%)
3. ✅ **Roster Expansion** - Increase robot slots (1→10 robots)
4. ✅ **Storage Facility** - Increase weapon storage (5→55 weapons)
5. ✅ **Combat Training Academy** - Combat Systems caps (10→50)
6. ✅ **Defense Training Academy** - Defensive Systems caps (10→50)
7. ✅ **Mobility Training Academy** - Chassis & Mobility caps (10→50)
8. ✅ **AI Training Academy** - AI/Team Coordination caps (10→50)

**Not Yet Implemented (6 facilities):**
1. ❌ **Repair Bay** - Discount on repair costs (10%-55%)
2. ❌ **Research Lab** - Unlock analytics, loadout presets, battle simulation
3. ❌ **Medical Bay** - Critical damage repair cost reduction (15%-100%)
4. ❌ **Coaching Staff** - Stable-wide stat bonuses (coaches for offense/defense/tactics)
5. ❌ **Booking Office** - Tournament access and enhanced rewards
6. ❌ **Income Generator** - Passive income streams (merchandising, streaming)

#### 🚧 **Current UI Limitations**

**Organization & Clarity:**
- ⚠️ **No logical grouping**: All 14 facilities shown in flat 2-column grid without categories
- ⚠️ **No visual hierarchy**: Equal visual weight given to implemented vs. not-implemented facilities
- ⚠️ **No facility icons**: Text-only cards, no visual differentiation between facility types
- ⚠️ **Limited context**: No explanation of facility categories or strategic importance
- ⚠️ **No overview**: Cannot see total investment or progression at a glance

**Visual Design:**
- ⚠️ **Basic styling**: Standard gray cards without distinctive visual identity
- ⚠️ **No imagery**: No facility illustrations, icons, or visual themes
- ⚠️ **Repetitive layout**: All cards look identical except for text content
- ⚠️ **Small badge**: "Effect not yet implemented" badge is small and easy to miss

**Information Architecture:**
- ⚠️ **Mixed priorities**: Critical facilities (Roster Expansion) mixed with future features (Income Generator)
- ⚠️ **No guidance**: No indication of which facilities are most important to upgrade first
- ⚠️ **No relationships**: Cannot see dependencies or synergies between facilities

#### ❌ **Not Yet Implemented**

**Critical UX Features:**
- ❌ **Logical facility grouping**: Categorize by function (Economy, Capacity, Training, Advanced)
- ❌ **Visual facility icons**: 256×256px facility illustrations or icon placeholders
- ❌ **Facility category headers**: Clear section breaks between facility types
- ❌ **Priority indicators**: Visual cues for "Essential", "Important", "Advanced" facilities
- ❌ **Stable overview stats**: Total investment, total facilities upgraded, completion percentage
- ❌ **Collapsible categories**: Ability to collapse/expand facility groups

**Educational Features:**
- ❌ **Facility guides**: Tooltips explaining strategic importance of each facility
- ❌ **Upgrade recommendations**: "Recommended next upgrade" based on player progress
- ❌ **Facility comparisons**: Show which facilities provide similar or synergistic benefits
- ❌ **ROI indicators**: Show approximate payback period or value of facility investments

**Advanced Features:**
- ❌ **Facility presets**: "Balanced", "Combat-Focused", "Economy-Focused" upgrade paths
- ❌ **Batch upgrades**: Plan and queue multiple facility upgrades
- ❌ **Progress visualization**: Charts showing stable development over time
- ❌ **Facility unlock system**: Gated facilities that unlock at specific stable milestones

### Design References

- **[DESIGN_SYSTEM_AND_UX_GUIDE.md](design_ux/DESIGN_SYSTEM_AND_UX_GUIDE.md)**: Complete design system specification
- **[STABLE_SYSTEM.md](STABLE_SYSTEM.md)**: Facility system specifications and mechanics
- **[PRD_WEAPON_SHOP.md](PRD_WEAPON_SHOP.md)**: Reference for filtering, grouping, and view modes
- **[PRD_BATTLE_HISTORY_PAGE_OVERHAUL.md](PRD_BATTLE_HISTORY_PAGE_OVERHAUL.md)**: Reference for information density and visual hierarchy
- **[PRD_MY_ROBOTS_LIST_PAGE.md](PRD_MY_ROBOTS_LIST_PAGE.md)**: Reference for card-based UI patterns
- **[ECONOMY_IMPLEMENTATION.md](ECONOMY_IMPLEMENTATION.md)**: Economic context for facility investments

### Why This Matters

**Player Experience:**
- **Decision Quality**: Clear organization helps players prioritize facility investments
- **Strategic Planning**: Understanding facility categories enables long-term stable development
- **Reduced Confusion**: Implementation status prevents frustration with non-functional features
- **Time Efficiency**: Logical grouping reduces time to find desired facilities

**Development Benefits:**
- **Clear Roadmap**: Implementation status tracking shows remaining work
- **Asset Planning**: Image requirements enable coordinated asset creation
- **Scalability**: Organized structure supports adding new facilities in future phases
- **Testing Focus**: Clear distinction between implemented and planned features

---

## Goals & Objectives

### Primary Goals

1. **Implement Logical Facility Grouping**: Organize facilities into clear categories (Economy, Capacity, Training, Advanced)
2. **Improve Implementation Clarity**: Make it immediately obvious which facilities are functional
3. **Document Image Requirements**: Specify all facility images needed for visual enhancement
4. **Enhance Visual Hierarchy**: Use design system patterns to create clear visual distinction between facility types
5. **Add Category Navigation**: Enable quick jumping between facility categories
6. **Improve Information Density**: Show more relevant information without increasing scroll length

### Success Metrics

- Players can identify facility categories without reading all facility names (visual clarity test)
- 90%+ of players understand which facilities are implemented vs. planned
- Time to find specific facility reduced by 50% through categorization
- Image asset list is complete and actionable for asset creation
- Page maintains current scroll length despite added organization
- Mobile responsiveness preserved with category organization
- All facility cards align with design system color palette and spacing

### Non-Goals (Out of Scope for This PRD)

- ❌ Implementation of actual backend logic for remaining 6 facilities (separate PRDs)
- ❌ Creation of actual facility images/icons (design asset work)
- ❌ Advanced features like upgrade recommendations or batch upgrades (Phase 2+)
- ❌ Facility unlock system or progression gating (future enhancement)
- ❌ Detailed ROI calculations or payback analysis (future feature)

---

## Detailed Requirements

### 1. Facility Organization & Grouping

#### 1.1 Facility Categories

**Category 1: Economy & Discounts** (3 facilities)
- **Purpose**: Reduce operational costs across the stable
- **Strategic Value**: High ROI, should be prioritized early-game
- **Facilities**:
  1. Training Facility (✅ Implemented) - Attribute upgrade discounts
  2. Weapons Workshop (✅ Implemented) - Weapon purchase discounts
  3. Repair Bay (❌ Not Implemented) - Repair cost discounts

**Category 2: Capacity & Storage** (2 facilities)
- **Purpose**: Expand stable capacity for robots and weapons
- **Strategic Value**: Essential for progression, hard caps on gameplay
- **Facilities**:
  1. Roster Expansion (✅ Implemented) - Robot slots (1→10)
  2. Storage Facility (✅ Implemented) - Weapon storage (5→55)

**Category 3: Training Academies** (4 facilities)
- **Purpose**: Increase attribute caps for robot development
- **Strategic Value**: Required for late-game progression, unlocks higher attribute levels
- **Facilities**:
  1. Combat Training Academy (✅ Implemented) - Combat Systems caps (10→50)
  2. Defense Training Academy (✅ Implemented) - Defensive Systems caps (10→50)
  3. Mobility Training Academy (✅ Implemented) - Chassis & Mobility caps (10→50)
  4. AI Training Academy (✅ Implemented) - AI/Team Coordination caps (10→50)

**Category 4: Advanced Features** (5 facilities)
- **Purpose**: Unlock special features and advanced gameplay mechanics
- **Strategic Value**: Late-game enhancements, not required for basic progression
- **Facilities**:
  1. Research Lab (❌ Not Implemented) - Analytics, loadout presets, battle simulation
  2. Medical Bay (❌ Not Implemented) - Critical damage repair reduction
  3. Coaching Staff (❌ Not Implemented) - Stable-wide stat bonuses
  4. Booking Office (❌ Not Implemented) - Tournament access and rewards
  5. Income Generator (❌ Not Implemented) - Passive income streams

#### 1.2 Category Display Requirements

**Visual Structure:**
- Each category has a header with:
  - Category name (e.g., "Economy & Discounts")
  - Category icon (future: 64×64px SVG icon)
  - Brief description (1-2 sentences explaining category purpose)
  - Implementation count (e.g., "3 of 3 facilities implemented")
- Categories displayed in order: Economy → Capacity → Training → Advanced
- Within each category, facilities ordered by strategic priority
- Facilities within category use same 2-column grid layout as current design

**Category Headers:**
```
┌─────────────────────────────────────────────────────────────┐
│ 💰 Economy & Discounts                          [3 of 3 ✓]  │
│ Reduce operational costs and maximize your budget           │
└─────────────────────────────────────────────────────────────┘
```

**Implementation Status Indicators:**
- Green checkmark (✓) for fully implemented categories
- Yellow warning (⚠) for partially implemented categories
- Gray indicator for not-yet-implemented categories

#### 1.3 Facility Ordering Within Categories

**Economy & Discounts** (by usage frequency):
1. Training Facility (most used in gameplay)
2. Weapons Workshop (frequent purchases)
3. Repair Bay (future: combat damage)

**Capacity & Storage** (by progression importance):
1. Roster Expansion (hard blocker for multi-robot strategies)
2. Storage Facility (enables weapon collection)

**Training Academies** (alphabetical for consistency):
1. AI Training Academy
2. Combat Training Academy
3. Defense Training Academy
4. Mobility Training Academy

**Advanced Features** (by strategic value):
1. Research Lab (analytics & planning tools)
2. Coaching Staff (stable-wide bonuses)
3. Booking Office (tournament access)
4. Income Generator (passive income)
5. Medical Bay (critical damage handling)

### 2. Implementation Status Clarity

#### 2.1 Visual Status Indicators

**Current Implementation:**
- ✅ "Effect not yet implemented" yellow badge in top-right corner
- ⚠️ Badge is small and can be missed by users

**Enhanced Implementation:**

**Implemented Facilities:**
- Green checkmark badge in top-right: `✓ Active`
- Border color: Subtle green accent (`border-green-700/30`)
- No additional warnings or badges

**Not Yet Implemented Facilities:**
- Large yellow warning badge in top-right: `⚠ Coming Soon`
- Border color: Yellow accent (`border-yellow-600/50`)
- Overlay with reduced opacity (0.85) to de-emphasize
- Upgrade button shows "Coming Soon" instead of "Upgrade"
- Upgrade button is disabled with cursor-not-allowed

**Visual Example:**
```
Implemented Facility:
┌──────────────────────────────────────────────────── [✓ Active]
│ Training Facility                          Level 5/10
│ Reduces costs for upgrading robot attributes
│ 
│ Current: 25% discount on attribute upgrades
│ Next:    30% discount on attribute upgrades
│ 
│ Cost: ₡1,500,000                         [Upgrade]
└─────────────────────────────────────────────────────────────

Not Yet Implemented:
┌──────────────────────────────────────────────── [⚠ Coming Soon]
│ Repair Bay                                 Level 0/10
│ Reduces repair costs for damaged robots
│ 
│ Level 1: 10% discount on repair costs
│ 
│ Cost: ₡200,000                      [Coming Soon]
└─────────────────────────────────────────────────────────────
```

#### 2.2 Category-Level Status Summary

**Requirements:**
- Each category header shows implementation count
- Visual progress indicator: `[3 of 3 ✓]`, `[4 of 4 ✓]`, `[0 of 5]`
- Color-coded: Green for 100%, Yellow for partial, Gray for 0%

**Examples:**
- Economy & Discounts: `[2 of 3 ✓]` (Yellow - 67% implemented)
- Capacity & Storage: `[2 of 2 ✓]` (Green - 100% implemented)
- Training Academies: `[4 of 4 ✓]` (Green - 100% implemented)
- Advanced Features: `[0 of 5]` (Gray - 0% implemented)

#### 2.3 Stable Overview Dashboard

**Requirements:**
- Display overall stable development statistics at top of page
- Show total investment, facilities upgraded, implementation coverage

**Dashboard Content:**
```
┌─────────────────────────────────────────────────────────────┐
│ Stable Overview                                              │
├─────────────────────────────────────────────────────────────┤
│ Total Investment: ₡12,450,000                                │
│ Facilities Upgraded: 23 levels across 8 facilities           │
│ Implementation Coverage: 8 of 14 facilities active (57%)     │
└─────────────────────────────────────────────────────────────┘
```

**Visual Design:**
- Placed directly below page title "Stable Facilities"
- Uses same card styling as facility cards (bg-gray-800)
- Single-column layout with 3 key metrics
- Future: Add visual progress bars for each metric

### 3. Image Requirements

#### 3.1 Facility Icons/Illustrations

**Purpose**: Provide visual identity for each facility type to aid recognition and navigation.

**Image Specifications:**
- **Format**: SVG (scalable vector graphics) preferred, PNG fallback
- **Size**: 256×256px (displayed at 64×64px or 128×128px depending on viewport)
- **Style**: Consistent art direction matching Armoured Souls robot aesthetic
- **Color Palette**: Match design system (gray, blue, green, yellow accents)
- **Background**: Transparent background
- **File Naming**: `facility-{type}-icon.svg` (e.g., `facility-training-facility-icon.svg`)

**Facility Image List (14 total):**

1. **Training Facility** - Icon showing robot training/exercise equipment
2. **Weapons Workshop** - Icon showing weapons on workbench or forge
3. **Repair Bay** - Icon showing robot repair tools or maintenance area
4. **Research Lab** - Icon showing computers, screens, data analytics
5. **Medical Bay** - Icon showing medical cross, healing equipment
6. **Roster Expansion** - Icon showing multiple robot silhouettes or hangar
7. **Storage Facility** - Icon showing weapon racks or storage containers
8. **Coaching Staff** - Icon showing coach clipboard or tactical board
9. **Booking Office** - Icon showing trophy, tournament bracket, or schedule
10. **Combat Training Academy** - Icon showing weapon targeting or combat practice
11. **Defense Training Academy** - Icon showing shield or defensive barrier
12. **Mobility Training Academy** - Icon showing robot legs, chassis, or movement
13. **AI Training Academy** - Icon showing circuit board, AI chip, or neural network
14. **Income Generator** - Icon showing currency symbol, merchandising, or media

**Placeholder Strategy (Current Implementation):**
- Use SVG placeholders with facility-specific colors and simple shapes
- Text-based icons using emoji or single letters (temporary)
- Example: 🏋️ for Training Facility, 🔧 for Weapons Workshop, etc.

#### 3.2 Category Icons

**Purpose**: Provide visual identity for each facility category in headers.

**Image Specifications:**
- **Format**: SVG preferred
- **Size**: 64×64px (displayed at 32×32px)
- **Style**: Simple, iconic representations
- **Color**: Single color with transparency

**Category Icon List (4 total):**

1. **Economy & Discounts** - Currency/dollar sign symbol (💰)
2. **Capacity & Storage** - Warehouse/storage box symbol (📦)
3. **Training Academies** - Graduation cap or training symbol (🎓)
4. **Advanced Features** - Star or lightning bolt symbol (⭐)

**Placeholder Strategy:**
- Use Unicode emoji for quick implementation
- Replace with custom SVG icons when design assets are ready

#### 3.3 Future Image Enhancements

**Phase 2+ Considerations:**
- Facility background images (large 1920×1080px backgrounds for each category)
- Animated facility icons (Lottie animations showing facility activity)
- Facility level-up visual effects (particles, glows, etc.)
- Facility preview images (show what upgraded facilities look like)

### 4. UI/UX Enhancements

#### 4.1 Category Navigation

**Requirements:**
- Quick jump links to each category at top of page
- Sticky navigation bar that scrolls with page
- Active category highlighted as user scrolls

**Navigation Bar:**
```
┌─────────────────────────────────────────────────────────────┐
│ [Economy] [Capacity] [Training] [Advanced]                   │
└─────────────────────────────────────────────────────────────┘
```

**Behavior:**
- Clicking category scrolls to that section smoothly
- Active category button highlighted with blue background
- Navigation bar sticks to top of screen when scrolling past page header
- Mobile: Horizontal scrollable button bar

#### 4.2 Facility Card Improvements

**Current Card Structure:**
- Facility name and description
- Current level / Max level
- Current benefit (if level > 0)
- Next level benefit (if can upgrade)
- Upgrade cost and button

**Enhanced Card Structure:**
- **Add facility icon** (64×64px) in top-left corner
- **Move level indicator** to top-right corner (larger, more prominent)
- **Add progress bar** below name showing level progression
- **Improve benefit display** with icons (💰 for discounts, 📊 for caps, etc.)
- **Add tooltip** with full facility description and strategy tips

**Visual Mockup:**
```
┌─────────────────────────────────────────────────── [✓ Active]
│ 🏋️  Training Facility                       ▓▓▓▓▓░░░░░ 5/10
│     ▓▓▓▓▓░░░░░ (50% progress)
│     Reduces costs for upgrading robot attributes
│ 
│ ✓ Current:  💰 25% discount on attribute upgrades
│ → Next:     💰 30% discount on attribute upgrades
│ 
│ Cost: ₡1,500,000                              [Upgrade ➜]
└─────────────────────────────────────────────────────────────
```

#### 4.3 Mobile Responsiveness

**Requirements:**
- Single-column layout on mobile (current behavior preserved)
- Category headers remain sticky on mobile
- Touch-friendly button sizes (min 44×44px)
- Collapsible category sections on mobile (optional)
- Swipe gesture to navigate between categories (future enhancement)

#### 4.4 Accessibility

**Requirements:**
- All images have alt text describing facility type
- Category navigation keyboard accessible (tab navigation)
- ARIA labels for implementation status badges
- Color-blind friendly status indicators (not color-only)
- Screen reader announcements for upgrade actions

### 5. Technical Implementation

#### 5.1 Component Structure

**Current:**
```
FacilitiesPage.tsx
├─ Navigation
├─ Error display
├─ Loading state
└─ Facilities grid (flat list)
```

**Enhanced:**
```
FacilitiesPage.tsx
├─ Navigation
├─ StableOverview (new component)
│  ├─ Total investment
│  ├─ Facilities upgraded count
│  └─ Implementation coverage
├─ CategoryNavigation (new component)
│  └─ Category quick links
├─ FacilityCategory (new component) × 4
│  ├─ CategoryHeader
│  │  ├─ Category icon
│  │  ├─ Category name
│  │  ├─ Category description
│  │  └─ Implementation count
│  └─ FacilityCard × N
│     ├─ Facility icon
│     ├─ Implementation status badge
│     ├─ Progress bar
│     ├─ Benefits display
│     └─ Upgrade button
```

#### 5.2 Data Structure Changes

**Current:** Facilities returned as flat array from API

**Enhanced:** Add category information to each facility

```typescript
interface FacilityWithCategory extends Facility {
  category: 'economy' | 'capacity' | 'training' | 'advanced';
  categoryPriority: number; // Order within category
  strategicValue: 'essential' | 'important' | 'advanced';
}
```

**Group facilities client-side:**
```typescript
const facilitiesByCategory = {
  economy: facilities.filter(f => f.category === 'economy'),
  capacity: facilities.filter(f => f.category === 'capacity'),
  training: facilities.filter(f => f.category === 'training'),
  advanced: facilities.filter(f => f.category === 'advanced'),
};
```

#### 5.3 Backend Changes Required

**Minimal Backend Changes:**
- No database schema changes needed
- No API endpoint changes needed
- Frontend handles all categorization logic
- Backend `facilities.ts` config can add category metadata (optional)

**Optional Backend Enhancement:**
```typescript
// In facilities.ts config
export const FACILITY_CATEGORIES = {
  economy: {
    name: 'Economy & Discounts',
    description: 'Reduce operational costs and maximize your budget',
    icon: 'currency',
  },
  // ... other categories
};

// Add category field to FacilityConfig
export interface FacilityConfig {
  // ... existing fields
  category: 'economy' | 'capacity' | 'training' | 'advanced';
  categoryPriority: number;
}
```

#### 5.4 Image Integration

**Phase 1: Placeholder Icons (Immediate)**
```typescript
const facilityIcons: Record<string, string> = {
  training_facility: '🏋️',
  weapons_workshop: '🔧',
  repair_bay: '🔩',
  // ... etc.
};

// In FacilityCard component
<div className="text-4xl">{facilityIcons[facility.type]}</div>
```

**Phase 2: SVG/PNG Icons (Future)**
```typescript
import TrainingFacilityIcon from '@/assets/facilities/training-facility.svg';

<img 
  src={TrainingFacilityIcon} 
  alt="Training Facility"
  className="w-16 h-16"
/>
```

#### 5.5 Testing Requirements

**Unit Tests:**
- Facility categorization logic
- Implementation status badge rendering
- Category count calculations

**Integration Tests:**
- Upgrade functionality (existing tests preserved)
- Category navigation scroll behavior
- Mobile responsive breakpoints

**Visual Tests:**
- Screenshot comparisons for each category
- Implementation badge display
- Progress bar rendering

---

## Implementation Roadmap

### Phase 1: Organization & Clarity (P1 - Immediate)

**Estimated Effort**: 4-6 hours

**Tasks:**
1. ✅ Create PRD document with facility groupings and image requirements
2. ⬜ Add facility category metadata to frontend constants
3. ⬜ Implement facility grouping logic (client-side)
4. ⬜ Create CategoryHeader component
5. ⬜ Add emoji placeholders for facility icons
6. ⬜ Enhance implementation status badges (larger, clearer)
7. ⬜ Update FacilityCard styling with progress bars
8. ⬜ Add category-level implementation counts
9. ⬜ Test responsive layout with categories
10. ⬜ Update tests for new structure

**Deliverables:**
- ✅ PRD_FACILITIES_PAGE_OVERHAUL.md
- ⬜ Organized Facilities page with 4 clear categories
- ⬜ Enhanced implementation status visibility
- ⬜ Emoji placeholder icons for all facilities

### Phase 2: Visual Enhancement (P2 - Near Future)

**Estimated Effort**: 8-12 hours (includes asset creation)

**Tasks:**
1. ⬜ Design and create 14 facility SVG icons
2. ⬜ Design and create 4 category SVG icons
3. ⬜ Replace emoji placeholders with SVG icons
4. ⬜ Implement CategoryNavigation sticky bar
5. ⬜ Add smooth scroll to category sections
6. ⬜ Create StableOverview dashboard component
7. ⬜ Enhance facility card visual design
8. ⬜ Add hover effects and transitions

**Deliverables:**
- ⬜ 14 facility SVG icons
- ⬜ 4 category SVG icons
- ⬜ Sticky category navigation
- ⬜ Stable overview dashboard
- ⬜ Enhanced visual design

### Phase 3: Advanced Features (P3 - Future)

**Estimated Effort**: 16-24 hours

**Tasks:**
1. ⬜ Implement upgrade recommendations system
2. ⬜ Add facility comparison tooltips
3. ⬜ Create ROI indicators for facility investments
4. ⬜ Add batch upgrade planning
5. ⬜ Implement facility presets (upgrade paths)
6. ⬜ Add progress visualization charts
7. ⬜ Create facility unlock/gating system
8. ⬜ Implement educational tooltips and guides

**Deliverables:**
- ⬜ Smart upgrade recommendations
- ⬜ Facility comparison tools
- ⬜ Batch upgrade planning
- ⬜ Educational content

---

## Open Questions & Decisions Needed

### 1. Facility Icon Art Direction
**Question**: Should facility icons use realistic/detailed art style or simple/iconic style?  
**Options**:
- A) Detailed realistic icons (matches robot aesthetics, higher production cost)
- B) Simple iconic symbols (faster to create, scales better at small sizes)
- C) Hybrid approach (simple shapes with detailed textures)

**Recommendation**: Start with Option B (simple iconic) for Phase 1, enhance to Option C in Phase 2.

### 2. Category Collapsing
**Question**: Should categories be collapsible to reduce page length?  
**Options**:
- A) All categories always expanded (current scroll length ~doubled)
- B) All categories collapsible, remember user preference
- C) Advanced features category collapsed by default, others expanded

**Recommendation**: Option C - Collapse "Advanced Features" by default since all are not implemented.

### 3. Not-Implemented Facility Display
**Question**: How prominently should not-yet-implemented facilities be shown?  
**Options**:
- A) Full display with large "Coming Soon" badge (current approach)
- B) Reduced opacity and moved to bottom of category
- C) Collapsible "Coming Soon" section that hides them by default
- D) Only show implemented facilities, list others in "Roadmap" section

**Recommendation**: Option B - Show them but make them visually secondary to functional facilities.

### 4. Mobile Category Navigation
**Question**: How should category navigation work on mobile screens?  
**Options**:
- A) Horizontal scrollable button bar
- B) Dropdown select menu
- C) No category nav, users scroll normally
- D) Floating "Jump to" button that opens category selector

**Recommendation**: Option A for tablets, Option D for phones (< 640px).

---

## Success Criteria & Metrics

### User Experience Metrics

**Findability:**
- ✅ Success: Users can locate desired facility in < 15 seconds (vs. current ~30 seconds)
- 📊 Measurement: User testing session recordings

**Clarity:**
- ✅ Success: 95%+ of users correctly identify implemented vs. not-implemented facilities
- 📊 Measurement: User survey after using page

**Satisfaction:**
- ✅ Success: Post-implementation user satisfaction score > 4.0/5.0 (vs. current 3.2/5.0 estimated)
- 📊 Measurement: In-game feedback survey

### Technical Metrics

**Performance:**
- ✅ Success: Page load time remains < 500ms
- ✅ Success: No layout shift (CLS < 0.1)
- 📊 Measurement: Lighthouse performance audit

**Accessibility:**
- ✅ Success: WCAG 2.1 AA compliance
- ✅ Success: Keyboard navigation fully functional
- 📊 Measurement: Automated accessibility testing tools

**Responsiveness:**
- ✅ Success: Functional on all screen sizes (320px - 2560px)
- ✅ Success: Touch targets > 44×44px on mobile
- 📊 Measurement: Responsive testing on device lab

### Business Metrics

**Engagement:**
- ✅ Success: Average time on page increases by 20% (indicates better usability)
- ✅ Success: Facility upgrade rate increases by 10% (better understanding of benefits)
- 📊 Measurement: Analytics tracking

**Asset Planning:**
- ✅ Success: Design team can create all 14 facility icons based on PRD specifications
- ✅ Success: Zero rework needed on image specifications
- 📊 Measurement: Design team feedback

---

## Appendix A: Complete Facility List with Details

### Economy & Discounts (Category 1)

#### Training Facility (✅ Implemented)
- **Type**: `training_facility`
- **Max Level**: 10
- **Cost Range**: ₡300K - ₡4.5M (total: ₡17.5M)
- **Benefits**: 5% - 50% discount on attribute upgrades
- **Strategic Value**: Essential - High ROI for active players who upgrade robots frequently
- **Implementation Status**: Fully implemented, discount applies to robot attribute upgrade costs

#### Weapons Workshop (✅ Implemented)
- **Type**: `weapons_workshop`
- **Max Level**: 10
- **Cost Range**: ₡250K - ₡4M (total: ₡15.05M)
- **Benefits**: 5% - 50% discount on weapon purchases
- **Strategic Value**: Essential - Critical for economy-focused players, saves credits on weapon acquisitions
- **Implementation Status**: Fully implemented, discount applies at weapon shop

#### Repair Bay (❌ Not Implemented)
- **Type**: `repair_bay`
- **Max Level**: 10
- **Cost Range**: ₡200K - ₡3M (total: ₡12.7M)
- **Benefits**: 10% - 55% discount on repair costs + automatic minor repairs at max level
- **Strategic Value**: Important - Will be critical when combat damage system is implemented
- **Implementation Status**: Not yet implemented (requires combat damage system)

### Capacity & Storage (Category 2)

#### Roster Expansion (✅ Implemented)
- **Type**: `roster_expansion`
- **Max Level**: 9
- **Cost Range**: ₡300K - ₡3M (total: ₡12.2M)
- **Benefits**: 2 - 10 robot slots (starts at 1 robot with no upgrades)
- **Strategic Value**: Essential - Hard cap on number of robots, required for multi-robot strategies
- **Implementation Status**: Fully implemented, increases robot ownership limit

#### Storage Facility (✅ Implemented)
- **Type**: `storage_facility`
- **Max Level**: 10
- **Cost Range**: ₡150K - ₡2M (total: ₡8.4M)
- **Benefits**: 10 - 55 weapon storage capacity (5 base + facility levels)
- **Strategic Value**: Important - Enables weapon collection and loadout flexibility
- **Implementation Status**: Fully implemented, increases weapon inventory capacity

### Training Academies (Category 3)

#### Combat Training Academy (✅ Implemented)
- **Type**: `combat_training_academy`
- **Max Level**: 10
- **Cost Range**: ₡400K - ₡2.5M (total: ₡13M)
- **Benefits**: Increases Combat Systems attribute caps from 10 to 15-50
- **Strategic Value**: Important - Required for late-game combat attribute progression
- **Implementation Status**: Fully implemented, increases caps for Combat Power, Energy Weapons, Ballistic Weapons, Melee Weapons, Combat Systems Integration

#### Defense Training Academy (✅ Implemented)
- **Type**: `defense_training_academy`
- **Max Level**: 10
- **Cost Range**: ₡400K - ₡2.5M (total: ₡13M)
- **Benefits**: Increases Defensive Systems attribute caps from 10 to 15-50
- **Strategic Value**: Important - Required for late-game defense attribute progression
- **Implementation Status**: Fully implemented, increases caps for Armor Plating, Energy Shield, Regeneration, Countermeasures, Defensive Systems Integration

#### Mobility Training Academy (✅ Implemented)
- **Type**: `mobility_training_academy`
- **Max Level**: 10
- **Cost Range**: ₡400K - ₡2.5M (total: ₡13M)
- **Benefits**: Increases Chassis & Mobility attribute caps from 10 to 15-50
- **Strategic Value**: Important - Required for late-game mobility attribute progression
- **Implementation Status**: Fully implemented, increases caps for Frame Durability, Mobility, Gyroscopic Stabilization, Chassis Integration

#### AI Training Academy (✅ Implemented)
- **Type**: `ai_training_academy`
- **Max Level**: 10
- **Cost Range**: ₡500K - ₡3M (total: ₡16M)
- **Benefits**: Increases AI & Team Coordination attribute caps from 10 to 15-50
- **Strategic Value**: Important - Required for late-game AI/team attribute progression (future 2v2)
- **Implementation Status**: Fully implemented, increases caps for Threat Analysis, Battle Strategy, AI Processing, Team Coordination

### Advanced Features (Category 4)

#### Research Lab (❌ Not Implemented)
- **Type**: `research_lab`
- **Max Level**: 10
- **Cost Range**: ₡400K - ₡5M (total: ₡25.1M)
- **Benefits**: Unlocks advanced analytics, loadout presets, battle simulation, predictive AI, robot cloning
- **Strategic Value**: Advanced - Quality of life features, not required for core gameplay
- **Implementation Status**: Not yet implemented (Phase 2+ feature)

#### Medical Bay (❌ Not Implemented)
- **Type**: `medical_bay`
- **Max Level**: 10
- **Cost Range**: ₡350K - ₡4.5M (total: ₡21.6M)
- **Benefits**: 15% - 100% reduction on critical damage repair costs, prevents permanent damage
- **Strategic Value**: Advanced - Will be important when critical damage system is implemented
- **Implementation Status**: Not yet implemented (requires critical damage system)

#### Coaching Staff (❌ Not Implemented)
- **Type**: `coaching_staff`
- **Max Level**: 10
- **Cost Range**: ₡500K - ₡3.5M (total: ₡16.5M)
- **Benefits**: Hire coaches for stable-wide stat bonuses (+3-7% to combat, defense, tactics)
- **Strategic Value**: Advanced - Passive bonuses across all robots
- **Implementation Status**: Not yet implemented (Phase 2+ feature)

#### Booking Office (❌ Not Implemented)
- **Type**: `booking_office`
- **Max Level**: 10
- **Cost Range**: ₡500K - ₡5M (total: ₡27.5M)
- **Benefits**: Access to higher-tier tournaments, enhanced tournament rewards (+10-40%), cosmetics
- **Strategic Value**: Advanced - Required for tournament progression system
- **Implementation Status**: Not yet implemented (requires tournament system expansion)

#### Income Generator (❌ Not Implemented)
- **Type**: `income_generator`
- **Max Level**: 10
- **Cost Range**: ₡800K - ₡5M (total: ₡28M)
- **Benefits**: Passive income from merchandising and streaming (₡5K-35K/day, scales with prestige)
- **Strategic Value**: Advanced - Late-game economic boost
- **Implementation Status**: Not yet implemented (Phase 3+ feature)

---

## Appendix B: Image Asset Specifications

### Facility Icons (14 assets)

**File Naming Convention**: `facility-[facility-type]-icon.svg`

**Technical Specs:**
- Format: SVG (vector)
- Canvas Size: 256×256px
- Display Sizes: 64×64px (card header), 128×128px (detail view)
- Color Palette: Match design system (neutral grays with colored accents)
- Transparency: Yes (transparent background)
- Optimization: SVGO optimized, < 10KB per file

**Individual Asset List:**

1. `facility-training-facility-icon.svg` - Robot exercising/training equipment
2. `facility-weapons-workshop-icon.svg` - Weapons on workbench, forge imagery
3. `facility-repair-bay-icon.svg` - Repair tools, wrench, maintenance equipment
4. `facility-research-lab-icon.svg` - Computer screens, data analytics, graphs
5. `facility-medical-bay-icon.svg` - Medical cross, healing beams
6. `facility-roster-expansion-icon.svg` - Multiple robot silhouettes, hangar door
7. `facility-storage-facility-icon.svg` - Weapon racks, storage containers
8. `facility-coaching-staff-icon.svg` - Coach clipboard, tactical whiteboard
9. `facility-booking-office-icon.svg` - Trophy, tournament bracket, schedule
10. `facility-combat-training-academy-icon.svg` - Weapon targeting reticle
11. `facility-defense-training-academy-icon.svg` - Shield, defensive barrier
12. `facility-mobility-training-academy-icon.svg` - Robot legs, movement trails
13. `facility-ai-training-academy-icon.svg` - Circuit board, neural network
14. `facility-income-generator-icon.svg` - Currency symbol, media/merchandise

### Category Icons (4 assets)

**File Naming Convention**: `category-[category-name]-icon.svg`

**Technical Specs:**
- Format: SVG (vector)
- Canvas Size: 64×64px
- Display Size: 32×32px
- Color: Single color with alpha channel
- Style: Simple, iconic, minimal detail

**Individual Asset List:**

1. `category-economy-icon.svg` - Currency/dollar sign symbol
2. `category-capacity-icon.svg` - Warehouse/storage box symbol
3. `category-training-icon.svg` - Graduation cap or dumbbell symbol
4. `category-advanced-icon.svg` - Star or lightning bolt symbol

### Placeholder Assets (Immediate Use)

**Phase 1 Emoji Placeholders:**
```typescript
const facilityEmojis = {
  training_facility: '🏋️',
  weapons_workshop: '🔧',
  repair_bay: '🔩',
  research_lab: '🔬',
  medical_bay: '⚕️',
  roster_expansion: '🏭',
  storage_facility: '📦',
  coaching_staff: '📋',
  booking_office: '🏆',
  combat_training_academy: '⚔️',
  defense_training_academy: '🛡️',
  mobility_training_academy: '🦿',
  ai_training_academy: '🤖',
  income_generator: '💰',
};

const categoryEmojis = {
  economy: '💰',
  capacity: '📦',
  training: '🎓',
  advanced: '⭐',
};
```

### Future Enhancement Assets (Phase 3+)

**Optional Additions:**
- Facility background images (1920×1080px, used as page backgrounds)
- Animated facility icons (Lottie JSON animations)
- Facility level-up effects (particle systems, glows)
- Facility preview images (show upgraded facility appearance)

---

## Appendix C: Design System Alignment

### Color Palette

**Facility Cards:**
- Background: `bg-gray-800` (existing)
- Border (default): `border-gray-700`
- Border (implemented): `border-green-700/30`
- Border (not implemented): `border-yellow-600/50`

**Status Badges:**
- Active (implemented): `bg-green-700 text-green-100`
- Coming Soon: `bg-yellow-600 text-yellow-100`
- Maximum Level: `bg-green-700 text-green-100`

**Category Headers:**
- Background: `bg-gray-800`
- Border: `border-gray-700`
- Text: `text-white` (title), `text-gray-400` (description)

**Progress Bars:**
- Filled: `bg-blue-600`
- Unfilled: `bg-gray-700`
- Border: `border-gray-600`

### Typography

**Page Title:** `text-3xl font-bold` (existing)  
**Category Title:** `text-2xl font-semibold`  
**Facility Name:** `text-2xl font-semibold` (existing)  
**Facility Description:** `text-sm text-gray-400` (existing)  
**Level Indicator:** `text-2xl font-bold` (existing)  
**Benefits:** `text-sm` (current/next)  
**Cost:** `text-lg font-semibold`  

### Spacing

**Page Padding:** `container mx-auto px-4 py-8` (existing)  
**Category Margin:** `mb-8` (between categories)  
**Card Margin:** `gap-6` (existing grid gap)  
**Card Padding:** `p-6` (existing)  
**Header Padding:** `p-4` (category headers)  

### Responsive Breakpoints

- Mobile: < 640px (1 column)
- Tablet: 640px - 1023px (1-2 columns)
- Desktop: ≥ 1024px (2 columns)

---

## Appendix D: Related Documentation

### Core Documentation
- [STABLE_SYSTEM.md](STABLE_SYSTEM.md) - Complete facility system mechanics
- [ECONOMY_IMPLEMENTATION.md](ECONOMY_IMPLEMENTATION.md) - Economic context
- [ROBOT_ATTRIBUTES.md](ROBOT_ATTRIBUTES.md) - Attribute caps and training academies

### Design References
- [DESIGN_SYSTEM_AND_UX_GUIDE.md](design_ux/DESIGN_SYSTEM_AND_UX_GUIDE.md) - Design system
- [PRD_WEAPON_SHOP.md](PRD_WEAPON_SHOP.md) - Reference for filtering and views
- [PRD_BATTLE_HISTORY_PAGE_OVERHAUL.md](PRD_BATTLE_HISTORY_PAGE_OVERHAUL.md) - Reference for information density
- [PRD_MY_ROBOTS_LIST_PAGE.md](PRD_MY_ROBOTS_LIST_PAGE.md) - Card-based UI patterns

### Implementation PRDs (Future)
- PRD_REPAIR_BAY_IMPLEMENTATION.md (not yet created)
- PRD_RESEARCH_LAB_FEATURES.md (not yet created)
- PRD_MEDICAL_BAY_CRITICAL_DAMAGE.md (not yet created)
- PRD_COACHING_STAFF_BONUSES.md (not yet created)
- PRD_BOOKING_OFFICE_TOURNAMENTS.md (not yet created)
- PRD_INCOME_GENERATOR_PASSIVE_INCOME.md (not yet created)

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Feb 7, 2026 | GitHub Copilot | Initial PRD created with facility groupings, implementation status tracking, and image requirements |

---

**Document Status**: ✅ Ready for Review  
**Next Steps**: Review with owner, begin Phase 1 implementation  
**Estimated Completion**: Phase 1 by end of Q1 2026
