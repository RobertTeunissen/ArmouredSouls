# Quick Reference: Code Quality Tools

This guide provides quick commands for maintaining code quality in the ArmouredSouls project.

---

## Backend Commands

### Linting
```bash
cd prototype/backend

# Check for linting issues
npm run lint

# Auto-fix linting issues
npm run lint:fix
```

### Building
```bash
cd prototype/backend

# Compile TypeScript
npm run build

# Start development server (with auto-reload)
npm run dev

# Start production server
npm start
```

### Testing
```bash
cd prototype/backend

# Run all tests
npm test

# Run specific test file
npm test -- tests/storageCalculations.test.ts

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run custom test scripts
npm run test:matchmaking
npm run test:robot-stats
```

### Database
```bash
cd prototype/backend

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Open Prisma Studio
npm run prisma:studio

# Seed database
npx tsx prisma/seed.ts
```

### Security
```bash
cd prototype/backend

# Check for vulnerabilities
npm audit

# Fix vulnerabilities (automatic)
npm audit fix

# Fix vulnerabilities (may break things)
npm audit fix --force
```

---

## Frontend Commands

### Linting
```bash
cd prototype/frontend

# Check for linting issues
npm run lint

# Auto-fix linting issues (if lint:fix exists)
npm run lint -- --fix
```

### Building
```bash
cd prototype/frontend

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Testing
```bash
cd prototype/frontend

# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Run E2E tests in headed mode (see browser)
npm run test:e2e:headed

# Debug E2E tests
npm run test:e2e:debug

# Show test report
npm run playwright:report
```

### Security
```bash
cd prototype/frontend

# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix
```

---

## Git Workflow

### Conventional Commits
Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```bash
# Feature
git commit -m "feat(robots): add weapon loadout system"

# Bug fix
git commit -m "fix(auth): resolve token expiration issue"

# Documentation
git commit -m "docs(api): update authentication endpoints"

# Refactoring
git commit -m "refactor(battle): simplify damage calculation"

# Tests
git commit -m "test(economy): add storage calculation tests"

# Chores
git commit -m "chore(deps): update dependencies"
```

### Branch Naming
```bash
# Feature
git checkout -b feature/weapon-loadout-ui

# Bug fix
git checkout -b fix/auth-token-expiry

# Documentation
git checkout -b docs/update-setup-guide
```

---

## CI/CD Pipeline

### GitHub Actions Workflow

The CI/CD pipeline automatically runs on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`

**Checks**:
1. ✅ Backend lint
2. ✅ Backend build
3. ✅ Backend tests
4. ✅ Frontend lint
5. ✅ Frontend build
6. ✅ Frontend E2E tests
7. ✅ Security audit

**View Results**:
- Go to the "Actions" tab in GitHub
- Click on the latest workflow run
- View logs for each job

---

## Before Committing

### Checklist
- [ ] Code compiles without errors (`npm run build`)
- [ ] Linter passes with no errors (`npm run lint`)
- [ ] Tests pass (`npm test`)
- [ ] No sensitive data or secrets in code
- [ ] Commit message follows conventional format
- [ ] Changes are minimal and focused

### Quick Pre-commit Check
```bash
# Backend
cd prototype/backend && npm run build && npm run lint && npm test

# Frontend
cd prototype/frontend && npm run build && npm run lint
```

---

## Common Issues & Solutions

### Issue: "Prisma Client not generated"
```bash
cd prototype/backend
npm run prisma:generate
```

### Issue: "Database connection failed"
```bash
# Start Docker database
cd prototype
docker compose up -d

# Check if database is running
docker ps
```

### Issue: "Port already in use"
```bash
# Find process using port 3001 (backend)
lsof -i :3001

# Kill process
kill -9 <PID>

# Or for frontend (port 3000)
lsof -i :3000
kill -9 <PID>
```

### Issue: "Module not found"
```bash
# Backend
cd prototype/backend
rm -rf node_modules
npm install

# Frontend
cd prototype/frontend
rm -rf node_modules
npm install
```

### Issue: "ESLint not found"
```bash
# Backend
cd prototype/backend
npm install

# Frontend
cd prototype/frontend
npm install
```

---

## Code Quality Standards

### TypeScript
- ✅ No `any` types (use proper types)
- ✅ Explicit return types for functions
- ✅ Interfaces for all data structures
- ✅ Strict mode enabled

### Code Style
- ✅ Max line length: 100 characters
- ✅ 2 spaces for indentation
- ✅ Single quotes for strings
- ✅ Semicolons required

### Testing
- ✅ Unit tests for business logic
- ✅ Integration tests for API endpoints
- ✅ E2E tests for user flows
- ✅ Aim for >80% coverage

### Security
- ✅ No hardcoded secrets
- ✅ Input validation on all endpoints
- ✅ Authentication on protected routes
- ✅ Regular dependency updates

---

## Useful Resources

- **Main README**: `/README.md`
- **Setup Guide**: `/docs/SETUP.md`
- **QA Report**: `/docs/QA_BASELINE_REPORT.md`
- **Architecture**: `/docs/ARCHITECTURE.md`
- **Contributing**: `/CONTRIBUTING.md`
- **Copilot Instructions**: `/.github/copilot-instructions.md`

---

## Quick Help

### Get Help
```bash
# View available npm scripts (backend)
cd prototype/backend && npm run

# View available npm scripts (frontend)
cd prototype/frontend && npm run
```

### Documentation
- **Prisma**: https://www.prisma.io/docs
- **React**: https://react.dev
- **Tailwind**: https://tailwindcss.com/docs
- **Playwright**: https://playwright.dev
- **ESLint**: https://eslint.org/docs

---

**Last Updated**: February 8, 2026
