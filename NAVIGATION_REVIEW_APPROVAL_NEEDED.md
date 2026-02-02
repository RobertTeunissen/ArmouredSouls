# Navigation Review - Items Requiring Approval

## Date: February 2, 2026

This document outlines discrepancies found between the implemented navigation and the design documents, and proposes solutions that require your approval before implementation.

---

## 🔴 Critical Issues Found

### 1. Missing Existing Pages in Navigation

#### League Standings (ALREADY IMPLEMENTED)
- **Route**: `/league-standings`
- **Page**: `LeagueStandingsPage.tsx` exists and works
- **Current Status**: Only in mobile drawer, NOT in desktop primary navigation
- **Issue**: Desktop users can't easily access league standings
- **Proposed Fix**: Add to desktop primary navigation

#### Weapon Inventory (ALREADY IMPLEMENTED)
- **Route**: `/weapon-inventory`
- **Page**: `WeaponInventoryPage.tsx` exists and works
- **Current Status**: In mobile drawer only, NOT in desktop navigation at all
- **Issue**: Desktop users must type URL directly to access
- **Proposed Fix**: Add to desktop navigation (possibly in a dropdown or secondary nav)

---

## ❓ Pages Requiring Decision: Keep or Remove?

### All Robots Page
- **Route**: `/all-robots`
- **Page**: `AllRobotsPage.tsx`
- **Purpose**: Shows ALL robots in the system (from all users), sorted by ELO
- **API Endpoint**: `/api/robots/all/robots`
- **Current Status**: 
  - Accessible from mobile drawer under "COMPETE" section
  - Listed in NAVIGATION_AND_PAGE_STRUCTURE.md as "Global robot database (dev tool)"
  
**Analysis**:
- **Arguments for KEEPING**:
  - Players can scout opponents
  - View global rankings/leaderboard
  - Research popular builds
  - Compare their robots to top performers
  
- **Arguments for REMOVING**:
  - Marked as "dev tool" in docs
  - Could be replaced by "Leaderboards" page (Phase 3)
  - May give away strategic information
  - Not part of core user workflows

**YOUR DECISION NEEDED**: 
- [ ] KEEP - It's useful for players (rename to "Robot Database" or "Global Rankings"?)
- [ ] REMOVE - Replace with proper Leaderboards feature in Phase 3
- [ ] TEMPORARY KEEP - Mark as "Beta" feature, remove when Leaderboards implemented

---

## 📋 Future Features Strategy

According to NAVIGATION_AND_PAGE_STRUCTURE.md, these are planned but not implemented:

### Phase 1 (Current) - Not Yet Implemented
- **Registration Page** (`/register`) - New account creation

### Phase 2 - Planned Future Features
- **Matchmaking Queue** (`/matchmaking`) - Join ranked battles
- **Profile** (`/profile`) - User profile and stats
- **Settings** (`/settings`) - Account settings
- **Friends** (`/friends`) - Social features
- **Notifications** (`/notifications`) - Message inbox

### Phase 3+ - Later Features
- Guilds, Tournaments, Marketplace, etc.

---

## 💡 Proposed Solution: Progressive Disclosure

### Option A: Show All Future Features (Transparent Roadmap)
**Pros**: Players know what's coming, builds excitement
**Cons**: Navigation looks "incomplete", many disabled items

Add all Phase 1-2 items to navigation with visual indicators:
```
Desktop Nav:
Dashboard | My Robots | Facilities | Weapon Shop | Leagues | Profile (Soon) | Settings (Soon)

Mobile Drawer:
MANAGE STABLE
- My Robots
- Facilities  
- Weapon Shop
- Weapon Inventory

COMPETE
- Matchmaking (Phase 2)
- Battle History
- Leagues
- Tournaments (Phase 4)

SOCIAL
- Friends (Phase 2)
- Guild (Phase 3)
- Chat (Phase 3)

SETTINGS
- Profile (Phase 2)
- Settings (Phase 2)
- Logout
```

### Option B: Show Only Current + Next Phase (Progressive)
**Pros**: Cleaner navigation, less clutter
**Cons**: Players don't see long-term roadmap

Show Phase 1 (current) + Phase 2 (next):
- All currently implemented pages
- Phase 2 pages marked as "Coming Soon"
- Phase 3+ hidden until Phase 2 complete

### Option C: Current Only (Minimal)
**Pros**: Clean, focused, no disabled items
**Cons**: No sense of future features

Only show implemented features, add new ones as they're built.

---

## 🎨 Visual Design for Future Items

If we show future features, they should be clearly differentiated:

### Disabled/Future Item Styling
```css
Text Color: text-tertiary (muted gray)
Background: No hover effect
Cursor: not-allowed or help
Badge: "Soon" or "Phase 2" pill
Opacity: 0.6
Tooltip: "Coming in Phase 2 - Q2 2026"
```

### Example Components
```tsx
// Regular active link
<NavLink to="/robots">My Robots</NavLink>

// Future feature link
<FutureNavLink phase="2" tooltip="Coming Q2 2026">
  Profile
  <Badge>Soon</Badge>
</FutureNavLink>
```

---

## ✅ Your Decisions Required

Please respond with:

### 1. All Robots Page
- [ ] **KEEP** - Rename to "______" and keep in navigation
- [ ] **REMOVE** - Delete page and route
- [ ] **MARK AS BETA** - Keep but add "Beta" label, plan to remove later

### 2. Future Features Display Strategy
- [ ] **Option A** - Show all future features with badges (transparent roadmap)
- [ ] **Option B** - Show current + next phase only (progressive)
- [ ] **Option C** - Show current only, add features as built (minimal)

### 3. Missing Pages - Add Where?

**League Standings** (exists, needs desktop nav access):
- [ ] Add to desktop primary navigation (top bar)
- [ ] Add to desktop "More" dropdown/menu
- [ ] Keep mobile-only (current state)

**Weapon Inventory** (exists, needs desktop nav access):
- [ ] Add to desktop primary navigation (top bar)
- [ ] Add to desktop "Facilities" dropdown
- [ ] Add to desktop "More" dropdown/menu
- [ ] Keep mobile-only (current state)

### 4. Phase Prioritization
Which future features (if any) should be shown first?
- [ ] Profile & Settings
- [ ] Matchmaking
- [ ] Social (Friends, Guild)
- [ ] None - wait until implemented

---

## 📝 Next Steps

Once you provide decisions above, I will:

1. **Immediate Changes** (no approval needed):
   - Fix missing routes (Leagues, Weapon Inventory) in desktop nav
   
2. **After Your Approval**:
   - Remove or keep All Robots page
   - Implement future feature display strategy
   - Add "Coming Soon" badges and styling
   - Update documentation

3. **Testing**:
   - Verify all navigation links work
   - Test on mobile and desktop
   - Take screenshots for review
   - Update PRD documentation

---

**Please review and provide your decisions so I can proceed with implementation.**
