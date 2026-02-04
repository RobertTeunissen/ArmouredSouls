# Product Requirements Document: Weapon Shop Design

**Last Updated**: February 4, 2026  
**Status**: Implementation In Progress  
**Owner**: Robert Teunissen  
**Epic**: Weapon Shop & Inventory System  
**Priority**: P1 (High Priority - Core Gameplay Feature)

**Revision History:**
- v1.0 (Feb 4, 2026): Initial PRD created
- v1.1 (Feb 4, 2026): Added table view mode, fixed implementation roadmap status markers, added backend requirements analysis
- v1.2 (Feb 4, 2026): Implementation started - Phase 1 (View Mode Toggle) completed
- v1.3 (Feb 4, 2026): Phase 2 (Filtering System) completed
- v1.4 (Feb 4, 2026): Phase 3 core features (Search & Sort) completed
- v1.5 (Feb 4, 2026): Phase 2 (Comparison Mode) completed - All 4 core phases done
- v1.6 (Feb 4, 2026): Added collapsible filters, owned indicator, detail modal, table improvements. Updated Critical Features Status. Added Chapter 7 (Weapon Card View Modes). Added Appendix B (Weapon Images Documentation).

> **⚠️ COMPREHENSIVE DESIGN DOCUMENT**: This PRD defines the complete Weapon Shop experience, designed to scale from the current 23 weapons to hundreds of weapons in future phases. It establishes patterns for discovery, comparison, filtering, and purchasing that maintain usability at any catalog size.

---

## Executive Summary

This PRD defines the comprehensive design requirements for the Weapon Shop page (`/weapon-shop`) in Armoured Souls. The Weapon Shop is a critical economic interface where players browse, compare, and purchase weapons for their robot stable. The design must support **scalability from 23 weapons to hundreds of weapons** while maintaining intuitive navigation, clear value comparison, and strategic decision-making.

**Key Design Challenges:**
- **Scalability**: Support browsing 100+ weapons without overwhelming users
- **Comparison**: Enable quick comparison of weapon stats, bonuses, and cost-effectiveness
- **Discovery**: Help players find the right weapon for their strategy (loadout type, attribute focus, budget)
- **View Flexibility**: Provide both card view (visual, detailed) and table view (compact, scannable) layouts
- **Education**: Clearly communicate weapon value, DPS, attribute bonuses, and loadout compatibility
- **Economy Integration**: Display costs, discounts, storage capacity, and affordability

**Success Criteria**: 
- Players can find desired weapons in <30 seconds even with 100+ weapon catalog
- 90%+ of purchases are made with clear understanding of weapon stats and value
- Filtering and sorting reduces visible weapons to <20 relevant options
- Comparison tools enable side-by-side evaluation of 2-3 weapons
- Users can seamlessly toggle between card view and table view with all filters/sorting maintained
- Table view enables quick scanning of 20+ weapons at once
- Storage capacity and affordability constraints are immediately visible
- Weapon discovery feels like browsing a high-tech armory, not a spreadsheet

**Impact**: Establishes the primary economic interface for weapon acquisition, directly influencing player strategy, loadout diversity, and economic decision-making throughout the game lifecycle.

---

## Background & Context

### Current State

#### ✅ **Fully Implemented**

**Database & Backend:**
- ✅ Complete weapon catalog: 23 weapons defined with full specifications (see [PRD_WEAPON_ECONOMY_OVERHAUL.md](PRD_WEAPON_ECONOMY_OVERHAUL.md))
- ✅ Database schema: Weapon model with all attributes (baseDamage, cost, 15 attribute bonuses)
- ✅ Backend API: `GET /api/weapons` (returns all weapons)
- ✅ Backend API: `POST /api/weapon-inventory/purchase` (purchase weapon)
- ✅ Backend API: `GET /api/weapon-inventory/storage-status` (storage capacity tracking)
- ✅ Weapon Workshop discount system: 5% per level, up to 50% (see [STABLE_SYSTEM.md](STABLE_SYSTEM.md))
- ✅ Storage capacity system: 5 base + (5 × Storage Facility Level), max 55 weapons
- ✅ Weapon pricing formula: DPS-inclusive exponential pricing (fair value across all weapons)

**Frontend - Basic Shop:**
- ✅ WeaponShopPage component (`prototype/frontend/src/pages/WeaponShopPage.tsx`)
- ✅ Weapon card display with name, type, damage, cost, attribute bonuses
- ✅ Purchase functionality with credit validation
- ✅ Storage capacity indicator (X/Y format)
- ✅ Weapon Workshop discount calculation and display
- ✅ Loading states, error handling, purchase confirmation
- ✅ Authentication integration

**Documentation:**
- ✅ Design System Guide: Weapon Shop section ([DESIGN_SYSTEM_AND_UX_GUIDE.md](design_ux/DESIGN_SYSTEM_AND_UX_GUIDE.md))
- ✅ Weapon catalog specification ([WEAPONS_AND_LOADOUT.md](WEAPONS_AND_LOADOUT.md))
- ✅ Weapon economy pricing ([PRD_WEAPON_ECONOMY_OVERHAUL.md](PRD_WEAPON_ECONOMY_OVERHAUL.md))

#### 🚧 **Partially Implemented**

**Current UI Limitations:**
- ⚠️ **Basic grid layout**: Works for 23 weapons but will not scale to 100+ weapons
- ⚠️ **No filtering system**: Cannot filter by loadout type, weapon type, price range, or attribute focus
- ⚠️ **No sorting options**: Cannot sort by cost, damage, DPS, or attribute totals
- ⚠️ **Limited comparison**: Side-by-side comparison not available
- ⚠️ **Basic search**: No text search for weapon names or descriptions
- ⚠️ **Static display**: All weapons always visible (no pagination or infinite scroll)

#### ❌ **Not Yet Implemented**

**Critical Features Status:**

**Discovery & Navigation (for 100+ weapons):**
- ✅ **Advanced filtering system**: Filter by multiple criteria simultaneously (IMPLEMENTED Phase 1)
  - ✅ Loadout type (Single, Weapon+Shield, Two-Handed, Dual-Wield)
  - ✅ Weapon type (Melee, Ballistic, Energy, Shield)
  - ✅ Price range (Budget: <₡100K, Mid: ₡100-300K, Premium: ₡300K+, Luxury: ₡500K+)
  - ✅ "Can Afford" quick filter based on user credits
  - ✅ Filter panel is collapsible to save screen space
- ✅ **Multi-criteria sorting**: Sort by name, price (asc/desc), damage, DPS (IMPLEMENTED Phase 3)
- ✅ **Text search**: Search weapon names, descriptions, types, and loadout types (IMPLEMENTED Phase 3)
- ❌ **Smart recommendations**: "Recommended for your robots" based on current loadout gaps
- ❌ **Recently viewed**: Track and display recently browsed weapons

**Comparison & Analysis:**
- ✅ **Comparison mode**: Select 2-3 weapons for side-by-side detailed comparison (IMPLEMENTED Phase 2)
- ✅ **Value analysis**: Show cost-per-damage, DPS-per-₡1K, attributes-per-₡1K efficiency metrics (IMPLEMENTED Phase 2)
- ❌ **Loadout preview**: "How will this weapon affect my robot's stats?" calculator
- ❌ **Alternative suggestions**: "Similar weapons" or "Better value options"
- ✅ **Owned indicator**: Visual badge showing "Already Own (X)" for owned weapons (IMPLEMENTED)

**Enhanced Display:**
- ✅ **Weapon illustrations**: 256×256px weapon artwork/placeholders (IMPLEMENTED Phase 4 - SVG placeholders ready for artwork)
- ✅ **View mode toggle**: Switch between card view and table view (IMPLEMENTED Phase 4)
- ✅ **Card view**: Visual, detailed weapon cards with images (IMPLEMENTED)
- ✅ **Table view**: Compact, scannable table layout with sortable columns including cooldown (IMPLEMENTED)
- ✅ **Weapon detail modal**: Click weapon name/image to open full detail modal (IMPLEMENTED)
- ❌ **Compact/Detailed view toggle**: Switch between compact and detailed card sizes (card view only)
- ❌ **Attribute visualization**: Bar charts or radial charts for attribute distributions
- ✅ **DPS calculation display**: Show calculated DPS in table and detail views (IMPLEMENTED)
- ✅ **Loadout compatibility**: Displayed on all weapon cards and detail modal (IMPLEMENTED)

**Economic Context:**
- ❌ **Batch purchase**: "Add to cart" system for buying multiple weapons
- ❌ **Price history**: Show if weapon price recently changed
- ❌ **Discount forecast**: "Your next Weapons Workshop upgrade will save ₡X on this weapon"
- ❌ **Financing visualization**: "This weapon costs X% of your total credits"

**Educational Features:**
- ❌ **Weapon guides**: Tooltips explaining weapon types, attributes, loadout mechanics
- ❌ **First-time user tutorial**: Guided tour of filtering, comparison, and purchasing
- ❌ **Weapon tooltips**: Hover/tap to see detailed breakdowns without opening full card
- ❌ **Build suggestions**: "Popular with [Loadout Type]" tags based on game data

### Design References

- **[DESIGN_SYSTEM_AND_UX_GUIDE.md](design_ux/DESIGN_SYSTEM_AND_UX_GUIDE.md)**: Complete design system specification (lines 458-525)
- **[WEAPONS_AND_LOADOUT.md](WEAPONS_AND_LOADOUT.md)**: Weapon catalog and loadout system
- **[PRD_WEAPON_ECONOMY_OVERHAUL.md](PRD_WEAPON_ECONOMY_OVERHAUL.md)**: Weapon pricing and economy
- **[STABLE_SYSTEM.md](STABLE_SYSTEM.md)**: Weapons Workshop discount system
- **[ROBOT_ATTRIBUTES.md](ROBOT_ATTRIBUTES.md)**: Complete list of 23 robot attributes
- **[PRD_MY_ROBOTS_LIST_PAGE.md](PRD_MY_ROBOTS_LIST_PAGE.md)**: Reference implementation for card-based UI patterns

### Why This Matters

**Player Experience:**
- **Decision Quality**: Better filters and comparison = better purchasing decisions
- **Time Efficiency**: Finding the right weapon quickly maintains game flow
- **Strategic Depth**: Understanding weapon value enables optimized builds
- **Reduced Regret**: Clear information prevents "bad purchase" frustration

**Game Economy:**
- **Engagement**: Well-designed shop encourages exploration and experimentation
- **Monetization Ready**: Scalable design supports future premium weapon packs
- **Balance Visibility**: Players can see weapon balance and pricing fairness

**Technical Scalability:**
- **Future-Proof**: Design patterns work for 23 or 300 weapons
- **Performance**: Filtering/sorting reduces render load for large catalogs
- **Maintainability**: Structured approach simplifies adding new weapons

---

## Goals & Objectives

### Primary Goals

1. **Scalable Discovery**: Enable efficient weapon browsing with 100+ weapon catalog
2. **Informed Decisions**: Provide complete information for strategic weapon selection
3. **Rapid Comparison**: Allow quick side-by-side evaluation of weapon options
4. **Economic Clarity**: Make costs, discounts, and affordability immediately visible
5. **Loadout Integration**: Surface loadout compatibility and robot fit analysis
6. **Visual Excellence**: Align with Direction B (Precision) design system aesthetic

### Success Metrics

**Usability:**
- Average time to find and purchase desired weapon: <60 seconds (target: 30 seconds)
- % of users who use filtering/sorting: >70%
- % of users who use comparison mode: >40%
- % of purchases made after viewing 1-3 weapons: >60% (indicates effective discovery)

**Engagement:**
- Average weapons viewed per session: 8-12 (indicates healthy browsing)
- % of sessions resulting in purchase: >30%
- Return visits to weapon shop per week: 2-3 (indicates strategic planning)

**Economic:**
- % of purchases where user can afford weapon: >95% (good affordability signaling)
- % of purchases near storage capacity limit: <10% (indicates good capacity awareness)
- % of users who upgrade Weapons Workshop within 2 weeks: >40% (discount awareness)

**Technical:**
- Page load time with 100 weapons: <2 seconds
- Filter/sort operation response: <200ms
- No performance degradation up to 500 weapons

### Non-Goals (Out of Scope for This PRD)

- ❌ **Weapon crafting/customization** (future Phase 2+ feature)
- ❌ **Weapon trading/marketplace** (future Phase 2+ feature)
- ❌ **Weapon modifications/upgrades** (separate feature)
- ❌ **Dynamic pricing** (market-based weapon prices - future consideration)
- ❌ **Auction system** (future advanced economy feature)
- ❌ **Weapon rentals** (alternative acquisition model - not planned)
- ❌ **Gacha/loot box mechanics** (not aligned with game philosophy)

---

## User Stories

### Epic: Weapon Discovery & Browsing

**US-1: Browse Weapon Catalog**
```
As a player
I want to browse the complete weapon catalog
So that I can see all available options for my robots

Acceptance Criteria:
- All weapons displayed in organized grid layout
- Weapon cards show key information (name, type, damage, cost, bonuses)
- Grid is responsive (1 column mobile, 2-3 columns tablet, 3-4 columns desktop)
- Scroll performance remains smooth with 100+ weapons
- Loading states provide feedback during data fetch
- Weapon cards are visually consistent with design system
```

**US-2: Filter Weapons by Loadout Type**
```
As a player
I want to filter weapons by loadout type
So that I only see weapons compatible with my robot's configuration

Acceptance Criteria:
- Filter tabs/buttons for: All, Single, Weapon+Shield, Two-Handed, Dual-Wield
- Clicking filter immediately updates visible weapons
- Active filter is visually highlighted
- Weapon count shown for each filter (e.g., "Two-Handed (4)")
- Filter state persists during session
- Can combine with other filters (type, price range)
```

**US-3: Filter Weapons by Type**
```
As a player
I want to filter weapons by weapon type
So that I can focus on specific weapon categories

Acceptance Criteria:
- Filter options: All, Melee, Ballistic, Energy, Shield
- Visual type badges on weapon cards
- Filter count indicators (e.g., "Energy (7)")
- Can combine with loadout type filter
- Clear filter indicators show active selections
```

**US-4: Filter Weapons by Price Range**
```
As a player
I want to filter weapons by price range
So that I can focus on weapons within my budget

Acceptance Criteria:
- Price range options: All, Budget (<₡100K), Mid (₡100-300K), Premium (₡300K+), Luxury (₡500K+)
- "Can Afford" quick filter shows only weapons within current credits
- Visual affordability indicators (green checkmark, red x)
- Price ranges adapt to weapon catalog (show actual ranges, not fixed brackets)
- Discount prices used for filtering (not base prices)
```

**US-5: Search Weapons by Name**
```
As a player
I want to search for weapons by name
So that I can quickly find specific weapons

Acceptance Criteria:
- Search input field at top of page
- Real-time filtering as I type (debounced, <200ms)
- Search matches weapon name and description
- "No results" message if no matches
- Search combined with active filters
- Clear button to reset search
```

### Epic: Weapon Comparison & Analysis

**US-6: Compare Multiple Weapons**
```
As a player
I want to compare 2-3 weapons side-by-side
So that I can make informed purchasing decisions

Acceptance Criteria:
- "Compare" button on weapon cards
- Select up to 3 weapons for comparison
- Comparison view shows all stats side-by-side
- Highlight differences (higher values in green, lower in red)
- Show cost comparison, DPS comparison, attribute totals
- "Remove from comparison" button
- "Purchase" button available in comparison view
- Exit comparison mode to return to browsing
```

**US-7: View Weapon Details**
```
As a player
I want to view complete weapon details
So that I understand all aspects before purchasing

Acceptance Criteria:
- Click weapon card to open detailed view/modal
- Shows: Full description, all 15 attribute bonuses, base damage, cooldown, DPS
- Displays: Cost (with discount breakdown), loadout compatibility, weapon type
- Shows: Storage impact ("After purchase: X/Y storage used")
- Shows: Affordability ("You have ₡X, need ₡Y")
- "Purchase" button in detail view
- Related/similar weapons suggested
```

**US-8: Understand Weapon Value**
```
As a player
I want to see weapon cost-effectiveness metrics
So that I can identify good value purchases

Acceptance Criteria:
- Display "Value Score" or "Cost per Attribute Point" metric
- Show DPS-per-credit ratio for damage comparison
- Highlight "Best Value" weapons in category
- Tooltip explaining value calculation
- Filter/sort by value metrics
```

### Epic: Weapon Purchasing

**US-9: Purchase Single Weapon**
```
As a player
I want to purchase a weapon
So that I can add it to my inventory and equip it to robots

Acceptance Criteria:
- "Purchase" button on weapon card
- Disabled if insufficient credits or storage full
- Confirmation modal shows: Weapon name, final cost (with discount), remaining credits, storage impact
- "Confirm Purchase" button in modal
- Success message: "Weapon purchased! Visit Weapon Inventory to equip."
- Credits updated in real-time
- Storage capacity updated
- Purchased weapon marked as "Owned (X)" on future visits
```

**US-10: View Purchase Constraints**
```
As a player
I want to see what prevents me from purchasing a weapon
So that I understand how to proceed

Acceptance Criteria:
- Visual indicators for purchase blockers:
  - "Insufficient Credits" (shows credits needed)
  - "Storage Full" (shows storage expansion options)
  - "Already Owned (5)" (informational, not blocking)
- Disabled purchase button with tooltip explaining reason
- Links to relevant pages (Stable Management for storage, battles for credits)
- Real-time updates as constraints change (after facility upgrade)
```

**US-11: Understand Weapon Workshop Discounts**
```
As a player
I want to see how Weapon Workshop upgrades affect prices
So that I can decide whether to upgrade before purchasing

Acceptance Criteria:
- Discount percentage displayed if Weapons Workshop > 0
- Strikethrough original price, show discounted price
- "Save ₡X" badge showing discount amount
- Tooltip: "Your Level X Weapons Workshop provides Y% discount"
- Link to Stable Management to upgrade workshop
- Show potential savings: "Upgrading to Level X would save ₡Y on this purchase"
```

### Epic: Sorting & Organization

**US-12: Sort Weapons**
```
As a player
I want to sort weapons by various criteria
So that I can organize the catalog by what matters to me

Acceptance Criteria:
- Sort dropdown with options:
  - Price (Low to High, High to Low)
  - Damage (High to Low, Low to High)
  - DPS (High to Low)
  - Attribute Total (High to Low)
  - Value Score (Best Value First)
  - Name (A-Z)
- Default sort: "Recommended" (balanced by value and popularity)
- Sort persists during session
- Visual indicator of active sort
- Combines with active filters
```

**US-13: View Owned Weapons**
```
As a player
I want to see which weapons I already own
So that I can avoid duplicate purchases or buy more copies

Acceptance Criteria:
- "Owned" badge on weapon cards if weapon in inventory
- Badge shows quantity: "Owned (3)"
- "View in Inventory" link
- Filter option: "Show Only Owned" / "Hide Owned"
- Owned weapons still purchasable (can own multiples)
```

### Epic: Responsive & Scalable UI

**US-14: View Mode Toggle**
```
As a player
I want to switch between card view and table view
So that I can browse weapons in my preferred format

Acceptance Criteria:
- Toggle button prominently displayed (top-right of weapon display)
- "Card View" button shows grid icon, "Table View" shows list icon
- Active view mode is visually highlighted
- Switching views maintains all active filters and sorting
- Switching views does not require data reload (instant transition)
- View mode preference persists between sessions
- Table view shows 15-20+ weapons per screen with sortable columns
- Card view shows visual weapon cards with illustrations
- Both views support comparison selection and purchasing
- Clicking weapon in either view opens the same detail modal
```

**US-15: Mobile-Optimized Browsing**
```
As a player on mobile
I want to browse weapons comfortably on small screens
So that I can shop anywhere

Acceptance Criteria:
- Single column layout on mobile (<640px)
- Touch-optimized filter controls (large tap targets)
- Swipeable filter tabs
- Collapsible filter panel (off-canvas drawer)
- Simplified weapon cards on mobile (key info only)
- Tap weapon card to expand details
```

**US-16: Performant Large Catalog**
```
As a player browsing 100+ weapons
I want the page to remain responsive
So that I can browse smoothly without lag

Acceptance Criteria:
- Pagination or infinite scroll for 50+ weapons
- Lazy loading of weapon images
- Filter/sort operations complete in <200ms
- Smooth scrolling maintained
- No UI freezing during filtering
- "Load More" button or automatic scroll loading
```

---

## Feature Requirements

### 1. Filtering System

#### 1.1 Multi-Criteria Filtering

**Description**: Allow players to apply multiple filters simultaneously to narrow down weapon options from 100+ weapons to <20 relevant choices.

**Requirements:**

**Filter Categories:**
1. **Loadout Type**: Single, Weapon+Shield, Two-Handed, Dual-Wield, Shield (separate category)
2. **Weapon Type**: Melee, Ballistic, Energy, Shield
3. **Price Range**: Budget (<₡100K), Mid (₡100-300K), Premium (₡300K+), Luxury (₡500K+)
4. **Affordability**: Can Afford (within current credits)
5. **Availability**: In Stock (storage available)
6. **Attribute Focus**: Offensive (Combat/Targeting/Critical), Defensive (Armor/Shield/Evasion), Mobility (Speed/Thrusters/Servos), Balanced
7. **Ownership**: Show All, Hide Owned, Show Only Owned

**UI Implementation:**
- Filter panel at top or left sidebar
- Checkbox or toggle button groups for each category
- Active filters shown as removable tags/chips
- "Clear All Filters" button
- Filter counts: "(7 weapons match your filters)"
- Collapsible filter groups on mobile (accordion or drawer)

**Technical Specifications:**
- Client-side filtering for instant response (<200ms)
- Multiple filters applied with AND logic (all must match)
- Exception: Loadout type uses OR within category (show Single OR Dual-Wield)
- Filter state stored in URL query params for shareable links
- Filter state persists in localStorage between sessions

**Edge Cases:**
- No weapons match filters: Show "No weapons found" with suggestion to adjust filters
- Single filter result: Highlight the match prominently
- All filters cleared: Return to full catalog view

#### 1.2 Quick Filter Presets

**Description**: Provide one-click filter presets for common weapon shopping scenarios.

**Preset Options:**
- "Budget Weapons" (< ₡100K, Can Afford)
- "Best Value" (sorted by cost-per-attribute-point)
- "High Damage" (sort by baseDamage, DPS)
- "For [Loadout Type]" (based on user's most common loadout in their robots)
- "New Arrivals" (future: when new weapons added)

**Requirements:**
- Preset buttons above main filter panel
- One-click applies preset (replaces current filters)
- Visual indication of active preset
- Custom presets saved per user (future enhancement)

### 2. Sorting System

#### 2.1 Multi-Criteria Sorting

**Description**: Allow players to organize weapons by various metrics to find optimal choices.

**Sort Options:**
1. **Recommended** (default): Balanced algorithm considering value, popularity, player's robots
2. **Price: Low to High**: Cheapest weapons first
3. **Price: High to Low**: Most expensive weapons first
4. **Damage: High to Low**: Highest baseDamage first
5. **DPS: High to Low**: Highest calculated DPS first
6. **Attribute Total: High to Low**: Sum of all attribute bonuses
7. **Best Value**: Lowest cost-per-attribute-point first
8. **Name: A-Z**: Alphabetical by weapon name
9. **Type: Melee/Ballistic/Energy**: Group by weapon type

**UI Implementation:**
- Dropdown select or button group
- Active sort highlighted
- Sort direction toggle (ascending/descending) for applicable sorts
- Combine with filters (sort applies to filtered results)

**Technical Specifications:**
- Client-side sorting for instant reordering
- Sort state persists during session
- Sort preference saved per filter combination (e.g., "When filtering for Two-Handed, remember High Damage sort")

#### 2.2 Secondary Sort

**Description**: Allow tie-breaking with secondary sort criteria.

**Example**: "Sort by Attribute Total, then by Price (Low to High)" to find highest-stat weapons at lowest cost.

**Requirements:**
- Secondary sort dropdown (optional, appears after primary sort selected)
- Common combinations: "Damage → Price", "Attribute Total → Value", "Type → Price"
- Clear indicator of multi-level sort active

### 3. Search System

#### 3.1 Text Search

**Description**: Real-time text search across weapon names and descriptions.

**Requirements:**
- Search input field at top of page
- Placeholder: "Search weapons by name..."
- Debounced search (300ms after user stops typing)
- Search matches weapon name (exact and partial)
- Future: Search weapon descriptions, attribute names
- Case-insensitive matching
- Clear button (X icon) to reset search

**UI Feedback:**
- Result count: "Showing 4 weapons matching 'plasma'"
- Highlight matching text in weapon names
- "No results" message with search term shown
- Recent searches dropdown (future enhancement)

**Technical Specifications:**
- Combines with active filters (search within filtered results)
- Search query in URL for shareable links
- Fuzzy matching consideration (e.g., "plazma" → "plasma")

### 4. View Mode Toggle System

#### 4.1 Card View vs Table View

**Description**: Provide two distinct layout modes for browsing weapons, allowing users to choose between visual detail (card view) and information density (table view).

**Requirements:**

**View Mode Toggle Control:**
- Toggle button group: "Card View" / "Table View"
- Positioned prominently near sort controls (top-right of weapon display area)
- Icon-based toggle: Grid icon (card view) / List icon (table view)
- Active view mode highlighted
- Toggle state persists in localStorage between sessions
- View mode preference saved in URL query parameter

**Card View (Visual/Detailed):**
- **Layout**: Grid of weapon cards (3-4 columns desktop, 2 columns tablet, 1 column mobile)
- **Content**: Weapon illustration (256×256px), name, type, cost, damage, DPS, attribute summary
- **Best For**: Visual browsing, seeing weapon artwork, detailed inspection
- **Interaction**: Click card to open detail modal, hover for quick preview
- **Pros**: Visually appealing, easier to scan aesthetics, good for discovery
- **Cons**: Shows fewer weapons per screen, requires more scrolling

**Table View (Compact/Scannable):**
- **Layout**: Responsive table with sortable columns
- **Columns** (desktop, all sortable):
  1. **Name** (with small type icon)
  2. **Type** (Melee/Ballistic/Energy/Shield)
  3. **Loadout** (Single/Dual/Two-Handed/Shield)
  4. **Damage**
  5. **DPS** (calculated)
  6. **Cost** (with discount if applicable)
  7. **Attributes** (total bonus)
  8. **Actions** (Purchase button, Compare checkbox)
- **Mobile Columns** (condensed):
  1. **Name** (with type icon)
  2. **DPS / Cost** (combined)
  3. **Actions**
- **Row Interactions**:
  - Click row to open weapon detail modal (same as card click)
  - Hover row for highlight effect
  - Checkbox in "Actions" column for comparison selection
- **Best For**: Quick scanning, comparing multiple weapons at once, data-driven decisions
- **Pros**: Shows 15-20+ weapons per screen, easy to compare across rows, efficient scanning
- **Cons**: Less visual appeal, no weapon illustrations visible, may feel spreadsheet-like

**Responsive Behavior:**
- **Desktop (≥1025px)**: Full table with all columns OR 3-4 column card grid
- **Tablet (641-1024px)**: Condensed table (hide less important columns) OR 2 column card grid
- **Mobile (≤640px)**: Minimal table (3 columns) OR 1 column card grid

**Technical Specifications:**
- View mode state managed in React state/context
- Same weapon data rendered differently based on view mode
- All filters, sorting, search apply equally to both views
- Smooth transition when switching views (no data reload)
- Table component supports column sorting (click column header)
- Table rows are keyboard-navigable (tab through, enter to open)

#### 4.2 Table View Detailed Specifications

**Table Structure:**
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Name            │ Type      │ Loadout     │ Dmg │ DPS │ Cost    │ Attr │ Action │
├──────────────────────────────────────────────────────────────────────────────┤
│ [⚡] Laser      │ Energy    │ Single      │ 120 │ 48  │ ₡220K   │ +12  │ [Buy] ☐│
│     Rifle       │           │             │     │     │ (-15%)  │      │        │
├──────────────────────────────────────────────────────────────────────────────┤
│ [🔫] Machine    │ Ballistic │ Single,     │ 80  │ 40  │ ₡190K   │ +11  │ [Buy] ☐│
│     Gun         │           │ Dual-Wield  │     │     │         │      │        │
├──────────────────────────────────────────────────────────────────────────────┤
│ [⚔] Power       │ Melee     │ Single      │ 150 │ 60  │ ₡500K   │ +18  │ [Buy] ☐│
│     Sword       │           │             │     │     │ (-15%)  │      │        │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Column Details:**
1. **Name**: Weapon name with small type icon prefix, left-aligned
2. **Type**: Weapon type (Melee/Ballistic/Energy/Shield), colored badge
3. **Loadout**: Compatible loadout types, abbreviated (S/D/2H/W+S)
4. **Dmg**: Base damage, numeric, right-aligned
5. **DPS**: Calculated damage per second, numeric, right-aligned
6. **Cost**: Discounted cost with strikethrough base cost if applicable, right-aligned
7. **Attr**: Total attribute bonuses (sum), numeric, right-aligned
8. **Action**: Purchase button + comparison checkbox

**Table Features:**
- **Sortable Columns**: Click column header to sort (arrow indicates direction)
- **Row Highlighting**: Hover to highlight, selected for comparison has colored background
- **Affordability Indicators**: 
  - Green row if affordable
  - Gray/dimmed row if unaffordable
  - Red text for "Insufficient Credits" in action column
- **Owned Indicator**: "Owned (X)" badge in name column
- **Pagination**: Show 20-30 rows per page with page controls
- **Sticky Header**: Table header remains visible during scroll

**Mobile Table Adaptation:**
```
┌────────────────────────────────────────────┐
│ Name           │ DPS / Cost  │ Action      │
├────────────────────────────────────────────┤
│ [⚡] Laser     │ 48 DPS      │ [Buy]       │
│     Rifle      │ ₡220K       │             │
├────────────────────────────────────────────┤
│ [🔫] Machine   │ 40 DPS      │ [Buy]       │
│     Gun        │ ₡190K       │             │
└────────────────────────────────────────────┘
```

**Accessibility:**
- Table uses semantic HTML (`<table>`, `<th>`, `<td>`)
- Column headers have aria-sort attributes
- Row click has keyboard support (enter/space)
- Screen reader announces sort changes

### 5. Comparison System

#### 4.1 Side-by-Side Comparison

**Description**: Select 2-3 weapons and compare them in a dedicated comparison view.

**Requirements:**

**Selection Phase:**
- "Compare" checkbox or button on each weapon card
- Selected weapons highlighted with checkmark badge
- Selection counter: "2/3 weapons selected"
- "Clear Selection" button
- Maximum 3 weapons selected (disable further selections)

**Comparison View:**
- Modal or dedicated section showing selected weapons side-by-side
- Three columns (one per weapon)
- Rows for each stat: Name, Type, Loadout Compatibility, Cost, Damage, DPS, Cooldown, each attribute
- Visual highlighting:
  - Highest value in category: Green text
  - Lowest value in category: Red text (if significant)
  - Equal values: White text
- Cost comparison section:
  - Base cost, discounted cost, difference
  - "Best Value" badge on weapon with best cost-per-attribute ratio
- Action buttons: "Purchase [Weapon Name]" for each weapon
- "Close Comparison" button to exit

**Technical Specifications:**
- Comparison state managed in React context
- Comparison view persists across page navigation (until cleared)
- Shareable comparison link (URL encodes selected weapon IDs)

#### 4.2 Quick Compare Hover

**Description**: Lightweight comparison without entering full comparison mode.

**Requirements:**
- Hover over weapon card shows tooltip with key stats
- If another weapon card already hovered recently, show difference indicators
- Example: "+5 more damage", "-₡50K cheaper", "+3 total attributes"
- Desktop only (not feasible on mobile)

### 6. Economic Context Display

#### 6.1 Pricing & Discounts

**Requirements:**

**Weapon Card Display:**
- Base cost in strikethrough if discount active
- Discounted cost prominently displayed
- "Save ₡X" badge showing discount amount
- Discount percentage: "(15% off)"

**Discount Tooltip:**
- "Your Level 3 Weapons Workshop provides 15% discount"
- Link to Stable Management: "Upgrade to Level 4 for 20% discount"

**Affordability Indicators:**
- Green checkmark if player can afford
- Red X if insufficient credits
- Tooltip: "You have ₡150K, need ₡200K (₡50K short)"
- "Insufficient Credits" label on purchase button

#### 6.2 Storage Capacity Display

**Requirements:**

**Header Display:**
- Prominent storage indicator: "Weapon Storage: 18/25"
- Visual progress bar showing capacity percentage
- Color coding:
  - <70% full: Green
  - 70-90% full: Yellow
  - >90% full: Red
- Tooltip: "Upgrade Storage Facility to increase capacity"

**Storage Impact Preview:**
- On weapon card: "After purchase: 19/25 storage used"
- Warning if near capacity: "Only 2 slots remaining"
- "Storage Full" blocker with link to Stable Management

#### 6.3 Value Analysis

**Requirements:**

**Per-Weapon Metrics:**
- Cost-per-Attribute-Point: ₡X per point
- DPS-per-Credit: X DPS per ₡1,000
- Total attribute bonus: Sum of all bonuses

**Value Badges:**
- "Best Value in Category" for weapons with exceptional cost-efficiency
- "Premium Option" for high-cost, high-performance weapons
- "Budget Pick" for low-cost viable options

**Comparison Context:**
- "20% better value than similar weapons"
- "Average price for this damage tier"

### 7. Weapon Card Design

#### 7.1 Card Layout - Compact View

**Use Case**: Default browsing mode for large catalogs.

**Layout (256×300px card):**
```
┌────────────────────────────┐
│   [Weapon Illustration]    │ 256×256px image
│        (256×256px)          │
├────────────────────────────┤
│ [Type Icon] Weapon Name    │ Type badge + name
│ ₡150,000 (-15%) Save ₡25K  │ Cost with discount
├────────────────────────────┤
│ ⚔ Damage: 120  ⏱ CD: 2.5s │ Key stats
│ 📊 DPS: 48  ⭐ +12 Attrs   │ Calculated values
├────────────────────────────┤
│ [Purchase] [Compare] [ℹ]   │ Action buttons
└────────────────────────────┘
```

**Content:**
- Weapon illustration (256×256px placeholder if image not available)
- Weapon type icon (32×32px: Melee, Ballistic, Energy, Shield)
- Weapon name (truncate if >25 characters)
- Cost display (base cost strikethrough if discounted, final cost prominent)
- Discount badge if applicable
- Key stats: Base Damage, Cooldown, DPS (calculated)
- Attribute summary: "+12 attributes" (sum of all bonuses)
- Loadout type compatibility icons (small icons for valid loadouts)
- Action buttons: Purchase (primary), Compare (secondary), Info (details)
- Owned indicator: "Owned (2)" badge if in inventory

**States:**
- Default: Neutral gray background
- Hover: Slight elevation, border highlight
- Selected for comparison: Blue border, checkmark badge
- Unaffordable: Grayscale filter, red "Insufficient Credits" banner
- Storage full: Grayscale filter, yellow "Storage Full" banner
- Purchased (in session): Green "Just Purchased!" badge (temporary)

#### 7.2 Card Layout - Detailed View

**Use Case**: Expanded view when user wants more information without opening modal.

**Layout (400×600px card):**
```
┌─────────────────────────────────────┐
│     [Weapon Illustration]           │ Larger image
│          (400×300px)                 │
├─────────────────────────────────────┤
│ [Type Icon] Weapon Name             │
│ ₡150,000  (-15% discount) Save ₡25K │
├─────────────────────────────────────┤
│ Description text (2-3 lines)        │
├─────────────────────────────────────┤
│ Combat Stats:                        │
│   Base Damage: 120                   │
│   Cooldown: 2.5s                     │
│   DPS: 48                            │
├─────────────────────────────────────┤
│ Attribute Bonuses:                   │
│   +5 Combat Power                    │
│   +3 Targeting Systems               │
│   +2 Critical Systems                │
│   +2 Weapon Control                  │
│   (... collapsed others)             │
├─────────────────────────────────────┤
│ Loadout Compatibility:               │
│   ✓ Single  ✓ Weapon+Shield         │
│   ✗ Two-Handed  ✓ Dual-Wield        │
├─────────────────────────────────────┤
│ Value Analysis:                      │
│   ₡12,500 per attribute point        │
│   Value Score: 4.2/5 ⭐              │
├─────────────────────────────────────┤
│ [Purchase ₡150,000] [Compare] [ℹ]   │
└─────────────────────────────────────┘
```

**Toggle**: "Compact View" / "Detailed View" button to switch between card types globally.

#### 7.3 Weapon Detail Modal

**Use Case**: Full information sheet when user clicks "Info" or weapon name.

**Layout (Modal, 800×900px):**
```
┌──────────────────────────────────────────────┐
│ [X Close]        Weapon Name        [Type]   │
├──────────────────────────────────────────────┤
│                                              │
│    [Weapon Illustration 512×512px]          │
│                                              │
├──────────────────────────────────────────────┤
│ Full description (multiple paragraphs)       │
├──────────────────────────────────────────────┤
│ ┌─────────────┬─────────────┬─────────────┐ │
│ │ Base Damage │  Cooldown   │     DPS     │ │
│ │     120     │    2.5s     │     48      │ │
│ └─────────────┴─────────────┴─────────────┘ │
├──────────────────────────────────────────────┤
│ Complete Attribute Bonuses:                  │
│ [Offensive Attributes]                       │
│   Combat Power: +5                           │
│   Targeting Systems: +3                      │
│   Critical Systems: +2                       │
│   Penetration: +0                            │
│   ... (all 15 attributes listed)             │
├──────────────────────────────────────────────┤
│ Loadout Compatibility:                       │
│   ✓ Single: Can be equipped as main weapon  │
│   ✓ Weapon+Shield: Can pair with shield     │
│   ✗ Two-Handed: Not a two-handed weapon     │
│   ✓ Dual-Wield: Can be dual-wielded         │
├──────────────────────────────────────────────┤
│ Cost Analysis:                               │
│   Base Cost: ₡175,000                        │
│   Workshop Discount: -15% (-₡25,000)        │
│   Final Cost: ₡150,000                       │
│   Cost per Attribute: ₡12,500                │
│   DPS per ₡1,000: 0.32                       │
│   Value Score: 4.2/5 ⭐                      │
├──────────────────────────────────────────────┤
│ Similar Weapons: (3 cards)                   │
│   [Card 1] [Card 2] [Card 3]                 │
├──────────────────────────────────────────────┤
│ [Purchase ₡150,000]  [Add to Comparison]     │
└──────────────────────────────────────────────┘
```

**Interactions:**
- Click weapon card or "Info" button to open modal
- ESC key or X button to close
- Click "Purchase" to trigger purchase flow
- Click "Add to Comparison" to add weapon to comparison set
- Click similar weapon cards to navigate to that weapon's detail modal

### 8. Educational Features

#### 8.1 Tooltips & Help

**Requirements:**

**Inline Tooltips:**
- Hover over attribute names: Tooltip explains what the attribute does
- Hover over DPS: "Damage Per Second = Base Damage ÷ Cooldown"
- Hover over "Value Score": Explains cost-effectiveness calculation
- Hover over loadout icons: "This weapon can be used in Single or Dual-Wield configurations"

**Help Icons:**
- "?" icon next to weapon type: Opens "What are weapon types?" explanation
- "?" icon next to filters: "How to use filters effectively"
- "?" icon next to comparison: "How to compare weapons"

**First-Time User Guide:**
- Dismiss able tutorial overlay on first visit
- Highlights: "Filter weapons here", "Compare weapons here", "Check your storage here"
- "Skip Tutorial" and "Next" buttons

#### 8.2 Smart Recommendations

**Requirements:**

**"Recommended for You" Section:**
- Displayed at top of page before main catalog
- Shows 3-5 weapons based on:
  - Player's current robots' loadout types (recommend compatible weapons)
  - Attribute gaps (e.g., if all robots have low Shield Capacity, recommend weapons with shield bonuses)
  - Budget (suggest weapons player can afford)
- "Why recommended?" tooltip explaining logic

**"Complete Your Loadout" Suggestions:**
- If player owns one weapon for Dual-Wield, suggest compatible offhand weapons
- If player has Weapon+Shield loadout but no shield, recommend shields

**"Upgrade Path" Suggestions:**
- "You own [Basic Weapon]. Consider upgrading to [Better Weapon] for +X damage."

### 9. Responsive Design

#### 9.1 Mobile Optimization (≤640px)

**Layout:**
- Single column weapon cards
- Hamburger menu for filters (off-canvas drawer)
- Sticky header with search and filter buttons
- Simplified weapon cards (key stats only)
- Tap card to expand details inline (accordion)
- Large tap targets (minimum 44×44px)

**Filter Panel:**
- Opens as bottom sheet (drawer from bottom)
- Full-screen overlay with "Apply Filters" button
- Active filters shown as chips at top of screen

**Comparison Mode:**
- Maximum 2 weapons on mobile (not 3)
- Comparison view stacks vertically (not side-by-side)

#### 9.2 Tablet Optimization (641px - 1024px)

**Layout:**
- 2 column grid for weapon cards
- Side panel filter (collapsible)
- Comparison mode: 2-3 weapons in horizontal scroll if needed

#### 9.3 Desktop Optimization (≥1025px)

**Layout:**
- 3-4 column grid (adjustable based on screen width)
- Persistent left sidebar for filters
- Comparison mode: Full side-by-side display

### 10. Performance Optimization

#### 10.1 Large Catalog Handling (100+ weapons)

**Requirements:**

**Pagination:**
- Display 20-30 weapons per page
- "Load More" button or auto-load on scroll
- Page numbers for direct navigation
- "Showing 1-24 of 156 weapons"

**Lazy Loading:**
- Weapon images load as they approach viewport
- Placeholder skeleton screens during load

**Virtualization:**
- Render only visible weapon cards + buffer
- Recycle DOM nodes as user scrolls (React Virtualized or similar)

**Filtering Performance:**
- Client-side filtering cached and memoized
- Debounced filter updates (200ms)

#### 10.2 Image Optimization

**Requirements:**
- Weapon illustrations: WebP format with PNG fallback
- Responsive images: Serve smaller images on mobile (128×128px) vs desktop (256×256px)
- Lazy loading images with intersection observer
- Placeholder: Low-res blur or simple icon while loading

---

## UX/UI Design Specifications

### 1. Visual Design Alignment

#### 1.1 Design System Integration

**Logo State**: Direction B (Precision) - See [DESIGN_SYSTEM_AND_UX_GUIDE.md](design_ux/DESIGN_SYSTEM_AND_UX_GUIDE.md)

**Color Palette:**
- **Primary Action**: #58a6ff (bright blue - "Purchase" buttons)
- **Secondary Action**: #6e7681 (muted gray - "Compare", "Info")
- **Surface Background**: #0d1117 (dark background)
- **Card Background**: #161b22 (elevated surface)
- **Border**: #30363d (subtle borders)
- **Text Primary**: #e6edf3 (white text)
- **Text Secondary**: #7d8590 (gray text for metadata)
- **Success**: #3fb950 (green - affordability indicators, value badges)
- **Warning**: #d29922 (yellow - storage warnings, near-capacity)
- **Error**: #f85149 (red - insufficient credits, blockers)

**Typography:**
- **Headings**: Inter, bold, 24px (page title), 18px (section headers)
- **Body**: Inter, regular, 14px (descriptions, stats)
- **Labels**: Inter, semi-bold, 12px (uppercase for categories)
- **Numbers**: Inter, medium, 16px (prices, stats - emphasis on numerics)

**Spacing:**
- Card padding: 16px
- Card gap: 16px (mobile), 20px (desktop)
- Section spacing: 32px

**Elevation/Shadows:**
- Weapon cards: `box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2)`
- Hover cards: `box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4)`
- Modals: `box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6)`

#### 1.2 Weapon Illustrations

**Requirements** (from Design System):
- **Size**: 256×256px for cards, 512×512px for detail modal
- **Style**: Detailed mechanical renderings, technical aesthetic
- **Format**: PNG or WebP, transparent background
- **Lighting**: Consistent lighting direction (top-left), neutral background
- **Color**: Full color with metallic/technical feel

**Placeholder Strategy** (until illustrations ready):
- Use weapon type icons (64×64px) on solid background
- Color-coded by type: Blue (Energy), Orange (Ballistic), Red (Melee), Gray (Shield)
- Maintain aspect ratio for future image swap

### 2. Interaction Patterns

#### 2.1 Weapon Card Interactions

**Hover (Desktop):**
- Subtle elevation increase (2px lift)
- Border color change: #30363d → #58a6ff (primary blue)
- Cursor: pointer
- Smooth transition: 200ms ease-in-out

**Click:**
- Primary click area: Opens weapon detail modal
- Button clicks: Execute button action (Purchase, Compare, Info)

**Selection for Comparison:**
- Checkmark overlay on top-right corner
- Border: 2px solid #58a6ff
- Background tint: rgba(88, 166, 255, 0.1)

#### 2.2 Filter Interactions

**Filter Changes:**
- Instant visual feedback (<200ms)
- Loading spinner if query takes >200ms
- Smooth transitions as cards appear/disappear
- Maintain scroll position when possible

**Filter Tags/Chips:**
- Active filters shown as removable chips below filter panel
- Click X on chip to remove individual filter
- "Clear All" button to reset

#### 2.3 Purchase Flow

**Step 1: Click "Purchase"**
- Confirmation modal opens
- Modal content: Weapon summary, cost, remaining credits, storage impact

**Step 2: Confirm Purchase**
- "Confirm Purchase" button (loading state during API call)
- Success: Modal closes, success toast notification, weapon card updates
- Error: Error message in modal, modal stays open

**Step 3: Post-Purchase**
- Toast notification: "Weapon purchased! ₡X remaining. Visit Weapon Inventory to equip."
- Weapon card updates: "Already Own (X)" badge appears
- Credits balance in header updates
- Owned weapons count refreshed

### 3. Weapon Card View Modes

The Weapon Shop provides three distinct viewing modes for weapons, each optimized for different use cases:

#### 3.1 Card View (Default)

**Purpose**: Visual browsing with full weapon details and images

**Layout:**
- Grid layout: 3 columns (desktop), 2 columns (tablet), 1 column (mobile)
- Each card shows:
  - Weapon image (192×192px)
  - Weapon name (clickable to open detail modal)
  - Weapon type and loadout type
  - Description
  - Base damage and cooldown
  - DPS calculation
  - Cost with discount indication
  - Attribute bonuses summary
  - Purchase button
  - Comparison checkbox
  - "Already Own (X)" badge if owned
- Grouped by loadout type (shields, two-handed, one-handed)

**Best For:**
- First-time browsing
- Visual comparison of weapons
- Detailed information at a glance
- Mobile-friendly browsing

**Navigation:**
- Click weapon name or image → Opens Detail Modal
- Check "Compare" box → Adds to comparison (max 3)
- Click "Purchase" → Buys weapon

#### 3.2 Table View

**Purpose**: Compact, scannable overview for quick comparisons

**Layout:**
- Single sortable table with columns:
  1. Name (with weapon type icon, clickable)
  2. Loadout (loadout type)
  3. Type (weapon type)
  4. Damage (base damage)
  5. Cooldown (seconds)
  6. DPS (calculated)
  7. Cost (with discount if applicable)
  8. Attributes (total attribute bonuses)
  9. Action (purchase button)
- Shows 15-20+ weapons visible at once
- Click column headers to sort
- Visual sort indicators (↑/↓)

**Best For:**
- Experienced users who know what they want
- Quick stat comparisons across many weapons
- Sorting by specific criteria (price, DPS, damage, etc.)
- Desktop use (not ideal for mobile)

**Navigation:**
- Click weapon name → Opens Detail Modal
- Click column header → Sorts table
- Click "Buy" → Purchases weapon
- No comparison checkboxes in table view (use card view for comparison)

#### 3.3 Detail Modal View

**Purpose**: Complete weapon information for final purchase decision

**Layout:**
- Full-screen modal overlay
- Large weapon image (256×256px)
- Complete weapon details:
  - Name, type, loadout type
  - "Already Own (X)" indicator (if owned)
  - Full description
  - Combat stats grid (damage, cooldown, DPS, total attributes)
  - Complete list of all attribute bonuses
  - Cost with discount breakdown
  - User's current credits
  - Purchase button with status
- Close button (X)

**Best For:**
- Final purchase verification
- Reviewing all weapon details before buying
- Understanding complete attribute breakdown
- Checking owned status

**Navigation:**
- Click "Close" → Returns to previous view (card or table)
- Click "Purchase" → Buys weapon and closes modal
- ESC key → Closes modal

#### 3.4 View Mode Toggle

**Switching Between Views:**
- Toggle button at top of page (grid icon for card view, list icon for table view)
- View preference saved in localStorage
- All filters, search, and sort settings persist when switching views
- Active filters work in both views

**View Mode Recommendations:**
- **New Users**: Start with Card View for visual exploration
- **Shopping for Specific Stats**: Use Table View for quick sorting/scanning
- **Final Purchase Decision**: Detail Modal for complete information
- **Mobile Users**: Card View (table view works but less ideal)

---

### 4. Empty & Error States

#### 3.1 No Weapons Match Filters

**Display:**
- Icon: Magnifying glass with X
- Message: "No weapons match your filters"
- Suggestion: "Try adjusting your filters or browsing all weapons"
- Button: "Clear All Filters"

#### 3.2 First-Time User (No Weapons Owned)

**Display:**
- Icon: Crossed swords
- Message: "Welcome to the Weapon Shop!"
- Subtext: "Equip your robots with powerful weapons to dominate the arena"
- CTA: "Browse Weapons" (scrolls to catalog)

#### 3.3 Storage Full

**Display:**
- Warning banner at top of page (yellow background)
- Message: "Your weapon storage is full (25/25)"
- Action: "Upgrade Storage Facility" (link to Stable Management)

#### 3.4 Insufficient Credits

**Display:**
- Disabled purchase buttons on unaffordable weapons
- Tooltip: "Insufficient credits. You have ₡X, need ₡Y"
- Filter option: "Can Afford" to hide unaffordable weapons

#### 3.5 API Error

**Display:**
- Error banner: "Failed to load weapons. Please refresh the page."
- Button: "Retry"
- If persistent: "If the problem persists, please contact support."

---

## Technical Implementation

### 1. Data Model

#### Weapon Interface (TypeScript)
```typescript
interface Weapon {
  id: number;
  name: string;
  weaponType: 'melee' | 'ballistic' | 'energy' | 'shield';
  loadoutType: 'single' | 'weapon_shield' | 'two_handed' | 'dual_wield';
  description: string;
  baseDamage: number;
  cooldown: number; // seconds
  cost: number; // base cost
  
  // 15 attribute bonuses
  combatPowerBonus: number;
  targetingSystemsBonus: number;
  criticalSystemsBonus: number;
  penetrationBonus: number;
  weaponControlBonus: number;
  attackSpeedBonus: number;
  armorPlatingBonus: number;
  shieldCapacityBonus: number;
  evasionThrustersBonus: number;
  counterProtocolsBonus: number;
  servoMotorsBonus: number;
  gyroStabilizersBonus: number;
  hydraulicSystemsBonus: number;
  powerCoreBonus: number;
  threatAnalysisBonus: number;
  
  // Calculated fields (not in database, computed on frontend)
  dps?: number;
  totalAttributeBonus?: number;
  discountedCost?: number;
  costPerAttributePoint?: number;
  valueScore?: number; // 0-5 rating
}

interface WeaponFilters {
  loadoutTypes: string[];
  weaponTypes: string[];
  priceRange: { min: number; max: number } | null;
  canAfford: boolean;
  storageAvailable: boolean;
  attributeFocus: 'offensive' | 'defensive' | 'mobility' | 'balanced' | null;
  ownershipFilter: 'all' | 'owned' | 'not_owned';
  searchQuery: string;
}

interface WeaponSort {
  field: 'recommended' | 'price' | 'damage' | 'dps' | 'attributeTotal' | 'value' | 'name';
  direction: 'asc' | 'desc';
}
```

### 2. API Requirements

#### GET /api/weapons
**Current**: Returns all weapons  
**Enhancement Needed**: Add query parameters for server-side filtering (future optimization for 500+ weapons)

**Query Parameters** (future):
```
GET /api/weapons?loadoutType=two_handed&weaponType=melee&maxCost=200000
```

#### GET /api/weapon-inventory
**Current**: Returns user's owned weapons  
**Enhancement**: Return ownership counts per weapon ID

**Response Enhancement**:
```json
{
  "weapons": [ /* array of WeaponInventory */ ],
  "ownershipCounts": {
    "1": 3, // Weapon ID 1 owned 3 times
    "5": 1
  }
}
```

### 3. Frontend Architecture

#### Component Structure
```
WeaponShopPage/
├── WeaponShopHeader (credits, storage, title)
├── SearchBar (text search input)
├── FilterPanel
│   ├── LoadoutTypeFilter
│   ├── WeaponTypeFilter
│   ├── PriceRangeFilter
│   ├── AttributeFocusFilter
│   └── ClearFiltersButton
├── ControlBar
│   ├── SortControl (dropdown)
│   └── ViewModeToggle (Card/Table toggle buttons)
├── ActiveFiltersDisplay (removable chips)
├── RecommendedWeapons (top section)
├── WeaponDisplay (conditional rendering based on view mode)
│   ├── WeaponGrid (card view)
│   │   └── WeaponCard (multiple instances)
│   └── WeaponTable (table view)
│       └── WeaponRow (multiple instances)
└── ComparisonPanel (if weapons selected)
    └── WeaponComparison (modal/drawer)
```

#### State Management
```typescript
// Use React Context or Zustand for global state
interface WeaponShopState {
  weapons: Weapon[];
  loading: boolean;
  error: string | null;
  
  viewMode: 'card' | 'table'; // NEW: View mode toggle
  filters: WeaponFilters;
  sort: WeaponSort;
  searchQuery: string;
  
  selectedForComparison: number[]; // weapon IDs
  ownedWeapons: { [weaponId: number]: number }; // ownership counts
  
  userCredits: number;
  storageCapacity: { current: number; max: number };
  weaponWorkshopLevel: number;
}

// Actions
const actions = {
  setViewMode(mode: 'card' | 'table'): void; // NEW: Toggle view mode
  setFilters(filters: Partial<WeaponFilters>): void;
  setSort(sort: WeaponSort): void;
  setSearchQuery(query: string): void;
  toggleComparisonSelection(weaponId: number): void;
  purchaseWeapon(weaponId: number): Promise<void>;
  // ...
};
```

#### Performance Optimization
- **Memoization**: Use `React.memo` for WeaponCard to prevent unnecessary re-renders
- **Debouncing**: Debounce search input (300ms) and filter changes (200ms)
- **Virtual Scrolling**: Implement if catalog exceeds 100 weapons (react-window or similar)
- **Code Splitting**: Lazy load comparison modal and detail modal

### 4. URL State Management

**Shareable Links**: Encode filter/sort/search state in URL query parameters.

**Example URL**:
```
/weapon-shop?view=table&loadout=two_handed,dual_wield&type=melee&priceMax=300000&sort=damage-desc&search=sword
```

**Benefits**:
- Users can share filtered views
- Browser back/forward works correctly
- Bookmarking specific searches

**Implementation**: Use `react-router` query parameters or `URLSearchParams`

### 5. Backend & Database Requirements Analysis

#### Current Backend State (✅ Sufficient for PRD Implementation)

**Existing APIs:**
- ✅ `GET /api/weapons` - Returns all weapons with full specifications
- ✅ `POST /api/weapon-inventory/purchase` - Purchase weapon with validation
- ✅ `GET /api/weapon-inventory` - User's owned weapons
- ✅ `GET /api/weapon-inventory/storage-status` - Storage capacity tracking
- ✅ `GET /api/facilities` - Weapon Workshop level for discount calculation

**Existing Database Schema:**
- ✅ `Weapon` model: All 15 attribute bonuses, baseDamage, cost, cooldown, types
- ✅ `WeaponInventory` model: User ownership with timestamps
- ✅ `Facility` model: Weapon Workshop and Storage Facility levels
- ✅ `User` model: Currency tracking

**Analysis: No Backend Changes Required**

All features in the Implementation Roadmap can be implemented with **frontend-only changes**:

1. **Filtering & Sorting** (Phase 1): Client-side operations on data from `GET /api/weapons`
2. **Comparison & Analysis** (Phase 2): Frontend state management and calculations
3. **Search & Discovery** (Phase 3): Client-side text search and recommendations
4. **Visual Polish & View Modes** (Phase 4): Frontend rendering and layout components
5. **Performance** (Phase 5): Frontend pagination, lazy loading, memoization
6. **Educational Features** (Phase 6): Frontend tooltips and guides

**Why No Backend Changes Needed:**

- **Filtering**: All filter criteria (loadout type, weapon type, price range, attributes) are already in weapon data
- **Sorting**: All sort fields (damage, DPS, cost, attribute totals) can be calculated client-side
- **Search**: Text search across weapon names/descriptions done client-side (23-100 weapons is manageable)
- **View Modes**: Card vs. table view is purely presentational (frontend)
- **Comparison**: Selecting and comparing weapons is client-side state management
- **Recommendations**: Can be generated client-side based on user's robot data and weapon gaps

**Future Optimization Considerations (500+ Weapons):**

If the weapon catalog scales beyond 100-200 weapons, consider these backend enhancements:

- **Server-Side Filtering**: Add query parameters to `GET /api/weapons` for pre-filtered results
  ```
  GET /api/weapons?loadoutType=two_handed&weaponType=melee&maxCost=300000
  ```
- **Pagination**: Backend pagination with `page` and `limit` parameters
- **Full-Text Search**: Database-level search (PostgreSQL full-text search) for better performance
- **Caching**: Redis caching for frequently accessed weapon lists

**Current Recommendation**: Implement all features with frontend-only changes. Monitor performance and add backend optimizations only if needed.

#### No Database Changes Required

The existing Prisma schema fully supports all PRD requirements:
- All weapon attributes present (combat stats, 15 bonuses)
- Ownership tracking via WeaponInventory
- Storage capacity calculated from Facility levels
- Discount calculation from Weapon Workshop facility

**Conclusion**: This PRD requires **zero backend or database changes**. All features are frontend implementations using existing APIs.

---

## Success Metrics & KPIs

### Usability Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Time to find desired weapon | <30 seconds | Analytics: Time from page load to purchase click |
| Filter usage rate | >70% | % of sessions where at least one filter applied |
| Comparison usage rate | >40% | % of sessions where comparison mode used |
| Search usage rate | >50% | % of sessions using text search |
| Average weapons viewed before purchase | 3-8 | Count of weapon card interactions per purchase |
| Purchase completion rate | >85% | % of "Purchase" clicks resulting in successful purchase |

### Engagement Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Average session duration | 2-5 minutes | Time spent on weapon shop page |
| Weapons browsed per session | 10-20 | Count of weapon cards viewed |
| Return visits per week | 2-3 | Unique sessions per user per week |
| Comparison mode usage | >40% | % of users who use comparison feature |
| Detail modal views | >60% | % of weapon cards where detail modal opened |

### Economic Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Average purchase value | ₡150-250K | Average cost of purchased weapons |
| Weapons purchased per session | 1-2 | Count of purchases per visit |
| Abandoned purchases | <15% | % of purchase confirmations cancelled |
| Storage upgrade rate | >40% | % of users upgrading Storage Facility within 2 weeks |
| Weapon Workshop upgrade rate | >30% | % of users upgrading Weapons Workshop within 2 weeks |

### Technical Performance Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Initial page load time | <2 seconds | Lighthouse/WebPageTest |
| Filter response time | <200ms | Time from filter change to UI update |
| Search response time | <300ms | Time from input to result update |
| Scroll performance (100+ weapons) | 60 FPS | Chrome DevTools performance profiling |
| Image load time | <1 second | Lazy load performance tracking |

---

## Implementation Roadmap

### Phase 1: Enhanced Filtering & Sorting (P0 - Weeks 1-2) - COMPLETE ✅

**Goal**: Support browsing 100+ weapons efficiently through filtering and sorting.

**Deliverables:**
- ✅ Multi-criteria filtering system (loadout type, weapon type, price range)
  - ✅ FilterPanel component created
  - ✅ Loadout type filter (Single, Weapon+Shield, Two-Handed, Dual Wield)
  - ✅ Weapon type filter (Melee, Ballistic, Energy, Shield)
  - ✅ Price range filter (Budget, Mid, Premium, Luxury)
  - ✅ "Can Afford" quick filter
- ✅ Active filters display with removable chips
  - ✅ ActiveFiltersDisplay component created
  - ✅ Color-coded filter chips
  - ✅ Individual filter removal
- ✅ "Clear All Filters" button
- ✅ Weapon count display ("Showing X of Y weapons")
- ✅ Empty state when no weapons match filters
- ⏳ Multi-criteria sorting (price, damage, DPS, value) - Partially complete (table only)
- ⏳ URL state management for shareable links (deferred)
- ✅ Mobile-responsive filter panel

**Implementation Notes:**
- **Completed**: Full filtering system with multiple criteria
- **Completed**: Client-side filtering using useMemo for performance
- **Completed**: Filters work in both Card and Table views
- **Remaining**: Sort dropdown for card view, URL state management

**Success Criteria:**
- ✅ Filter operations complete in <200ms
- ✅ Users can reduce 100 weapons to <20 with 2-3 filters
- ✅ Active filters are clearly visible and removable
- ✅ Mobile filter panel usable on small screens (basic responsiveness)

### Phase 2: Comparison & Analysis (P1 - Weeks 3-4) - COMPLETE ✅

**Goal**: Enable informed purchasing decisions.

**Implementation Date**: February 4, 2026

**Completed Features**:
- ✅ Comparison selection checkboxes on weapon cards
- ✅ ComparisonBar component (floating bottom bar shows count and actions)
- ✅ ComparisonModal component with side-by-side 2-3 weapon comparison
- ✅ Value analysis metrics: Cost/Damage, DPS/₡1K, Attributes/₡1K
- ✅ Best value indicators with ⭐ highlights
- ✅ Purchase directly from comparison modal
- ✅ Remove individual weapons from comparison
- ✅ Clear all selections option

**Deliverables:**
- Comparison mode: Select 2-3 weapons ✅
- Side-by-side comparison view ✅
- Value analysis metrics (cost-per-attribute, DPS-per-credit) ✅
- Weapon detail modal (full information sheet) ⏸️ (deferred - comparison modal sufficient)
- "Similar weapons" suggestions ⏸️ (deferred - future enhancement)

**Success Criteria:**
- >40% of users use comparison mode ⏳ (pending user testing)
- Comparison view shows clear value differences ✅
- Detail modal provides complete weapon information ⏸️ (deferred)

### Phase 3: Search & Discovery (P1 - Weeks 5-6) - CORE FEATURES COMPLETE ✅

**Goal**: Improve weapon discovery and recommendations.

**Deliverables:**
- ✅ Text search functionality (real-time, debounced 300ms)
  - ✅ SearchBar component created
  - ✅ Multi-field search (name, description, type, loadout)
  - ✅ Search result count display
  - ✅ Empty state handling
- ✅ Sort dropdown for card view
  - ✅ SortDropdown component created
  - ✅ 5 sort options (name, price asc/desc, damage, DPS)
  - ✅ localStorage persistence
- ⏳ "Recommended for You" section (top of page) - Deferred (requires user history)
- ⏳ Quick filter presets ("Budget Weapons", "Best Value", etc.) - Deferred
- ⏳ Owned weapons indicator ("Owned (3)" badges) - Deferred (requires inventory integration)
- ⏳ "Complete Your Loadout" suggestions - Deferred

**Implementation Notes:**
- **Completed**: Full text search with debouncing
- **Completed**: Sort dropdown with 5 options
- **Completed**: Search + filter + sort integration
- **Remaining**: Recommendation features require user behavior tracking

**Success Criteria:**
- ✅ Search performs in <100ms (debounced)
- ✅ Sorting is instant for card view
- ✅ Search integrates with filters seamlessly
- ⏳ >50% of users use text search (pending user testing)

### Phase 4: Visual Polish & Illustrations (P2 - Weeks 7-9) - IN PROGRESS

**Goal**: Align with design system, enhance visual appeal, and add view mode toggle.

**Deliverables:**
- ⏳ **IN PROGRESS** View mode toggle (Card/Table view switcher) 
  - ✅ ViewModeToggle component created
  - ✅ WeaponTable component with 8 sortable columns
  - ✅ localStorage persistence for view preference
  - ⏳ URL parameter integration (deferred)
- ⏳ **IN PROGRESS** Table view layout with sortable columns
  - ✅ Sortable columns (Name, Type, Loadout, Damage, DPS, Cost, Attributes, Action)
  - ✅ Click column headers to sort
  - ✅ Visual sort indicators
  - ✅ Weapon type icons in table
- Weapon illustrations (256×256px, all 23 weapons)
- ✅ Weapon type icons (32×32px: Melee, Ballistic, Energy, Shield)
  - ✅ `/icons/weapon-types/melee.svg`
  - ✅ `/icons/weapon-types/ballistic.svg`
  - ✅ `/icons/weapon-types/energy.svg`
  - ✅ `/icons/weapon-types/shield.svg`
- ✅ View mode icons (32×32px: Grid, List)
  - ✅ `/icons/view-modes/grid.svg`
  - ✅ `/icons/view-modes/list.svg`
- Enhanced weapon card design (refined layout, hover states)
- Empty state illustrations and messaging

**Implementation Notes:**
- **Completed**: Core view toggle functionality with card and table views
- **Completed**: Table view with full sorting capability
- **Completed**: All icon assets created
- **Remaining**: Weapon illustrations, enhanced card design, empty states

**Success Criteria:**
- ✅ View mode toggle switches between card and table layouts
- ✅ Table view shows 15-20+ weapons per screen
- ✅ All columns sortable with visual feedback
- ✅ View preference persists between sessions
- All weapons have placeholder or final illustrations (pending)
- Visual design matches design system color palette (mostly complete)
- User feedback on aesthetics is positive (pending user testing)

### Phase 5: Performance & Scalability (P2 - Weeks 10-11)

**Goal**: Optimize for 500+ weapon catalog.

**Deliverables:**
- Pagination or infinite scroll (20-30 weapons per page)
- Lazy loading for weapon images
- Virtualized scrolling (if catalog >100 weapons)
- Image optimization (WebP format, responsive images)
- Caching and memoization

**Success Criteria:**
- Page load time <2 seconds with 100 weapons
- Smooth scrolling at 60 FPS
- No UI freezing during filtering

### Phase 6: Educational Features (P3 - Future)

**Goal**: Help new players understand weapon mechanics.

**Deliverables:**
- ⬜ First-time user tutorial (dismissable)
- ⬜ Inline tooltips for all attributes and stats
- ⬜ "Why recommended?" explanations
- ⬜ Help icons with educational modals
- ⬜ Loadout preview calculator ("How will this affect my robot?")

**Success Criteria:**
- Tutorial completion rate >60%
- Reduced support questions about weapon mechanics
- New user conversion rate increases

---

## Future Considerations

### Phase 2+ Enhancements

**Weapon Crafting Integration**:
- Weapon shop shows base weapons + "Craft Variant" option
- Link to crafting system for custom attribute combinations

**Marketplace Integration**:
- Player-to-player weapon trading
- Dynamic pricing based on supply/demand
- Auction system for rare weapons

**Weapon Rentals**:
- Rent high-tier weapons for limited battles (alternative acquisition model)
- Lower upfront cost, ongoing rental fee per battle

**Seasonal Weapons**:
- Limited-time weapon releases
- Event-exclusive weapons with unique attributes
- "New Arrivals" filter badge

**Weapon Bundles**:
- Purchase pre-configured weapon sets for specific strategies
- Bundle discounts ("Complete Two-Handed Arsenal: 5 weapons, save 20%")

**Advanced Filters**:
- Filter by "Works well with [Robot Name]" (analyze current robot builds)
- Filter by "Popular in [League]" (based on game data)
- Filter by "Under-utilized" (help discover niche weapons)

**Social Features**:
- "Most Popular This Week" section
- "Your friends own this weapon" indicator
- Weapon reviews and ratings (5-star system)

**Personalization**:
- AI-driven recommendations based on play style
- Custom filter presets saved per user
- Recent searches and browsing history

**Gamification**:
- "Weapon Collector" achievements for owning X weapons
- "Dealer" achievements for owning all weapons in a category
- Weapon catalog completion progress bar

---

## Appendix

### A. Weapon Catalog Overview (23 Weapons)

**Current Catalog** (see [PRD_WEAPON_ECONOMY_OVERHAUL.md](PRD_WEAPON_ECONOMY_OVERHAUL.md) for full details):

**Single Weapons (Main Weapon Slot):**
1. Practice Sword (₡50,000) - Starter weapon
2. Laser Rifle (₡220,000) - Energy, ranged
3. Shotgun (₡180,000) - Ballistic, close-range
4. Machine Gun (₡190,000) - Ballistic, rapid-fire
5. Ion Beam (₡260,000) - Energy, sustained beam
6. Combat Blade (₡160,000) - Melee, quick strikes
7. Battle Axe (₡195,000) - Melee, heavy impact
8. Arc Launcher (₡240,000) - Energy, area effect

**Two-Handed Weapons:**
9. Plasma Cannon (₡350,000) - Energy, high damage
10. Railgun (₡400,000) - Ballistic, armor-piercing
11. Power Hammer (₡320,000) - Melee, devastating blows
12. Siege Launcher (₡380,000) - Ballistic, explosive rounds

**Shields (Offhand Weapon Slot):**
13. Combat Shield (₡140,000) - Defensive, shield bonus
14. Energy Barrier (₡200,000) - Advanced shield, energy absorption
15. Reflector Shield (₡180,000) - Counter-focused defense

**Dual-Wield Weapons (Paired):**
16. Dual Pistols (₡175,000 each) - Ballistic, balanced
17. Dual Daggers (₡145,000 each) - Melee, speed-focused
18. Dual SMGs (₡195,000 each) - Ballistic, high fire rate

**Premium Weapons (High-Tier):**
19. Plasma Blade (₡500,000) - Melee, energy-infused
20. Quantum Rifle (₡550,000) - Energy, precision
21. Gravity Hammer (₡580,000) - Melee, two-handed, max damage
22. Disintegrator Cannon (₡650,000) - Energy, two-handed, ultimate weapon
23. Aegis Shield (₡300,000) - Shield, maximum defense

**Loadout Type Distribution**:
- Single: 8 weapons
- Two-Handed: 4 weapons
- Shield: 3 weapons
- Dual-Wield: 3 weapon types (6 individual weapons if paired)
- Versatile (multiple loadout types): 5 weapons

### B. Weapon Images Documentation

**Image Location**: `/prototype/frontend/src/assets/weapons/`

**Image Format**: SVG (256×256px viewBox), scalable vector graphics

**Naming Convention**: Weapon name in lowercase with hyphens (e.g., `practice-sword.svg`)

**Current Implementation Status**: ✅ All 23 weapon placeholder images created

**Image List** (with usage locations):

**Melee Weapons** (Red/Gray theme):
1. `practice-sword.svg` - Practice Sword
   - **Used in**: Card view (192×192px), Detail modal (256×256px)
2. `combat-knife.svg` - Combat Knife
   - **Used in**: Card view, Detail modal
3. `energy-blade.svg` - Energy Blade (blue theme)
   - **Used in**: Card view, Detail modal
4. `plasma-blade.svg` - Plasma Blade (purple theme)
   - **Used in**: Card view, Detail modal
5. `power-sword.svg` - Power Sword
   - **Used in**: Card view, Detail modal
6. `battle-axe.svg` - Battle Axe
   - **Used in**: Card view, Detail modal
7. `heavy-hammer.svg` - Heavy Hammer
   - **Used in**: Card view, Detail modal

**Ballistic Weapons** (Orange/Gray theme):
8. `machine-pistol.svg` - Machine Pistol
   - **Used in**: Card view, Detail modal
9. `machine-gun.svg` - Machine Gun
   - **Used in**: Card view, Detail modal
10. `burst-rifle.svg` - Burst Rifle
    - **Used in**: Card view, Detail modal
11. `assault-rifle.svg` - Assault Rifle
    - **Used in**: Card view, Detail modal
12. `shotgun.svg` - Shotgun
    - **Used in**: Card view, Detail modal
13. `grenade-launcher.svg` - Grenade Launcher (yellow theme)
    - **Used in**: Card view, Detail modal
14. `sniper-rifle.svg` - Sniper Rifle
    - **Used in**: Card view, Detail modal
15. `railgun.svg` - Railgun
    - **Used in**: Card view, Detail modal

**Energy Weapons** (Blue/Purple theme):
16. `laser-pistol.svg` - Laser Pistol (blue)
    - **Used in**: Card view, Detail modal
17. `laser-rifle.svg` - Laser Rifle (blue)
    - **Used in**: Card view, Detail modal
18. `plasma-rifle.svg` - Plasma Rifle (purple)
    - **Used in**: Card view, Detail modal
19. `plasma-cannon.svg` - Plasma Cannon (purple)
    - **Used in**: Card view, Detail modal
20. `ion-beam.svg` - Ion Beam (blue)
    - **Used in**: Card view, Detail modal

**Shields** (Cyan/Blue theme):
21. `light-shield.svg` - Light Shield
    - **Used in**: Card view, Detail modal
22. `combat-shield.svg` - Combat Shield
    - **Used in**: Card view, Detail modal
23. `reactive-shield.svg` - Reactive Shield
    - **Used in**: Card view, Detail modal

**Image Loading**:
- Images loaded via `getWeaponImagePath()` utility function
- Path resolution: weapon name → lowercase → hyphenated → `/src/assets/weapons/${filename}.svg`
- Graceful fallback: If image fails to load, it's hidden (no broken image icon)
- Example: "Practice Sword" → `practice-sword.svg` → `/src/assets/weapons/practice-sword.svg`

**Future Replacement**:
- Current: SVG placeholder images with color-coding
- Future: Professional weapon artwork (PNG/WebP, 256×256px minimum, 512×512px for detail view)
- Replacement process: Replace SVG files with PNG/WebP while maintaining same filenames

**Price Range**:
- Budget (<₡100K): 1 weapon (Practice Sword - starter)
- Entry (₡100-200K): 8 weapons
- Mid (₡200-400K): 8 weapons
- Premium (₡400K+): 6 weapons

### B. Glossary

- **Attribute Bonus**: Numerical increase to one of 23 robot attributes provided by weapon
- **Base Damage**: Raw damage value of weapon before modifiers
- **Cooldown**: Time in seconds between weapon attacks in battle
- **Cost-per-Attribute-Point**: Weapon cost divided by total attribute bonus (value metric)
- **DPS**: Damage Per Second = Base Damage ÷ Cooldown
- **Loadout Type**: Robot configuration determining weapon slot usage (Single, Weapon+Shield, Two-Handed, Dual-Wield)
- **Storage Capacity**: Maximum number of weapons a stable can own (5 base + 5 per Storage Facility level)
- **Value Score**: Composite metric (0-5 stars) indicating weapon cost-effectiveness
- **Weapon Type**: Damage category (Melee, Ballistic, Energy, Shield) - currently cosmetic, future may affect combat mechanics
- **Weapons Workshop**: Facility providing purchase discounts (5% per level, max 50%)

### C. Design System References

**Logo State**: Direction B (Precision)
- Use case: Management, strategic planning, catalog browsing
- Visual: Inner ring rotated 120°, clean lines, technical aesthetic
- Color emphasis: Blue (#58a6ff) for precision and analysis

**Page Hierarchy**:
- H1: "Weapon Shop" (24px, bold)
- H2: Section headers ("Filters", "All Weapons") (18px, semi-bold)
- H3: Category labels ("Loadout Type", "Price Range") (14px, uppercase)
- Body: Stats, descriptions (14px, regular)

**Icon Set** (32×32px):
- Weapon Type: Melee (crossed swords), Ballistic (bullet), Energy (lightning), Shield (shield icon)
- Loadout Type: Single (1 sword), Dual-Wield (2 swords), Two-Handed (large sword), Weapon+Shield (sword+shield)

---

## Changelog

**v1.0** (February 4, 2026): Initial PRD created
- Comprehensive design for Weapon Shop page
- Scalability requirements for 100+ weapons
- Filtering, sorting, comparison, and search systems
- Implementation roadmap (6 phases)
- Success metrics and KPIs defined

---

**Document Status**: ✅ Ready for Review  
**Next Steps**: Review with product team, gather feedback, begin Phase 1 implementation  
**Owner**: Robert Teunissen  
**Last Updated**: February 4, 2026