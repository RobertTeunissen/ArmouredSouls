# Design Document: VPS Migration

## Overview

This design covers the migration of the Armoured Souls application from a local-only development setup to a production-ready deployment on Scaleway VPS instances. The migration touches every layer of the stack: frontend API configuration, backend hardening, infrastructure provisioning, CI/CD automation, database operations, scheduled job decomposition, and multi-environment support.

The current state is a monorepo under `prototype/` with:
- A React + Vite frontend with 30+ hardcoded `localhost:3001` references across API utility files
- An Express.js + Prisma backend with open CORS, no process management, and a monolithic cycle endpoint
- A local Docker PostgreSQL container with hardcoded credentials
- A CI pipeline that runs tests but has no deployment capability

The target state is a fully automated deployment pipeline pushing to isolated ACC and PRD environments on Scaleway DEV1-S instances, with HTTPS, process management, automated backups, scheduled game cycles, and structured logging.

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Reverse Proxy | Caddy | Automatic HTTPS via Let's Encrypt, simpler config than Nginx, built-in SPA fallback |
| Process Manager | PM2 | Node.js-native, built-in log rotation, cluster mode, ecosystem file for config |
| Scheduler | node-cron in-process | Avoids external cron dependency, runs inside the backend process managed by PM2 |
| CI/CD | GitHub Actions with SSH deploy | Already has CI pipeline, SSH deploy is simple and fits the budget |
| Logging | winston | Structured JSON logging, transport flexibility, widely adopted in Express apps |
| Rate Limiting | express-rate-limit | Lightweight, well-maintained, supports per-route limits |

## Architecture

### System Architecture (Production)

```mermaid
graph TB
    subgraph Internet
        User[Browser Client]
        GH[GitHub Actions]
        UR[UptimeRobot]
    end

    subgraph "Scaleway VPS (DEV1-S)"
        subgraph "Caddy (Reverse Proxy)"
            SSL[SSL Termination]
            Static[Static File Serving]
            Proxy[API Proxy /api/*]
        end

        subgraph "PM2 Managed"
            Backend[Express.js Backend<br/>:3001 on 127.0.0.1]
            Scheduler[Cycle Scheduler<br/>node-cron in-process]
        end

        subgraph "Docker"
            DB[(PostgreSQL 16<br/>127.0.0.1:5432)]
        end

        Backups[Backup Scripts<br/>cron + pg_dump]
        Logs[/var/log/armouredsouls/]
    end

    User -->|HTTPS :443| SSL
    SSL --> Static
    SSL --> Proxy
    Proxy -->|HTTP| Backend
    Backend --> DB
    Scheduler --> Backend
    GH -->|SSH Deploy| Backend
    UR -->|Health Check| SSL
    Backups -->|pg_dump| DB
    Backend -->|winston| Logs
```

### Request Flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant C as Caddy
    participant E as Express Backend
    participant D as PostgreSQL

    B->>C: HTTPS GET /dashboard
    C->>B: index.html (SPA)
    B->>C: HTTPS GET /api/user/profile
    C->>E: HTTP GET /api/user/profile (127.0.0.1:3001)
    E->>D: SELECT * FROM users WHERE id = ?
    D->>E: User row
    E->>C: JSON response
    C->>B: JSON response (gzip compressed)
```

### Multi-Environment Strategy

```mermaid
graph LR
    subgraph DEV["DEV (Local Laptop)"]
        ViteDev[Vite Dev Server :3000]
        BackendDev[Express :3001]
        DockerDev[(PostgreSQL :5432)]
    end

    subgraph ACC["ACC (Scaleway VPS #1)"]
        CaddyAcc[Caddy :443]
        BackendAcc[PM2 + Express]
        DBAcc[(PostgreSQL Docker)]
    end

    subgraph PRD["PRD (Scaleway VPS #2)"]
        CaddyPrd[Caddy :443]
        BackendPrd[PM2 + Express]
        DBPrd[(PostgreSQL Docker)]
    end

    DEV -->|"push to main"| ACC
    ACC -->|"manual promote"| PRD
```

| Aspect | DEV | ACC | PRD |
|--------|-----|-----|-----|
| Domain | localhost | acc.armouredsouls.com | armouredsouls.com |
| NODE_ENV | development | acceptance | production |
| SSL | None | Let's Encrypt | Let's Encrypt |
| Scheduler | Disabled (manual) | Enabled (configurable) | Enabled (daily) |
| Seed Data | Full (test users) | ACC seed data | Production only |
| Deploy | Manual | Auto on push to main | Manual promote |

## Components and Interfaces

### 1. Frontend API Client (Requirement 1, 2)

A centralized Axios instance replaces all hardcoded `localhost:3001` references.

**File:** `prototype/frontend/src/utils/apiClient.ts`

```typescript
import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  withCredentials: true,
});

// Request interceptor: attach JWT
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

**Migration pattern** for each API utility file (`userApi.ts`, `matchmakingApi.ts`, `financialApi.ts`, `AuthContext.tsx`):
- Remove local `API_BASE_URL` constant
- Remove local `getAuthHeaders()` helper
- Replace `axios.get(...)` / `axios.post(...)` with `apiClient.get(...)` / `apiClient.post(...)`
- All paths become relative: `apiClient.get('/api/user/profile')`

**Vite configuration** (`vite.config.ts`):
- Keep the existing dev proxy for `/api` → `http://localhost:3001` (DEV only)
- In production builds, `VITE_API_URL` defaults to empty string, so all API calls use relative paths through Caddy

### 2. Backend Environment Configuration (Requirement 3, 19, 20)

**Startup validation** (`prototype/backend/src/config/env.ts`):

```typescript
interface EnvConfig {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  corsOrigins: string[];
  schedulerEnabled: boolean;
}

export function loadEnvConfig(): EnvConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const jwtSecret = process.env.JWT_SECRET || 'default-dev-secret';

  if (nodeEnv === 'production' && jwtSecret === 'default-dev-secret') {
    console.error('FATAL: JWT_SECRET must be set in production');
    process.exit(1);
  }

  const corsOriginRaw = process.env.CORS_ORIGIN || '';
  const corsOrigins = nodeEnv === 'development'
    ? ['*']
    : corsOriginRaw.split(',').map(o => o.trim()).filter(Boolean);

  return {
    nodeEnv,
    port: parseInt(process.env.PORT || '3001', 10),
    databaseUrl: process.env.DATABASE_URL || '',
    jwtSecret,
    corsOrigins,
    schedulerEnabled: process.env.SCHEDULER_ENABLED === 'true',
  };
}
```

**CORS configuration** (replaces `app.use(cors())`):

```typescript
import cors from 'cors';

// In index.ts:
const config = loadEnvConfig();
app.use(cors({
  origin: config.corsOrigins.includes('*')
    ? true
    : config.corsOrigins,
  credentials: true,
}));
```

**Rate limiting** (`prototype/backend/src/middleware/rateLimiter.ts`):

```typescript
import rateLimit from 'express-rate-limit';

export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.headers['x-forwarded-for'] as string || 'unknown',
});

export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.headers['x-forwarded-for'] as string || 'unknown',
});
```

Applied as:
```typescript
app.use('/api', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
```

### 3. Health Endpoint (Requirement 12)

Enhanced health check with database connectivity:

```typescript
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
    });
  }
});
```

### 4. Reverse Proxy — Caddy (Requirement 4, 5)

**File:** `Caddyfile` (deployed to VPS)

```
acc.armouredsouls.com {
    # Static frontend files
    root * /opt/armouredsouls/frontend/dist
    
    # API proxy
    handle /api/* {
        reverse_proxy 127.0.0.1:3001
    }
    
    # SPA fallback
    handle {
        try_files {path} /index.html
        file_server
    }
    
    # Security headers
    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        -Server
    }
    
    # Compression
    encode gzip zstd
    
    # Cache hashed assets long-term, no-cache for index.html
    @assets path /assets/*
    header @assets Cache-Control "public, max-age=31536000, immutable"
    
    @html path /index.html
    header @html Cache-Control "no-cache, no-store, must-revalidate"
}
```

Caddy handles SSL automatically — no certbot configuration needed. It obtains and renews Let's Encrypt certificates on its own.

### 5. Process Management — PM2 (Requirement 6)

**File:** `ecosystem.config.js` (deployed to VPS)

```javascript
module.exports = {
  apps: [{
    name: 'armouredsouls-backend',
    script: 'dist/index.js',
    cwd: '/opt/armouredsouls/backend',
    instances: 1,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '5s',
    restart_delay: 5000,
    env: {
      NODE_ENV: 'acceptance',
    },
    // Log configuration
    error_file: '/var/log/armouredsouls/pm2-error.log',
    out_file: '/var/log/armouredsouls/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_size: '50M',
  }],
};
```

### 6. Cycle Scheduler (Requirement 24)

The monolithic `POST /admin/cycles/bulk` endpoint (14 steps in a single request) is decomposed into 4 independent scheduled jobs using `node-cron`, running in-process within the backend.

**File:** `prototype/backend/src/services/cycleScheduler.ts`

```typescript
interface SchedulerConfig {
  enabled: boolean;
  leagueSchedule: string;      // cron: default '0 20 * * *'
  tournamentSchedule: string;   // cron: default '0 8 * * *'
  tagTeamSchedule: string;      // cron: default '0 12 * * *'
  settlementSchedule: string;   // cron: default '0 23 * * *'
}

interface SchedulerStatus {
  active: boolean;
  jobs: {
    name: string;
    schedule: string;
    lastRun: Date | null;
    nextRun: Date | null;
    status: 'idle' | 'running' | 'failed';
  }[];
}
```

**Concurrency lock:** A simple in-memory mutex prevents overlapping job execution. If a job attempts to start while another is running, it queues and waits.

**Job decomposition:**

| Job | Default Schedule | Steps |
|-----|-----------------|-------|
| League Cycle | 20:00 UTC | 1. Repair robots → 2. Execute league battles → 3. Rebalance leagues → 4. Schedule matchmaking (24h lead) |
| Tournament Cycle | 08:00 UTC | 1. Repair robots → 2. Execute/schedule tournament matches → 3. Advance winners → 4. Auto-create next tournament |
| Tag Team Cycle | 12:00 UTC | 1. Repair robots → 2. Execute tag team battles (odd cycles only) → 3. Rebalance → 4. Schedule matchmaking (48h lead) |
| Daily Settlement | 23:00 UTC | 1. Passive income → 2. Operating costs → 3. Balance logging → 4. Increment counters → 5. Analytics snapshot → 6. Auto-generate users |

**Status endpoint:** `GET /admin/scheduler/status` returns the `SchedulerStatus` object.

The existing `POST /admin/cycles/bulk` endpoint is retained for manual triggering in DEV.

### 7. Logging (Requirement 13)

**Library:** `winston` with JSON format in production, colorized console in development.

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.NODE_ENV === 'production'
    ? winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    : winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
  transports: [
    new winston.transports.Console(),
  ],
  // Prevent logging sensitive data
  defaultMeta: { service: 'armouredsouls' },
});
```

**Request logging middleware:** Logs method, path, status code, and response time for every API request. Sensitive fields (passwords, tokens, connection strings) are redacted.

**Log rotation:** PM2 handles log rotation at 50MB file size. Additionally, `logrotate` on the VPS retains logs for 30 days.

### 8. CI/CD Pipeline (Requirement 10, 14, 18)

**File:** `.github/workflows/deploy.yml`

```mermaid
graph TD
    A[Push to main] --> B[Run Tests]
    B -->|Pass| C[Build Frontend]
    C --> D[Build Backend]
    D --> E[Deploy to ACC via SSH]
    E --> F[Run prisma migrate deploy]
    F --> G[Restart PM2]
    G --> H[Health Check]
    H -->|Pass| I[Deploy Success]
    H -->|Fail| J[Alert + Keep Previous Artifacts]

    K[Manual Trigger] --> L[Promote to PRD]
    L --> M[Same deploy steps with PRD secrets]
```

**Deploy steps:**
1. `rsync` built artifacts to VPS (`/opt/armouredsouls/`)
2. `npm ci --production` on VPS for backend dependencies
3. Pre-migration database backup via `pg_dump`
4. `npx prisma migrate deploy`
5. `pm2 restart ecosystem.config.js`
6. Health check: `curl -f https://acc.armouredsouls.com/api/health` within 30s
7. Post-deploy smoke test: verify frontend loads (HTTP 200 on `/`), login endpoint responds

**Environment separation:**
- `acceptance` environment: auto-deploy on push to main, uses `ACC_*` secrets
- `production` environment: manual `workflow_dispatch` with approval gate, uses `PRD_*` secrets

### 9. Database Operations (Requirement 7, 8, 11)

**Docker Compose Production** (`docker-compose.production.yml`):

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    command:
      - "postgres"
      - "-c"
      - "log_connections=on"
      - "-c"
      - "log_disconnections=on"
      - "-c"
      - "max_connections=20"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

Key differences from dev `docker-compose.yml`:
- Credentials from environment variables (not hardcoded `password`)
- Port bound to `127.0.0.1` only
- Connection logging enabled
- Max connections set to 20

**Backup script** (`/opt/armouredsouls/scripts/backup.sh`):
- Runs daily via system cron
- `pg_dump` to `/opt/armouredsouls/backups/`
- Retains 7 daily + 4 weekly backups
- Logs success/failure with file size
- On failure: triggers UptimeRobot webhook alert

**Prisma connection pool:** Set `connection_limit=10` in the `DATABASE_URL` query string to match the DEV1-S resources.

### 10. Firewall and Security (Requirement 9)

**UFW rules:**
```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (Caddy redirect)
ufw allow 443/tcp   # HTTPS
ufw enable
```

**Additional hardening:**
- SSH: key-only auth, password auth disabled in `/etc/ssh/sshd_config`
- `fail2ban` installed for SSH brute-force protection
- Backend listens on `127.0.0.1:3001` only (not `0.0.0.0`)
- PostgreSQL accessible only from `127.0.0.1`

### 11. Seed Data Strategy (Requirement 15)

The seed script (`prisma/seed.ts`) is modified to check `NODE_ENV`:

- **development/test:** Seeds everything (weapons, facilities, test users player1-6, admin, test_attr_* accounts)
- **acceptance:** Seeds weapons, facilities, and a small set of test accounts for QA
- **production:** Seeds only essential game data (weapons, default facility configs). No test users.

The seed script is made idempotent using `upsert` operations instead of `create`.

### 12. Test Adaptation (Requirement 22)

**Playwright config changes:**
- `baseURL` reads from `PLAYWRIGHT_BASE_URL` env var, defaults to `http://localhost:3000`
- `webServer` block conditionally disabled when `PLAYWRIGHT_BASE_URL` is set (remote testing)

**CI test separation:**
- Unit tests (Jest): run on every push, no database required
- E2E tests (Playwright): run on merge to main, or on-demand

### 13. Rollback Procedure (Requirement 16)

The deploy script maintains a `releases/` directory on the VPS:
- `releases/current` → symlink to active release
- `releases/previous` → previous release artifacts
- `releases/backups/` → pre-migration database dumps

Rollback steps:
1. `pm2 stop armouredsouls-backend`
2. Swap symlink: `current` → `previous`
3. If DB rollback needed: restore from `releases/backups/`
4. `pm2 start ecosystem.config.js`

Target: restore within 10 minutes.


## Data Models

### Environment Variables

The following environment variables govern runtime behavior across all environments:

**Backend (`prototype/backend/.env`)**:

| Variable | DEV Default | ACC Example | PRD Example | Required |
|----------|-------------|-------------|-------------|----------|
| `NODE_ENV` | `development` | `acceptance` | `production` | Yes |
| `PORT` | `3001` | `3001` | `3001` | No |
| `DATABASE_URL` | `postgresql://armouredsouls:password@localhost:5432/armouredsouls` | `postgresql://as_acc:<32-char>@127.0.0.1:5432/armouredsouls_acc?connection_limit=10` | `postgresql://as_prd:<32-char>@127.0.0.1:5432/armouredsouls_prd?connection_limit=10` | Yes |
| `JWT_SECRET` | `default-dev-secret` | `<random 64-char>` | `<random 64-char>` | Yes |
| `CORS_ORIGIN` | (empty = allow all) | `https://acc.armouredsouls.com` | `https://armouredsouls.com,https://www.armouredsouls.com` | Yes (prod) |
| `SCHEDULER_ENABLED` | `false` | `true` | `true` | No |
| `LEAGUE_SCHEDULE` | — | `0 20 * * *` | `0 20 * * *` | No |
| `TOURNAMENT_SCHEDULE` | — | `0 8 * * *` | `0 8 * * *` | No |
| `TAGTEAM_SCHEDULE` | — | `0 12 * * *` | `0 12 * * *` | No |
| `SETTLEMENT_SCHEDULE` | — | `0 23 * * *` | `0 23 * * *` | No |
| `LOG_LEVEL` | `debug` | `info` | `info` | No |

**Frontend (`prototype/frontend/.env`)**:

| Variable | DEV Default | ACC Build | PRD Build |
|----------|-------------|-----------|-----------|
| `VITE_API_URL` | (empty — uses Vite proxy) | (empty — relative paths through Caddy) | (empty — relative paths through Caddy) |

**Playwright (`prototype/frontend/.env.test`)**:

| Variable | Local | Remote ACC |
|----------|-------|------------|
| `PLAYWRIGHT_BASE_URL` | `http://localhost:3000` | `https://acc.armouredsouls.com` |

### Scheduler State Model

The Cycle Scheduler maintains in-memory state:

```typescript
interface JobState {
  name: 'league' | 'tournament' | 'tagTeam' | 'settlement';
  schedule: string;           // cron expression
  lastRunAt: Date | null;
  lastRunDurationMs: number | null;
  lastRunStatus: 'success' | 'failed' | null;
  lastError: string | null;
  nextRunAt: Date | null;
}

interface SchedulerState {
  active: boolean;
  runningJob: string | null;  // null if no job running
  queue: string[];            // queued job names
  jobs: JobState[];
}
```

This state is not persisted to the database — it resets on backend restart. The `cycleMetadata` table (already in the Prisma schema) tracks persistent cycle counters and timestamps.

### VPS Directory Structure

```
/opt/armouredsouls/
├── backend/
│   ├── dist/                  # Compiled backend JS
│   ├── node_modules/
│   ├── prisma/
│   │   └── migrations/
│   ├── package.json
│   └── .env                   # Environment-specific config
├── frontend/
│   └── dist/                  # Vite build output (served by Caddy)
├── scripts/
│   ├── backup.sh              # Database backup script
│   ├── restore.sh             # Database restore script
│   └── deploy.sh              # Deployment helper
├── backups/
│   ├── daily/                 # 7 daily pg_dump files
│   └── weekly/                # 4 weekly pg_dump files
├── releases/
│   ├── current -> release-20240115/
│   └── previous -> release-20240114/
├── docker-compose.production.yml
├── ecosystem.config.js        # PM2 config
└── Caddyfile
```

### GitHub Actions Secrets

| Secret | Scope | Description |
|--------|-------|-------------|
| `ACC_SSH_KEY` | acceptance | SSH private key for ACC VPS |
| `ACC_VPS_IP` | acceptance | ACC VPS public IP |
| `ACC_VPS_USER` | acceptance | Deploy user on ACC VPS |
| `PRD_SSH_KEY` | production | SSH private key for PRD VPS |
| `PRD_VPS_IP` | production | PRD VPS public IP |
| `PRD_VPS_USER` | production | Deploy user on PRD VPS |


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Environment config loading round-trip

*For any* set of environment variable values (NODE_ENV, PORT, DATABASE_URL, JWT_SECRET, CORS_ORIGIN, SCHEDULER_ENABLED), the `loadEnvConfig()` function should produce a config object whose fields match the provided environment variable values, with correct type coercion (PORT as number, SCHEDULER_ENABLED as boolean, CORS_ORIGIN as array).

**Validates: Requirements 3.1, 25.4**

### Property 2: JWT secret validation in production

*For any* JWT_SECRET string that equals the default placeholder value, when NODE_ENV is `production`, the `loadEnvConfig()` function should throw an error or call `process.exit`. Conversely, for any non-placeholder JWT_SECRET string in production, startup should succeed.

**Validates: Requirements 3.2, 3.3**

### Property 3: CORS origin parsing and enforcement

*For any* comma-separated string of origin URLs in CORS_ORIGIN, the CORS configuration should parse them into an array and accept requests only from those origins when NODE_ENV is not `development`. In development mode, all origins should be accepted regardless of CORS_ORIGIN value.

**Validates: Requirements 3.4, 19.1, 19.2**

### Property 4: JWT token attachment interceptor

*For any* non-empty token string stored in localStorage, the API client request interceptor should attach an `Authorization: Bearer <token>` header to the outgoing request config.

**Validates: Requirements 2.3**

### Property 5: 401 response clears authentication state

*For any* API response with status code 401, the response interceptor should remove the token from localStorage and redirect to the login page, regardless of the request URL or response body.

**Validates: Requirements 2.4**

### Property 6: Rate limiting enforcement

*For any* IP address, after making N requests within a 60-second window where N exceeds the configured limit (100 for general endpoints, 10 for auth endpoints), the next request should receive a 429 status code with a `Retry-After` header. Requests within the limit should pass through normally.

**Validates: Requirements 20.1, 20.2, 20.3**

### Property 7: Rate limiter uses forwarded IP

*For any* request containing an `X-Forwarded-For` header, the rate limiter should use the forwarded IP address (not the direct connection IP) as the rate limiting key.

**Validates: Requirements 20.5**

### Property 8: Health endpoint response structure

*For any* database state (connected or disconnected), the health endpoint response should always contain `status`, `database`, `timestamp`, and `environment` fields. When the database is unreachable, the HTTP status code should be 503.

**Validates: Requirements 12.1, 12.3**

### Property 9: Structured JSON logging in production

*For any* log message produced when NODE_ENV is `production`, the output should be valid JSON containing at minimum `timestamp`, `level`, and `message` fields.

**Validates: Requirements 13.1**

### Property 10: Request logging completeness

*For any* incoming HTTP request to the API, the request logger should produce a log entry containing the HTTP method, request path, response status code, and response time in milliseconds.

**Validates: Requirements 13.2, 13.3**

### Property 11: Sensitive data exclusion from logs

*For any* log entry produced by the backend, the entry should not contain raw password values, JWT token strings, or full database connection strings (containing credentials).

**Validates: Requirements 13.6**

### Property 12: Seed script idempotence

*For any* initial database state, running the seed script N times (where N >= 1) should produce the same database state as running it exactly once. No duplicate records should be created.

**Validates: Requirements 15.3**

### Property 13: Production seed data filtering

*For any* execution of the seed script when NODE_ENV is `production`, the resulting database should contain essential game data (weapons, default configurations) but zero test user accounts (player1-6, admin, test_attr_* accounts).

**Validates: Requirements 15.1, 15.2**

### Property 14: Scheduler activation control

*For any* value of the SCHEDULER_ENABLED environment variable, the Cycle Scheduler should be active if and only if the value is exactly the string `true`. All other values (including undefined, empty string, `false`, `1`, `yes`) should result in an inactive scheduler.

**Validates: Requirements 24.12, 24.13**

### Property 15: Scheduler cron configuration

*For any* valid cron expression provided via the schedule environment variables (LEAGUE_SCHEDULE, TOURNAMENT_SCHEDULE, TAGTEAM_SCHEDULE, SETTLEMENT_SCHEDULE), the corresponding scheduled job should be registered with that cron expression. When the env var is not set, the default schedule should be used.

**Validates: Requirements 24.2, 24.4, 24.6, 24.10**

### Property 16: Battle job step ordering — repair first

*For any* battle-related scheduled job (League Cycle, Tournament Cycle, Tag Team Cycle), the first step executed should always be robot repair. The remaining steps should execute in the defined order for that job type.

**Validates: Requirements 24.3, 24.5, 24.8, 24.24**

### Property 17: Tag team odd/even cycle behavior

*For any* cycle number, the Tag Team Cycle job should execute battle operations if and only if the cycle number is odd. On even-numbered cycles, battle execution should be skipped and a skip log entry should be produced.

**Validates: Requirements 24.7, 24.8, 24.9**

### Property 18: Scheduler concurrency lock

*For any* two scheduled jobs attempting to execute simultaneously, only one should be actively running at any given time. The second job should be queued and execute only after the first completes.

**Validates: Requirements 24.15, 24.16**

### Property 19: Scheduler error isolation

*For any* error thrown during a scheduled job's execution, the scheduler should catch the error, log it with full context (job name, failed step, error message), and continue running without crashing the backend process. The failed job should not be automatically retried.

**Validates: Requirements 24.17, 24.18**

### Property 20: Daily settlement updates cycle metadata

*For any* successful execution of the Daily Settlement job, the `cycleMetadata.totalCycles` counter should be incremented by 1 and `lastCycleAt` should be updated to the current timestamp.

**Validates: Requirements 24.19**

### Property 21: Scheduler job execution logging

*For any* scheduled job execution (successful or failed), the scheduler should log the job name, start time, end time, and duration in milliseconds.

**Validates: Requirements 24.20**

### Property 22: Backup retention policy

*For any* set of backup files with timestamps, the backup cleanup function should retain exactly 7 daily backups and 4 weekly backups, deleting all older files.

**Validates: Requirements 8.2**

## Error Handling

### Frontend Error Handling

| Error | Handling |
|-------|----------|
| 401 Unauthorized | API client interceptor clears token, redirects to `/login` |
| 429 Too Many Requests | Display user-friendly "slow down" message with retry timer |
| 500 Server Error | Display generic error message, log to console |
| Network Error | Display "connection lost" banner, retry with exponential backoff |
| VITE_API_URL misconfigured | Falls back to empty string (relative paths), which works through Caddy |

### Backend Error Handling

| Error | Handling |
|-------|----------|
| Invalid JWT_SECRET in production | `process.exit(1)` with error log — fail fast |
| Database connection failure | Health endpoint returns 503, winston logs error, PM2 keeps process alive |
| Scheduled job failure | Catch error, log with full context, send alert, do not retry, do not crash |
| Rate limit exceeded | Return 429 with `Retry-After` header |
| Unhandled exception | Express error middleware catches, logs stack trace (redacted in production response), returns 500 |
| Migration failure | CI/CD halts deployment, pre-migration backup preserved |

### Infrastructure Error Handling

| Error | Handling |
|-------|----------|
| Backend process crash | PM2 auto-restarts within 5s, max 10 restarts per 60s window |
| SSL certificate renewal failure | Caddy handles automatically; UptimeRobot alerts if HTTPS fails |
| Backup failure | Script logs error, triggers UptimeRobot webhook alert |
| Disk space low | Monitoring via `df` in health check (future enhancement) |
| Deploy health check failure | CI/CD reports failure, previous artifacts retained for manual rollback |

## Testing Strategy

### Dual Testing Approach

This migration requires both unit tests and property-based tests working together:

- **Unit tests** verify specific examples, edge cases, integration points, and configuration correctness
- **Property-based tests** verify universal properties across randomly generated inputs

### Property-Based Testing Configuration

- **Library:** `fast-check` (already installed in both backend and frontend)
- **Minimum iterations:** 100 per property test
- **Tag format:** `Feature: vps-migration, Property {number}: {property_text}`
- **Each correctness property maps to exactly one property-based test**

### Test Categories

**Backend Property Tests (fast-check + Jest):**

| Property | Test File | What It Validates |
|----------|-----------|-------------------|
| P1: Env config loading | `tests/envConfig.property.test.ts` | Config parsing with random env values |
| P2: JWT secret validation | `tests/envConfig.property.test.ts` | Startup rejection with placeholder secrets |
| P3: CORS parsing | `tests/cors.property.test.ts` | Origin parsing and enforcement |
| P6: Rate limiting | `tests/rateLimiter.property.test.ts` | Request counting and 429 responses |
| P7: Forwarded IP | `tests/rateLimiter.property.test.ts` | X-Forwarded-For key extraction |
| P8: Health endpoint | `tests/health.property.test.ts` | Response structure across DB states |
| P9: JSON logging | `tests/logging.property.test.ts` | Log format validation |
| P10: Request logging | `tests/logging.property.test.ts` | Log field completeness |
| P11: Sensitive data | `tests/logging.property.test.ts` | Redaction of passwords/tokens |
| P12: Seed idempotence | `tests/seed.property.test.ts` | No duplicates on repeated runs |
| P13: Production seed | `tests/seed.property.test.ts` | No test users in production mode |
| P14: Scheduler activation | `tests/scheduler.property.test.ts` | SCHEDULER_ENABLED parsing |
| P15: Cron configuration | `tests/scheduler.property.test.ts` | Schedule env var parsing |
| P16: Step ordering | `tests/scheduler.property.test.ts` | Repair-first execution order |
| P17: Odd/even cycles | `tests/scheduler.property.test.ts` | Tag team cycle skip logic |
| P18: Concurrency lock | `tests/scheduler.property.test.ts` | Mutual exclusion of jobs |
| P19: Error isolation | `tests/scheduler.property.test.ts` | Error catching without crash |
| P20: Cycle metadata | `tests/scheduler.property.test.ts` | Counter increment after settlement |
| P21: Job logging | `tests/scheduler.property.test.ts` | Start/end/duration in logs |
| P22: Backup retention | `tests/backup.property.test.ts` | File retention policy |

**Frontend Property Tests (fast-check + Vitest):**

| Property | Test File | What It Validates |
|----------|-----------|-------------------|
| P4: JWT attachment | `src/__tests__/apiClient.property.test.ts` | Token header injection |
| P5: 401 handling | `src/__tests__/apiClient.property.test.ts` | Token clearing on 401 |

**Unit Tests (specific examples and edge cases):**

- Health endpoint returns 503 when DB is down (Req 12.3)
- Backend listens on 127.0.0.1 in production (Req 9.6)
- CORS allows all origins in development mode (Req 19.3)
- CORS includes `credentials: true` (Req 19.4)
- Playwright config reads PLAYWRIGHT_BASE_URL (Req 22.1, 22.2)
- `.env.example` files exist with required variables (Req 1.6, 3.6)
- `docker-compose.production.yml` uses env vars for credentials (Req 11.3)
- No hardcoded `localhost:3001` in frontend source (Req 1.4)
- Scheduler status endpoint returns correct shape (Req 24.22)
- Existing `/admin/cycles/bulk` endpoint still works (Req 24.14)

**E2E / Smoke Tests (Playwright):**

- Frontend loads at configured base URL
- Login flow works end-to-end
- Health endpoint returns 200
- API requests use relative paths (no localhost in network tab)

### CI Pipeline Test Stages

1. **On every push:** Backend unit tests + property tests (Jest), Frontend build + lint
2. **On merge to main:** All of stage 1 + E2E tests (Playwright) + deploy to ACC
3. **Manual promote:** Deploy to PRD (no rebuild, same artifacts)


## Scaleway VPS Setup Guide

This is a step-by-step guide for provisioning and configuring the Scaleway DEV1-S instance for the ACC environment. The same steps apply to PRD when you're ready to provision it — just use different credentials and domain.

### Prerequisites

Before you start, you need:
- A Scaleway account (you already have this)
- Your domain `acc.armouredsouls.com` — you'll need to claim the `armouredsouls.com` domain and create the subdomain DNS record
- An SSH key pair on your Mac (we'll generate one if you don't have it)

### Step 1: Generate an SSH Key Pair (on your Mac)

If you don't already have one:

```bash
ssh-keygen -t ed25519 -C "armouredsouls-deploy"
```

Press Enter to accept the default location (`~/.ssh/id_ed25519`). Set a passphrase or leave empty.

Then copy the public key — you'll need it in the next step:

```bash
cat ~/.ssh/id_ed25519.pub
```

### Step 2: Add Your SSH Key to Scaleway

1. Log into the [Scaleway Console](https://console.scaleway.com)
2. Go to **Project** → **Credentials** (left sidebar under "Identity and Access Management")
3. Scroll to **SSH Keys** and click **Add SSH Key**
4. Paste the public key from Step 1
5. Give it a name like `macbook-deploy`

### Step 3: Create the VPS Instance

1. In the Scaleway Console, go to **Instances** → **Create Instance**
2. Choose these settings:
   - **Availability Zone:** `fr-par-1` (Paris) or `nl-ams-1` (Amsterdam — closer to NL)
   - **Instance type:** `DEV1-S` (2 vCPU, 2 GB RAM, 20 GB SSD) — ~€6.42/month
   - **Image:** `Ubuntu 24.04 LTS (Noble Numbat)`
   - **Name:** `armouredsouls-acc`
   - **SSH Key:** Select the key you added in Step 2
3. Click **Create Instance**
4. Wait for the instance to boot (takes about 30 seconds)
5. Note the **Public IP address** — you'll need it for DNS and SSH

### Step 4: Point Your Domain to the VPS

At your domain registrar (wherever you register `armouredsouls.com`):

1. Create an **A record** for `acc.armouredsouls.com` pointing to the VPS public IP
2. (Later for PRD) Create an **A record** for `armouredsouls.com` pointing to the PRD VPS IP

DNS propagation can take up to 24 hours, but usually completes within minutes.

### Step 5: Connect to the VPS via SSH

From your Mac terminal:

```bash
ssh root@<YOUR_VPS_IP>
```

You should get a root shell. If it asks about the host fingerprint, type `yes`.

### Step 6: Create a Deploy User (don't run the app as root)

```bash
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

Now test that you can SSH as the deploy user (from your Mac, in a new terminal):

```bash
ssh deploy@<YOUR_VPS_IP>
```

### Step 7: Secure SSH Access

Back on the VPS as root:

```bash
sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd
```

From now on, you can only SSH as `deploy` with your key. Root login is disabled.

### Step 8: Set Up the Firewall (UFW)

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

Verify:

```bash
ufw status
```

Should show ports 22, 80, 443 allowed.

### Step 9: Install fail2ban

```bash
apt update
apt install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban
```

This blocks IPs after repeated failed SSH login attempts.

### Step 10: Install Docker (for PostgreSQL)

```bash
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

usermod -aG docker deploy
```

Verify:

```bash
docker --version
docker compose version
```

### Step 11: Install Node.js 22 (LTS)

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

node --version
npm --version
```

### Step 12: Install PM2

```bash
npm install -g pm2
pm2 startup systemd -u deploy --hp /home/deploy
```

This ensures PM2 starts on boot and runs as the `deploy` user.

### Step 13: Install Caddy

```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list

apt update
apt install -y caddy
```

Caddy is now installed and running. We'll configure it after the first deployment.

### Step 14: Create the Application Directory Structure

Switch to the deploy user:

```bash
su - deploy
```

Then create the directory structure:

```bash
mkdir -p /opt/armouredsouls/{backend,frontend,scripts,backups/daily,backups/weekly,releases}
sudo chown -R deploy:deploy /opt/armouredsouls
```

### Step 15: Set Up PostgreSQL via Docker Compose

Create the production Docker Compose file:

```bash
cat > /opt/armouredsouls/docker-compose.production.yml << 'EOF'
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-as_acc}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB:-armouredsouls_acc}
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    command:
      - "postgres"
      - "-c"
      - "log_connections=on"
      - "-c"
      - "log_disconnections=on"
      - "-c"
      - "max_connections=20"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-as_acc}"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
EOF
```

Generate a strong database password and create the `.env` file for Docker:

```bash
DB_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
echo "POSTGRES_USER=as_acc" > /opt/armouredsouls/.env.docker
echo "POSTGRES_PASSWORD=$DB_PASSWORD" >> /opt/armouredsouls/.env.docker
echo "POSTGRES_DB=armouredsouls_acc" >> /opt/armouredsouls/.env.docker
chmod 600 /opt/armouredsouls/.env.docker

echo ""
echo "=== SAVE THIS DATABASE PASSWORD ==="
echo "Database password: $DB_PASSWORD"
echo "Full DATABASE_URL: postgresql://as_acc:${DB_PASSWORD}@127.0.0.1:5432/armouredsouls_acc?connection_limit=10"
echo "==================================="
```

Start PostgreSQL:

```bash
cd /opt/armouredsouls
docker compose --env-file .env.docker -f docker-compose.production.yml up -d
```

Verify it's running:

```bash
docker compose --env-file .env.docker -f docker-compose.production.yml ps
```

### Step 16: Create the Backend Environment File

```bash
JWT_SECRET=$(openssl rand -base64 48 | tr -d '/+=' | head -c 64)

cat > /opt/armouredsouls/backend/.env << EOF
NODE_ENV=acceptance
PORT=3001
DATABASE_URL=postgresql://as_acc:${DB_PASSWORD}@127.0.0.1:5432/armouredsouls_acc?connection_limit=10
JWT_SECRET=${JWT_SECRET}
CORS_ORIGIN=https://acc.armouredsouls.com
SCHEDULER_ENABLED=true
LEAGUE_SCHEDULE=0 20 * * *
TOURNAMENT_SCHEDULE=0 8 * * *
TAGTEAM_SCHEDULE=0 12 * * *
SETTLEMENT_SCHEDULE=0 23 * * *
LOG_LEVEL=info
EOF

chmod 600 /opt/armouredsouls/backend/.env

echo ""
echo "=== SAVE THESE SECRETS ==="
echo "JWT_SECRET: $JWT_SECRET"
echo "=========================="
```

### Step 17: Configure Caddy

```bash
sudo tee /etc/caddy/Caddyfile << 'EOF'
acc.armouredsouls.com {
    root * /opt/armouredsouls/frontend/dist

    handle /api/* {
        reverse_proxy 127.0.0.1:3001
    }

    handle {
        try_files {path} /index.html
        file_server
    }

    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        -Server
    }

    encode gzip zstd

    @assets path /assets/*
    header @assets Cache-Control "public, max-age=31536000, immutable"

    @html path /index.html
    header @html Cache-Control "no-cache, no-store, must-revalidate"
}
EOF

sudo systemctl restart caddy
```

Caddy will automatically obtain a Let's Encrypt certificate for `acc.armouredsouls.com` once DNS is pointing to the VPS IP.

### Step 18: Set Up the Backup Script

```bash
cat > /opt/armouredsouls/scripts/backup.sh << 'SCRIPT'
#!/bin/bash
set -e

BACKUP_DIR="/opt/armouredsouls/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DAY_OF_WEEK=$(date +%u)

# Load database credentials
source /opt/armouredsouls/.env.docker

# Daily backup
docker exec $(docker ps -q -f name=postgres) pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$BACKUP_DIR/daily/backup_${TIMESTAMP}.sql.gz"

FILESIZE=$(du -h "$BACKUP_DIR/daily/backup_${TIMESTAMP}.sql.gz" | cut -f1)
echo "[$(date)] Backup completed: backup_${TIMESTAMP}.sql.gz (${FILESIZE})"

# Weekly backup on Sundays
if [ "$DAY_OF_WEEK" -eq 7 ]; then
    cp "$BACKUP_DIR/daily/backup_${TIMESTAMP}.sql.gz" "$BACKUP_DIR/weekly/"
    echo "[$(date)] Weekly backup created"
fi

# Retain 7 daily backups
ls -t "$BACKUP_DIR/daily/"*.sql.gz 2>/dev/null | tail -n +8 | xargs -r rm

# Retain 4 weekly backups
ls -t "$BACKUP_DIR/weekly/"*.sql.gz 2>/dev/null | tail -n +5 | xargs -r rm
SCRIPT

chmod +x /opt/armouredsouls/scripts/backup.sh
```

Add to crontab (runs daily at 02:00 UTC):

```bash
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/armouredsouls/scripts/backup.sh >> /var/log/armouredsouls/backup.log 2>&1") | crontab -
```

Create the log directory:

```bash
sudo mkdir -p /var/log/armouredsouls
sudo chown deploy:deploy /var/log/armouredsouls
```

### Step 19: Set Up Log Rotation

```bash
sudo tee /etc/logrotate.d/armouredsouls << 'EOF'
/var/log/armouredsouls/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0644 deploy deploy
}
EOF
```

### Step 20: Set Up GitHub Actions Secrets

In your GitHub repository, go to **Settings** → **Environments**:

1. Create an environment called `acceptance`
2. Add these secrets to the `acceptance` environment:
   - `ACC_SSH_KEY`: The contents of your `~/.ssh/id_ed25519` private key (from your Mac: `cat ~/.ssh/id_ed25519`)
   - `ACC_VPS_IP`: Your Scaleway VPS public IP address
   - `ACC_VPS_USER`: `deploy`

Later, when you provision PRD, create a `production` environment with:
   - `PRD_SSH_KEY`, `PRD_VPS_IP`, `PRD_VPS_USER`
   - Enable **Required reviewers** protection rule (so PRD deploys need manual approval)

### Step 21: Verify Everything

Run these checks on the VPS:

```bash
# Check Docker + PostgreSQL
docker compose --env-file /opt/armouredsouls/.env.docker -f /opt/armouredsouls/docker-compose.production.yml ps

# Check Node.js
node --version

# Check PM2
pm2 status

# Check Caddy
sudo systemctl status caddy

# Check firewall
sudo ufw status

# Check fail2ban
sudo systemctl status fail2ban

# Check backup script
/opt/armouredsouls/scripts/backup.sh
ls -la /opt/armouredsouls/backups/daily/
```

### What Happens Next

Once the VPS is set up, the CI/CD pipeline (which we'll build in the implementation tasks) will:

1. Build the frontend and backend on GitHub Actions
2. `rsync` the artifacts to `/opt/armouredsouls/` on the VPS via SSH
3. Run `prisma migrate deploy` to apply database migrations
4. Restart the backend via PM2
5. Verify the health endpoint responds

You don't need to manually deploy code — the pipeline handles it on every push to `main`.

### Provisioning PRD Later

When you're ready for production, repeat Steps 3-19 with these differences:
- Instance name: `armouredsouls-prd`
- Domain: `armouredsouls.com` (instead of `acc.armouredsouls.com`)
- Database user: `as_prd`, database name: `armouredsouls_prd`
- `NODE_ENV=production` in the backend `.env`
- `CORS_ORIGIN=https://armouredsouls.com,https://www.armouredsouls.com`
- New, separate JWT_SECRET and database password
- Everything else is identical — same scripts, same configs, just different env vars
