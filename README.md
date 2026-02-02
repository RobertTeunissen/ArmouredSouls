# Armoured Souls

A next-generation strategy simulation game where thousands of players manage their own "stable" of battle robots in a persistent online world.

## 🚀 Quick Start

**→ See [Complete Setup Guide](docs/SETUP.md) for detailed instructions**

To run the Phase 1 prototype locally:

```bash
# Clone and navigate
git clone https://github.com/RobertTeunissen/ArmouredSouls.git
cd ArmouredSouls/prototype

# Start database
docker compose up -d

# Setup backend
cd backend
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate
npx tsx prisma/seed.ts
npm run dev  # Terminal 1

# Setup frontend (in new terminal)
cd ../frontend
npm install
npm run dev  # Terminal 2
```

Open http://localhost:3000 - Login with `player1` / `password123`

📖 **For testing new versions and database reset:** See [SETUP.md](docs/SETUP.md)
🔧 **Having installation issues?** → See the "🐛 Troubleshooting" section in [SETUP.md](docs/SETUP.md)

⚠️ **If `prisma generate` fails**: Your local `schema.prisma` may be corrupted. Run: `git restore prototype/backend/prisma/schema.prisma` then try again. See the troubleshooting section in [SETUP.md](docs/SETUP.md) for details.

## 🎮 Project Vision

Armoured Souls is designed to be a highly scalable, secure, and portable multiplayer strategy game. Players will build, customize, and manage teams of battle robots, competing in various game modes and tournaments.

## 🎯 Core Principles

- **Fully Automated Testing**: Comprehensive test coverage at all levels
- **Ultra Secure**: Security-first design with robust authentication and data protection
- **Portable**: Web-based initially, with iOS and Android support in future phases
- **Scalable**: Built to support thousands of concurrent players

## 📋 Project Status

**Current Phase**: Phase 1 - Local Prototype  
**Status**: Basic setup complete, ready for feature development

> ✅ **Progress**: The prototype foundation is in place with backend (Express + Prisma), frontend (React + Tailwind), and database (PostgreSQL) configured and ready to use.

## 📚 Documentation

### Getting Started
- [**Setup Guide**](docs/SETUP.md) - Complete setup, quick testing reference, and troubleshooting
- [**Robot Attributes System**](docs/ROBOT_ATTRIBUTES.md) - Complete attribute system, currency, weapons, and economy

### Testing & Admin Access
- [**Testing Guide**](docs/MATCHMAKING_TESTING_GUIDE.md) - Complete testing instructions with admin access
- **Admin Login**: Username `admin`, Password `admin123`
- **Quick Testing**: See the "Quick Testing Reference" section in [SETUP.md](docs/SETUP.md)

### Matchmaking System
- [**System Guide**](docs/MATCHMAKING_SYSTEM_GUIDE.md) - Complete matchmaking documentation
- [**PRD: Matchmaking**](docs/PRD_MATCHMAKING.md) - Product requirements and specifications
- [**Implementation Plan**](docs/IMPLEMENTATION_PLAN_MATCHMAKING.md) - Detailed 11-phase plan
- [**GitHub Issues (Copy-Paste)**](docs/GITHUB_ISSUES_MATCHMAKING.md) - Ready-to-use issue templates
- [**Quick Reference**](docs/QUICK_REFERENCE_MATCHMAKING.md) - Visual guides and flow charts

### Weapon Loadout System
- [**PRD: Weapon Loadout**](docs/PRD_WEAPON_LOADOUT.md) - Product requirements and specifications
- [**Implementation Plan**](docs/IMPLEMENTATION_PLAN_WEAPON_LOADOUT.md) - Detailed 11-issue sequential plan with technical specs
- [**GitHub Issues (Copy-Paste)**](docs/GITHUB_ISSUES_WEAPON_LOADOUT.md) - Ready-to-use issue templates
- [**Quick Reference**](docs/QUICK_REFERENCE_WEAPON_LOADOUT.md) - Visual guides and dependency charts

### My Robots Page (Robot Roster Management)
- [**PRD: My Robots List Page**](docs/PRD_MY_ROBOTS_LIST_PAGE.md) - ⭐ Comprehensive PRD (v1.8.1 - Complete)
- [**Documentation Index**](docs/MY_ROBOTS_PAGE_DOCS_INDEX.md) - Navigation hub for all My Robots page docs
- [**Quick Start Guide**](docs/MY_ROBOTS_PAGE_README.md) - Testing instructions and feature overview
- **Features**: Robot cards, HP/Shield bars, Battle Readiness, Repair All, Capacity management, ELO sorting

### General Documentation
- [Phase 1 Plan](docs/PHASE1_PLAN.md) - Detailed plan for local prototype development
- [Game Design Document](docs/GAME_DESIGN.md) - High-level game design and vision
- [Architecture Overview](docs/ARCHITECTURE.md) - System design and technical architecture
- [Module Structure](docs/MODULE_STRUCTURE.md) - Breakdown of system modules and components
- [Security Strategy](docs/SECURITY.md) - Security requirements and implementation approach
- [Testing Strategy](docs/TESTING_STRATEGY.md) - Automated testing approach and standards
- [Portability Strategy](docs/PORTABILITY.md) - Cross-platform development strategy
- [Planning Questions](docs/QUESTIONS.md) - Key questions and decisions

## 🗂️ Repository Structure

```
ArmouredSouls/
├── docs/               # Project documentation
├── prototype/          # Phase 1 local prototype (ACTIVE)
│   ├── backend/        # Express + Prisma backend
│   ├── frontend/       # React + Tailwind frontend
│   └── docker-compose.yml
└── modules/            # Future production codebase (Phase 2+)
    ├── auth/           # Authentication & authorization
    ├── game-engine/    # Core game logic
    ├── database/       # Data persistence layer
    ├── api/            # RESTful API layer
    └── ui/             # User interface components
```

## 🚀 Development Phases

### Phase 1: Local Prototype (Current - In Progress)
- ✅ Basic project structure and configuration
- ✅ Database schema (Users, Robots, Components, Battles)
- ✅ Development environment setup
- 🚧 Authentication system
- 🚧 Robot creation and management
- 🚧 Battle simulation engine
- 🚧 Basic UI pages

### Phase 2: Foundation (Upcoming)
- Core infrastructure setup
- Authentication system
- Database schema
- API framework

### Phase 3: Game Core
- Robot management system
- Battle simulation engine
- Player progression system

### Phase 4: Multiplayer
- Real-time battle system
- Matchmaking
- Tournaments

### Phase 5: Mobile
- iOS port
- Android port
- Cross-platform synchronization

## 🤝 Contributing

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines and best practices.

## 📄 License

[License details to be determined]

## 📧 Contact

Project Owner: Robert Teunissen
