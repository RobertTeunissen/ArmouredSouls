# Armoured Souls Design System Documentation

**Last Updated**: February 1, 2026  
**Status**: Complete and Ready for Implementation

---

## 📖 Overview

This folder contains the complete design system documentation for Armoured Souls. These documents are being refined for full alignment with implementation.

---

## 🎯 Start Here

### For Quick Reference
👉 **[DESIGN_SYSTEM_QUICK_REFERENCE.md](DESIGN_SYSTEM_QUICK_REFERENCE.md)**
- Fast lookups: colors, typography, logo usage
- Component code templates
- Common patterns and mistakes to avoid
- Implementation checklists

### For Complete Specifications
👉 **[DESIGN_SYSTEM_AND_UX_GUIDE.md](./DESIGN_SYSTEM_AND_UX_GUIDE.md)**
- Master reference document
- Page-by-page design specifications
- Image requirements and visual strategy
- Emotional design mapped to user journey
- Complete component patterns

### For Navigation Architecture
👉 **[NAVIGATION_AND_PAGE_STRUCTURE.md](./NAVIGATION_AND_PAGE_STRUCTURE.md)**
- Complete navigation system
- Page inventory across all phases
- User flows and logical paths
- Progressive disclosure strategy

---

## 📚 Document Hierarchy

### Tier 1: Strategic Foundation (Brand Docs)
Located in `/docs/brand/` - These define **WHY** we design this way

1. **1_brand_&_logo_design_foundations.md** - Brand premise, player fantasy, emotional targets
2. **2_brand_type_system.md** - Typography selection (Industrial Precision)
3. **2a_logo_geometry_&_construction.md** - Logo construction rules
4. **3_brand_usage_system.md** - Logo usage matrix (B/C/D variants)
5. **4_motion_micro_animation_system.md** - Motion philosophy and rules

**Status**: ✅ LOCKED - Foundation is stable

### Tier 2: Tactical Synthesis (Design System)
Located in `/docs/design_ux/` - These define **WHAT** to implement

1. **DESIGN_SYSTEM_AND_UX_GUIDE.md** - Complete implementation guide
2. **NAVIGATION_AND_PAGE_STRUCTURE.md** - Navigation architecture & page inventory
3. **DESIGN_SYSTEM_QUICK_REFERENCE.md** - Developer handbook

**Status**: In Progress - Being refined with implementation feedback

### Tier 3: Content Specifications (Game Design)
Located in `/docs/` - These define **CONTENT** to visualize

1. **GAME_DESIGN.md** - Core game concept, player fantasy
2. **FRONTEND_UI_REFERENCE.md** - Page structure and UI mapping
3. **ROBOT_ATTRIBUTES.md** - 23 attributes system
4. **STABLE_SYSTEM.md** - 14 facilities system
5. **WEAPONS_AND_LOADOUT.md** - 11 weapons catalog (including Practice Sword)

**Status**: Content inventory defined, docs being updated for accuracy

---

## 🎨 Key Design Decisions

### Brand Identity
- **Player Fantasy**: "I am a manager, not a pilot"
- **Primary Emotions**: Mastery and Pride
- **Visual Style**: Industrial Precision (engineered, not playful)
- **Aesthetic**: Dark theme with metallic materials

### Logo System (Three Variants)
- **Direction B** (Core): Precision, management screens, navigation
- **Direction C** (Energized): Emotional peaks, battles, achievements
- **Direction D** (Minimal): Infrastructure, login, loading, favicon

### Typography
- **Headers/Logo**: DIN Next / Inter Tight (industrial grotesk)
- **UI/Body**: Inter (interface-optimized sans-serif)
- **Style**: Bold for impact, clean for readability

### Color Palette
- **Base**: Dark space black (#0a0e14) with elevated surfaces
- **Accent**: Cyan-blue (#58a6ff) for actions
- **Status**: Green (healthy), Amber (warning), Red (critical)
- **Categories**: 5 colors for attribute groups

### Motion Philosophy
- **Deliberate**: Motion responds to action, not idle
- **Contained**: Energy is internal, not explosive
- **Brief**: Emotional peaks settle quickly (150-300ms)

---

## 🖼️ Visual Asset System

### Asset Categories & Priorities

#### Phase 1 (P0) - MVP Core Identity
1. **Direction B Logo** (all sizes: 32px, 40px, 64px)
2. **Robot Portraits** (3-5 frames: 256×256px, 512×512px)
3. **Weapon Illustrations** (11 weapons: 256×256px, 128×128px)
4. **HP/Shield Bars** (component with color coding)
5. **Currency Icons** (₡ Credits, Prestige)

#### Phase 2 (P1) - Polish & Depth
6. **Attribute Icons** (23 icons: 24×24px SVG)
7. **Facility Illustrations** (14 facilities: 256×256px)
8. **Weapon Type Icons** (4 types: 32×32px SVG)
9. **Navigation Icons** (dashboard, robots, shop, etc.)
10. **Direction D Logo** (login, loading: 16px, 32px, 512px)

#### Phase 3 (P2) - Battle System Enhancement
11. **Direction C Logo** (energized with inner glow for battle screens)
12. **Battle-Ready Poses** (robot combat stances)
13. **Arena Backgrounds** (atmospheric environments)
14. **League Badges** (competitive tier icons)

**Note**: Battle system and league standings are already implemented (/battle-history, /league-standings). P2 focuses on visual enhancements. 

---

## 📋 Page-by-Page Summary

### Core Gameplay Pages (P0)

| Page | Logo | Key Visuals | Emotional Target |
|------|------|------------|------------------|
| **Dashboard** | B | Robot portraits, HP bars | Control, ownership |
| **Robots List** | B | Robot cards with status | Organization, pride |
| **Robot Detail** | B | Hero portrait, weapons, attributes | Mastery, strategy |
| **Weapon Shop** | B | Weapon illustrations, costs | Comparison, planning |
| **Weapon Inventory** | B | Weapons + equipped status | Management, allocation |

**Access**: Robots List shows all your robots (/robots), Robot Detail shows individual robot details (/robot/:id).

### Progression Pages (P1)

| Page | Logo | Key Visuals | Emotional Target |
|------|------|------------|------------------|
| **Facilities** | B | Facility illustrations, levels | Long-term investment |
| **Create/Edit Robot** | B | Robot form, attributes | Planning, customization | 

### Infrastructure Pages (P1)

| Page | Logo | Key Visuals | Emotional Target |
|------|------|------------|------------------|
| **Login/Register** | D | Minimal logo, clean background | Calm entry, professionalism |

### Battle Pages (Implemented)

| Page | Logo | Key Visuals | Emotional Target |
|------|------|------------|------------------|
| **Battle History** | B | Battle log, results | Analysis, learning |
| **Battle Detail** | B | Turn-by-turn log, stats | Understanding mechanics |
| **League Standings** | B | Rankings, ELO, league tiers | Competition, progression |

**Current Access**: /battle-history, /league-standings

---

## ✅ Implementation Readiness Checklist

### Documentation ✅
- [x] Brand strategy defined
- [x] Logo variants specified (B, C, D)
- [x] Typography system locked (Industrial Precision)
- [x] Motion rules established
- [x] Color palette defined
- [x] Asset specifications complete
- [x] Page designs documented
- [x] Component patterns defined
- [x] Priority matrix established
- [x] Alignment verified

### Ready for Asset Production ✅
- [x] Asset categories defined
- [x] Sizes and formats specified
- [x] Priority order established (P0 → P1 → P2)
- [x] Content inventory complete
- [x] Usage guidelines clear



---

## 🚀 Next Steps

### Implementation Priorities
1. Review **DESIGN_SYSTEM_AND_UX_GUIDE.md** for detailed specifications
2. Use **DESIGN_SYSTEM_QUICK_REFERENCE.md** for quick lookups during implementation
3. Start with **P0 assets** (robot portraits, weapons, Direction B logo)
4. Follow specifications for sizes, formats, color palettes
5. Implement component patterns (cards, modals, status bars)
6. Test implementations against brand alignment checklist 

---

## 📊 Success Metrics

### Recognition Speed
- **Current**: 5-10 seconds to identify robots (reading text)
- **Target**: <2 seconds to identify robots (visual recognition)

### Cognitive Load
- **Current**: Text-heavy lists, 23 attribute labels
- **Target**: Scannable cards, icon-based attributes (60% reduction)

### User Experience
- **Current**: "Feels like a prototype/spreadsheet"
- **Target**: "Feels like a complete game"

### Performance
- **Target**: Page load time increase <500ms with full assets

---



---

 

---



---

 

---

## ✨ Status

The design system documentation provides comprehensive guidance for visual implementation. These documents are being refined to ensure full alignment with the current implementation state.

---

**Version**: 1.0 (February 1, 2026)  
**Status**: In Review 
