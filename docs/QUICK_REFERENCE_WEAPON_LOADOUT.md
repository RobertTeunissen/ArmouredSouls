# Quick Reference: Weapon Loadout Implementation

**Total Issues**: 11  
**Estimated Time**: 9-15 days  
**Priority Order**: Complete issues sequentially (1 → 11)

---

## Dependency Flow Chart

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BACKEND FOUNDATION                            │
└─────────────────────────────────────────────────────────────────────┘
    
    Issue #1: Backend Utils ──┐
              (1-2 days)      │
                              ├──→ Issue #2: Storage API
                              │         (0.5-1 day)
                              │              ↓
                              └──────────────┼──→ Issue #3: Equipment API
                                             │         (2-3 days)
                                             │              ↓
                                             └──→ Issue #4: Loadout API
                                                       (1 day)
                                                            ↓

┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND FOUNDATION                           │
└─────────────────────────────────────────────────────────────────────┘

    Issue #5: Frontend Utils ────────┐
           (0.5-1 day)                │
                                      │
    Issue #4: Loadout API ────────────┤
                                      ├──→ Issue #6: Loadout Selector
    Issue #1: Backend Utils ──────────┘         (1-2 days)
                                                      ↓

┌─────────────────────────────────────────────────────────────────────┐
│                         CORE UI FEATURES                             │
└─────────────────────────────────────────────────────────────────────┘

    Issue #6: Loadout Selector ──┐
    Issue #5: Frontend Utils ────┤
    Issue #3: Equipment API ─────┴──→ Issue #7: Equipment UI
                                           (2-3 days)
                                                ↓
                                                │
    ┌───────────────────────────────────────────┘
    │
    ├──→ Issue #8: Stats Display
    │         (1-2 days)
    │              ↓

┌─────────────────────────────────────────────────────────────────────┐
│                     ENHANCED UI & FEATURES                           │
└─────────────────────────────────────────────────────────────────────┘

    Issue #8: Stats Display ──┐
    Issue #7: Equipment UI ───┤
    Issue #3: Equipment API ──┴──→ Issue #9: Inventory Page
                                        (2-3 days)
                                             ↓
                                             │
    Issue #9: Inventory Page ────────────────┤
    Issue #2: Storage API ────────────────────┴──→ Issue #10: Storage UI
                                                         (1-2 days)
                                                              ↓

┌─────────────────────────────────────────────────────────────────────┐
│                          FINAL POLISH                                │
└─────────────────────────────────────────────────────────────────────┘

    ALL PREVIOUS ISSUES ──────────────────────────→ Issue #11: Polish & Testing
                                                          (1-2 days)
```

---

## Critical Path (Must Complete in Order)

### Week 1: Backend Foundation
1. **Issue #1** → Backend Utils (Foundation) ⏱️ 1-2 days
2. **Issue #2** → Storage API ⏱️ 0.5-1 day
3. **Issue #3** → Equipment API ⏱️ 2-3 days
4. **Issue #4** → Loadout API ⏱️ 1 day

**Week 1 Total**: ~5-7 days

### Week 2: Frontend Core
5. **Issue #5** → Frontend Utils ⏱️ 0.5-1 day
6. **Issue #6** → Loadout Selector ⏱️ 1-2 days
7. **Issue #7** → Equipment UI ⏱️ 2-3 days

**Week 2 Total**: ~4-6 days

### Week 2-3: Enhanced Features
8. **Issue #8** → Stats Display ⏱️ 1-2 days
9. **Issue #9** → Inventory Page ⏱️ 2-3 days
10. **Issue #10** → Storage UI ⏱️ 1-2 days

**Optional Polish**:
11. **Issue #11** → Polish & Testing ⏱️ 1-2 days

---

## Can Work in Parallel (After Dependencies Complete)

Once Issue #7 is complete, these can be done simultaneously:
- Issue #8 (Stats Display) 
- Issue #9 (Inventory Page)

Once Issues #8 and #9 are complete:
- Issue #10 (Storage UI)
- Issue #11 (Polish)

---

## Must Have vs Should Have

### MUST HAVE (Core Functionality)
- Issues #1-8: Essential for basic weapon equipment

### SHOULD HAVE (Enhanced Experience)
- Issues #9-10: Better inventory management and UX

### NICE TO HAVE (Polish)
- Issue #11: Final polish and edge cases

---

## User Story Coverage

| Issue | User Stories Covered |
|-------|---------------------|
| #3, #7 | US-1: Equip Weapon to Main Slot |
| #3, #7 | US-2: Equip Offhand Weapon/Shield |
| #3, #7 | US-3: Unequip Weapon from Robot |
| #4, #6 | US-4: Change Robot Loadout Type |
| ~~#9~~ | ~~US-5: View Weapon Inventory~~ (Integrated into Weapon Shop) |
| #8 | US-6: View Effective Stats with Loadout |
| #2, #10 | US-7: Storage Capacity Management |

---

## Testing Strategy

### Unit Tests (Do During Development)
- Issue #1: Backend utility functions
- Issue #5: Frontend utility functions
- Issue #6: React components
- Issue #7: React components
- Issue #8: React components

### Integration Tests (Do After Backend Complete)
- Issue #2: Storage capacity enforcement
- Issue #3: Equipment API endpoints
- Issue #4: Loadout API endpoint

### E2E Tests (Do After Frontend Complete)
- Issue #11: Complete user flows

---

## Key Technical Decisions

### Backend
- **Stat Calculations**: Server-side for data integrity
- **Validation**: Multi-layer (type, slot, loadout compatibility)
- **Transactions**: All equipment changes wrapped in DB transactions

### Frontend
- **State Management**: React hooks + Context (no Redux for now)
- **Stat Calculations**: Mirror backend logic for instant UI feedback
- **API Calls**: Optimistic UI updates with error rollback

### Performance
- **Caching**: Calculate stats on-demand initially
- **Optimization**: Add memoization in Issue #11 if needed
- **Lazy Loading**: Weapon images loaded on demand

---

## Quick Start Guide for Developers

### To Start Issue #1:
```bash
cd prototype/backend
# Create utility files
mkdir -p src/utils
touch src/utils/robotCalculations.ts
touch src/utils/weaponValidation.ts
# Review docs
cat ../../docs/ROBOT_ATTRIBUTES.md
cat ../../docs/WEAPONS_AND_LOADOUT.md
```

### To Start Issue #5:
```bash
cd prototype/frontend
# Create utility file
mkdir -p src/utils
touch src/utils/robotStats.ts
# Review backend implementation
cat ../backend/src/utils/robotCalculations.ts
```

### To Start Issue #6:
```bash
cd prototype/frontend
# Create component
mkdir -p src/components
touch src/components/LoadoutSelector.tsx
# Review API endpoints
cat ../backend/src/routes/robots.ts
```

---

## Verification Checklist

Before closing each issue:
- [ ] All tasks completed
- [ ] Unit tests written and passing
- [ ] Integration tests passing (if applicable)
- [ ] Manual testing completed
- [ ] Code reviewed
- [ ] Documentation updated
- [ ] Acceptance criteria met
- [ ] No regressions in existing features

---

## Emergency Contacts

If blocked or need clarification:
1. Check PRD: `docs/PRD_WEAPON_LOADOUT.md`
2. Check Design Docs: `docs/WEAPONS_AND_LOADOUT.md`, `docs/ROBOT_ATTRIBUTES.md`
3. Comment on GitHub issue
4. Check implementation plan: `docs/IMPLEMENTATION_PLAN_WEAPON_LOADOUT.md`

---

**Last Updated**: January 29, 2026
