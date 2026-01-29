# Armoured Souls - GitHub Copilot Instructions

> **Last Updated**: January 29, 2026

This document provides comprehensive instructions for GitHub Copilot when working on the Armoured Souls project. These guidelines ensure consistent code quality, maintainability, and alignment with project standards.

---

## Project Overview

**Armoured Souls** is a next-generation strategy simulation game where thousands of players manage their own "stable" of battle robots in a persistent online world. The game features:

- **Robot Customization**: Players build, upgrade, and customize battle robots
- **Turn-Based Combat**: Strategic batch-processed battles using a scheduled system (inspired by Football Manager)
- **Persistent World**: Multiplayer environment with rankings, tournaments, and progression
- **Scalable Architecture**: Built for thousands of concurrent players with web-first, mobile-later approach

**Current Phase**: Phase 1 - Local Prototype  
**Status**: Foundational setup complete, active feature development underway

---

## Tech Stack & Architecture

### Backend (Node.js/TypeScript)
- **Runtime**: Node.js 18+ with TypeScript 5.3+
- **Framework**: Express.js (simple, extensive middleware support)
- **ORM**: Prisma (TypeScript-first, excellent DX, powerful migrations)
- **Database**: PostgreSQL (primary data store)
- **Authentication**: JWT-based auth with bcrypt password hashing
- **Testing**: Jest with Supertest for API testing
- **Build Tool**: tsx for development, tsc for production builds

### Frontend (React/TypeScript)
- **Library**: React 18+ with TypeScript
- **Router**: React Router v6
- **Build Tool**: Vite (fast HMR, modern bundler)
- **Styling**: Tailwind CSS (utility-first approach)
- **HTTP Client**: Axios
- **Linting**: ESLint with TypeScript support

### Infrastructure
- **Containerization**: Docker (PostgreSQL database)
- **Version Control**: Git with Conventional Commits
- **CI/CD**: GitHub Actions (automated testing on every commit)

### Project Structure
```
ArmouredSouls/
├── docs/               # Project documentation
├── prototype/          # Phase 1 local prototype (CURRENT ACTIVE DEVELOPMENT)
│   ├── backend/        # Express + Prisma backend
│   │   ├── src/
│   │   │   ├── routes/      # API endpoint handlers
│   │   │   ├── middleware/  # Express middleware (auth, etc.)
│   │   │   ├── utils/       # Utility functions
│   │   │   └── index.ts     # App entry point
│   │   ├── prisma/          # Database schema and migrations
│   │   └── tests/           # Backend tests
│   ├── frontend/       # React + Tailwind frontend
│   │   └── src/
│   │       ├── components/  # React components
│   │       ├── pages/       # Page-level components
│   │       ├── services/    # API service layer
│   │       └── utils/       # Frontend utilities
│   └── docker-compose.yml   # Local database setup
└── modules/            # Future production codebase (Phase 2+)
```

---

## Coding Standards & Conventions

### General Principles
- **DRY** (Don't Repeat Yourself): Extract reusable logic into utilities/services
- **KISS** (Keep It Simple, Stupid): Prefer simple, readable solutions over clever ones
- **YAGNI** (You Aren't Gonna Need It): Don't build features until they're needed
- **SOLID Principles**: Follow single responsibility, open/closed, etc.
- **Self-Documenting Code**: Write clear variable/function names; comments only when necessary

### TypeScript Guidelines

#### Type Safety
- **Always use TypeScript**: Never use `any` type unless absolutely necessary
- **Explicit types**: Define interfaces/types for all data structures
- **Return types**: Explicitly type function return values
- **Strict mode**: Code must compile with strict TypeScript settings

```typescript
// ✅ Good: Explicit types, clear naming
interface Robot {
  id: string;
  name: string;
  health: number;
  attack: number;
  defense: number;
}

const calculateDamage = (attacker: Robot, defender: Robot): number => {
  const baseDamage = attacker.attack - defender.defense;
  return Math.max(baseDamage, 0);
};

// ❌ Bad: Implicit any, unclear naming
function calc(a, d) {
  return a.att - d.def;
}
```

#### Variable Declarations
- **Always use `const`** for variables that don't change
- **Use `let`** only when reassignment is necessary
- **Never use `var`**: It has function scope and causes confusion

#### Naming Conventions
- **Variables/Functions**: `camelCase` (e.g., `robotHealth`, `calculateDamage`)
- **Interfaces/Types**: `PascalCase` (e.g., `Robot`, `BattleResult`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_HEALTH`, `DEFAULT_ATTACK`)
- **Files**: `camelCase.ts` for utilities, `PascalCase.tsx` for React components
- **Directories**: `kebab-case` (e.g., `game-engine`, `robot-management`)

#### Code Style
- **Max line length**: 100 characters
- **Indentation**: 2 spaces (consistent with project setup)
- **Semicolons**: Use semicolons consistently
- **String quotes**: Prefer single quotes `'string'` unless template literals are needed
- **Arrow functions**: Use arrow functions for simple callbacks and utilities

### React/Frontend Standards

#### Component Structure
- **Functional components only**: No class components
- **Hooks**: Use React hooks for state and side effects
- **Component naming**: PascalCase files and component names match

```typescript
// ✅ Good: Functional component with TypeScript
interface RobotCardProps {
  robot: Robot;
  onSelect: (robotId: string) => void;
}

export const RobotCard: React.FC<RobotCardProps> = ({ robot, onSelect }) => {
  return (
    <div className="p-4 bg-gray-800 rounded-lg">
      <h3 className="text-xl font-bold">{robot.name}</h3>
      <button onClick={() => onSelect(robot.id)}>Select</button>
    </div>
  );
};

// ❌ Bad: Class component, inline styles
class RobotCard extends React.Component {
  render() {
    return <div style={{ padding: '1rem' }}>...</div>;
  }
}
```

#### Tailwind CSS Usage
- **No inline styles**: Always use Tailwind utility classes
- **Consistent spacing**: Use Tailwind's spacing scale (p-4, m-2, etc.)
- **Responsive design**: Use responsive modifiers (sm:, md:, lg:)
- **Dark theme**: Use dark mode classes when applicable (bg-gray-800, text-white)

#### State Management
- **Local state**: Use `useState` for component-local state
- **API calls**: Use async/await with try-catch for error handling
- **No global state library yet**: Keep state local until Phase 2

### Backend/API Standards

#### Express Route Handlers
- **Async/Await**: All route handlers should be async
- **Error handling**: Use try-catch blocks and send appropriate HTTP status codes
- **Input validation**: Validate all user inputs before processing
- **Authentication**: Protect routes with auth middleware where needed

```typescript
// ✅ Good: Async handler with validation and error handling
router.post('/robots', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { name, attack, defense } = req.body;
    
    // Validate inputs
    if (!name || attack < 0 || defense < 0) {
      return res.status(400).json({ error: 'Invalid robot data' });
    }
    
    const robot = await prisma.robot.create({
      data: { name, attack, defense, userId: req.user.id }
    });
    
    res.status(201).json(robot);
  } catch (error) {
    console.error('Robot creation error:', error);
    res.status(500).json({ error: 'Failed to create robot' });
  }
});

// ❌ Bad: No error handling, no validation, callback-style
router.post('/robots', (req, res) => {
  prisma.robot.create(req.body).then(robot => {
    res.json(robot);
  });
});
```

#### Prisma Database Patterns
- **Use Prisma Client**: Always use `@prisma/client` for database operations
- **Type safety**: Leverage Prisma's generated types
- **Migrations**: Use `prisma migrate dev` for schema changes
- **Transactions**: Use Prisma transactions for multi-step operations

```typescript
// ✅ Good: Type-safe Prisma query with relations
const robot = await prisma.robot.findUnique({
  where: { id: robotId },
  include: {
    weapons: true,
    battles: {
      orderBy: { createdAt: 'desc' },
      take: 10
    }
  }
});

// ❌ Bad: Raw SQL (avoid unless necessary for performance)
const robots = await prisma.$queryRaw`SELECT * FROM robots`;
```

---

## Testing Requirements

### Test-Driven Development (TDD)
- **Write tests first**: For new features, write tests before implementation when possible
- **Test coverage**: Aim for >80% code coverage overall, >90% for critical modules
- **Automated tests**: All tests run in CI/CD on every commit

### Testing Pyramid
```
E2E Tests (10%)      ← Few, slow, high-level user flows
Integration (30%)    ← API endpoints with database
Unit Tests (60%)     ← Pure functions, utilities
```

### Unit Tests (Jest)

**Characteristics**:
- Fast execution (<1ms per test)
- No external dependencies (mock database, APIs)
- Test one function/unit at a time

**Example**:
```typescript
// tests/utils/robotStats.test.ts
describe('calculateDamage', () => {
  it('should calculate damage correctly when attacker is stronger', () => {
    const attacker = { attack: 100 } as Robot;
    const defender = { defense: 30 } as Robot;
    
    const damage = calculateDamage(attacker, defender);
    
    expect(damage).toBe(70);
  });
  
  it('should return 0 when defender is stronger', () => {
    const attacker = { attack: 10 } as Robot;
    const defender = { defense: 50 } as Robot;
    
    const damage = calculateDamage(attacker, defender);
    
    expect(damage).toBe(0);
  });
});
```

### Integration Tests (Supertest)

**Characteristics**:
- Test API endpoints with real database
- Use test database (separate from development)
- Reset database state between tests

**Example**:
```typescript
// tests/routes/robots.test.ts
describe('POST /api/robots', () => {
  let authToken: string;
  
  beforeAll(async () => {
    // Setup: Create test user and get auth token
    authToken = await createTestUserAndGetToken();
  });
  
  it('should create a new robot', async () => {
    const response = await request(app)
      .post('/api/robots')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'TestBot',
        attack: 50,
        defense: 30
      });
    
    expect(response.status).toBe(201);
    expect(response.body.name).toBe('TestBot');
  });
  
  it('should reject invalid robot data', async () => {
    const response = await request(app)
      .post('/api/robots')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: '' }); // Invalid: missing required fields
    
    expect(response.status).toBe(400);
  });
});
```

### Running Tests
```bash
# Backend tests
cd prototype/backend
npm test                    # Run all tests
npm test -- --watch        # Watch mode for TDD
npm test -- --coverage     # Generate coverage report

# Frontend tests (when added in future)
cd prototype/frontend
npm test
```

---

## Security Best Practices

### Authentication & Authorization
- **JWT tokens**: Use short-lived JWTs (1 hour) with refresh tokens
- **Password hashing**: Always use bcrypt with appropriate salt rounds (10+)
- **Input validation**: Validate and sanitize all user inputs
- **SQL injection**: Use Prisma's parameterized queries (built-in protection)

### Secrets Management
- **Never commit secrets**: Use `.env` files for local development
- **Environment variables**: Store all sensitive config in environment variables
- **`.env.example`**: Provide example env file with dummy values

```bash
# .env.example (safe to commit)
DATABASE_URL="postgresql://user:password@localhost:5432/armouredsouls"
JWT_SECRET="your-secret-key-here"

# .env (never commit - in .gitignore)
DATABASE_URL="postgresql://realuser:realpass@localhost:5432/armouredsouls"
JWT_SECRET="actual-secret-key-8h23f9h23f9h23f"
```

### Data Validation
- **Server-side validation**: Always validate on backend, never trust client
- **Type checking**: Use TypeScript and Zod/Joi for runtime validation
- **Error messages**: Don't expose internal details in error messages

---

## Development Workflow

### Git Workflow
1. Create feature branch from `main`: `git checkout -b feature/robot-customization`
2. Make changes with frequent commits
3. Push branch and create Pull Request
4. CI/CD runs automated tests
5. Code review and merge to `main`

### Commit Message Format (Conventional Commits)

**Format**: `<type>(<scope>): <subject>`

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `refactor`: Code refactoring (no behavior change)
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements

**Examples**:
```
feat(robot): add damage calculation system
fix(auth): prevent token expiration edge case
docs(api): update robot API documentation
test(weapons): add weapon loadout validation tests
refactor(battle): simplify battle result calculation
```

### Branch Naming
- **Feature**: `feature/add-robot-customization`
- **Bug fix**: `fix/authentication-token-expiry`
- **Documentation**: `docs/update-api-docs`

---

## Database & Prisma Guidelines

### Schema Design
- **Use Prisma schema**: Define all models in `prisma/schema.prisma`
- **Migrations**: Always use migrations, never manually alter database
- **Relations**: Define relations properly with `@relation`
- **Indexes**: Add indexes for frequently queried fields

```prisma
// Good: Well-defined model with relations and constraints
model Robot {
  id        String   @id @default(uuid())
  name      String
  health    Int      @default(100)
  attack    Int
  defense   Int
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  weapons   Weapon[]
  battles   Battle[]
  createdAt DateTime @default(now())
  
  @@index([userId])
}
```

### Migration Workflow
```bash
# 1. Modify prisma/schema.prisma
# 2. Generate migration
npm run prisma:migrate -- --name add_robot_attributes

# 3. Regenerate Prisma Client
npm run prisma:generate

# 4. Test changes locally
npm run dev
```

### Database Seeding
- **Seed file**: `prisma/seed.ts` provides test data for development
- **Idempotent**: Seeds should be safe to run multiple times
- **Realistic data**: Use realistic but fake data for testing

---

## API Design Standards

### RESTful Conventions
- **Resources**: Use nouns, not verbs (`/robots`, not `/getRobots`)
- **HTTP methods**: GET (read), POST (create), PUT/PATCH (update), DELETE (delete)
- **Status codes**: Use appropriate codes (200, 201, 400, 401, 404, 500)

### Endpoint Examples
```
GET    /api/robots           # List all robots
POST   /api/robots           # Create new robot
GET    /api/robots/:id       # Get specific robot
PUT    /api/robots/:id       # Update robot
DELETE /api/robots/:id       # Delete robot

GET    /api/users/me         # Get current user
POST   /api/auth/login       # Login
POST   /api/auth/register    # Register new user
```

### Response Format
```typescript
// Success response
{
  "id": "123",
  "name": "BattleBot",
  "health": 100
}

// Error response
{
  "error": "Robot not found",
  "code": "ROBOT_NOT_FOUND"
}

// List response
{
  "data": [...],
  "total": 50,
  "page": 1,
  "pageSize": 20
}
```

---

## Documentation Standards

### Code Comments
- **Only when necessary**: Code should be self-documenting through clear naming
- **When to comment**:
  - Complex algorithms or business logic
  - Non-obvious workarounds
  - API contracts and interfaces
- **When NOT to comment**: Obvious code that explains itself

```typescript
// ❌ Bad: Obvious comment
// Set the robot name
robot.name = 'BattleBot';

// ✅ Good: Explains complex logic
// Apply weapon bonuses multiplicatively to ensure
// later weapons don't provide exponentially more benefit
const effectiveAttack = weapons.reduce((attack, weapon) => 
  attack * (1 + weapon.attackBonus), baseAttack
);
```

### JSDoc for Public APIs
```typescript
/**
 * Calculate damage dealt by attacker to defender.
 * Damage is reduced by defender's defense, with a minimum of 0.
 * 
 * @param attacker - The attacking robot
 * @param defender - The defending robot
 * @returns The amount of damage dealt (0 or positive)
 * 
 * @example
 * const damage = calculateDamage(myRobot, enemyRobot);
 * console.log(`Dealt ${damage} damage`);
 */
export const calculateDamage = (attacker: Robot, defender: Robot): number => {
  const baseDamage = attacker.attack - defender.defense;
  return Math.max(baseDamage, 0);
};
```

---

## Common Patterns & Anti-Patterns

### ✅ Do's

**1. Use async/await for asynchronous operations**
```typescript
// ✅ Good
const robot = await prisma.robot.findUnique({ where: { id } });
if (!robot) throw new Error('Robot not found');
```

**2. Validate inputs early**
```typescript
// ✅ Good
if (!name || name.length < 3) {
  return res.status(400).json({ error: 'Name must be at least 3 characters' });
}
```

**3. Use environment variables for configuration**
```typescript
// ✅ Good
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;
```

**4. Proper error handling in API routes**
```typescript
// ✅ Good
try {
  const result = await riskyOperation();
  res.json(result);
} catch (error) {
  console.error('Operation failed:', error);
  res.status(500).json({ error: 'Operation failed' });
}
```

### ❌ Don'ts

**1. Don't use `any` type**
```typescript
// ❌ Bad
const processData = (data: any) => { ... };

// ✅ Good
interface RobotData {
  name: string;
  attack: number;
}
const processData = (data: RobotData) => { ... };
```

**2. Don't commit sensitive data**
```typescript
// ❌ Bad
const JWT_SECRET = 'hardcoded-secret-key';

// ✅ Good
const JWT_SECRET = process.env.JWT_SECRET;
```

**3. Don't ignore errors**
```typescript
// ❌ Bad
await prisma.robot.create(data); // No error handling

// ✅ Good
try {
  await prisma.robot.create(data);
} catch (error) {
  // Handle error appropriately
}
```

**4. Don't use synchronous file operations in production**
```typescript
// ❌ Bad
const data = fs.readFileSync('file.txt');

// ✅ Good
const data = await fs.promises.readFile('file.txt');
```

---

## Performance Considerations

### Database Queries
- **Avoid N+1 queries**: Use `include` to load relations in single query
- **Use indexes**: Add database indexes for frequently queried fields
- **Pagination**: Always paginate large result sets

```typescript
// ❌ Bad: N+1 query problem
const robots = await prisma.robot.findMany();
for (const robot of robots) {
  robot.weapons = await prisma.weapon.findMany({ where: { robotId: robot.id } });
}

// ✅ Good: Single query with include
const robots = await prisma.robot.findMany({
  include: { weapons: true }
});
```

### Frontend Optimization
- **Lazy loading**: Load heavy components only when needed
- **Memoization**: Use `useMemo` and `useCallback` for expensive computations
- **Debouncing**: Debounce search inputs and API calls

---

## Project-Specific Context

### Battle System Architecture
- **Batch processing**: Battles are processed in scheduled batches (not real-time)
- **Server-authoritative**: All battle logic runs on server to prevent cheating
- **Deterministic**: Same inputs always produce same outputs for replay accuracy

### Robot Attributes
- Core stats: `health`, `attack`, `defense`, `speed`, `armor`
- Weapons: Robots can equip multiple weapons from inventory
- Upgrades: Training facilities provide temporary stat boosts

### Future Phases
- **Phase 2**: Modular production codebase, microservices architecture
- **Phase 3**: Real-time features, WebSocket support
- **Phase 4**: Mobile apps (React Native with shared codebase)

---

## Quick Reference Checklist

When writing code for Armoured Souls, ensure:

- [ ] TypeScript strict mode enabled, no `any` types
- [ ] Async/await with try-catch for all async operations
- [ ] Input validation on all user-facing endpoints
- [ ] Authentication middleware applied where needed
- [ ] Tests written for new features (unit + integration)
- [ ] Prisma migrations created for schema changes
- [ ] Environment variables used for secrets
- [ ] Code follows naming conventions (camelCase, PascalCase, etc.)
- [ ] Tailwind CSS for all styling (no inline styles)
- [ ] Conventional Commits format for commit messages
- [ ] Documentation updated for significant changes

---

## Additional Resources

- **README**: `/README.md` - Quick start guide
- **Architecture**: `/docs/ARCHITECTURE.md` - System design and tech stack
- **Setup Guide**: `/docs/SETUP.md` - Detailed setup instructions
- **Contributing**: `/CONTRIBUTING.md` - Contribution guidelines
- **Robot System**: `/docs/ROBOT_ATTRIBUTES.md` - Game mechanics documentation

---

**Questions or Clarifications?**  
If you're unsure about any guideline or pattern, refer to existing code in the `prototype/` directory as examples. When in doubt, prioritize clarity and maintainability over cleverness.
