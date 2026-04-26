---
inclusion: always
---

# Armoured Souls Project Overview

## Project Type
Browser-based robot combat strategy game with turn-based mechanics, league systems, and economic simulation.

## Technology Stack

### Backend
- **Runtime**: Node.js 24 LTS
- **Language**: TypeScript 5.8 (strict mode)
- **Framework**: Express 5
- **ORM**: Prisma 7 (PostgreSQL)
- **Authentication**: JWT with bcrypt password hashing
- **Process Manager**: PM2 (production)
- **Testing**: Jest 30 with property-based testing (fast-check)

### Frontend
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS 4
- **Testing**: Vitest 4 with property-based testing (fast-check)
- **State Management**: Zustand + React Context + hooks
- **HTTP Client**: Fetch API / Axios

### Database
- **DBMS**: PostgreSQL 17
- **Containerization**: Docker Compose
- **Migrations**: Prisma Migrate
- **Connection Pooling**: Prisma connection limits

### Infrastructure
- **Reverse Proxy**: Caddy (automatic HTTPS)
- **Hosting**: Scaleway DEV1-S VPS (2 vCPU, 2GB RAM)
- **CI/CD**: GitHub Actions
- **Firewall**: UFW (Ubuntu)
- **Backups**: Automated daily PostgreSQL dumps

## Project Structure
- `/app/backend` - Main backend application (services organized into 18 domain subdirectories under src/services/)
- `/app/frontend` - React frontend application
- `/app/shared` - Shared TypeScript modules imported by both frontend and backend (game formulas, discount calculations)
- `/docs` - Comprehensive documentation organized by category (includes modular architecture migration plan in `docs/guides/`)

## Key Systems
1. **Combat System** - Turn-based robot battles with weapons, armor, and damage calculations
2. **League System** - Competitive ranking with promotions/relegations
3. **Economy** - Credits, facilities, investments, weapon shop
4. **Cycle System** - Automated daily game cycles
5. **Fame & Prestige** - Player progression 
6. **Tournament System** - Competitive events
7. **Changelog System** - In-game "What's New" feed with auto-generated drafts from deploys, admin review/publish workflow, and player notification modal
8. **Tuning Pool System** - Per-robot tactical attribute tuning with facility-gated pool size (Spec #25)
9. **Achievement System** - 77-achievement progression layer with badges, progress tracking, rarity, pinned showcase, and toast notifications (Spec #27)
10. **Admin Portal** - Dedicated admin experience with sidebar navigation, 18 route-based lazy-loaded pages, Zustand shared state (useAdminStore), AdminRoute guard, 6 analytics dashboards, shared UI component library, and server-side audit trail (Spec #28)

## Documentation Organization
- `docs/architecture/` - System architecture, schema, combat engine, security
- `docs/game-systems/` - Game design and system specifications
- `docs/prd_pages/` - Page-specific requirements
- `docs/guides/` - Setup, deployment, maintenance guides
- `docs/analysis/` - Feature analysis and planning
- `docs/balance_changes/` - Game balance modifications
- `docs/design_ux/` - Design system and brand guidelines
- `docs/implementation_notes/` - Technical implementation details

## Development Principles
- Modular architecture for maintainability
- Comprehensive documentation for all features
- Security-first approach (see docs/architecture/PRD_SECURITY.md)
- Database-driven game state management
- RESTful API design
