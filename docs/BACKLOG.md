# Backlog — Ideas to Be Specced

Items identified during audits, reviews, and development. Prioritized by impact on player experience and system reliability.

---

## WSJF Priority Ranking

Based on player poll (April 2026, 16 votes) and backlog analysis. WSJF = (Business Value + Time Criticality + Risk Reduction) / Job Size. Each factor 1–5.

| Rank | Item | # | Votes | BV | TC | RR | Size | WSJF |
|------|------|---|-------|----|----|-----|------|------|
| 1 | Game Loop Audit | 6 | 3 🗳️ | 3 | 4 | 5 | 2 | **6.0** |
| 2 | Feature Flags | 15 | 1 🗳️ | 2 | 2 | 4 | 2 | **4.0** |
| 3 | Landing Page | 4 | 0 🗳️ | 3 | 2 | 1 | 2 | **3.0** |
| 4 | Practice Arena Catalog Access | 57 | 0 🗳️ | 2 | 1 | 1 | 1 | **4.0** |
| 5 | Robot Comparison Tool | 42 | 0 🗳️ | 2 | 1 | 1 | 2 | **2.0** |
| 6 | Dashboard Enhancements | 24 | 0 🗳️ | 2 | 1 | 1 | 2 | **2.0** |
| 7 | Weapon Special Properties | 11 | 1 🗳️ | 3 | 2 | 2 | 4 | **1.8** |
| 8 | Daily Login Bonuses & Seasonal Events | 34 | 0 🗳️ | 3 | 1 | 1 | 3 | **1.7** |
| 9 | Player Personas / Complexity Modes | 16 | 1 🗳️ | 2 | 1 | 2 | 3 | **1.7** |
| 10 | Arena / Terrain Modifiers | 12 | 1 🗳️ | 3 | 1 | 2 | 4 | **1.5** |
| 11 | Modular Package Extraction | 35 | 0 🗳️ | 1 | 1 | 2 | 3 | **1.3** |
| 12 | Robot Detail Page Split | 37 | 0 🗳️ | 2 | 1 | 1 | 3 | **1.3** |
| 13 | Universal Search / Command Palette | 27 | 0 🗳️ | 2 | 1 | 1 | 3 | **1.3** |
| 14 | Progressive Feature Disclosure | 28 | 0 🗳️ | 2 | 1 | 1 | 3 | **1.3** |
| 15 | Weapon Crafting System | 29 | 0 🗳️ | 3 | 1 | 1 | 5 | **1.0** |
| 16 | Conditional Battle Triggers / AI Scripting | 32 | 0 🗳️ | 3 | 1 | 1 | 5 | **1.0** |
| 17 | Future Revenue Streams | 33 | 0 🗳️ | 2 | 1 | 1 | 4 | **1.0** |
| 18 | Player Marketplace | 44 | 0 🗳️ | 3 | 1 | 1 | 5 | **1.0** |
| 19 | Social Features (Friends, Guilds, Chat) | 45 | 0 🗳️ | 3 | 1 | 1 | 5 | **1.0** |
| 20 | Prestige Store | 47 | 0 🗳️ | 2 | 1 | 1 | 4 | **1.0** |
| 21 | Blueprint Library | 48 | 0 🗳️ | 1 | 1 | 1 | 3 | **1.0** |
| 22 | Cosmetic Customization System | 46 | 0 🗳️ | 2 | 1 | 1 | 5 | **0.8** |
| 23 | Matchup-Dependent Weapon Effectiveness | 58 | 0 🗳️ | 3 | 1 | 2 | 5 | **1.2** |

---

### #4 — Landing Page / Marketing Front Page
**Source**: Current state — visitors land on a login/register form with no context  
**Priority**: High — first impression for new players

The current front page is just a login and registration module. New visitors have no idea what the game is, how it plays, or why they should sign up. Needs: game concept pitch, screenshots or gameplay preview, feature highlights (4 battle modes, 47 weapons, league system), call-to-action to register.

### #6 — Game Loop Audit — Remaining Gaps
**Source**: Design review  
**Priority**: Medium — most loops are now addressed; remaining gaps are late-game and social  
**Progress (Aug 2026)**: Loop 1 (Core), Loop 3 (Competitive), Loop 4 (Reputation), Loop 6 (Facility Investment), and the experimentation/seasonal missing loops are all addressed by shipped specs (#25, #27, #31, #33, #34, #35, #37, #38, #44, #45). What remains:

**Loop 2: Economic Loop — late-season credit drain.** The Season System (Spec #45) solves infinite accumulation by hard-resetting every 100 cycles, and the Income Dashboard makes ROI visible. But *within* a season, once facilities and attributes are maxed (~cycle 60-70), credits pile up with no meaningful sink. Weapon Refinement helps but caps out.
- Fix candidates: Weapon Special Properties (#11), Weapon Crafting (#29), Prestige Store (#47), or any recurring consumable/cosmetic credit drain.

**Loop 5: Roster Loop — shallow synergy.** Team Battles (Spec #37) added robot interaction through coordination attributes, and the Booking Office (Spec #35) enables per-robot event specialization. But robots within a stable still lack strategic complementarity — there's no "this robot covers what that one can't" pull. Merchandising normalization (prestige ÷ roster capacity) creates economic tension between breadth and depth, but the *gameplay* reason to diversify is weak.
- Fix candidates: Arena/Terrain Modifiers (#12) forcing diverse builds, Weapon Special Properties (#11) creating type advantages, Matchup-Dependent Weapon Effectiveness (#58).

**Missing: Social/Rivalry.** The most conspicuously absent loop now that everything else is addressed. Leaderboards and stable profiles create awareness of other players but no interaction — no challenges, no rivalries, no congratulations.
- Fix candidates: #45 Phase 1 (notifications) and Phase 2 (friends). Even a lightweight "mark as rival" feature that highlights their results in your cycle summary would help.

**Missing: Recovery/Comeback (minor).** Season reset is the ultimate comeback mechanic. Mid-season, a player who falls behind has limited options beyond patience. No catch-up LP mechanic, no underdog bonus. This may be acceptable by design — LP is supposed to reflect truth — but a 100-cycle season is long to coast through if you stumble early.
- Open question: is this a problem worth solving, or is the season reset sufficient?

### #11 — Weapon Special Properties
**Source**: PRD_WEAPON_ECONOMY.md, PRD_WEAPONS_LOADOUT.md  
**Priority**: Medium — would significantly deepen combat strategy

All 47 weapons currently have only attribute bonuses — no special effects. The pricing formula and combat simulator are designed to support properties like "ignores armor", "shield drain", "area damage" but none are implemented.

### #12 — Arena / Terrain Modifiers with Home Arena Selection
**Source**: Player idea, [GitHub #278](https://github.com/RobertTeunissen/ArmouredSouls/issues/278)  
**Priority**: Medium — adds meta variation and per-battle decision-making

Battles take place in a randomly assigned arena with gameplay modifiers (e.g. "corrosive atmosphere: -15% armor effectiveness"). Players choose a preferred "home arena" for a familiarity bonus. The `ArenaConfig` type already exists in the combat simulator for KotH but has no gameplay modifiers.

**Player ideas from #278**: Arena shape/size as a gameplay variable — big arena, small arena, "endless arena", square, octagon, rolling floor that changes direction. Different arenas favor different robot builds and weapon types, which ties into tuning strategy and incentivizes weapon diversity (synergy with #5).

### #15 — Feature Flags / Per-User Feature Rollout
**Source**: Backlog triage  
**Priority**: Medium — enables safer releases and A/B testing

Add a feature toggle system manageable from the admin portal. Flags can be global, percentage-based, or per-user/per-role.

### #16 — Player Personas / Complexity Modes
**Source**: Backlog triage  
**Priority**: Medium — different players want fundamentally different experiences

Two archetypes: "just let me fight" vs "show me everything." Per the [Prestige & Fame Design Exploration](analysis/PRESTIGE_FAME_DESIGN_EXPLORATION.md): gating depth by prestige doesn't work — a preference toggle may be the right approach.

### #24 — Dashboard Enhancements
**Source**: PRD_DASHBOARD_PAGE.md  
**Priority**: Low — cosmetic improvements  
**Progress**: Promotion/demotion notifications on the dashboard shipped June 2026 (PR #337).

Tournament wins/trophy display, loading skeletons, notification toasts. If fame cosmetics (titles, visual indicators) are implemented via #8, the dashboard should display them.

### #27 — Universal Search / Command Palette (Cmd+K)
**Source**: Deleted navigation analysis doc, backlog triage  
**Priority**: Low → Medium candidate — improves discoverability across the entire app

No global search exists. A universal search bar (header or Cmd+K overlay) querying robots, players, weapons, pages, guide articles, and battle history. Existing infrastructure: `SearchBar` component, guide search index API, admin user search pattern.

### #28 — Progressive Feature Disclosure
**Source**: Deleted navigation analysis doc  
**Priority**: Low — reduces new player overwhelm

Per the [Prestige & Fame Design Exploration](analysis/PRESTIGE_FAME_DESIGN_EXPLORATION.md): prestige-gated feature unlocks were largely rejected. A simple preference toggle (#16) may be more appropriate.

### #29 — Weapon Crafting System
Custom weapon design at Workshop Level 6+. Pricing formula already supports it.

### #32 — Conditional Battle Triggers / Robot AI Scripting
Player-defined robot behaviors: "switch stance when HP < 30%", "target weakest in KotH".

### #33 — Future Revenue Streams
Trading commission, sponsorship deals, arena attendance, championship bonuses, daily login bonuses.

### #34 — Daily Login Bonuses & Seasonal Events
Consecutive login rewards, limited-time challenges, end-of-season league placement rewards.

### #35 — Modular Package Extraction
npm workspace extraction. Only relevant when multiple consumers need shared backend logic.

### #37 — Robot Detail Page Split: Review vs Prepare / Stable Preparation Dashboard
**Source**: Tuning Pool spec discussion (spec #25)  
**Analysis**: [Robot Detail Page Split Analysis](analysis/ROBOT_DETAIL_PAGE_SPLIT_ANALYSIS.md) (June 2026)

The Robot Detail page serves two distinct intents (Review: Overview/Matches/Analytics vs Prepare: Upgrades/Tuning/Battle Config/Stats). With 8 tabs, the page conflates retrospective analysis with prospective preparation — neither context gets appropriate density or layout. Analysis recommends splitting into two pages: a public Robot Profile (`/robots/:id`) as a scrollable career narrative, and an owner-only Workshop (`/robots/:id/prepare`) with collapsible accordion sections, a robot switcher for multi-robot workflows, and a persistent status strip. The "Stable Preparation Dashboard" concept is absorbed into the Workshop via the robot switcher rather than a separate page.

### #42 — Robot Comparison Tool
**Source**: Removed from navbar — unimplemented page (`/robots/compare`)  
**Priority**: Low — QoL feature for experienced players

Side-by-side comparison of two or more robots' stats, attributes, weapons, and tuning allocations. Helps players make informed decisions about upgrades and loadout changes. Could include a simulated "who would win" prediction based on current builds.

### #44 — Player Marketplace
**Source**: Removed from navbar — unimplemented pages (`/marketplace`, `/marketplace/my-listings`, `/marketplace/history`)  
**Priority**: Not scoped — large feature, needs economic design

Player-to-player weapon trading marketplace. Players list weapons for sale at their chosen price, others browse and buy. Includes listing management ("My Listings") and transaction history. Needs careful economic balancing to avoid inflation/deflation. Consider: listing fees, transaction tax, price floors/ceilings, trade cooldowns.

**Dependencies**: Weapon resale mechanics (#5), possibly Season System (#41) which would reset inventories.

### #45 — Social Features (Friends, Guilds, Chat)
**Source**: Removed from navbar — unimplemented pages (`/friends`, `/notifications`, `/guilds`, `/guild`, `/guild/manage`, `/chat`)  
**Priority**: Not scoped — large feature set, low player demand so far

Full social layer: friend lists, in-game notifications, guild creation/management, guild chat. Would enable guild-vs-guild competitions, shared facilities, and social retention loops. Large scope — broken into four incremental phases below.

**Current state (Aug 2026)**: Zero social infrastructure exists. No WebSocket/SSE layer, no notification inbox, no friend/guild models. What *does* exist: public stable profiles (`/stables/:userId`), leaderboards (player discovery), Team Battles (persistent robot groups), Discord webhooks (operational only), and two unused notification preference booleans on the User model (`notificationsBattle`, `notificationsLeague`). Scale: < 1000 concurrent users, single VPS.

**Risk**: At current player count, friends lists and guild chat risk being a ghost town. In-game notifications have standalone value regardless of population. The signal to start Phase 2+ is players actively visiting each other's stable profiles and recognizing names on leaderboards.

#### Recommended Build Order

**Phase 1: In-Game Notification System** (small-medium, ~2-3 days)
- Highest standalone value, no social critical-mass problem, activates the dead preference booleans, and every later phase depends on it.
- Schema: `Notification` table (userId, type, title, body, metadata JSON, read boolean, createdAt). Types: `battle_result`, `league_promotion`, `league_demotion`, `tournament_result`, `achievement_unlocked`, `season_rollover`.
- Backend: `NotificationService` that existing orchestrators call after battles/promotions. REST endpoints for fetch/mark-read/bulk-dismiss.
- Frontend: Bell icon in nav header, dropdown or `/notifications` page, respect existing user preferences.
- Delivery: Start with polling (matches current infra). WebSocket/SSE upgrade is a separate future concern.

**Phase 2: Friends System** (medium, ~3-4 days) — depends on Phase 1
- Friend requests (send/accept/reject/cancel), friends list, last-active status, friend activity feed.
- Schema: `Friendship` table (requesterId, addresseeId, status: pending/accepted/blocked, createdAt).
- Features: Send request from stable profile page, friends list page, filter leaderboards to friends, "friend's recent battles" feed.
- Triggered by: players actively visiting stable profiles and recognizing rivals from leagues.

**Phase 3: Guilds** (medium-large, ~4-5 days) — depends on Phases 1 + 2
- Guild CRUD, membership (owner/officer/member roles), guild profile page, guild leaderboard, guild-level stats aggregation.
- Schema: `Guild` table (name, tag, description, ownerId, createdAt), `GuildMember` table (guildId, userId, role, joinedAt).
- Builds on Team Battles — a guild is the social layer around existing team mechanics. Later: guild-vs-guild challenges (could be its own spec).

**Phase 4: Chat** (large, ~5-7 days) — depends on Phases 2 + 3, forces WebSocket decision
- Real-time messaging: guild chat, direct messages between friends.
- Infrastructure: requires WebSocket layer or aggressive polling. Socket.io or native WS with a simple message queue.
- Schema: `Message` table (channelId, senderId, content, createdAt), `Channel` table (type: direct/guild, participants).
- Defer until player count justifies the infrastructure cost — a ghost-town chat is worse than no chat.

**Dependencies**: Phase 1 is independent. Phase 2 needs Phase 1. Phase 3 needs Phases 1+2. Phase 4 needs all three plus real-time infra.

### #46 — Cosmetic Customization System
**Source**: Removed from navbar — unimplemented pages (`/customize`, `/customize/skins`, `/customize/stable`, `/customize/poses`, `/customize/emotes`)  
**Priority**: Not scoped — monetization opportunity, no gameplay impact

Robot skins, stable visual customization, victory poses, and emotes/taunts. Pure cosmetic layer with no gameplay effect. Could serve as a credit sink for late-game players or a future monetization vector. Depends on having visual assets created.

**Potential credit sinks**: Skin unlocks, pose unlocks, emote packs, stable themes.

### #47 — Prestige Store
**Source**: Removed from navbar — unimplemented page (`/prestige-store`)  
**Priority**: Not scoped — depends on prestige having enough value

A store where players spend accumulated prestige points on exclusive rewards: cosmetic items, facility unlock discounts, unique weapon skins, or seasonal advantages. Gives prestige a tangible spend path beyond passive multipliers.

**Dependencies**: Cosmetic Customization (#46) for cosmetic rewards, Season System (#41) for seasonal prestige value.

### #48 — Blueprint Library
**Source**: Removed from navbar — unimplemented page (`/blueprints`)  
**Priority**: Not scoped — depends on Weapon Crafting (#29)

A collection of saved weapon blueprints for the crafting system. Players save successful designs, share blueprints with others, and browse community-created weapon configurations. Only relevant once Weapon Crafting (#29) is implemented.

**Dependencies**: Weapon Crafting System (#29).

### #57 — Practice Arena Catalog Access (Try Before You Buy)
**Source**: Weapon Experimentation Problem (#5), follow-up item 3  
**Priority**: Low — QoL, small scope

Let players test any weapon from the shop in practice battles, not just owned weapons. The What-If system already supports weapon overrides for owned weapons — extending to unowned weapons is a small change. Reduces purchase anxiety and encourages experimentation.

### #58 — Matchup-Dependent Weapon Effectiveness (Rock-Paper-Scissors)
**Source**: Weapon Experimentation Problem (#5), follow-up item 4  
**Priority**: Not scoped — large combat system change

Energy weapons bypass armor but shields resist them; ballistic shreds shields but armor blocks. Creates rock-paper-scissors dynamics that require owning multiple weapon types. Large scope — needs its own spec, careful balance work, and UI changes to communicate effectiveness. Synergizes with Arena Modifiers (#12) for meta variation.