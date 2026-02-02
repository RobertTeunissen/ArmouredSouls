# Armoured Souls — Navigation & Page Structure

**Last Updated**: February 1, 2026  
**Status**: Future State Architecture  
**Purpose**: Define complete navigation system and page structure for all phases

---

## Executive Summary

This document defines the complete navigation architecture and page structure for Armoured Souls from MVP through all future phases. It describes:
- **Complete page inventory** (50+ pages across all phases)
- **Modern 2026 navigation patterns** (hamburger menus, app bars, FABs, bottom nav)
- **User interaction flows** and logical paths
- **Multi-level navigation hierarchy** (primary, secondary, contextual)
- **Platform-specific patterns** (desktop, mobile, tablet)
- **Progressive disclosure strategy** for feature rollout

**Key Philosophy**: Navigation reinforces the "manager" fantasy through clear information architecture, efficient workflows, and contextual access to tools.

---

## Table of Contents

1. [Navigation Principles](#navigation-principles)
2. [2026 Navigation Patterns](#2026-navigation-patterns)
3. [Complete Page Inventory](#complete-page-inventory)
4. [Navigation Architecture](#navigation-architecture)
5. [User Flows & Logical Paths](#user-flows--logical-paths)
6. [Desktop Navigation Design](#desktop-navigation-design)
7. [Mobile Navigation Design](#mobile-navigation-design)
8. [Contextual Navigation](#contextual-navigation)
9. [Phase-by-Phase Rollout](#phase-by-phase-rollout)
10. [Accessibility & Keyboard Navigation](#accessibility--keyboard-navigation)

---

## Navigation Principles

### Core Navigation Philosophy

**Armoured Souls navigation must:**

1. **Reinforce Manager Role** - Navigation mirrors a sports team manager's command center, not an arcade game menu
2. **Optimize for Daily Workflows** - Common tasks (check robots, configure, battle, review) are 1-2 clicks away
3. **Progressive Disclosure** - Advanced features revealed as players progress (prestige gates, level unlocks)
4. **Context-Aware** - Navigation adapts to current activity (managing vs battling vs socializing)
5. **Platform-Appropriate** - Desktop favors always-visible navigation; mobile uses space-efficient patterns

### Design Constraints

**Must Avoid**:
- ❌ Overwhelming new players with 50+ pages at once
- ❌ Deep navigation hierarchies (3+ levels)
- ❌ Context-switching friction (jumping between unrelated areas)
- ❌ Hidden or "mysterious" navigation patterns

**Must Include**:
- ✅ Persistent access to core functions (robots, battles, stable)
- ✅ Clear visual hierarchy (primary vs secondary nav)
- ✅ Quick access to economic info (Credits, Prestige)
- ✅ Notifications and status indicators
- ✅ Search functionality (for large collections)

---

## 2026 Navigation Patterns

### Modern Web Navigation (2026)

**Desktop Patterns**:
1. **App Bar + Side Nav** - Persistent top bar with expandable side navigation
2. **Tab-Based Navigation** - Horizontal tabs for related content sections
3. **Mega Menus** - Dropdown panels with rich content and multiple columns
4. **Command Palette** - Keyboard-driven quick access (Cmd+K / Ctrl+K)
5. **Breadcrumbs** - Contextual path showing location in hierarchy

**Mobile Patterns**:
1. **Bottom Navigation Bar** - 4-5 primary actions at thumb-reach
2. **Hamburger Menu** - Collapsible side drawer for secondary navigation
3. **Floating Action Button (FAB)** - Primary action (e.g., "Create Robot", "Enter Battle")
4. **Swipe Gestures** - Horizontal swipes between related screens
5. **Pull-to-Refresh** - Update content with downward swipe

**Progressive Web App (PWA) Features**:
- Install prompt for add-to-home-screen
- Offline mode indicators
- Push notifications for battles, achievements
- App-like full-screen mode

### Why These Patterns?

**App Bar**: Industry standard (Gmail, Discord, Twitter) - users expect top navigation
**Bottom Nav**: Mobile thumb-reach optimization - proven by Instagram, YouTube
**Command Palette**: Power user efficiency - popularized by Notion, Linear
**Mega Menus**: Information density for complex apps - used by Amazon, Atlassian
**FAB**: Clear primary action - Material Design standard

---

## Complete Page Inventory

### Phase 1: MVP (Current - 14 Pages)

#### Authentication & Onboarding (2 pages)
1. **Login Page** (`/login`) - Username/password authentication
2. **Registration Page** (`/register`) - New account creation (future)

#### Core Management (5 pages)
3. **Dashboard** (`/dashboard`) - Stable overview, robot status, quick actions
4. **My Robots** (`/robots`) - Robot roster list view
5. **Robot Detail** (`/robots/:id`) - Individual robot configuration
6. **Create Robot** (`/robots/create`) - Purchase new robot frame
7. **Facilities** (`/facilities`) - Stable facility upgrades

#### Economy & Equipment (2 pages)
8. **Weapon Shop** (`/weapon-shop`) - Browse and purchase weapons
9. **Weapon Inventory** (`/weapon-inventory`) - Manage owned weapons

#### Battle & Competition (3 pages)
10. **Battle History** (`/battle-history`) - Past battle results
11. **Battle Detail** (`/battle/:id`) - Single battle replay/stats
12. **League Standings** (`/league-standings`) - Current league rankings

#### Development/Admin (2 pages)
13. **All Robots** (`/all-robots`) - Global robot database (dev tool)
14. **Admin Panel** (`/admin`) - Admin-only tools

---

### Phase 2: Foundation & Enhanced Features (12 NEW pages, 26 total)

#### User Profile & Social (5 pages)
15. **Profile** (`/profile`) - User profile, stable name, stats, achievements
16. **Settings** (`/settings`) - Account settings, preferences, notifications
17. **Friends** (`/friends`) - Friend list, requests, online status
18. **Player Profile** (`/player/:id`) - View other players' public profiles
19. **Notifications** (`/notifications`) - Inbox for system messages, friend requests

#### Matchmaking & Battle Preparation (4 pages)
20. **Matchmaking Queue** (`/matchmaking`) - Join ranked queue, select robot
21. **Battle Preparation** (`/battle/prepare/:robotId`) - Pre-battle confirmation screen
22. **Battle Live** (`/battle/live/:id`) - Live battle viewer (if real-time elements added)
23. **Practice Arena** (`/practice`) - PvE sparring matches against AI

#### Advanced Robot Management (3 pages)
24. **Robot Comparison** (`/robots/compare`) - Side-by-side stat comparison
25. **Training Planner** (`/robots/:id/training`) - Long-term upgrade planning tool
26. **Loadout Presets** (`/robots/:id/loadouts`) - Save/load weapon configurations

---

### Phase 3: Social & Community (10 NEW pages, 36 total)

#### Guilds & Clans (4 pages)
27. **Guilds Browser** (`/guilds`) - Discover and join guilds
28. **Guild Detail** (`/guilds/:id`) - Guild information, members, stats
29. **My Guild** (`/guild`) - Guild dashboard (if member)
30. **Guild Management** (`/guild/manage`) - Guild admin tools (if officer/leader)

#### Leaderboards & Rankings (3 pages)
31. **Global Leaderboards** (`/leaderboards`) - Multiple ranking categories
32. **Regional Rankings** (`/leaderboards/region/:region`) - Regional leaderboards
33. **Specialized Rankings** (`/leaderboards/:category`) - "Fastest robot", "Most wins", etc.

#### Social Features (3 pages)
34. **Chat** (`/chat`) - In-game chat system (direct messages, guild chat)
35. **Battle Replay Sharing** (`/replays`) - Community-shared battle replays
36. **Spectator Mode** (`/spectate/:userId`) - Watch ongoing/recent battles

---

### Phase 4: Tournaments & Events (8 NEW pages, 44 total)

#### Tournaments (5 pages)
37. **Tournament Hub** (`/tournaments`) - Browse active/upcoming tournaments
38. **Tournament Detail** (`/tournaments/:id`) - Tournament info, bracket, schedule
39. **Tournament Registration** (`/tournaments/:id/register`) - Entry form and payment
40. **Tournament Bracket** (`/tournaments/:id/bracket`) - Interactive bracket viewer
41. **Tournament Lobby** (`/tournaments/:id/lobby`) - Pre-tournament waiting room

#### Special Events (3 pages)
42. **Events Calendar** (`/events`) - Seasonal events, limited-time challenges
43. **Event Detail** (`/events/:id`) - Event rules, rewards, leaderboard
44. **Daily Challenges** (`/challenges`) - Daily/weekly challenge tasks

---

### Phase 5: Advanced Economy & Trading (8 NEW pages, 52 total)

#### Marketplace (4 pages)
45. **Marketplace** (`/marketplace`) - Player-to-player trading hub
46. **Marketplace Listings** (`/marketplace/search`) - Browse listings with filters
47. **My Listings** (`/marketplace/my-listings`) - Manage active sales
48. **Transaction History** (`/marketplace/history`) - Purchase/sale history

#### Crafting & Blueprints (2 pages)
49. **Weapon Crafting** (`/crafting`) - Design custom weapons (Weapons Workshop Level 6+)
50. **Blueprint Library** (`/blueprints`) - Owned weapon blueprints

#### Advanced Economy (2 pages)
51. **Income Dashboard** (`/income`) - Revenue streams, passive income tracking
52. **Prestige Store** (`/prestige-store`) - Exclusive items unlocked by prestige

---

### Phase 6: Team Battles & Advanced Modes (6 NEW pages, 58 total)

#### Team Battles (3 pages)
53. **Team Builder** (`/team/:size`) - Configure 2v2, 3v3, 5v5 teams
54. **Team Matchmaking** (`/team/matchmaking`) - Team battle queue
55. **Team Battle History** (`/team/history`) - Team battle records

#### Advanced Game Modes (3 pages)
56. **Battle Royale** (`/battle-royale`) - Last Man Standing mode
57. **Guild Wars** (`/guild-wars`) - Mass stable vs stable battles
58. **Story Mode** (`/story`) - Tutorial and lore missions

---

### Phase 7: Cosmetics & Customization (5 NEW pages, 63 total)

#### Visual Customization (5 pages)
59. **Customization Hub** (`/customize`) - Access all customization options
60. **Robot Skins** (`/customize/skins`) - Robot visual customization
61. **Stable Customization** (`/customize/stable`) - Stable logo, colors, banners
62. **Victory Poses** (`/customize/poses`) - Robot victory animations
63. **Emotes & Taunts** (`/customize/emotes`) - In-battle expressions

---

### Phase 8: Analytics & Advanced Tools (7 NEW pages, 70 total)

#### Performance Analytics (4 pages)
64. **Analytics Dashboard** (`/analytics`) - Comprehensive performance metrics
65. **Robot Performance** (`/analytics/robot/:id`) - Individual robot deep dive
66. **Battle Analytics** (`/analytics/battles`) - Battle trends and insights
67. **Economy Analytics** (`/analytics/economy`) - Credits flow, spending patterns

#### Advanced Tools (3 pages)
68. **Simulator** (`/simulator`) - Battle outcome simulator/calculator
69. **Build Calculator** (`/calculator`) - Stat optimization tool
70. **Meta Reports** (`/meta`) - Community meta analysis, top builds

---

## Navigation Architecture

### Three-Tier Navigation System

Armoured Souls uses a **three-tier navigation hierarchy**:

#### Tier 1: Primary Navigation (Always Visible)
**Purpose**: Access core game areas  
**Placement**: Top app bar (desktop), bottom nav (mobile)  
**Max Items**: 5-6 items

**Desktop Primary Nav** (App Bar):
```
[Logo] Dashboard | Robots | Battles | Facilities | Shop | [Profile] [₡Credits] [Logout]
```

**Mobile Primary Nav** (Bottom Bar):
```
[Dashboard] [Robots] [Battles] [Social] [More]
```

#### Tier 2: Secondary Navigation (Contextual)
**Purpose**: Navigate within a section  
**Placement**: Below app bar, left sidebar, or tabs  
**Max Items**: 8-10 items per section

**Examples**:
- **Robots Section**: My Robots | Create | Compare | Training
- **Battles Section**: Queue | History | Leagues | Tournaments
- **Social Section**: Friends | Guild | Chat | Leaderboards
- **Shop Section**: Weapons | Marketplace | Crafting | Prestige Store

#### Tier 3: Tertiary Navigation (In-Page)
**Purpose**: Navigate within a single page  
**Placement**: Tabs, anchors, or segmented controls  
**Max Items**: 4-6 tabs

**Examples**:
- **Robot Detail**: Overview | Attributes | Loadouts | Performance
- **Facilities**: Economy | Combat | Progression | Advanced
- **Profile**: Stats | Achievements | History | Settings

---

### Navigation Hierarchy Map

```
Primary Level (Tier 1)
├── Dashboard
│   └── (Quick links to everything)
│
├── Robots (Tier 2 Section)
│   ├── My Robots
│   │   └── [Tier 3: List view | Grid view | Filters]
│   ├── Create Robot
│   ├── Robot Detail (:id)
│   │   └── [Tier 3: Overview | Attributes | Loadouts | Performance]
│   ├── Compare Robots (Phase 2)
│   └── Training Planner (Phase 2)
│
├── Battles (Tier 2 Section)
│   ├── Matchmaking Queue
│   │   └── [Tier 3: 1v1 | 2v2 | 3v3 | Custom]
│   ├── Battle History
│   │   └── [Tier 3: Recent | Wins | Losses | Replays]
│   ├── Battle Detail (:id)
│   ├── League Standings
│   │   └── [Tier 3: My League | All Leagues | Regional]
│   ├── Tournaments (Phase 4)
│   │   └── [Tier 3: Active | Upcoming | Past | My Tournaments]
│   ├── Practice Arena (Phase 2)
│   └── Special Events (Phase 4)
│
├── Facilities (Tier 2 Section)
│   └── [Tier 3: Economy | Combat | Progression | Advanced]
│
├── Shop (Tier 2 Section)
│   ├── Weapon Shop
│   ├── Weapon Inventory
│   ├── Marketplace (Phase 5)
│   │   └── [Tier 3: Browse | My Listings | History]
│   ├── Crafting (Phase 5)
│   ├── Prestige Store (Phase 5)
│   └── Customization Hub (Phase 7)
│
├── Social (Tier 2 Section - Phase 3)
│   ├── Friends
│   ├── Guild
│   │   └── [Tier 3: Overview | Members | Wars | Management]
│   ├── Chat
│   │   └── [Tier 3: Direct Messages | Guild Chat | Global]
│   ├── Leaderboards
│   │   └── [Tier 3: Global | Regional | Friends | Specialized]
│   └── Spectate
│
└── Profile (Dropdown Menu)
    ├── My Profile
    │   └── [Tier 3: Stats | Achievements | History | Settings]
    ├── Settings
    │   └── [Tier 3: Account | Notifications | Preferences | Privacy]
    ├── Analytics (Phase 8)
    ├── Notifications
    └── Logout
```

---

## User Flows & Logical Paths

### Critical User Journeys

#### Journey 1: New Player Onboarding (First Session)
**Goal**: Create first robot and understand core mechanics

```
Login/Register
  ↓
Dashboard (welcome message, tutorial prompt)
  ↓
Facilities (upgrade Roster Expansion to create robots)
  ↓
Create Robot (spend ₡500k)
  ↓
Robot Detail (configure first robot)
  ↓
Weapon Shop (buy first weapon)
  ↓
Robot Detail (equip weapon)
  ↓
Matchmaking Queue (first battle - future)
```

**Navigation Pattern**: Linear guided flow with persistent "Next Step" prompts

---

#### Journey 2: Daily Check-In (Returning Player)
**Goal**: Review results, make adjustments, queue next battle

```
Dashboard
  ↓ (See battle results notification)
Battle History
  ↓ (Click recent battle)
Battle Detail (review outcome)
  ↓ (Robot needs repair)
Robot Detail (pay repair costs)
  ↓ (Adjust loadout based on battle)
Robot Detail (change weapon/stance)
  ↓ (Ready for next battle)
Matchmaking Queue
  ↓
Dashboard (confirm queue, logout)
```

**Navigation Pattern**: Hub-and-spoke (Dashboard central, quick access to actions)

---

#### Journey 3: Robot Optimization (Strategy Session)
**Goal**: Analyze performance and optimize robot build

```
Robots Page (select robot)
  ↓
Robot Detail (review current stats)
  ↓
Battle History (filter by this robot)
  ↓
Battle Detail (study recent loss)
  ↓
Analytics/Simulator (calculate optimal build - Phase 8)
  ↓
Robot Detail (upgrade attributes)
  ↓
Training Planner (plan future upgrades - Phase 2)
  ↓
Facilities (invest in training facility)
  ↓
Robot Detail (make upgrades)
```

**Navigation Pattern**: Deep dive with backtracking, needs breadcrumbs

---

#### Journey 4: Social Engagement (Community Interaction)
**Goal**: Join guild, chat, compete on leaderboards

```
Dashboard
  ↓ (See guild invitation)
Guilds Browser (browse available guilds)
  ↓
Guild Detail (review guild stats)
  ↓
My Guild (join successful)
  ↓
Chat (guild chat opens)
  ↓
Guild Wars (participate in guild battle - Phase 6)
  ↓
Leaderboards (check guild ranking)
```

**Navigation Pattern**: Social hub with notifications driving discovery

---

#### Journey 5: Tournament Participation (Competitive Event)
**Goal**: Register for tournament and compete

```
Dashboard (tournament notification)
  ↓
Tournament Hub (browse tournaments)
  ↓
Tournament Detail (review rules, prizes)
  ↓
Tournament Registration (select robots, pay fee)
  ↓
Tournament Lobby (wait for start)
  ↓
Battle Preparation (tournament match)
  ↓
Battle Live/Detail (tournament battle)
  ↓
Tournament Bracket (view standings)
  ↓
Tournament Hub (await next round or view results)
```

**Navigation Pattern**: Event-driven flow with dedicated tournament context

---

### Navigation Shortcuts & Power User Features

**Command Palette** (Cmd+K / Ctrl+K):
```
Type to search:
- "robot thunder" → Jump to Thunder (robot)
- "upgrade armor" → Jump to Robot Detail > Attributes
- "battle history" → Jump to Battle History
- "guild" → Jump to My Guild
- "buy weapons" → Jump to Weapon Shop
```

**Quick Actions** (Dashboard cards):
```
- "Create Robot" → /robots/create
- "Join Battle" → /matchmaking
- "Repair Robots" → /robots (filtered by damaged)
- "Upgrade Facilities" → /facilities
- "Check Leaderboard" → /leaderboards
```

**Keyboard Shortcuts**:
```
D → Dashboard
R → Robots
B → Battle History
F → Facilities
S → Weapon Shop
/ → Search/Command Palette
N → Notifications
? → Help/Shortcuts
```

---

## Desktop Navigation Design

### Top App Bar (Always Visible)

```
┌──────────────────────────────────────────────────────────────────────┐
│ [AS Logo]  Dashboard  Robots▾  Battles▾  Facilities  Shop▾  Social▾ │
│                                                                        │
│                                     [Search🔍] [🔔3] [₡2,000,000]    │
│                                     [@Username▾] [Logout]             │
└──────────────────────────────────────────────────────────────────────┘
```

**Breakdown**:
- **Logo**: Clickable, returns to Dashboard
- **Primary Nav Items**: 5 main sections (some with dropdowns ▾)
- **Search**: Global search/command palette trigger
- **Notifications**: Badge shows unread count
- **Credits**: Always visible, clickable for economy dashboard (future)
- **Username Dropdown**: Profile, Settings, Logout

**Hover/Click on "Robots▾"** (Mega Menu Example):
```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                        │
│  MY ROBOTS              TOOLS                QUICK ACCESS             │
│  ────────────           ─────                ────────────             │
│  View All Robots        Compare Robots       [Card: Recent Robot]    │
│  Create New Robot       Training Planner     [Card: Recent Robot]    │
│  Robot Stats            Build Calculator     [Card: Recent Robot]    │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
```

---

### Left Sidebar (Contextual Secondary Nav)

Appears on complex pages (e.g., Robot Detail, Facilities, Analytics):

```
┌────────────────┐
│ ROBOT DETAIL   │
│ ──────────────│
│ › Overview     │ ← Active
│   Attributes   │
│   Loadouts     │
│   Performance  │
│   Training     │
│                │
│ QUICK ACTIONS  │
│ ──────────────│
│ • Repair       │
│ • Upgrade      │
│ • Battle       │
└────────────────┘
```

**Characteristics**:
- Collapsible (toggle button)
- Sticky (stays visible on scroll)
- Highlights active section
- Quick action buttons at bottom

---

### Breadcrumbs (When in deep hierarchy)

```
Dashboard > Robots > Thunder (Robot) > Attributes > Combat Systems
                                                       └─ You are here
```

**Rules**:
- Appears below app bar, above main content
- Max 5 levels deep (truncate with "...")
- Each item clickable for quick backtracking
- Current page not clickable

---

### Content Area Structure

```
┌──────────────────────────────────────────────────────────────────────┐
│ App Bar                                                               │
├──────────────────────────────────────────────────────────────────────┤
│ Breadcrumbs (if applicable)                                          │
├─────────────┬────────────────────────────────────────────────────────┤
│             │ [Page Title]                            [Action Button]│
│             │                                                         │
│  Sidebar    │  Main Content Area                                     │
│  (optional) │                                                         │
│             │  [Content cards, tables, forms, etc.]                  │
│             │                                                         │
│             │                                                         │
│             │                                                         │
│             │                                                         │
└─────────────┴────────────────────────────────────────────────────────┘
```

---

## Mobile Navigation Design

### Bottom Navigation Bar (Primary - Always Visible)

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                        │
│                     [Main Content Area]                               │
│                                                                        │
│                                                                        │
├────────────┬────────────┬────────────┬────────────┬────────────────┤
│ [🏠]      │ [🤖]      │ [⚔️]      │ [👥]      │ [≡]              │
│ Dashboard  │  Robots    │  Battles   │  Social    │  More            │
└────────────┴────────────┴────────────┴────────────┴──────────────────┘
```

**Bottom Nav Tabs** (5 items max):
1. **Dashboard** (🏠) - Home, overview, notifications
2. **Robots** (🤖) - Robot management
3. **Battles** (⚔️) - Matchmaking, history, leagues
4. **Social** (👥) - Friends, guild, chat (Phase 3+)
5. **More** (≡) - Facilities, shop, settings, etc.

**Characteristics**:
- Fixed at bottom (thumb-reach zone)
- Active tab highlighted with color accent
- Icon + label for clarity
- Haptic feedback on tap (mobile)

---

### Hamburger Menu (Secondary Navigation)

Accessed from "More" tab or hamburger icon (☰):

```
┌──────────────────────────────────────────┐
│ [@Username]                    [✕ Close] │
│ ₡2,000,000 Credits  ⭐1,200 Prestige    │
├──────────────────────────────────────────┤
│                                          │
│ 🛠️ MANAGE STABLE                       │
│   › Facilities                           │
│   › Weapon Shop                          │
│   › Weapon Inventory                     │
│   › Training Planner                     │
│                                          │
│ 🏆 COMPETE                              │
│   › Matchmaking                          │
│   › Tournaments                          │
│   › Leaderboards                         │
│   › Practice Arena                       │
│                                          │
│ 🌐 SOCIAL                               │
│   › Friends                              │
│   › Guild                                │
│   › Chat                                 │
│   › Spectate                             │
│                                          │
│ 💰 ECONOMY                              │
│   › Marketplace                          │
│   › Crafting                             │
│   › Prestige Store                       │
│                                          │
│ ⚙️ SETTINGS                             │
│   › Profile                              │
│   › Settings                             │
│   › Notifications                        │
│   › Help                                 │
│                                          │
│ 🚪 Logout                               │
└──────────────────────────────────────────┘
```

**Characteristics**:
- Slides in from left
- Scrollable if content exceeds viewport
- Categorized sections with icons
- Swipe-right-to-close gesture
- Semi-transparent backdrop (tap to close)

---

### Floating Action Button (FAB)

Appears on pages with a primary action:

```
┌──────────────────────────────────────────┐
│                                          │
│         [Content Area]                   │
│                                          │
│                                          │
│                                      ┌───┤
│                                      │[+]│ ← FAB
│                                      └───┤
└──────────────────────────────────────────┘
```

**Context-Specific Actions**:
- **Robots Page**: Create New Robot
- **Matchmaking**: Join Queue
- **Guild Page**: Invite Friend
- **Marketplace**: Create Listing

**Characteristics**:
- Circular button, prominent color (primary accent)
- Fixed position (bottom-right, above bottom nav)
- Animates on page load
- Hides on scroll down, reappears on scroll up

---

### Mobile Header (Contextual Top Bar)

```
┌──────────────────────────────────────────┐
│ [← Back]  Page Title      [⋮ Actions]   │
├──────────────────────────────────────────┤
│                                          │
│         [Content Area]                   │
│                                          │
└──────────────────────────────────────────┘
```

**Elements**:
- **Back Button**: Returns to previous screen
- **Page Title**: Current location
- **Actions Menu (⋮)**: Context actions (share, settings, etc.)

**Behavior**:
- Sticky (stays on top during scroll)
- Hides during scroll down (max screen space)
- Reappears on scroll up

---

### Swipe Gestures (Mobile)

**Horizontal Swipes** (Between related pages):
```
Battle History ←swipe→ Battle Detail ←swipe→ Next Battle
Robot List ←swipe→ Robot Detail ←swipe→ Next Robot
```

**Vertical Swipes**:
- **Pull-to-Refresh**: Update content (battle results, leaderboards)
- **Swipe-Up**: Open bottom sheet (e.g., filters, actions)
- **Swipe-Down**: Dismiss bottom sheet or modal

---

## Contextual Navigation

### Battle Context Navigation

When user is in a battle flow, navigation adapts:

**Battle Preparation Screen**:
```
[Cancel] ← → Robot: Thunder → Opponent: Bolt → Confirm Battle ✓
```

**During Battle** (Live battles - future):
```
[Exit] ← → Battle Progress: Round 3/5 → [Pause] [Settings]
```

**Post-Battle**:
```
[Dashboard] ← → Battle Result: Victory → [Rematch] [Share]
```

---

### Tournament Context Navigation

Tournament has its own navigation overlay:

```
┌──────────────────────────────────────────┐
│ 🏆 TOURNAMENT: Spring Championship 2026  │
├──────────────────────────────────────────┤
│ Round 2/4 • Your Match in 15 minutes     │
│                                          │
│ [Bracket] [Lobby] [Rules] [Leaderboard] │
└──────────────────────────────────────────┘
```

**Characteristics**:
- Persistent banner at top of screen
- Countdown timer to next match
- Quick access to tournament-specific pages
- Dismissible (minimize to notification)

---

### Admin Context Navigation

Admin panel has elevated navigation:

```
┌──────────────────────────────────────────┐
│ ⚡ ADMIN MODE                            │
├──────────────────────────────────────────┤
│ Users | Robots | Battles | Economy | Logs│
│                                   [Exit] │
└──────────────────────────────────────────┘
```

**Characteristics**:
- Distinct color scheme (amber/yellow)
- Always visible admin mode indicator
- Separate admin-only pages
- Easy exit to normal mode

---

## Phase-by-Phase Rollout

### Phase 1: MVP Navigation (Current)

**Desktop Primary Nav** (6 items):
```
[Logo] Dashboard | My Robots | Facilities | Weapon Shop | Battle History | [Profile]
```

**Mobile Bottom Nav** (5 items):
```
[Dashboard] [Robots] [Battles] [Shop] [More]
```

**Pages**: 14 pages (see Page Inventory Phase 1)

---

### Phase 2: Enhanced Navigation

**Desktop Primary Nav** (6 items + dropdowns):
```
[Logo] Dashboard | Robots▾ | Battles▾ | Facilities | Shop▾ | [Profile]
```

**New Dropdowns**:
- **Robots▾**: My Robots, Create, Compare, Training
- **Battles▾**: Queue, History, Leagues, Practice
- **Shop▾**: Weapons, Inventory

**Pages**: 26 pages (12 new)

---

### Phase 3: Social Navigation

**Desktop Primary Nav** (7 items):
```
[Logo] Dashboard | Robots▾ | Battles▾ | Facilities | Shop▾ | Social▾ | [Profile]
```

**New Section**:
- **Social▾**: Friends, Guild, Chat, Leaderboards

**Mobile Bottom Nav** (5 items):
```
[Dashboard] [Robots] [Battles] [Social] [More]
```

**Pages**: 36 pages (10 new)

---

### Phase 4: Tournament Navigation

**Desktop Primary Nav** (7 items):
```
[Logo] Dashboard | Robots▾ | Battles▾ | Tournaments▾ | Facilities | Shop▾ | Social▾ | [Profile]
```

**New Section**:
- **Tournaments▾**: Hub, Browse, My Tournaments, Events

**Contextual**: Tournament banner (when active)

**Pages**: 44 pages (8 new)

---

### Phase 5-8: Progressive Expansion

**Navigation Strategy**: Avoid overwhelming users
- Features revealed based on **prestige level**
- Tooltips on first unlock ("New feature unlocked!")
- Advanced features in **More** menu initially
- Promoted to primary nav based on **usage frequency**

**Example Progressive Disclosure**:
- **Marketplace**: Unlocked at 1,000 prestige
- **Crafting**: Unlocked when Weapons Workshop reaches Level 6
- **Analytics**: Unlocked at 5,000 prestige or 100 battles
- **Simulator**: Unlocked at 10,000 prestige

---

## Accessibility & Keyboard Navigation

### Keyboard Navigation

**Tab Order**:
1. Skip-to-content link (first tab)
2. Primary navigation items (left to right)
3. Search / notifications
4. Profile dropdown
5. Main content area (focus trap in modals)

**Keyboard Shortcuts**:
```
Tab             → Next focusable element
Shift+Tab       → Previous focusable element
Enter           → Activate button/link
Space           → Toggle checkbox/switch
Arrow Keys      → Navigate lists, tabs, dropdowns
Escape          → Close modal/dropdown
Cmd/Ctrl+K      → Open command palette
/               → Focus search
?               → Show keyboard shortcuts
```

**Focus Indicators**:
- Visible focus ring (blue outline)
- High contrast (WCAG 2.1 AA)
- Never remove outline without alternative

---

### Screen Reader Support

**ARIA Labels**:
```html
<nav aria-label="Primary navigation">
  <ul>
    <li><a href="/dashboard" aria-current="page">Dashboard</a></li>
    <li><a href="/robots">Robots</a></li>
    ...
  </ul>
</nav>

<button aria-label="Open notifications" aria-describedby="notification-count">
  <span aria-hidden="true">🔔</span>
  <span id="notification-count">3 unread</span>
</button>
```

**Landmark Roles**:
- `<nav role="navigation">` - Navigation areas
- `<main role="main">` - Main content
- `<aside role="complementary">` - Sidebars
- `<header role="banner">` - App header
- `<footer role="contentinfo">` - Footer

**Live Regions** (Notifications):
```html
<div role="status" aria-live="polite" aria-atomic="true">
  Battle completed! You won against Bolt.
</div>
```

---

### High Contrast Mode

**Considerations**:
- Test navigation in Windows High Contrast Mode
- Ensure icons have text alternatives
- Don't rely solely on color for state (add icons, text, patterns)
- Borders and dividers visible in high contrast

---

## Search & Discovery

### Global Search (Command Palette)

**Trigger**: Cmd+K (Mac), Ctrl+K (Windows), or click search icon

**Interface**:
```
┌──────────────────────────────────────────────┐
│ Search or jump to...                    [✕] │
├──────────────────────────────────────────────┤
│ ▸ Robots                                     │
│   • Thunder (Your robot)                     │
│   • Bolt (Your robot)                        │
│                                              │
│ ▸ Pages                                      │
│   • Battle History                           │
│   • Weapon Shop                              │
│   • Facilities                               │
│                                              │
│ ▸ Actions                                    │
│   • Create New Robot                         │
│   • Join Matchmaking Queue                   │
│   • Upgrade Facility                         │
└──────────────────────────────────────────────┘
```

**Features**:
- **Fuzzy search**: "btl hist" matches "Battle History"
- **Recent items**: Shows last 5 accessed pages/robots
- **Quick actions**: Jump to common actions
- **Keyboard navigation**: Arrow keys, Enter to select
- **Categories**: Robots, Pages, Actions, Help

---

### Filters & Sorting (In-Page)

**Example: Robots Page**
```
[Search: ___________] [Filter: All Frames ▾] [Sort: Name ▾] [View: Grid ⊞]

Filters Drawer (expandable):
├─ Frame Type: [ ] Humanoid [ ] Tank [ ] Quadruped
├─ HP Status: [ ] Healthy [ ] Damaged [ ] Critical
├─ ELO Range: [min: ___] to [max: ___]
└─ Equipped: [ ] All [ ] Main Weapon [ ] Shield
```

---

## Notifications System

### Notification Types

1. **System Notifications** (Blue)
   - Battle completed
   - Facility upgrade complete
   - Achievement unlocked
   - Tournament starting soon

2. **Social Notifications** (Green)
   - Friend request
   - Guild invitation
   - Chat message
   - Friend online

3. **Economic Notifications** (Yellow)
   - Marketplace sale completed
   - Income generated
   - Prestige level increased

4. **Warning Notifications** (Red)
   - Robot critically damaged
   - Tournament registration closing
   - Guild war starting

---

### Notification Display

**Desktop** (App Bar Badge):
```
[🔔 3] ← Badge shows count
```

**Click opens dropdown**:
```
┌──────────────────────────────────────────┐
│ Notifications                    [Mark all read] │
├──────────────────────────────────────────┤
│ 🔵 Battle Complete: Victory vs Bolt      │
│    2 minutes ago                    [View]│
├──────────────────────────────────────────┤
│ 🟢 Friend Request: Player123             │
│    5 minutes ago            [Accept][Decline]│
├──────────────────────────────────────────┤
│ 🟡 Marketplace Sale: Power Sword sold   │
│    1 hour ago                       [View]│
└──────────────────────────────────────────┘
```

**Mobile** (Pull-down notification):
```
┌──────────────────────────────────────────┐
│ [Swipe down to dismiss]                  │
│ ⚔️ Battle Complete: Victory!             │
│ ₡5,000 earned • +25 ELO                  │
│                           [View] [Dismiss]│
└──────────────────────────────────────────┘
```

---

## Implementation Guidelines

### Technical Recommendations

**Navigation Component Structure**:
```tsx
// Desktop
<AppBar>
  <Logo />
  <PrimaryNav items={primaryNavItems} />
  <Search />
  <Notifications />
  <UserMenu />
</AppBar>

// Mobile
<>
  <MobileHeader title={pageTitle} />
  <BottomNav tabs={bottomNavTabs} />
  <HamburgerMenu sections={menuSections} />
  <FAB action={primaryAction} />
</>
```

**Responsive Breakpoints**:
```css
/* Mobile */
@media (max-width: 767px) { /* Bottom nav, hamburger, FAB */ }

/* Tablet */
@media (min-width: 768px) and (max-width: 1023px) { /* Hybrid */ }

/* Desktop */
@media (min-width: 1024px) { /* App bar, sidebar, mega menus */ }
```

**Navigation State Management**:
```typescript
// Context or Redux store
interface NavigationState {
  activeSection: 'dashboard' | 'robots' | 'battles' | 'social' | 'shop';
  breadcrumbs: Breadcrumb[];
  notifications: Notification[];
  searchOpen: boolean;
  menuOpen: boolean;
}
```

---

## Best Practices Summary

### Do's ✅

1. **Keep primary nav to 5-7 items** - Cognitive load limit
2. **Use familiar patterns** - Users expect app bar + bottom nav
3. **Provide multiple paths** - Dashboard shortcuts + nav menu
4. **Show current location** - Active states, breadcrumbs
5. **Progressive disclosure** - Unlock features gradually
6. **Persistent access to core** - Robots, battles, shop always reachable
7. **Keyboard accessible** - Tab navigation, shortcuts
8. **Mobile-optimized** - Thumb-reach, gestures, FAB
9. **Search/command palette** - Power user efficiency
10. **Clear visual hierarchy** - Primary, secondary, tertiary

### Don'ts ❌

1. **Don't bury features** - Max 2-3 clicks to any page
2. **Don't use only hamburger** - Primary actions visible
3. **Don't overwhelm new users** - Hide advanced features initially
4. **Don't use unclear icons** - Always pair with labels (mobile)
5. **Don't remove back button** - Always provide escape route
6. **Don't create dead ends** - Every page has next action
7. **Don't use tiny touch targets** - 44×44px minimum (mobile)
8. **Don't surprise users** - Navigation behaves predictably
9. **Don't neglect keyboard** - Power users expect shortcuts
10. **Don't ignore context** - Navigation adapts to user's activity

---

## Future Considerations

### AI-Powered Navigation (Post-2026)

**Intelligent Suggestions**:
- "Your robot Thunder needs repair" → Quick link to Robot Detail
- "Practice against Bolt's build" → Simulate battle
- "Similar tournaments starting soon" → Tournament Hub

**Personalized Dashboard**:
- Reorder widgets based on usage
- Show relevant shortcuts based on behavior
- Predictive loading of likely next page

**Voice Navigation** (Mobile):
- "Show my robots" → Navigate to Robots Page
- "Battle history for Thunder" → Filter battle history
- "Upgrade armor plating" → Navigate to Attributes

---

## Version History & Maintenance

**Document Owner**: Product Team / UX Designer  
**Review Frequency**: After each phase completion  
**Next Review**: Before Phase 2 kickoff

**Update Triggers**:
- New major feature addition
- User feedback on navigation confusion
- Accessibility improvements
- Platform changes (iOS, Android updates)

---

## Conclusion

This navigation architecture ensures Armoured Souls can scale from 14 pages (MVP) to 70+ pages (future) without overwhelming users. By using:
- **Three-tier hierarchy** (primary, secondary, tertiary)
- **Progressive disclosure** (features unlock with progression)
- **Platform-appropriate patterns** (desktop vs mobile)
- **Multiple access paths** (nav menu, shortcuts, search, dashboard)
- **Contextual navigation** (battle mode, tournament mode)

...we create a navigation system that **reinforces the manager fantasy**, **optimizes for daily workflows**, and **adapts to user expertise**.

Navigation is not just a menu—it's the **command center** that makes players feel like professional stable managers.

---

**Version**: 1.0 (February 1, 2026)  
**Status**: Future State Architecture Defined
