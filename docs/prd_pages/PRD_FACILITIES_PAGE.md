# Product Requirements Document: Facilities Page UX Overhaul

**Project**: Armoured Souls  
**Document Type**: Product Requirements Document (PRD)  
**Version**: v1.3  
**Date**: February 7, 2026  
**Author**: GitHub Copilot  
**Status**: Phase 1 & 2 Complete - Implementation Active  
**Owner**: Robert Teunissen  
**Epic**: Facilities System & Stable Management UX  
**Priority**: P2 (Medium Priority - UX Enhancement)

---

## Version History
- v1.0 - Initial PRD created (February 7, 2026)
  - Documented current implementation status (8 implemented, 6 not implemented)
  - Defined logical facility groupings (4 categories)
  - Specified image requirements (14 facility icons + 4 category icons)
  - Outlined UX improvement plan
- v1.1 - Review comments processed (February 7, 2026)
  - Corrected implementation status: Repair Bay and Income Generator are implemented (10 of 14 total)
  - Recategorized Income Generator from Advanced to Economy category
  - Clarified Medical Bay purpose (critical damage vs regular damage)
  - Removed Stable Overview Dashboard section (not priority)
  - Specified image storage path (frontend/src/assets/facilities/)
  - Clarified navigation bar purpose and open questions
  - Updated implementation counts throughout document
- v1.2 - Image format specification update (February 7, 2026)
  - Changed primary image format from SVG to WebP 256×256px
  - Added SVG as fallback format for compatibility
  - Rationale: Facilities are important expenses requiring high-quality visuals
  - Updated file naming conventions and technical specifications
  - WebP provides better visual quality with modern compression
- v1.3 - Phase 1 & 2 implementation complete (February 7, 2026)
  - Phase 1 COMPLETE: Category organization, collapsible sections, progress bars
  - Phase 2 COMPLETE: FacilityIcon component, 14 SVG icons, WebP-ready architecture
  - Removed redundant badges per user feedback (completion counts, Active badges)
  - Fixed Repair Bay discount inconsistency (10% → 5% for Level 1)
  - Updated implementation roadmap status
  - WebP generation marked as optional enhancement (SVGs sufficient)
- **v1.4 - Prestige gates documentation added (February 9, 2026)**
  - **Added Section 6: Prestige Requirements & Gating (NOT IMPLEMENTED)**
  - Documented prestige unlock requirements for facility levels
  - Specified UI requirements for prestige lock indicators
  - Added backend validation requirements
  - Cross-referenced with PRD_PRESTIGE_AND_FAME.md and STABLE_SYSTEM.md

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

**Implemented (10 facilities):**
1. ✅ **Training Facility** - Discount on attribute upgrades (5%-50%)
2. ✅ **Weapons Workshop** - Discount on weapon purchases (5%-50%)
3. ✅ **Repair Bay** - Discount on repair costs (10%-55%)
4. ✅ **Roster Expansion** - Increase robot slots (1→10 robots)
5. ✅ **Storage Facility** - Increase weapon storage (5→55 weapons)
6. ✅ **Combat Training Academy** - Combat Systems caps (10→50)
7. ✅ **Defense Training Academy** - Defensive Systems caps (10→50)
8. ✅ **Mobility Training Academy** - Chassis & Mobility caps (10→50)
9. ✅ **AI Training Academy** - AI/Team Coordination caps (10→50)
10. ✅ **Income Generator** - Passive income streams (merchandising, streaming)

**Not Yet Implemented (4 facilities):**
1. ❌ **Research Lab** - Unlock analytics, loadout presets, battle simulation
2. ❌ **Medical Bay** - Critical damage repair cost reduction (15%-100%)
   - *Note: Medical Bay handles critical/permanent damage, while Repair Bay handles regular battle damage. Different systems.*
3. ❌ **Coaching Staff** - Stable-wide stat bonuses (coaches for offense/defense/tactics)
4. ❌ **Booking Office** - Tournament access and enhanced rewards

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
- **[PRD_ECONOMY_SYSTEM.md](prd_core/PRD_ECONOMY_SYSTEM.md)**: Economic context for facility investments (see Implementation History section)

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

1. **Implement Logical Facility Grouping**: Organize facilities into clear categories 
2. **Improve Implementation Clarity**: Make it immediately obvious which facilities are functional
3. **Document Image Requirements**: Specify all facility images needed for visual enhancement
4. **Enhance Visual Hierarchy**: Use design system patterns to create clear visual distinction between facility types
5. **Add Category Navigation**: Enable quick jumping between facility categories
6. **Improve Information Density**: Show more relevant information without increasing scroll length

### Success Metrics

- Players can identify facility categories without reading all facility names (visual clarity test)
- 95%+ of players understand which facilities are implemented vs. planned
- Time to find specific facility reduced by 50% through categorization
- Image asset list is complete and actionable for asset creation
- Page maintains current scroll length despite added organization
- Mobile responsiveness preserved with category organization
- All facility cards align with design system color palette and spacing

### Non-Goals (Out of Scope for This PRD)

- ❌ Implementation of actual backend logic for remaining 4 facilities (separate PRDs)
- ❌ Creation of actual facility images/icons (design asset work, can use AI generation)
- ❌ Advanced features like upgrade recommendations or batch upgrades (Phase 2+)
- ❌ Facility unlock system or progression gating (future enhancement)
- ❌ Detailed ROI calculations or payback analysis (future feature)

---

## Detailed Requirements

### 1. Facility Organization & Grouping

#### 1.1 Facility Categories

**Category 1: Economy & Discounts** (4 facilities)
- **Purpose**: Reduce operational costs and unlock passive income across the stable
- **Strategic Value**: High ROI, should be prioritized early-game
- **Facilities**:
  1. Training Facility (✅ Implemented) - Attribute upgrade discounts
  2. Weapons Workshop (✅ Implemented) - Weapon purchase discounts
  3. Repair Bay (✅ Implemented) - Repair cost discounts
  4. Income Generator (✅ Implemented) - Passive income from merchandising & streaming 

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

**Category 4: Advanced Features** (3 facilities)
- **Purpose**: Unlock special features and advanced gameplay mechanics
- **Strategic Value**: Late-game enhancements, not required for basic progression
- **Facilities**:
  1. Research Lab (❌ Not Implemented) - Analytics, loadout presets, battle simulation
  2. Medical Bay (❌ Not Implemented) - Critical damage repair reduction (different from Repair Bay's regular damage)
  3. Coaching Staff (❌ Not Implemented) - Stable-wide stat bonuses
  4. Booking Office (❌ Not Implemented) - Tournament access and rewards

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
│ 💰 Economy & Discounts                          [4 of 4 ✓]  │
│ Reduce operational costs and unlock passive income          │
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
3. Repair Bay (combat damage)
4. Income Generator (passive income)

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

No icon / image on the Visual Example?

#### 2.2 Category-Level Status Summary

**Requirements:**
- Each category header shows implementation count
- Visual progress indicator: `[3 of 3 ✓]`, `[4 of 4 ✓]`, `[0 of 5]`
- Color-coded: Green for 100%, Yellow for partial, Gray for 0%

**Examples:**
- Economy & Discounts: `[4 of 4 ✓]` (Green - 100% implemented)
- Capacity & Storage: `[2 of 2 ✓]` (Green - 100% implemented)
- Training Academies: `[4 of 4 ✓]` (Green - 100% implemented)
- Advanced Features: `[0 of 4]` (Gray - 0% implemented) 

### 3. Image Requirements

#### 3.1 Facility Icons/Illustrations

**Purpose**: Provide visual identity for each facility type to aid recognition and navigation. Facilities represent significant player investments and require high-quality visual representation.

**Image Specifications:**
- **Primary Format**: WebP (modern compression, high quality)
- **Fallback Format**: SVG (scalable vector graphics for compatibility)
- **Size**: 256×256px (WebP), scalable (SVG)
- **Display Sizes**: 64×64px (card header), 128×128px (detail view), 256×256px (modal/expanded view)
- **Style**: Consistent art direction matching Armoured Souls robot aesthetic
- **Color Palette**: Match design system (gray, blue, green, yellow accents)
- **Background**: Transparent background
- **File Naming**: 
  - Primary: `facility-{type}-icon.webp` (e.g., `facility-training-facility-icon.webp`)
  - Fallback: `facility-{type}-icon.svg` (e.g., `facility-training-facility-icon.svg`)
- **Storage Path**: `/prototype/frontend/src/assets/facilities/` (create this directory)
- **Loading Strategy**: Load WebP first, fallback to SVG if WebP not supported or fails to load

**Rationale for WebP Primary:**
- Facilities are important economic investments (costs ranging from ₡150K to ₡5M)
- Players need to clearly see what they're investing in
- 256×256 WebP provides superior visual quality while maintaining small file sizes (~10-30KB)
- Modern browsers have excellent WebP support (95%+ coverage)
- SVG fallback ensures universal compatibility

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
- Use emoji placeholders until WebP assets are created (🏋️, 🔧, 🔩, etc.)
- Phase 1: Emoji icons (immediate)
- Phase 2: WebP 256×256px icons with SVG fallback (primary implementation)
- Phase 3: Enhanced visuals with animations (future)

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

**Considerations:**
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

---

## 6. Prestige Requirements & Gating

**Status**: ❌ **NOT IMPLEMENTED**

**Reference**: See [PRD_PRESTIGE_AND_FAME.md](prd_core/PRD_PRESTIGE_AND_FAME.md) and [STABLE_SYSTEM.md](STABLE_SYSTEM.md) for complete prestige system specification.

### 6.1 Overview

Many facility levels require prestige thresholds to unlock. Players must earn prestige through battles, tournaments, and milestones before they can purchase these facility upgrades. This creates a progression system that rewards long-term play and stable success.

**User Story**: "As a player, I want to see which facility levels require prestige so I can plan my progression and understand what I need to unlock advanced upgrades."

### 6.2 Prestige Requirements by Facility

**Facilities with Prestige Gates** (from STABLE_SYSTEM.md):

**Repair Bay:**
- Level 4: 1,000 prestige
- Level 7: 5,000 prestige
- Level 9: 10,000 prestige

**Training Facility:**
- Level 4: 1,000 prestige
- Level 7: 5,000 prestige
- Level 9: 10,000 prestige

**Weapons Workshop:**
- Level 4: 1,500 prestige
- Level 7: 5,000 prestige
- Level 9: 10,000 prestige

**Research Lab:**
- Level 4: 2,000 prestige
- Level 7: 7,500 prestige
- Level 9: 15,000 prestige

**Medical Bay:**
- Level 4: 2,000 prestige
- Level 7: 7,500 prestige
- Level 9: 15,000 prestige

**Roster Expansion:**
- Level 4: 1,000 prestige
- Level 7: 5,000 prestige
- Level 9: 10,000 prestige

**Coaching Staff:**
- Level 3: 2,000 prestige
- Level 6: 5,000 prestige
- Level 9: 10,000 prestige

**Booking Office:**
- Level 1: 1,000 prestige
- Level 2: 2,500 prestige
- Level 3: 5,000 prestige
- Level 4: 10,000 prestige
- Level 5: 15,000 prestige
- Level 6: 20,000 prestige
- Level 7: 25,000 prestige
- Level 8: 35,000 prestige
- Level 9: 45,000 prestige
- Level 10: 50,000 prestige

**Combat Training Academy:**
- Level 3: 2,000 prestige
- Level 5: 4,000 prestige
- Level 7: 7,000 prestige
- Level 9: 10,000 prestige
- Level 10: 15,000 prestige

**Defense Training Academy:**
- Level 3: 2,000 prestige
- Level 5: 4,000 prestige
- Level 7: 7,000 prestige
- Level 9: 10,000 prestige
- Level 10: 15,000 prestige

**Mobility Training Academy:**
- Level 3: 2,000 prestige
- Level 5: 4,000 prestige
- Level 7: 7,000 prestige
- Level 9: 10,000 prestige
- Level 10: 15,000 prestige

**AI Training Academy:**
- Level 3: 2,000 prestige
- Level 5: 4,000 prestige
- Level 7: 7,000 prestige
- Level 9: 10,000 prestige
- Level 10: 15,000 prestige

**Income Generator:**
- Level 4: 3,000 prestige
- Level 7: 7,500 prestige
- Level 9: 15,000 prestige

### 6.3 UI Requirements

#### 6.3.1 Prestige Lock Indicators

**Locked Facility Levels:**
- Display lock icon (🔒) next to level indicator
- Show prestige requirement in red text: "Requires 5,000 prestige"
- Disable upgrade button with "Locked" state
- Reduce card opacity to 0.7 to indicate unavailable

**Visual Example:**
```
┌──────────────────────────────────────────────────── [✓ Active]
│ 🏋️  Training Facility                       ▓▓▓░░░░░░░ 3/10
│     Reduces costs for upgrading robot attributes
│ 
│ ✓ Current:  💰 15% discount on attribute upgrades
│ → Next:     💰 20% discount on attribute upgrades
│ 
│ Cost: ₡1,200,000                              
│ 🔒 Requires 1,000 prestige (You have: 750)
│                                          [Locked]
└─────────────────────────────────────────────────────────────
```

**Unlocked Facility Levels:**
- No lock icon
- Normal opacity
- Upgrade button enabled (if credits available)
- Show prestige requirement met: "✓ Prestige requirement met"

#### 6.3.2 Prestige Progress Tooltip

**Hover/Click Tooltip:**
- Show current prestige: "Your prestige: 750"
- Show required prestige: "Required: 1,000"
- Show progress bar: `▓▓▓▓▓▓▓░░░ 75%`
- Show how to earn prestige: "Earn prestige by winning battles and tournaments"
- Link to prestige leaderboard: "View Prestige Leaderboard →"

#### 6.3.3 Prestige Indicator in Facility Card Header

**Add to each facility card:**
- Small prestige icon (⭐) next to level indicator if any levels require prestige
- Tooltip on hover: "Some levels require prestige to unlock"

### 6.4 Backend Requirements

#### 6.4.1 FacilityConfig Interface Update

**Current Interface** (in `facilities.ts`):
```typescript
export interface FacilityConfig {
  type: string;
  name: string;
  description: string;
  maxLevel: number;
  costs: number[];
  benefits: string[];
  implemented: boolean;
}
```

**Required Update**:
```typescript
export interface FacilityConfig {
  type: string;
  name: string;
  description: string;
  maxLevel: number;
  costs: number[];
  benefits: string[];
  implemented: boolean;
  prestigeRequirements?: number[]; // NEW: Prestige required for each level (sparse array)
}
```

**Example Implementation**:
```typescript
{
  type: 'training_facility',
  name: 'Training Facility',
  description: 'Reduces costs for upgrading robot attributes',
  maxLevel: 10,
  costs: [150000, 300000, 450000, 600000, 750000, 900000, 1100000, 1400000, 1750000, 2250000],
  benefits: [...],
  implemented: true,
  prestigeRequirements: [
    undefined, // Level 1: no prestige required
    undefined, // Level 2: no prestige required
    undefined, // Level 3: no prestige required
    1000,      // Level 4: 1,000 prestige required
    undefined, // Level 5: no prestige required
    undefined, // Level 6: no prestige required
    5000,      // Level 7: 5,000 prestige required
    undefined, // Level 8: no prestige required
    10000,     // Level 9: 10,000 prestige required
    undefined, // Level 10: no prestige required
  ],
}
```

#### 6.4.2 Upgrade Validation

**Update `POST /api/facilities/upgrade` endpoint:**

```typescript
// Pseudo-code for validation
async function upgradeFacility(userId: string, facilityType: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const facility = await getUserFacility(userId, facilityType);
  const config = getFacilityConfig(facilityType);
  
  const targetLevel = facility.level + 1;
  
  // NEW: Check prestige requirement
  if (config.prestigeRequirements && config.prestigeRequirements[targetLevel - 1]) {
    const requiredPrestige = config.prestigeRequirements[targetLevel - 1];
    if (user.prestige < requiredPrestige) {
      throw new Error(
        `Insufficient prestige. Required: ${requiredPrestige}, You have: ${user.prestige}`
      );
    }
  }
  
  // Existing credit validation
  const cost = config.costs[targetLevel - 1];
  if (user.credits < cost) {
    throw new Error('Insufficient credits');
  }
  
  // Perform upgrade...
}
```

#### 6.4.3 API Response Enhancement

**`GET /api/facility` response structure:**

```typescript
interface FacilityAPIResponse {
  facilities: FacilityResponse[];  // Array of facility objects
  userPrestige: number;             // User's current prestige
  userCurrency: number;             // User's current currency
  robotCount: number;               // Number of robots (for repair bay discount calculation)
}

interface FacilityResponse {
  type: string;
  name: string;
  description: string;
  currentLevel: number;
  maxLevel: number;
  currentBenefit: string | null;
  nextLevelBenefit: string | null;
  upgradeCost: number | null;
  implemented: boolean;
  // Prestige fields:
  prestigeRequired: number | null;  // Prestige required for next level
  prestigeMet: boolean;              // Whether user has enough prestige
  canUpgrade: boolean;               // Credits AND prestige requirements met
  canAfford: boolean;                // Whether user has enough currency
  hasPrestige: boolean;              // Whether user meets prestige requirement
}
```

**Note**: The endpoint returns an object containing the facilities array plus user context data, not a bare array. This enables the frontend to display user prestige and currency without additional API calls.
```

### 6.5 Frontend Requirements

#### 6.5.1 Component Updates

**FacilityCard Component:**
- Display lock icon if `prestigeRequired > 0 && !prestigeMet`
- Show prestige requirement text
- Disable upgrade button if `!canUpgrade`
- Add prestige progress tooltip

**FacilitiesPage Component:**
- Fetch user prestige from API
- Pass prestige data to facility cards
- Display user's current prestige in page header

#### 6.5.2 User Prestige Display

**Add to page header:**
```
┌─────────────────────────────────────────────────────────────┐
│ Facilities                                                   │
│ Your Prestige: 750 ⭐ (Novice)                               │
└─────────────────────────────────────────────────────────────┘
```

### 6.6 Testing Requirements

**Unit Tests:**
- Prestige validation logic
- FacilityConfig with prestigeRequirements
- API response includes prestige fields

**Integration Tests:**
- Upgrade blocked when prestige insufficient
- Upgrade succeeds when prestige sufficient
- Error messages display correctly

**UI Tests:**
- Lock icons display on locked facilities
- Tooltips show prestige requirements
- Upgrade button disabled state

### 6.7 Implementation Priority

**Priority**: P0 (Critical)

**Rationale**: 
- Prestige gates are documented in STABLE_SYSTEM.md as core progression mechanic
- Without enforcement, players can bypass intended progression
- Creates strategic depth and long-term goals

**Estimated Effort**: 2-3 days
- Backend: 1 day (config updates, validation, API changes)
- Frontend: 1-2 days (UI components, tooltips, testing)

---

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

**Phase 1: Placeholder Icons (Immediate - Current)**
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

**Phase 2: WebP with SVG Fallback (Primary Implementation)**

**Component Pattern:**
```typescript
import { useState, useEffect } from 'react';

interface FacilityIconProps {
  facilityType: string;
  alt: string;
  className?: string;
}

const FacilityIcon: React.FC<FacilityIconProps> = ({ facilityType, alt, className }) => {
  const webpSrc = `/assets/facilities/facility-${facilityType}-icon.webp`;
  const svgSrc = `/assets/facilities/facility-${facilityType}-icon.svg`;
  
  return (
    <picture>
      <source srcSet={webpSrc} type="image/webp" />
      <img 
        src={svgSrc} 
        alt={alt}
        className={className || "w-16 h-16"}
        loading="lazy"
      />
    </picture>
  );
};

// Usage in FacilityCard
<FacilityIcon 
  facilityType={facility.type}
  alt={facility.name}
  className="w-16 h-16"
/>
```

**Browser Compatibility:**
- Modern browsers (Chrome, Firefox, Edge, Safari): Load WebP for optimal quality
- Older browsers: Automatically fallback to SVG
- Lazy loading: Defer off-screen images for performance

**File Structure:**
```
/prototype/frontend/src/assets/facilities/
├── facility-training-facility-icon.webp    (256×256px)
├── facility-training-facility-icon.svg     (fallback)
├── facility-weapons-workshop-icon.webp     (256×256px)
├── facility-weapons-workshop-icon.svg      (fallback)
└── ... (28 files total)
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

### Phase 1: Organization & Clarity - ✅ COMPLETE

**Status**: Completed February 7, 2026

**Tasks:**
1. ✅ Create PRD document with facility groupings and image requirements
2. ✅ Add facility category metadata to frontend constants
3. ✅ Implement facility grouping logic (client-side)
4. ✅ Create collapsible category sections
5. ✅ Add emoji placeholders for facility icons
6. ✅ Enhance implementation status badges
7. ✅ Update FacilityCard styling with progress bars
8. ✅ Removed redundant category completion counts (user feedback)
9. ✅ Test responsive layout with categories
10. ⬜ Update tests for new structure (deferred)

**Deliverables:**
- ✅ PRD_FACILITIES_PAGE_OVERHAUL.md (v1.2)
- ✅ Organized Facilities page with 4 clear categories
- ✅ Enhanced implementation status visibility (Coming Soon badges only)
- ✅ Category-based organization with collapse/expand functionality
- ✅ Progress bars showing facility level advancement

### Phase 2: Visual Enhancement - ✅ COMPLETE

**Status**: Completed February 7, 2026  
**Actual Effort**: ~8 hours (asset creation + implementation)

**Tasks:**
1. ✅ Design and create 14 facility SVG icons (256×256px) - COMPLETED
2. ✅ Implement FacilityIcon component with WebP/SVG fallback logic - COMPLETED
3. ✅ Replace emoji placeholders with SVG icons (WebP ready) - COMPLETED
4. ✅ Enhance facility card visual design - COMPLETED
5. ✅ Integration testing and verification - COMPLETED
6. ⬜ Design and create 4 category SVG icons - DEFERRED (using emoji)
7. ⬜ Generate WebP versions (256×256px) - OPTIONAL ENHANCEMENT
8. ⬜ Implement CategoryNavigation sticky bar - FUTURE
9. ⬜ Add smooth scroll to category sections - FUTURE
10. ⬜ Add hover effects and transitions - FUTURE

**Deliverables:**
- ✅ 14 facility SVG icons (1-2KB each, professionally themed)
- ✅ FacilityIcon component with three-tier fallback (WebP → SVG → emoji)
- ✅ Assets directory with complete documentation
- ✅ Integration into FacilitiesPage
- ⬜ 4 category SVG icons (using emoji placeholders)
- ⬜ 14 facility WebP icons (optional future enhancement)

**Notes:**
- SVG icons sufficient for current needs (1-2KB vs target 10-30KB WebP)
- WebP generation optional quality enhancement for Phase 3+
- Component supports WebP when available (future-ready)

### Phase 3: Advanced Features (Future)

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
- A) Detailed realistic icons (matches robot aesthetics)
- B) Simple iconic symbols (faster to create, scales better at small sizes)
- C) Hybrid approach (simple shapes with detailed textures)

**Owner Response**: Icons can be AI-generated as needed. Production cost is not a concern.

**Recommendation**: Start with Option B (simple iconic) for Phase 1, use AI generation for quick iteration.

### 2. Category Navigation & Collapsing
**Question**: Should categories be collapsible to reduce page length?  
**Options**:
- A) All categories always expanded (current scroll length ~doubled)
- B) All categories collapsible, remember user preference
- C) Advanced features category collapsed by default, others expanded

**Owner Response**: Navigation bar is proposed to enable quick jumping between categories without scrolling. This is the primary solution for page length management.

**Recommendation**: Option C - Collapse "Advanced Features" by default since they are not implemented. Navigation bar provides quick access without scrolling.

### 3. Not-Implemented Facility Display
**Question**: How prominently should not-yet-implemented facilities be shown?  
**Options**:
- A) Full display with large "Coming Soon" badge (current approach)
- B) Reduced opacity and moved to bottom of category
- C) Collapsible "Coming Soon" section that hides them by default
- D) Only show implemented facilities, list others in "Roadmap" section

**Owner Response**: All facilities except "Advanced Features" are implemented. Advanced Features can go in a separate collapsed section.

**Recommendation**: Option C - Advanced Features category collapsed by default with clear "Coming Soon" indicators. All 10 implemented facilities displayed prominently.

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

#### Repair Bay (✅ Implemented)
- **Type**: `repair_bay`
- **Max Level**: 10
- **Cost Range**: ₡200K - ₡3M (total: ₡12.7M)
- **Benefits**: Multi-robot discount on repair costs (formula: Level × (5 + Active Robots), capped at 90%)
  - **Single Robot**: 5%-50% discount (Level 1-10)
  - **Multiple Robots**: Discount increases with roster size
  - **Examples**:
    - Level 1 + 4 robots = 9% discount
    - Level 5 + 7 robots = 60% discount
    - Level 6 + 10 robots = 90% discount (cap reached)
  - **⚠️ 90% Cap Warning**: Further investment provides no additional benefit once cap is reached
    - With 10 robots: Stop at Level 6 (saves ₡4.5M on Levels 7-10)
    - With 9 robots: Stop at Level 7 (saves ₡3M on Levels 8-10)
    - With 8 robots: Stop at Level 8 (saves ₡1.5M on Levels 9-10)
- **Strategic Value**: Important - Critical for managing battle damage repair costs, especially valuable with multiple robots
- **Implementation Status**: Fully implemented with multi-robot discount formula, discount applies to robot repair costs after battles

#### Income Generator (✅ Implemented)
- **Type**: `income_generator`
- **Max Level**: 10
- **Cost Range**: ₡800K - ₡5M (total: ₡28M)
- **Benefits**: Passive income from merchandising (unlocked at L1) and streaming (unlocked at L3), scales with prestige and battles
- **Strategic Value**: Important - Provides passive income to supplement battle earnings
- **Implementation Status**: Fully implemented, provides daily passive income from merchandising and streaming

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
- **Strategic Value**: Advanced - Handles critical/permanent damage (different from Repair Bay's regular damage)
- **Implementation Status**: Not yet implemented (requires critical damage system separate from regular battle damage)

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

---

## Appendix B: Image Asset Specifications

### Facility Icons (14 assets - Dual Format)

**Primary Format: WebP**

**File Naming Convention**: `facility-[facility-type]-icon.webp`

**Technical Specs:**
- Format: WebP
- Resolution: 256×256px
- Quality: 85-90% (balance quality and file size)
- File Size Target: 10-30KB per file
- Color Palette: Match design system (neutral grays with colored accents)
- Transparency: Yes (alpha channel support)
- Optimization: Use imagemin-webp or similar tools

**Fallback Format: SVG**

**File Naming Convention**: `facility-[facility-type]-icon.svg`

**Technical Specs:**
- Format: SVG (vector)
- Canvas Size: 256×256px
- Display Sizes: 64×64px (card header), 128×128px (detail view), 256×256px (modal)
- Color Palette: Match design system (neutral grays with colored accents)
- Transparency: Yes (transparent background)
- Optimization: SVGO optimized, < 10KB per file
- Fallback Strategy: Used when WebP not supported or fails to load

**Loading Implementation:**
```typescript
// React component pattern
<picture>
  <source srcset="facility-training-facility-icon.webp" type="image/webp" />
  <img src="facility-training-facility-icon.svg" alt="Training Facility" />
</picture>
```

**Individual Asset List (Dual Format Required):**

1. `facility-training-facility-icon.webp` + `.svg` - Robot exercising/training equipment
2. `facility-weapons-workshop-icon.webp` + `.svg` - Weapons on workbench, forge imagery
3. `facility-repair-bay-icon.webp` + `.svg` - Repair tools, wrench, maintenance equipment
4. `facility-research-lab-icon.webp` + `.svg` - Computer screens, data analytics, graphs
5. `facility-medical-bay-icon.webp` + `.svg` - Medical cross, healing beams
6. `facility-roster-expansion-icon.webp` + `.svg` - Multiple robot silhouettes, hangar door
7. `facility-storage-facility-icon.webp` + `.svg` - Weapon racks, storage containers
8. `facility-coaching-staff-icon.webp` + `.svg` - Coach clipboard, tactical whiteboard
9. `facility-booking-office-icon.webp` + `.svg` - Trophy, tournament bracket, schedule
10. `facility-combat-training-academy-icon.webp` + `.svg` - Weapon targeting reticle
11. `facility-defense-training-academy-icon.webp` + `.svg` - Shield, defensive barrier
12. `facility-mobility-training-academy-icon.webp` + `.svg` - Robot legs, movement trails
13. `facility-ai-training-academy-icon.webp` + `.svg` - Circuit board, neural network
14. `facility-income-generator-icon.webp` + `.svg` - Currency symbol, media/merchandise

**Total Assets Required**: 28 files (14 WebP + 14 SVG)

**WebP Format Benefits:**
- **Superior Quality**: 256×256px resolution provides crisp, detailed visuals at all display sizes
- **Small File Size**: 25-50% smaller than PNG while maintaining higher quality
- **Modern Compression**: Lossy and lossless compression options
- **Alpha Channel**: Full transparency support like PNG
- **Wide Support**: 95%+ browser coverage (Chrome, Firefox, Edge, Safari 14+, Opera)
- **Future-Proof**: Industry standard for web images
- **Appropriate for Investment**: High-quality visuals match the significance of facility investments (₡150K-₡5M)

**SVG Fallback Benefits:**
- **Universal Compatibility**: Works on all browsers including older versions
- **Scalability**: Vector format scales perfectly at any size
- **Small File Size**: < 10KB optimized
- **Reliability**: Guaranteed to work when WebP is not supported

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
- Facility background images (1920×1080px WebP with JPG fallback, used as page backgrounds)
- Animated facility icons (Lottie JSON animations or animated WebP)
- Facility level-up effects (particle systems, glows - CSS/Canvas)
- Facility preview images (show upgraded facility appearance - WebP format)

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
- [PRD_ECONOMY_SYSTEM.md](prd_core/PRD_ECONOMY_SYSTEM.md) - Economic context (see Implementation History section)
- [ROBOT_ATTRIBUTES.md](ROBOT_ATTRIBUTES.md) - Attribute caps and training academies

### Design References
- [DESIGN_SYSTEM_AND_UX_GUIDE.md](design_ux/DESIGN_SYSTEM_AND_UX_GUIDE.md) - Design system
- [PRD_WEAPON_SHOP.md](PRD_WEAPON_SHOP.md) - Reference for filtering and views
- [PRD_BATTLE_HISTORY_PAGE_OVERHAUL.md](PRD_BATTLE_HISTORY_PAGE_OVERHAUL.md) - Reference for information density
- [PRD_MY_ROBOTS_LIST_PAGE.md](PRD_MY_ROBOTS_LIST_PAGE.md) - Card-based UI patterns
