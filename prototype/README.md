# Armoured Souls - Phase 1 Prototype

This is the Phase 1 local prototype for Armoured Souls. The prototype is designed to run entirely on your local machine for testing and development.

## 🏗️ Project Structure

```
prototype/
├── backend/           # Express + Prisma backend
│   ├── src/          # TypeScript source code
│   ├── prisma/       # Database schema and migrations
│   └── package.json  # Backend dependencies
├── frontend/         # React + Vite + Tailwind frontend
│   ├── src/         # React components
│   └── package.json # Frontend dependencies
└── docker-compose.yml # PostgreSQL database
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+ (https://nodejs.org/)
- **Docker** and **Docker Compose** (https://www.docker.com/)
- **Git** (for version control)

### Installation

1. **Start the database**
   ```bash
   cd prototype
   docker-compose up -d
   ```

2. **Set up the backend**
   ```bash
   cd backend
   
   # Copy environment file
   cp .env.example .env
   
   # Install dependencies
   npm install
   
   # Generate Prisma client
   npm run prisma:generate
   
   # Run database migrations
   npm run prisma:migrate
   
   # Seed the database with sample data
   npx tsx prisma/seed.ts
   ```

3. **Set up the frontend**
   ```bash
   cd ../frontend
   
   # Install dependencies
   npm install
   ```

4. **Start the development servers**
   
   In one terminal (backend):
   ```bash
   cd backend
   npm run dev
   ```
   
   In another terminal (frontend):
   ```bash
   cd frontend
   npm run dev
   ```

5. **Open your browser**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001

## 📦 Tech Stack

### Backend
- **Express** - Web framework
- **Prisma** - Database ORM
- **PostgreSQL** - Database
- **TypeScript** - Type safety
- **bcrypt** - Password hashing
- **jsonwebtoken** - Authentication

### Frontend
- **React** - UI framework
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **TypeScript** - Type safety
- **React Router** - Routing

### Database
- **PostgreSQL 16** - Running in Docker

### Game Design
- **25 Robot Attributes** - Combat, Technical, Physical, Mental
- **Credits (₡)** - In-game currency
- **ELO Ranking** - Matchmaking system
- **Weapon System** - Purchasable weapons with attribute bonuses

## 🔧 Development

### Database Management

```bash
# View database in Prisma Studio
npm run prisma:studio

# Create a new migration
npm run prisma:migrate

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

### Test Users

The seed script creates 6 test users:

| Username | Password | Role | Currency |
|----------|----------|------|----------|
| admin | admin123 | admin | ₡10,000,000 |
| player1 | password123 | user | ₡1,000,000 |
| player2 | password123 | user | ₡1,000,000 |
| player3 | password123 | user | ₡1,000,000 |
| player4 | password123 | user | ₡1,000,000 |
| player5 | password123 | user | ₡1,000,000 |

### Game Economy

- **Starting Balance**: ₡1,000,000 Credits
- **Robot Frame**: ₡500,000 (bare metal, all 25 attributes at level 1)
- **Weapons**: ₡100,000 - ₡400,000 (required for battles)
- **Upgrade Cost**: (level + 1) × 1,000 Credits per attribute
  - Example: Level 1→2 costs ₡2,000
  - Example: Level 10→11 costs ₡11,000

## 📝 Next Steps

This basic setup provides:
- ✅ Backend server with Express
- ✅ Frontend with React + Tailwind
- ✅ PostgreSQL database with Prisma
- ✅ Database schema for users, robots, weapons, and battles
- ✅ 25-attribute robot system (Combat, Technical, Physical, Mental)
- ✅ Credits (₡) currency system
- ✅ Seed data with test users and 11 sample weapons
- ✅ ELO ranking system
- ✅ Comprehensive game design documentation

Still to implement (see PHASE1_PLAN.md and ROBOT_ATTRIBUTES.md for details):
- [ ] Authentication endpoints (login/logout)
- [ ] Robot CRUD endpoints with 25 attributes
- [ ] Weapon purchase system
- [ ] Battle simulation engine with attribute formulas
- [ ] Frontend pages (login, robot creator, weapon shop, battle simulator, etc.)
- [ ] Repair cost and battle reward calculations
- [ ] Battle history with ELO tracking

## 🐛 Troubleshooting

**Database connection fails:**
- Check Docker is running: `docker ps`
- Restart database: `docker-compose restart`

**Port already in use:**
- Backend (3001): Change PORT in `.env`
- Frontend (3000): Change port in `vite.config.ts`
- Database (5432): Change port mapping in `docker-compose.yml`

**Prisma errors:**
- Regenerate client: `npm run prisma:generate`
- Check DATABASE_URL in `.env`

## 📚 Documentation

See the main `/docs` directory for:
- [PHASE1_PLAN.md](/docs/PHASE1_PLAN.md) - Detailed Phase 1 plan
- [GAME_DESIGN.md](/docs/GAME_DESIGN.md) - Game design decisions
- [ARCHITECTURE.md](/docs/ARCHITECTURE.md) - System architecture

## 🤝 Contributing

This is a prototype - see [CONTRIBUTING.md](/CONTRIBUTING.md) for development guidelines.
