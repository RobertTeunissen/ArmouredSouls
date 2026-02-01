# Frontend UI Reference

**Last Updated**: January 30, 2026  
**Status**: Phase 1 Prototype Implementation  
**Version**: 1.0

---

## Overview

This document maps game design concepts to UI implementation, showing where players access each feature and why. It serves as a bridge between design documentation and frontend code, helping developers understand the information architecture and user experience decisions.

**Target Audience:**
- Frontend developers implementing UI
- UX designers planning user flows
- Product owners reviewing user experience
- New team members onboarding

---

## Page Structure

### 1. Dashboard Page

**Route**: `/dashboard`  
**Component**: `DashboardPage.tsx`  
**Purpose**: Overview of stable status and quick access to main features

**Displays**:
- Current Credits balance ([STABLE_SYSTEM.md](STABLE_SYSTEM.md))
- Current Prestige level ([STABLE_SYSTEM.md](STABLE_SYSTEM.md))
- Active robots list with HP status
- Recent battle results (future)
- Stable statistics (total battles, wins, win rate)

**Why This Information?**
- Credits and Prestige are core resources that influence all player decisions
- HP status shows which robots need repair (immediate economic decision)
- Stable statistics provide performance overview
- Centralized hub for quick navigation to all major features

**Key Components**:
- `Navigation` - Main navigation bar with Credits/Prestige display
- Robot roster cards - HP bars, ELO, quick actions
- Stable statistics summary

**User Actions**:
- View stable overview
- Navigate to Robots page
- Navigate to Facilities page
- Navigate to Weapon Shop/Inventory
- Quick access to robot details

**Related Documentation**:
- [STABLE_SYSTEM.md](STABLE_SYSTEM.md) - Credits, Prestige, and stable management
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - User model with stable fields

---

### 2. Robots Page

**Route**: `/robots`  
**Component**: `RobotsPage.tsx`  
**Purpose**: View and manage all robots in stable

**Displays**:
- List of all robots owned by player
- Robot name, frame, HP status, ELO rating
- Quick stats for each robot
- Create new robot button

**Why This Information?**
- Central management hub for all robots
- Overview of entire roster at a glance
- Quick access to individual robot details
- Shows which robots are battle-ready vs damaged

**Key Components**:
- Robot cards/list items
- Create robot button
- Navigation to robot details

**User Actions**:
- View all robots
- Click robot to view details
- Navigate to create new robot
- Filter/sort robots (future enhancement)

**Related Documentation**:
- [ROBOT_ATTRIBUTES.md](ROBOT_ATTRIBUTES.md) - Robot attributes and state
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - Robot model

---

### 3. Robot Detail Page

**Route**: `/robots/:id`  
**Component**: `RobotDetailPage.tsx`  
**Purpose**: Configure individual robot for battle and view comprehensive stats

**Displays**:
- **Robot Identity**: Name (editable), frame, ELO rating
- **Combat State**: Current HP, Current Shield, damage taken ([ROBOT_ATTRIBUTES.md](ROBOT_ATTRIBUTES.md))
- **Weapon Slots**: Main weapon, Offhand weapon ([WEAPONS_AND_LOADOUT.md](WEAPONS_AND_LOADOUT.md))
- **Loadout Configuration**: 4 loadout types (single, weapon_shield, two_handed, dual_wield)
- **Battle Stance**: 3 stance options (offensive, defensive, balanced)
- **Yield Threshold**: Slider 0-50% with repair cost preview
- **Attributes**: All 23 attributes with effective stats showing base + weapon + loadout bonuses
- **Performance Stats**: Battles, wins, losses, damage dealt/taken

**Why This Information?**
- All pre-battle configuration in one centralized location
- Real-time stat preview helps players understand impact of equipment/stance choices
- Weapon equipment shows available tactical options
- Stance and yield are per-battle settings that need easy access
- Effective stats calculation transparency builds player trust

**Key Components**:
- `LoadoutSelector` - Radio buttons for 4 loadout types
- `StanceSelector` - Radio buttons for 3 stance types
- `YieldThresholdSlider` - 0-50% slider with repair cost preview
- `WeaponSlot` - Main and offhand weapon slots with equip/unequip
- `WeaponSelectionModal` - Modal for selecting weapons from inventory
- `StatComparison` - Breakdown of base + weapon + loadout bonuses
- `EffectiveStatsTable` - Display of all 23 attributes with effective values
- `CompactAttributeRow` - Individual attribute display
- `PerformanceStats` - Battle history and statistics

**User Actions**:
- Edit robot name
- Equip/unequip weapons → Opens `WeaponSelectionModal`
- Change loadout type → Validates weapon compatibility, updates stats
- Change battle stance → Updates stat preview immediately
- Adjust yield threshold → Updates repair cost estimate
- Navigate to attribute upgrade (future)
- View detailed attribute breakdown

**Design Decisions**:
- **Why all on one page?** Players need to see how all settings interact; splitting across pages would require mental context switching
- **Why show effective stats?** Transparency in calculations builds trust and helps players make informed decisions
- **Why real-time updates?** Immediate feedback helps players understand consequences of choices

**Related Documentation**:
- [ROBOT_ATTRIBUTES.md](ROBOT_ATTRIBUTES.md) - All 23 attributes, stance system, yield threshold
- [WEAPONS_AND_LOADOUT.md](WEAPONS_AND_LOADOUT.md) - Loadout types and weapon system
- [PRD_BATTLE_STANCES_AND_YIELD.md](PRD_BATTLE_STANCES_AND_YIELD.md) - Stance and yield implementation requirements
- [PRD_WEAPON_LOADOUT.md](PRD_WEAPON_LOADOUT.md) - Weapon loadout implementation requirements

---

### 4. Create Robot Page

**Route**: `/robots/create`  
**Component**: `CreateRobotPage.tsx`  
**Purpose**: Purchase new robot frame and add to roster

**Displays**:
- Current Credits balance
- Robot frame cost (₡500,000)
- Robot frame selection (future: multiple frame types)
- Name input field
- Roster capacity indicator (current/max slots)

**Why This Information?**
- Clear cost transparency before purchase
- Shows if player has enough Credits
- Roster capacity prevents over-purchasing
- Name customization for player attachment

**Key Components**:
- Robot frame selector
- Name input field
- Purchase/create button
- Credits balance display

**User Actions**:
- Enter robot name
- Select frame type (currently single default)
- Create robot (deducts Credits)
- Navigate to new robot detail page

**Related Documentation**:
- [ROBOT_ATTRIBUTES.md](ROBOT_ATTRIBUTES.md) - Robot creation, initial HP/Shield
- [STABLE_SYSTEM.md](STABLE_SYSTEM.md) - Credits, Roster Expansion facility

---

### 5. All Robots Page

**Route**: `/all-robots`  
**Component**: `AllRobotsPage.tsx`  
**Purpose**: View global robot database (development/admin view)

**Displays**:
- All robots in the system (not just user's)
- Robot details across all users
- For development and testing purposes

**Why This Page?**
- Development tool for viewing all game data
- Testing and debugging functionality
- May evolve into leaderboard/rankings in future

**Key Components**:
- Robot listing (all users)
- Filter/search controls (future)

**User Actions**:
- Browse all robots in system
- View robot details

**Related Documentation**:
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - Robot model

---

### 6. Weapon Shop Page

**Route**: `/weapon-shop`  
**Component**: `WeaponShopPage.tsx`  
**Purpose**: Browse and purchase weapons from catalog

**Displays**:
- All 11 weapons with specifications ([WEAPONS_AND_LOADOUT.md](WEAPONS_AND_LOADOUT.md))
- Weapon name, type, base damage, cooldown, cost
- Attribute bonuses preview
- Storage capacity remaining (X/Y weapons)
- Weapons Workshop discount (if facility upgraded)

**Why This Information?**
- Complete weapon catalog visible for comparison shopping
- Storage capacity prevents accidental over-purchase
- Discount visibility encourages facility upgrades
- Clear attribute bonuses help players make informed choices

**Key Components**:
- Weapon cards with specifications
- Purchase buttons
- Storage capacity indicator
- Filter controls (by weapon type: Energy, Ballistic, Melee, Shield)

**User Actions**:
- Browse all available weapons
- Filter by weapon type
- View weapon details and attribute bonuses
- Purchase weapon → `POST /api/weapon-inventory/purchase`
- Navigate to Storage Facility upgrade (if at capacity)

**Related Documentation**:
- [WEAPONS_AND_LOADOUT.md](WEAPONS_AND_LOADOUT.md) - Complete weapon catalog
- [STABLE_SYSTEM.md](STABLE_SYSTEM.md) - Storage Facility, Weapons Workshop discount

---

### 7. Weapon Inventory Page

**Route**: `/weapon-inventory`  
**Component**: `WeaponInventoryPage.tsx`  
**Purpose**: View all owned weapons and manage equipment

**Displays**:
- All owned weapons (equipped and unequipped)
- Which robot is using each weapon
- Storage capacity usage (current/max)
- Weapon specifications (damage, cooldown, bonuses)
- Equipped status indicator

**Why This Information?**
- Central hub for weapon management
- Shows which weapons are available vs in use
- Helps players decide which weapons to equip where
- Visual indication of weapon allocation across robots

**Key Components**:
- Weapon inventory cards
- Storage capacity indicator
- Equipped status badges
- Filter controls (type, status)
- Weapon detail modal (future)

**User Actions**:
- View all owned weapons
- Filter by weapon type or equipped status
- Search by weapon name (future)
- Click weapon to see full details (future)
- Quick equip from inventory to robot (future)
- Unequip weapon from robot (future)

**Related Documentation**:
- [WEAPONS_AND_LOADOUT.md](WEAPONS_AND_LOADOUT.md) - Weapon inventory management
- [STABLE_SYSTEM.md](STABLE_SYSTEM.md) - Storage Facility capacity

---

### 8. Facilities Page

**Route**: `/facilities`  
**Component**: `FacilitiesPage.tsx`  
**Purpose**: Upgrade stable facilities for permanent benefits

**Displays**:
- All 14 facility types ([STABLE_SYSTEM.md](STABLE_SYSTEM.md))
- Current level for each facility
- Next level cost and benefits
- Operating costs per day
- Prestige requirements (if applicable)
- Credits balance

**Why This Information?**
- Long-term investment decisions require clear cost-benefit analysis
- Operating costs visible for economic planning
- Prestige requirements show progression gates
- Centralized view of all stable improvements

**Key Components**:
- Facility cards (14 facilities)
- Current level indicator
- Upgrade button with cost
- Benefits description
- Operating cost display
- Prestige requirement indicator

**User Actions**:
- View all facilities and their benefits
- Purchase/upgrade individual facilities
- Compare costs and benefits
- See progression requirements (prestige gates)

**Facilities List**:
1. Repair Bay - Repair cost discounts
2. Training Facility - Attribute upgrade discounts
3. Weapons Workshop - Weapon purchase discounts
4. Research Lab - Analytics and loadout presets
5. Medical Bay - Critical damage cost reduction
6. Roster Expansion - Additional robot slots
7. Storage Facility - Weapon storage capacity
8. Coaching Staff - Stable-wide attribute bonuses
9. Booking Office - Tournament access
10. Combat Training Academy - Combat Systems attribute caps
11. Defense Training Academy - Defensive Systems attribute caps
12. Mobility Training Academy - Chassis & Mobility attribute caps
13. AI Training Academy - AI Processing attribute caps
14. Income Generator - Passive income streams

**Related Documentation**:
- [STABLE_SYSTEM.md](STABLE_SYSTEM.md) - Complete facility system with all levels and costs

---

### 9. Login Page

**Route**: `/login`  
**Component**: `LoginPage.tsx`  
**Purpose**: User authentication

**Displays**:
- Login form (username/email, password)
- Register option (link to register form)
- Error messages for failed authentication

**Why This Page?**
- Security and user account management
- Separates user data and progress
- Entry point to application

**Key Components**:
- Login form
- Authentication error display
- Register link

**User Actions**:
- Enter credentials and login
- Navigate to registration (if new user)
- Access protected pages after authentication

**Related Documentation**:
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - User model
- [SECURITY.md](SECURITY.md) - Authentication approach

---

## Information Architecture Principles

### 1. Progressive Disclosure
- **Dashboard**: High-level overview of stable status and quick navigation
- **Detail Pages**: Comprehensive information (Robot Detail, Facilities)
- **Modals**: Context-specific actions (Weapon Selection Modal)

**Rationale**: Prevents information overload while ensuring all data is accessible when needed

### 2. Task-Oriented Organization
- **Pre-Battle Flow**: Robot Detail → Configure Loadout/Stance/Yield → Battle (future)
- **Progression Flow**: Attribute Upgrades (future) → Facility Upgrades
- **Management Flow**: Weapon Shop → Weapon Inventory → Robot Equipment

**Rationale**: Pages organized around player goals, not arbitrary categories

### 3. Contextual Information
- **Economic Context**: Credits always visible in navigation header
- **Battle Context**: HP status always visible on robot cards
- **Capacity Context**: Storage capacity shown when purchasing weapons

**Rationale**: Critical information available without navigation, reducing cognitive load

### 4. Consistent Navigation

**Main Navigation** (present on all pages):
- Dashboard
- Robots
- Weapon Shop
- Weapon Inventory
- Facilities
- Credits (display only)
- Prestige (display only)

**Breadcrumbs**: Show current location in hierarchy (future enhancement)

**Quick Actions**: Buttons on cards for common actions (Equip, Upgrade, Repair)

**Rationale**: Predictable navigation reduces learning curve, improves efficiency

---

## Design Rationale: Why This Page Structure?

### Separation of Concerns

**Robot Detail Page**: Pre-battle configuration (stance, yield, loadout, weapons)
- *Why separate?* Players need to see how all settings interact for tactical decisions

**Attribute Upgrade Page** (future): Long-term progression via Credits
- *Why separate?* Upgrades are strategic decisions separate from battle tactics

**Weapon Shop**: Acquisition of new weapons
- *Why separate?* Shopping experience distinct from management/equipment

**Weapon Inventory**: Management of owned weapons
- *Why separate?* Different mental model - "what do I own?" vs "what can I buy?"

**Facilities**: Stable-wide permanent upgrades
- *Why separate?* Long-term investment decisions require focused comparison

### User Flow Optimization

**New Player Journey**:
```
1. Login → Start
2. Dashboard → See starting resources (₡2,000,000)
3. Robots → View first robot
4. Robot Detail → Understand robot capabilities
5. Weapon Shop → Purchase first weapon
6. Robot Detail → Equip weapon, configure loadout/stance
7. (Battle) → Play battle (future)
8. Robot Detail → See damage, understand repair needs
9. Facilities → Upgrade Repair Bay for discounts
10. Repeat cycle
```

**Returning Player Journey**:
```
1. Dashboard → Check Credits, Prestige, robot status
2. Robot Detail → Quick configuration adjustments
3. (Battle) → Play (future)
```

**Optimization Decisions**:
- Dashboard as default route (immediate context)
- Robot Detail as comprehensive hub (reduce page jumping)
- Weapon Shop and Inventory separate (different mental models)
- All facilities on one page (enables comparison)

---

## Component Hierarchy

### Shared Components (Used Across Pages)

**Navigation** (`Navigation.tsx`)
- Location: All pages
- Purpose: Main navigation, Credits/Prestige display, user menu
- Props: Current page, user data

### Robot Detail Page Components

**LoadoutSelector** (`LoadoutSelector.tsx`)
- Location: Robot Detail Page
- Purpose: Select from 4 loadout types
- Props: Current loadout, onChange handler, weapon compatibility
- Related: [WEAPONS_AND_LOADOUT.md](WEAPONS_AND_LOADOUT.md)

**StanceSelector** (`StanceSelector.tsx`)
- Location: Robot Detail Page
- Purpose: Select from 3 battle stances
- Props: Current stance, onChange handler
- Related: [ROBOT_ATTRIBUTES.md](ROBOT_ATTRIBUTES.md) - Battle Stance section

**YieldThresholdSlider** (`YieldThresholdSlider.tsx`)
- Location: Robot Detail Page
- Purpose: Set HP percentage for surrender (0-50%)
- Props: Current threshold, onChange handler, repair cost preview
- Related: [ROBOT_ATTRIBUTES.md](ROBOT_ATTRIBUTES.md) - Yield Threshold section

**WeaponSlot** (`WeaponSlot.tsx`)
- Location: Robot Detail Page
- Purpose: Display and manage weapon equipment
- Props: Slot type (main/offhand), equipped weapon, onEquip/onUnequip handlers
- Related: [WEAPONS_AND_LOADOUT.md](WEAPONS_AND_LOADOUT.md)

**WeaponSelectionModal** (`WeaponSelectionModal.tsx`)
- Location: Triggered from Robot Detail Page
- Purpose: Select weapon from inventory for equipment
- Props: Available weapons, slot type, onSelect handler
- Related: [WEAPONS_AND_LOADOUT.md](WEAPONS_AND_LOADOUT.md)

**StatComparison** (`StatComparison.tsx`)
- Location: Robot Detail Page
- Purpose: Show stat breakdown (base + weapon + loadout bonuses)
- Props: Robot attributes, weapons, loadout type
- Related: [ROBOT_ATTRIBUTES.md](ROBOT_ATTRIBUTES.md) - Effective Stat Calculation

**EffectiveStatsTable** (`EffectiveStatsTable.tsx`)
- Location: Robot Detail Page
- Purpose: Display all 23 attributes with effective values
- Props: Robot, weapons, loadout, stance
- Related: [ROBOT_ATTRIBUTES.md](ROBOT_ATTRIBUTES.md)

**CompactAttributeRow** (`CompactAttributeRow.tsx`)
- Location: Robot Detail Page (within attribute displays)
- Purpose: Single attribute display with level and bonuses
- Props: Attribute name, base value, bonuses, effective value

**PerformanceStats** (`PerformanceStats.tsx`)
- Location: Robot Detail Page
- Purpose: Display battle history and performance metrics
- Props: Robot statistics (battles, wins, losses, damage)
- Related: [ROBOT_ATTRIBUTES.md](ROBOT_ATTRIBUTES.md) - Performance Tracking

**CompactUpgradeSection** (`CompactUpgradeSection.tsx`)
- Location: Robot Detail Page
- Purpose: Display attribute upgrade options (future)
- Props: Attribute, upgrade cost, handler

### Other Shared Components

**StableNameModal** (`StableNameModal.tsx`)
- Location: Dashboard or settings (future)
- Purpose: Edit stable name
- Props: Current name, onSave handler

**ProtectedRoute** (`ProtectedRoute.tsx`)
- Location: App routing
- Purpose: Authentication guard for protected pages
- Props: Children components

---

## Mobile Considerations

### Responsive Design Priorities (Future Phase)

**Phase 1 is desktop-focused.** Mobile optimization planned for Phase 2+.

1. **Dashboard**: Stack robot cards vertically, collapsible sections
2. **Robot Detail**: Tabs for different configuration sections (Weapons, Stance, Stats)
3. **Weapon Shop**: Grid → List view on mobile
4. **Weapon Inventory**: List view with expandable cards
5. **Facilities**: Grid → List with expandable detail views

### Touch Targets (Future)
- Minimum 44x44px tap targets
- Adequate spacing between interactive elements
- Large, clear action buttons

---

## Accessibility Considerations (Future Phase)

### Screen Reader Support
- Clear heading hierarchy (h1 → h2 → h3)
- ARIA labels for interactive elements
- Descriptive button text (not just icons)

### Keyboard Navigation
- Tab order follows logical flow
- Escape to close modals
- Enter to confirm actions
- Arrow keys for sliders (yield threshold)

### Visual Clarity
- High contrast for readability
- Color coding consistent (green = positive, red = negative)
- Icons supplement text (not replace)

---

## Future Enhancements

### Planned Pages (Phase 2+)

**Battle Preparation Screen**
- Route: `/battle/prepare/:robotId`
- Purpose: Final pre-battle review and confirmation
- Displays: Robot summary, effective stats, opponent info
- Status: Not yet implemented

**Battle Replay Viewer**
- Route: `/battles/:id/replay`
- Purpose: Review past battles with visual replay
- Status: Not yet implemented

**Tournament Page**
- Route: `/tournaments`
- Purpose: View and enter tournaments
- Status: Not yet implemented

**Leaderboards**
- Route: `/leaderboards`
- Purpose: Global rankings by ELO, wins, prestige
- Status: Not yet implemented

**Arena Team Builder**
- Route: `/arena/team`
- Purpose: Configure teams for 2v2, 3v3 battles
- Status: Not yet implemented

**Coaching Staff Management**
- Route: `/facilities/coaches`
- Purpose: Hire and manage coaches for bonuses
- Status: Not yet implemented

**Attribute Upgrade Page**
- Route: `/robots/:id/upgrade`
- Purpose: Spend Credits to upgrade individual attributes
- Status: Partially implemented in Robot Detail Page

### Planned Features

**Dashboard Enhancements**:
- Battle history timeline
- Daily income/expense report
- Achievement notifications
- Quick repair buttons

**Robot Detail Enhancements**:
- Loadout presets (save/load configurations)
- Stat comparison with other robots
- Battle history for individual robot
- Detailed attribute breakdown tooltips

**Weapon Shop/Inventory**:
- Advanced filtering and sorting
- Weapon comparison tool
- Quick equip from shop (if already owned)
- Weapon crafting interface (Weapons Workshop Level 6+)

**Facilities Page**:
- Operating cost calculator
- Prestige progression tracker
- Facility upgrade recommendations
- Cost-benefit analysis tools

---

## Technical Implementation Notes

### State Management
- **Context**: AuthContext for user authentication state
- **Local State**: Component-level state with React hooks (useState, useEffect)
- **Future**: Consider global state management (Redux/Zustand) if complexity increases

### API Integration
- **Base URL**: `/api` (configured in environment)
- **Authentication**: JWT tokens in Authorization header
- **Error Handling**: Consistent error responses from backend

### Key API Endpoints (by Page)

**Dashboard Page**:
- `GET /api/users/me` - Get user profile with Credits/Prestige
- `GET /api/robots` - Get user's robots (future: with HP status)

**Robot Detail Page**:
- `GET /api/robots/:id` - Get robot details
- `PUT /api/robots/:id` - Update robot (name, stance, yield, loadout)
- `PUT /api/robots/:id/equip-main-weapon` - Equip main weapon
- `PUT /api/robots/:id/equip-offhand-weapon` - Equip offhand weapon
- `DELETE /api/robots/:id/unequip-main-weapon` - Unequip main weapon
- `DELETE /api/robots/:id/unequip-offhand-weapon` - Unequip offhand weapon

**Weapon Shop Page**:
- `GET /api/weapons` - Get all available weapons
- `POST /api/weapon-inventory/purchase` - Purchase weapon

**Weapon Inventory Page**:
- `GET /api/weapon-inventory` - Get user's weapon inventory

**Facilities Page**:
- `GET /api/facilities` - Get user's facility levels
- `POST /api/facilities/upgrade/:facilityType` - Upgrade facility

**Create Robot Page**:
- `POST /api/robots` - Create new robot

---

## Page Load Performance

### Optimization Strategies (Current & Future)

**Current**:
- Single page application with client-side routing (React Router)
- Component lazy loading for unused routes
- API calls on page mount

**Future Optimizations**:
- Data prefetching for anticipated navigation
- Caching frequently accessed data (user profile, robots)
- Virtualized lists for large datasets (weapon inventory, facilities)
- Optimistic UI updates for better perceived performance
- Image lazy loading for robot frames/weapons

---

## Cross-References

### Design Documentation
- **[ROBOT_ATTRIBUTES.md](ROBOT_ATTRIBUTES.md)** - Robot attributes, stance, yield, combat formulas
- **[STABLE_SYSTEM.md](STABLE_SYSTEM.md)** - Credits, Prestige, facilities, economic system
- **[WEAPONS_AND_LOADOUT.md](WEAPONS_AND_LOADOUT.md)** - Weapon catalog, loadout types, equipment rules
- **[GAME_DESIGN.md](GAME_DESIGN.md)** - Overall game design philosophy
- **[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)** - Data models and relationships

### Implementation Documentation
- **[PRD_BATTLE_STANCES_AND_YIELD.md](PRD_BATTLE_STANCES_AND_YIELD.md)** - Stance and yield feature requirements
- **[PRD_WEAPON_LOADOUT.md](PRD_WEAPON_LOADOUT.md)** - Weapon loadout feature requirements
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture and tech stack
- **[TESTING_STRATEGY.md](TESTING_STRATEGY.md)** - Testing approach for frontend

---

## Maintenance

**Document Owner**: Frontend Development Team  
**Maintenance Schedule**: Update when adding new pages or significantly changing existing pages  
**Review Frequency**: After each sprint or major UI update

**Update Triggers**:
- New page/route added
- Significant component changes
- Navigation structure changes
- User flow modifications
- New features impacting multiple pages

---

## Conclusion

This Frontend UI Reference provides a comprehensive map of the Armoured Souls user interface, explaining what information is displayed where and why those design decisions were made. It serves as a living document that bridges game design concepts with UI implementation.

**Key Takeaways**:
- Page structure optimized for player task flows (pre-battle, progression, management)
- Information architecture follows progressive disclosure principles
- Consistent navigation and contextual information reduce cognitive load
- Component reusability ensures consistent user experience
- Design decisions documented for future reference and onboarding

**For Frontend Developers**:
- Use this document to understand the broader context of individual components
- Refer to design docs (linked throughout) for detailed game mechanics
- Follow established patterns when adding new pages or features
- Update this document when making significant UI changes

**For Designers/Product Owners**:
- Use this document to review information architecture decisions
- Reference when planning new features or pages
- Ensure new designs align with established patterns and principles

---

**Version History**:
- v1.0 (January 30, 2026) - Initial document creation based on Phase 1 prototype implementation
