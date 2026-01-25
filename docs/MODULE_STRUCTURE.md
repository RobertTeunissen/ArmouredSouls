# Armoured Souls - Module Structure

**Last Updated**: January 24, 2026

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

**Purpose**: Robot creation, customization, and management.

**Responsibilities**:
- Robot creation and configuration
- Robot stats and attributes
- Robot upgrade system
- Robot inventory (weapons, armor, modules)
- Robot templates and blueprints

**Key Entities**:
- Robot
- RobotComponent (weapon, armor, engine, etc.)
- RobotBlueprint
- RobotStats

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

**Purpose**: Battle simulation and combat mechanics.

**Responsibilities**:
- Battle initialization
- Time-based combat simulation
- Damage calculation (hit chance, critical hits, shields, penetration)
- Battle outcome determination
- Battle log generation (timestamped events)

**Key Entities**:
- Battle
- BattleParticipant
- BattleAction
- BattleLog

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

**Purpose**: Manage player's collection of robots (the "stable").

**Responsibilities**:
- Stable creation and management
- Robot organization
- Stable capacity limits
- Team composition
- Preset loadouts

**Key Entities**:
- Stable
- Team
- Loadout

**APIs**:
- `GET /stable/{playerId}` - Get player stable
- `POST /stable/{playerId}/team` - Create team
- `PUT /stable/{playerId}/team/{teamId}` - Update team
- `GET /stable/{playerId}/teams` - Get all teams

**Dependencies**:
- Robot module
- Player module

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

## Module Development Priority

**Note**: This section describes the logical module development order. For the actual project phases and implementation timeline, refer to ROADMAP.md which contains the authoritative Phase 0-9 structure.

### Module Foundation
1. Database (Prisma + PostgreSQL)
2. Auth (JWT + basic username/password for prototype)
3. API (Express-based REST API)

### Core Game Features
4. Player
5. Robot
6. Stable

### Gameplay Systems
7. Game Engine
8. Battle
9. Matchmaking (simplified for prototype)

### User Experience
10. UI (Web with React + Tailwind CSS)
11. Notifications (WebSockets/Web Push)

### Advanced Features
12. Admin
13. UI (Mobile - React Native, post-MVP)

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