# Armoured Souls - Module Structure

**Last Updated**: January 25, 2026

## Overview

This document breaks down the Armoured Souls system into logical modules, each with specific responsibilities. This modular approach enables independent development, testing, and scaling of components.

**Note**: For project phases and development timeline, see ROADMAP.md. This document focuses on module organization and current implementation status.

## Module Hierarchy

```
ArmouredSouls/
├── modules/
│   ├── auth/              # Authentication & Authorization
│   ├── game-engine/       # Core Game Logic
│   ├── player/            # Player Management
│   ├── robot/             # Robot/Unit Management
│   ├── battle/            # Battle Simulation
│   ├── stable/            # Stable Management
│   ├── database/          # Data Persistence Layer
│   ├── api/               # API Gateway & Routes
│   ├── ui/                # User Interface Components
│   ├── notifications/     # Notification System
│   ├── matchmaking/       # Player Matchmaking
│   └── admin/             # Admin Tools
```

---

## Module Specifications

### 1. Authentication Module (`auth`)

**Purpose**: Handle user authentication, authorization, and session management.

**Responsibilities**:
- User registration and login
- Password hashing and validation
- JWT token generation and validation
- OAuth 2.0 integration (Google, Facebook, etc.)
- Two-factor authentication (2FA)
- Session management
- Role and permission management

**Key Entities**:
- User
- Session
- Role
- Permission

**APIs**:
- `POST /auth/register` - Register new user
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `POST /auth/refresh` - Refresh JWT token
- `GET /auth/verify` - Verify token validity

**Dependencies**:
- Database module (user data)
- Notification module (email verification)

---

### 2. Game Engine Module (`game-engine`)

**Purpose**: Core game logic, rules, and mechanics.

**Responsibilities**:
- Game rule enforcement
- Turn processing
- Resource management
- Experience and leveling system
- Game state validation
- Event generation

**Key Entities**:
- Game (match instance)
- GameState
- GameRules
- GameEvent

**APIs**:
- `POST /game/create` - Create new game
- `GET /game/{id}` - Get game state
- `POST /game/{id}/action` - Submit player action
- `GET /game/{id}/events` - Get game events

**Dependencies**:
- Battle module
- Robot module
- Player module

---

### 3. Player Module (`player`)

**Purpose**: Manage player profiles, progression, and statistics.

**Responsibilities**:
- Player profile management
- Player statistics tracking
- Ranking and leaderboards
- Achievement system
- Player inventory
- Currency management

**Key Entities**:
- Player
- PlayerStats
- Achievement
- Inventory
- Currency

**APIs**:
- `GET /player/{id}` - Get player profile
- `PUT /player/{id}` - Update player profile
- `GET /player/{id}/stats` - Get player statistics
- `GET /player/{id}/achievements` - Get achievements
- `GET /leaderboard` - Get global leaderboard

**Dependencies**:
- Auth module (user linkage)
- Database module

---

### 4. Robot Module (`robot`)

**Purpose**: Robot creation, customization, and state management.

**Responsibilities**:
- Robot creation with 23 weapon-neutral attributes (Combat, Defensive, Mobility, AI, Team)
- Robot configuration (loadout, stance, yield threshold)
- Attribute upgrade system (level 1-50)
- Equipment management (weapon, secondWeapon for dual-wield, shield)
- Robot state tracking (currentHP, currentShield, ELO, wins, losses, fame)
- Per-robot league management (currentLeague, leagueId)

**Key Entities**:
- Robot (with 23 attributes + state + configuration)
- Weapon (13 weapons + 2 shields with cooldown, damage type, attribute bonuses)
- Loadout (weapon_shield, two_handed, dual_wield, single)
- BattleStance (offensive, defensive, balanced)

**APIs**:
- `POST /robot/create` - Create new robot
- `GET /robot/{id}` - Get robot details
- `PUT /robot/{id}` - Update robot configuration
- `POST /robot/{id}/upgrade` - Upgrade robot
- `DELETE /robot/{id}` - Delete robot

**Dependencies**:
- Player module (ownership)
- Database module

---

### 5. Battle Module (`battle`)

**Purpose**: Time-based battle simulation and combat mechanics.

**Responsibilities**:
- Battle initialization with loadout and stance configuration
- Time-based combat simulation (attack cooldowns, AI decision-making)
- Damage calculation with formulas (hit chance, critical hits, energy shields, penetration)
- Yield threshold detection (player-configurable surrender points)
- Battle outcome determination with repair cost multipliers (1.0x/1.5x/2.0x)
- Battle log generation with timestamped events
- Robot state updates (HP, shield, damage taken, ELO, wins/losses)

**Key Entities**:
- Battle (with comprehensive tracking)
- BattleParticipant (robot state at battle start)
- BattleAction (timestamped events in time-based system)
- BattleLog (JSON with full simulation)
- BattleOutcome (winnerReward, loserReward, repair costs, multipliers, yield flags)

**APIs**:
- `POST /battle/start` - Start new battle
- `GET /battle/{id}` - Get battle state
- `POST /battle/{id}/action` - Submit battle action
- `GET /battle/{id}/log` - Get battle log
- `GET /battle/{id}/replay` - Get battle replay

**Dependencies**:
- Robot module (battle units)
- Player module (participants)
- Game engine (rules)

---

### 6. Stable Module (`stable`)

**Purpose**: Manage player's stable with 14 facility types and progression systems.

**Responsibilities**:
- Stable management (prestige, totalBattles, totalWins, highestELO)
- Robot roster management (1 free slot, expandable to 10 via Roster Expansion facility)
- Facility upgrades (14 types, 10 levels each, prestige-gated)
- Daily income and expense tracking (revenue streams + facility maintenance)
- Coach system (Offensive, Defensive, Tactical, Team coaches provide stable-wide bonuses)
- Weapon storage (expandable via Storage Facility)
- Prestige milestones and unlocks

**Key Entities**:
- User (stable-level: prestige, currency, totalBattles, totalWins)
- Facility (14 types including 4 Training Academies)
- Coach (provides stable-wide attribute bonuses)
- Revenue Streams (merchandising, streaming, sponsorships)

**14 Facility Types**:
1. Repair Bay (repair discounts)
2. Training Facility (upgrade discounts)
3. Weapons Workshop (weapon discounts, crafting)
4. Research Lab (analytics, loadout presets)
5. Medical Bay (critical damage reduction)
6. Roster Expansion (robot slots 1→10)
7. Storage Facility (weapon storage 10→100)
8. Coaching Staff (hire coaches)
9. Booking Office (tournament unlocks)
10. Combat Training Academy (Combat Systems caps)
11. Defense Training Academy (Defensive Systems caps)
12. Mobility Training Academy (Chassis & Mobility caps)
13. AI Training Academy (AI + Team caps)
14. Merchandising Hub (passive income from merchandise sales)

**APIs**:
- `GET /stable/{playerId}` - Get stable details with facilities
- `POST /stable/{playerId}/facility/upgrade` - Upgrade facility
- `POST /stable/{playerId}/coach/hire` - Hire coach
- `GET /stable/{playerId}/economics` - Get daily income/expense report

**Dependencies**:
- Robot module (roster)
- Player module (currency, prestige)
- Database module (Facility model)

---

### 7. Database Module (`database`)

**Purpose**: Data persistence, schema management, and database operations.

**Responsibilities**:
- Database connection management
- Schema migrations
- Query optimization
- Data validation
- Backup and recovery
- Connection pooling

**Key Components**:
- ORM/Query Builder
- Migration system
- Connection pool
- Data models

**Technologies**:
- PostgreSQL (primary database)
- Redis (caching layer)
- Prisma (TypeScript ORM with schema migrations)

**Dependencies**:
- None (foundational module)

---

### 8. API Module (`api`)

**Purpose**: API gateway, routing, and request handling.

**Responsibilities**:
- Route definition and management
- Request validation
- Response formatting
- Rate limiting
- API versioning
- CORS handling
- Error handling and logging

**Key Components**:
- Router
- Middleware
- Request validators
- Response formatters

**APIs**:
- All public-facing endpoints
- Internal service communication

**Dependencies**:
- All other modules (routes to them)
- Auth module (authentication middleware)

---

### 9. UI Module (`ui`)

**Purpose**: User interface components and client-side logic.

**Responsibilities**:
- Component library
- State management
- Routing (client-side)
- API client
- Asset management
- Responsive design

**Key Components**:
- React components (Web)
- React Native components (Mobile)
- Redux/Zustand store
- API service layer

**Submodules**:
- `ui/web` - Web application
- `ui/mobile` - Mobile applications
- `ui/common` - Shared components

**Dependencies**:
- API module (backend communication)

---

### 10. Notifications Module (`notifications`)

**Purpose**: Handle all user notifications and communications.

**Responsibilities**:
- Email notifications
- Push notifications (mobile)
- In-app notifications
- Notification preferences
- Notification templates
- Notification queue management

**Key Entities**:
- Notification
- NotificationPreference
- NotificationTemplate

**APIs**:
- `GET /notifications` - Get user notifications
- `PUT /notifications/{id}/read` - Mark as read
- `POST /notifications/preferences` - Update preferences

**Dependencies**:
- Player module (user preferences)
- Third-party services (SendGrid, Firebase)

---

### 11. Matchmaking Module (`matchmaking`)

**Purpose**: Match players for battles based on skill and preferences.

**Responsibilities**:
- Queue management
- Skill-based matching
- Match creation
- Wait time optimization
- Bot opponent assignment

**Key Entities**:
- MatchmakingQueue
- MatchRequest
- Match

**APIs**:
- `POST /matchmaking/join` - Join matchmaking queue
- `DELETE /matchmaking/leave` - Leave queue
- `GET /matchmaking/status` - Get queue status

**Dependencies**:
- Player module (stats, ranking)
- Battle module (match creation)

---

### 12. Admin Module (`admin`)

**Purpose**: Administrative tools and back-office functionality.

**Responsibilities**:
- User management (ban, suspend)
- Content moderation
- System monitoring dashboard
- Game balance configuration
- Analytics and reports
- Database administration tools

**Key Components**:
- Admin dashboard UI
- Reporting tools
- Configuration management
- User management tools

**APIs**:
- `GET /admin/users` - List users
- `POST /admin/users/{id}/ban` - Ban user
- `GET /admin/stats` - System statistics
- `PUT /admin/config` - Update configuration

**Dependencies**:
- All modules (administration access)
- Auth module (admin permissions)

---

## Module Dependencies Graph

```
                    ┌──────────┐
                    │   Auth   │
                    └────┬─────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
    │ Player  │    │  Robot  │    │ Stable  │
    └────┬────┘    └────┬────┘    └────┬────┘
         │               │               │
         └───────┬───────┴───────┬───────┘
                 │               │
            ┌────▼────┐    ┌────▼────────┐
            │  Battle │◄───┤ Matchmaking │
            └────┬────┘    └─────────────┘
                 │
            ┌────▼────────┐
            │ Game Engine │
            └────┬────────┘
                 │
         ┌───────┴────────┬─────────────┐
         │                │             │
    ┌────▼────┐      ┌───▼────┐   ┌───▼──────────┐
    │   API   │      │   UI   │   │Notifications │
    └────┬────┘      └────────┘   └──────────────┘
         │
    ┌────▼────────┐
    │  Database   │
    └─────────────┘
```

## Module Development Strategy

**Note**: For the complete implementation timeline and phase breakdown (Phase 0-9), refer to **ROADMAP.md** which contains the authoritative development plan. This section provides a logical overview of module dependencies.

### Development Layers

The modules are organized in layers, where each layer depends on the layers below it:

**Layer 1: Foundation** (No dependencies)
- Database (Prisma + PostgreSQL)

**Layer 2: Core Infrastructure** (Depends on Layer 1)
- Auth (JWT + username/password)
- API (Express-based REST)

**Layer 3: Game Entities** (Depends on Layers 1-2)
- Player (user profiles, stats)
- Robot (23 attributes, state tracking)
- Stable (14 facilities, prestige system)

**Layer 4: Game Logic** (Depends on Layers 1-3)
- Game Engine (rules, validation)
- Battle (time-based combat simulation)

**Layer 5: User Experience** (Depends on Layers 1-4)
- UI (React + Tailwind CSS for web)
- Notifications (WebSockets/Web Push)

**Layer 6: Advanced Features** (Post-MVP)
- Matchmaking
- Admin tools
- UI (Mobile - React Native)

**Implementation Priority**: See ROADMAP.md Phase 1 for actual development priorities and detailed breakdown (Phase 1a: Core, 1b: Weapons, 1c: Stable)

## Inter-Module Communication

### Synchronous Communication
- REST API calls for immediate responses
- Direct function calls within same process

### Asynchronous Communication
- Message queue for non-blocking operations (future)
- Event bus for loosely coupled events (future)
- WebSockets for real-time notifications and cross-platform data synchronization

## Module Testing Strategy

Each module should have:
- **Unit Tests**: Test individual functions and classes
- **Integration Tests**: Test module interactions
- **Contract Tests**: Verify API contracts
- **Load Tests**: Validate performance under load

## Module Documentation Standard

Each module directory should contain:
- `README.md` - Module overview and quick start
- `API.md` - Detailed API documentation
- `SCHEMA.md` - Database schema (if applicable)
- `TESTS.md` - Testing guide and coverage
- `DEPLOYMENT.md` - Deployment instructions
