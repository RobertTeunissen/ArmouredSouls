# Quick Reference: Weapon Shop Design

**Last Updated**: February 4, 2026  
**Full PRD**: [PRD_WEAPON_SHOP.md](PRD_WEAPON_SHOP.md)

**Revision History:**
- v1.0 (Feb 4, 2026): Initial quick reference
- v1.1 (Feb 4, 2026): Added table view mode, updated implementation status, added backend requirements summary

> **Quick access guide** to the Weapon Shop design specifications. For complete details, see the full PRD.

---

## TL;DR

**Mission**: Design a weapon shop that scales from 23 weapons to 100+ weapons while maintaining excellent UX.

**Core Solution**: Multi-criteria filtering + comparison tools + smart sorting + dual view modes (card/table) = find the right weapon in <30 seconds.

---

## Key Features

### 1. View Mode Toggle (NEW)
- **Card View**: Visual grid with weapon illustrations, detailed at a glance
- **Table View**: Compact table with sortable columns, shows 15-20+ weapons per screen
- **Toggle Control**: Prominent button (grid/list icons)
- **State Persistence**: View preference saved between sessions
- **Filter Compatibility**: All filters/sorting work in both views

### 2. Multi-Criteria Filtering
- **Loadout Type**: Single, Weapon+Shield, Two-Handed, Dual-Wield
- **Weapon Type**: Melee, Ballistic, Energy, Shield
- **Price Range**: Budget, Mid, Premium, Luxury
- **Quick Filters**: Can Afford, Storage Available, Show Only Owned
- **Attribute Focus**: Offensive, Defensive, Mobility, Balanced

### 3. Advanced Sorting
- Recommended (default)
- Price (Low→High, High→Low)
- Damage (High→Low)
- DPS (High→Low)
- Attribute Total (High→Low)
- Best Value (cost-per-attribute)
- Name (A-Z)

### 4. Comparison Mode
- Select 2-3 weapons
- Side-by-side stat comparison
- Highlight highest/lowest values
- Value metrics: DPS, cost-per-attribute, efficiency scores
- Purchase directly from comparison view

### 5. Search
- Real-time text search (weapon names)
- Debounced (300ms)
- Combines with active filters
- "No results" suggestions

### 6. Economic Context
- Prominent storage display: "18/25 weapons"
- Weapon Workshop discount badges: "Save ₡25K (15% off)"
- Affordability indicators: Green checkmark / Red X
- "Can Afford" quick filter

---

## View Modes

### Card View (Visual/Detailed)
**Best For**: Visual browsing, seeing artwork, discovery  
**Layout**: Grid of cards (3-4 columns desktop)  
**Shows**: Weapon illustration, name, type, stats, actions

### Compact Card View
```
┌────────────────────────────┐
│   [Weapon Illustration]    │ 256×256px
├────────────────────────────┤
│ [Type] Weapon Name         │
│ ₡150,000 (-15%) Save ₡25K  │
│ ⚔ Dmg: 120  ⏱ CD: 2.5s    │
│ 📊 DPS: 48  ⭐ +12 Attrs   │
├────────────────────────────┤
│ [Purchase] [Compare] [ℹ]   │
└────────────────────────────┘
```

### Table View (Compact/Scannable) - NEW
**Best For**: Quick scanning, comparing many weapons, data-driven decisions  
**Layout**: Sortable table with multiple columns  
**Shows**: 15-20+ weapons per screen

```
┌──────────────────────────────────────────────────────────────────┐
│ Name        │ Type   │ Loadout │ Dmg │ DPS │ Cost  │ Attr │ Act │
├──────────────────────────────────────────────────────────────────┤
│ [⚡] Laser  │ Energy │ Single  │ 120 │ 48  │ ₡220K │ +12  │ [B] │
│     Rifle   │        │         │     │     │ -15%  │      │  ☐  │
├──────────────────────────────────────────────────────────────────┤
│ [🔫] Machine│Ballist │ Single, │  80 │ 40  │ ₡190K │ +11  │ [B] │
│     Gun     │   ic   │   Dual  │     │     │       │      │  ☐  │
└──────────────────────────────────────────────────────────────────┘
```

**Table Features**:
- Click column header to sort
- Click row to open weapon detail modal
- Checkbox for comparison selection
- Color-coded affordability (green/red rows)

---

## Legacy Card Designs
```
┌────────────────────────────┐
│   [Weapon Illustration]    │ 256×256px
├────────────────────────────┤
│ [Type] Weapon Name         │
│ ₡150,000 (-15%) Save ₡25K  │
│ ⚔ Dmg: 120  ⏱ CD: 2.5s    │
│ 📊 DPS: 48  ⭐ +12 Attrs   │
├────────────────────────────┤
│ [Purchase] [Compare] [ℹ]   │
└────────────────────────────┘
```

### Detailed View (Optional)
- 400×600px expanded card
- Full attribute list
- Description text
- Loadout compatibility
- Value analysis

### Detail Modal (Full Info)
- 800×900px modal
- 512×512px weapon image
- Complete specifications
- Similar weapons
- Purchase + Comparison actions

---

## Responsive Design

### Mobile (≤640px)
- Single column
- Off-canvas filter drawer
- Large tap targets
- Simplified cards
- Max 2 weapons for comparison

### Tablet (641-1024px)
- 2 column grid
- Collapsible side filter panel

### Desktop (≥1025px)
- 3-4 column grid
- Persistent left sidebar filters
- Full comparison view

---

## Backend & Database Requirements

### Summary: ✅ NO CHANGES REQUIRED

All features can be implemented with **frontend-only changes**.

**Why:**
- Existing API endpoints sufficient (`GET /api/weapons`, purchase, inventory, storage)
- All filter/sort data already in weapon model
- Client-side filtering/sorting is performant for 23-100 weapons
- View mode toggle is presentational (frontend)
- Comparison and recommendations are client-side logic

**Existing APIs Used:**
- `GET /api/weapons` - Returns all weapons
- `POST /api/weapon-inventory/purchase` - Purchase weapon
- `GET /api/weapon-inventory` - User's owned weapons
- `GET /api/weapon-inventory/storage-status` - Storage capacity
- `GET /api/facilities` - Weapon Workshop level for discounts

**Future Optimization** (if catalog exceeds 200+ weapons):
- Add server-side filtering query params
- Implement backend pagination
- Add database full-text search

**Current Recommendation**: Implement entirely in frontend using existing APIs.

---

## Performance Targets

| Metric | Target |
|--------|--------|
| Page load (100 weapons) | <2 seconds |
| Filter response | <200ms |
| Search response | <300ms |
| Scroll FPS | 60 FPS |

---

## Implementation Phases

### Phase 1: Filtering & Sorting (P0 - Weeks 1-2)
Multi-criteria filtering, sorting, URL state

### Phase 2: Comparison (P1 - Weeks 3-4)
Comparison mode, detail modal, value metrics

### Phase 3: Search & Discovery (P1 - Weeks 5-6)
Text search, recommendations, quick presets

### Phase 4: Visual Polish & View Modes (P2 - Weeks 7-9)
Weapon illustrations, table view toggle, refined card design

### Phase 5: Performance (P2 - Weeks 10-11)
Pagination, lazy loading, virtualization

### Phase 6: Educational (P3 - Future)
Tutorials, tooltips, help system

---

## Design System Alignment

**Logo State**: Direction B (Precision)

**Colors**:
- Primary: #58a6ff (blue - Purchase buttons)
- Success: #3fb950 (green - affordability)
- Warning: #d29922 (yellow - storage warnings)
- Error: #f85149 (red - insufficient credits)
- Surface: #0d1117 (dark background)
- Card: #161b22 (elevated surface)

**Typography**:
- Headings: Inter, bold, 24px/18px
- Body: Inter, regular, 14px
- Numbers: Inter, medium, 16px (prices, stats)

---

## Success Metrics

### Usability
- Time to find weapon: <30 seconds
- Filter usage: >70%
- Comparison usage: >40%
- View mode toggle adoption: >60%

### Engagement
- Weapons viewed per session: 10-20
- Purchase completion rate: >85%
- Return visits per week: 2-3

### Economic
- Weapon Workshop upgrade rate: >30%
- Storage upgrade rate: >40%

---

## User Stories Summary

1. **Browse Catalog**: See all weapons in organized grid
2. **Filter by Loadout**: Show only compatible weapons
3. **Filter by Type**: Focus on Melee/Ballistic/Energy/Shield
4. **Filter by Price**: Budget constraints
5. **Search by Name**: Quick text search
6. **Compare Weapons**: Side-by-side analysis
7. **View Details**: Complete weapon information
8. **Understand Value**: Cost-effectiveness metrics
9. **Purchase Weapon**: Buy and add to inventory
10. **View Constraints**: Understand purchase blockers
11. **Understand Discounts**: Weapon Workshop benefits
12. **Sort Weapons**: Organize by criteria
13. **View Owned**: See owned weapons
14. **Mobile Browsing**: Touch-optimized
15. **Large Catalog**: Performant with 100+ weapons

---

## API Endpoints

### GET /api/weapons
Returns all weapons with full specifications

### POST /api/weapon-inventory/purchase
Purchase weapon (deducts credits, adds to inventory)

### GET /api/weapon-inventory/storage-status
Returns current/max storage capacity

### GET /api/weapon-inventory
Returns user's owned weapons with counts

---

## Key Dependencies

- [PRD_WEAPON_ECONOMY_OVERHAUL.md](PRD_WEAPON_ECONOMY_OVERHAUL.md) - Weapon pricing
- [WEAPONS_AND_LOADOUT.md](WEAPONS_AND_LOADOUT.md) - Weapon catalog
- [DESIGN_SYSTEM_AND_UX_GUIDE.md](design_ux/DESIGN_SYSTEM_AND_UX_GUIDE.md) - Design system
- [STABLE_SYSTEM.md](STABLE_SYSTEM.md) - Weapons Workshop discounts
- [ROBOT_ATTRIBUTES.md](ROBOT_ATTRIBUTES.md) - 23 robot attributes

---

## Future Enhancements (Phase 2+)

- Weapon crafting integration
- Player-to-player marketplace
- Weapon rentals
- Seasonal/event weapons
- Weapon bundles
- Social features (reviews, ratings)
- AI-driven recommendations
- Collector achievements

---

**For Complete Details**: See [PRD_WEAPON_SHOP.md](PRD_WEAPON_SHOP.md)
