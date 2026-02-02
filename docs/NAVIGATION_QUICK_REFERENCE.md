# Navigation Quick Reference

**Last Updated**: February 1, 2026  
**For**: Quick lookups during implementation

---

## Desktop Navigation (Current MVP)

### Top App Bar
```
[AS Logo]  Dashboard | My Robots | Facilities | Weapon Shop | Battle History | [Profile▾] [₡Credits] [Logout]
```

### Future Desktop Navigation (Phase 2+)
```
[AS Logo]  Dashboard | Robots▾ | Battles▾ | Facilities | Shop▾ | Social▾ | [Search🔍] [🔔] [@User▾]
```

**Dropdowns**:
- **Robots▾**: My Robots, Create, Compare, Training
- **Battles▾**: Queue, History, Leagues, Practice, Tournaments
- **Shop▾**: Weapons, Inventory, Marketplace, Crafting
- **Social▾**: Friends, Guild, Chat, Leaderboards (Phase 3+)
- **@User▾**: Profile, Settings, Notifications, Logout

---

## Mobile Navigation (Current MVP)

### Bottom Navigation Bar
```
┌─────────┬─────────┬─────────┬─────────┬─────────┐
│   🏠    │   🤖    │   ⚔️    │   🛒    │   ≡    │
│Dashboard│ Robots  │ Battles │  Shop   │  More   │
└─────────┴─────────┴─────────┴─────────┴─────────┘
```

### Hamburger Menu (More Tab)
```
🛠️ MANAGE STABLE
  › Facilities
  › Weapon Shop
  › Weapon Inventory

🏆 COMPETE
  › Matchmaking
  › Battle History
  › Leagues

⚙️ SETTINGS
  › Profile
  › Settings
  › Logout
```

---

## Complete Page Inventory

### Phase 1: MVP (14 pages)
1. Login (`/login`)
2. Dashboard (`/dashboard`)
3. My Robots (`/robots`)
4. Robot Detail (`/robots/:id`)
5. Create Robot (`/robots/create`)
6. Facilities (`/facilities`)
7. Weapon Shop (`/weapon-shop`)
8. Weapon Inventory (`/weapon-inventory`)
9. Battle History (`/battle-history`)
10. Battle Detail (`/battle/:id`)
11. League Standings (`/league-standings`)
12. Admin Panel (`/admin`) - Admin
13. Registration (`/register`) - Future

### Next Release: Enhanced Features (12 NEW, 25 total)
14. Profile (`/profile`)
15. Settings (`/settings`)
16. Friends (`/friends`)
17. Player Profile (`/player/:id`)
18. Notifications (`/notifications`)
19. Matchmaking Queue (`/matchmaking`)
20. Battle Preparation (`/battle/prepare/:robotId`)
21. Battle Live (`/battle/live/:id`)
23. Practice Arena (`/practice`)
24. Robot Comparison (`/robots/compare`)
25. Training Planner (`/robots/:id/training`)
26. Loadout Presets (`/robots/:id/loadouts`)

### Future - Social: Social (10 NEW, 36 total)
27-30. Guilds (Browser, Detail, My Guild, Management)
31-33. Leaderboards (Global, Regional, Specialized)
34-36. Social (Chat, Replay Sharing, Spectator)

### Future - Tournaments: Tournaments (8 NEW, 44 total)
37-41. Tournaments (Hub, Detail, Registration, Bracket, Lobby)
42-44. Events (Calendar, Detail, Daily Challenges)

### Future - Economy: Economy (8 NEW, 52 total)
45-48. Marketplace (Hub, Search, My Listings, History)
49-50. Crafting (Crafting, Blueprints)
51-52. Advanced (Income Dashboard, Prestige Store)

### Phase 6: Team Battles (6 NEW, 58 total)
53-55. Team (Builder, Matchmaking, History)
56-58. Advanced Modes (Battle Royale, Guild Wars, Story)

### Phase 7: Cosmetics (5 NEW, 63 total)
59-63. Customization (Hub, Skins, Stable, Poses, Emotes)

### Phase 8: Analytics (7 NEW, 70 total)
64-67. Analytics (Dashboard, Robot, Battles, Economy)
68-70. Tools (Simulator, Calculator, Meta Reports)

---

## Navigation Patterns by Platform

### Desktop (>1024px)
- **App Bar**: Always visible, horizontal primary nav
- **Mega Menus**: Rich dropdown content with multiple columns
- **Sidebar**: Contextual secondary nav (collapsible)
- **Breadcrumbs**: Show location hierarchy
- **Command Palette**: Cmd+K / Ctrl+K for power users

### Tablet (768-1023px)
- **Hybrid**: App bar + collapsible side nav
- **Bottom Bar**: Optional for primary actions
- **Touch-Optimized**: Larger tap targets (44×44px)

### Mobile (<768px)
- **Bottom Nav**: 5 primary tabs (thumb-reach)
- **Hamburger Menu**: Secondary navigation drawer
- **FAB**: Floating action button for primary action
- **Mobile Header**: Back button + page title + actions
- **Swipe Gestures**: Navigate between related pages

---

## Progressive Disclosure (Feature Unlocking)

### Prestige-Gated Features
- **1,000 Prestige**: Marketplace access
- **5,000 Prestige**: Analytics dashboard, Guild creation
- **10,000 Prestige**: Simulator, Advanced tools

### Facility-Gated Features
- **Weapons Workshop Level 6**: Crafting unlock
- **Booking Office Level 3**: Tournament access
- **Roster Expansion**: Robot creation limits (1-10 slots)

### Usage-Based Features
- **100 Battles**: Battle analytics unlock
- **10 Friends**: Guild features unlock
- **First Victory**: Leaderboards unlock

---

## Keyboard Shortcuts

### Global Shortcuts
```
D       → Dashboard
R       → Robots
B       → Battle History
F       → Facilities
S       → Weapon Shop
/       → Search / Command Palette
Cmd+K   → Command Palette
?       → Help / Shortcuts
N       → Notifications
```

### Navigation Shortcuts
```
Tab         → Next focusable element
Shift+Tab   → Previous element
Enter       → Activate button/link
Escape      → Close modal/dropdown
Arrow Keys  → Navigate lists/tabs
```

---

## User Flow Templates

### New Player (First Session)
```
Login → Dashboard → Facilities → Create Robot → Weapon Shop → Robot Detail → (Battle - future)
```

### Daily Check-In (Returning Player)
```
Dashboard → Battle History → Battle Detail → Robot Detail (adjust) → Matchmaking → Logout
```

### Robot Optimization (Strategy)
```
Robots → Robot Detail → Battle History → Analytics → Facilities → Robot Detail (upgrade)
```

### Social Engagement (Community)
```
Dashboard → Guilds → My Guild → Chat → Guild Wars → Leaderboards
```

### Tournament (Competitive)
```
Dashboard → Tournament Hub → Tournament Detail → Registration → Lobby → Battle → Bracket
```

---

## Notification Types

### System (Blue)
- Battle completed
- Facility upgrade complete
- Achievement unlocked
- Tournament starting

### Social (Green)
- Friend request
- Guild invitation
- Chat message
- Friend online

### Economic (Yellow)
- Marketplace sale
- Income generated
- Prestige increase

### Warning (Red)
- Robot critical damage
- Tournament closing
- Guild war starting

---

## Implementation Checklist

### Phase 1 (MVP)
- [x] Simple horizontal top nav
- [x] Basic mobile bottom nav
- [x] Logo clickable (returns to dashboard)
- [x] Credits display in header
- [x] Logout button
- [ ] Command palette (Cmd+K)
- [ ] Notification badge
- [ ] User dropdown menu

### Phase 2 (Enhanced)
- [ ] Dropdown mega menus (Robots▾, Battles▾, Shop▾)
- [ ] Search bar with fuzzy search
- [ ] Notification center with badge
- [ ] Breadcrumbs on deep pages
- [ ] Sidebar navigation (Robot Detail, Facilities)
- [ ] Mobile: Enhanced hamburger menu

### Phase 3+ (Advanced)
- [ ] Social section in primary nav
- [ ] Guild notification badges
- [ ] Chat integration
- [ ] Progressive feature unlocking UI
- [ ] Contextual navigation (battle mode, tournament mode)

---

## Quick Design Rules

### Primary Navigation
- **Max 5-7 items** in top nav (desktop)
- **Max 5 tabs** in bottom nav (mobile)
- **Always visible** on all authenticated pages
- **Active state** clearly indicated

### Secondary Navigation
- **Max 8-10 items** per section
- **Grouped logically** by function
- **Icons + labels** for clarity
- **Collapsible** on mobile

### Accessibility
- **Tab-navigable** all elements
- **Focus indicators** visible
- **ARIA labels** for icons
- **Keyboard shortcuts** for power users
- **Screen reader** compatible

---

**Full Documentation**: [NAVIGATION_AND_PAGE_STRUCTURE.md](NAVIGATION_AND_PAGE_STRUCTURE.md)  
**Design System**: [DESIGN_SYSTEM_README.md](DESIGN_SYSTEM_README.md)

**Version**: 1.0 (February 1, 2026)
