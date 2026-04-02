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
- **State Management**: React Context + hooks
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
- `/prototype/backend` - Main backend application (services organized into 13 domain subdirectories under src/services/)
- `/prototype/frontend` - React frontend application  
- `/docs` - Comprehensive documentation organized by category
- `/modules` - Modular architecture (api, auth, database, game-engine, ui)

## Key Systems
1. **Combat System** - Turn-based robot battles with weapons, armor, and damage calculations
2. **League System** - Competitive ranking with promotions/relegations
3. **Economy** - Credits, facilities, investments, weapon shop
4. **Cycle System** - Automated daily game cycles
5. **Fame & Prestige** - Player progression 
6. **Tournament System** - Competitive events

## Documentation Organization
- `docs/prd_core/` - Core game design and system specifications
- `docs/prd_pages/` - Page-specific requirements
- `docs/guides/` - Setup, deployment, maintenance guides
- `docs/analysis/` - Feature analysis and planning
- `docs/balance_changes/` - Game balance modifications
- `docs/design_ux/` - Design system and brand guidelines
- `docs/implementation_notes/` - Technical implementation details

## Development Principles
- Modular architecture for maintainability
- Comprehensive documentation for all features
- Security-first approach (see docs/guides/SECURITY.md)
- Database-driven game state management
- RESTful API design
