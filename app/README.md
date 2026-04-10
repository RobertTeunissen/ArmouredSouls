# Armoured Souls - Phase 1 Prototype

This is the Phase 1 local prototype for Armoured Souls. The prototype runs entirely on your local machine for testing and development.

## 🚀 Setup Instructions

**→ See [Complete Setup Guide](../docs/guides/operations/LOCAL_SETUP.md) for detailed instructions**

Quick setup:
```bash
# From app/ directory
docker compose up -d                    # Start database
cd backend && npm install && npm run prisma:migrate && npx tsx prisma/seed.ts
cd ../frontend && npm install           # IMPORTANT: Run this after every git pull
```

> **⚠️ Important:** Always run `npm install` in both backend/ and frontend/ directories after pulling updates from Git.

Run servers:
```bash
cd backend && npm run dev   # Terminal 1 - http://localhost:3001
cd frontend && npm run dev  # Terminal 2 - http://localhost:3000
```

> **📘 Having issues?** See [frontend/TROUBLESHOOTING.md](frontend/TROUBLESHOOTING.md) for common problems and solutions.

## 📖 Full Documentation

See [../docs/guides/operations/LOCAL_SETUP.md](../docs/guides/operations/LOCAL_SETUP.md) for:
- Initial setup steps
- Testing new versions
- Database reset instructions
- Troubleshooting
- VS Code tips

---

## 🏗️ Project Structure

```
app/
├── backend/           # Express + Prisma backend
│   ├── src/          # TypeScript source code
│   ├── prisma/       # Database schema and migrations
│   └── package.json
├── frontend/         # React + Vite + Tailwind frontend
│   ├── src/         # React components
│   └── package.json
└── docker-compose.yml # PostgreSQL database
```

## 📦 Tech Stack

**Backend**: Express, Prisma, PostgreSQL, TypeScript, JWT auth  
**Frontend**: React, Vite, Tailwind CSS, React Router  
**Database**: PostgreSQL 16 in Docker

---

## 🌐 Production Deployment

Armoured Souls deploys to Scaleway DEV1-S VPS instances running Ubuntu 22.04, with Caddy as reverse proxy, PM2 for process management, and PostgreSQL in Docker.

- [VPS Setup Guide](../docs/guides/operations/VPS_SETUP.md) — Provision a new VPS from scratch
- [Deployment Guide](../docs/guides/operations/DEPLOYMENT.md) — CI/CD pipeline, first deploy, and manual PRD promotion
- [Maintenance Guide](../docs/guides/operations/MAINTENANCE.md) — Logs, backups, monitoring
- [Troubleshooting Guide](../docs/guides/TROUBLESHOOTING.md) — Common issues and rollback procedure
- [Architecture Decisions](../docs/guides/DECISIONS.md) — Project structure rationale and risk register

ACC auto-deploys on push to `main`. PRD requires manual promotion via GitHub Actions.

---

For complete setup, troubleshooting, and reset instructions: [../docs/guides/operations/LOCAL_SETUP.md](../docs/guides/operations/LOCAL_SETUP.md)
