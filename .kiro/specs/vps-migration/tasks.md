# Implementation Plan: VPS Migration

## Overview

Migrate the Armoured Souls application from a local-only development setup to a production-ready VPS deployment. Tasks are ordered so foundational code changes (env config, API client) come first, followed by backend hardening, scheduler decomposition, infrastructure files, CI/CD pipeline, test adaptation, and documentation. Property-based tests are placed alongside the code they validate.

## Tasks

- [x] 1. Backend environment configuration and startup validation
  - [x] 1.1 Create `prototype/backend/src/config/env.ts` with `loadEnvConfig()` function
    - Define `EnvConfig` interface with fields: `nodeEnv`, `port`, `databaseUrl`, `jwtSecret`, `corsOrigins`, `schedulerEnabled`
    - Parse `PORT` as number, `SCHEDULER_ENABLED` as boolean, `CORS_ORIGIN` as string array (split on comma)
    - Reject startup with `process.exit(1)` when `JWT_SECRET` equals the default placeholder in production
    - Default `CORS_ORIGIN` to `['*']` in development mode
    - _Requirements: 3.1, 3.2, 3.3, 25.4_

  - [x] 1.2 Write property test for env config loading (Property 1)
    - **Property 1: Environment config loading round-trip**
    - For any set of env var values, `loadEnvConfig()` produces a config with correct type coercion (PORT as number, SCHEDULER_ENABLED as boolean, CORS_ORIGIN as array)
    - Test file: `prototype/backend/tests/envConfig.property.test.ts`
    - **Validates: Requirements 3.1, 25.4**

  - [x] 1.3 Write property test for JWT secret validation (Property 2)
    - **Property 2: JWT secret validation in production**
    - For any placeholder JWT_SECRET in production, startup should fail. For any non-placeholder secret, startup should succeed.
    - Test file: `prototype/backend/tests/envConfig.property.test.ts`
    - **Validates: Requirements 3.2, 3.3**

  - [x] 1.4 Integrate `loadEnvConfig()` into `prototype/backend/src/index.ts`
    - Replace `app.use(cors())` with environment-based CORS using `config.corsOrigins`
    - Set `credentials: true` in CORS config
    - Pass config to backend startup, use `config.port` for listen
    - Bind to `127.0.0.1` when `nodeEnv` is `production` or `acceptance`
    - _Requirements: 3.4, 19.1, 19.2, 19.3, 19.4, 9.6_

  - [x] 1.5 Write property test for CORS origin parsing (Property 3)
    - **Property 3: CORS origin parsing and enforcement**
    - For any comma-separated origin string, CORS config parses correctly. In development, all origins accepted.
    - Test file: `prototype/backend/tests/cors.property.test.ts`
    - **Validates: Requirements 3.4, 19.1, 19.2**

- [x] 2. Rate limiting middleware
  - [x] 2.1 Create `prototype/backend/src/middleware/rateLimiter.ts`
    - Install `express-rate-limit` package
    - Create `generalLimiter` (100 req/min) and `authLimiter` (10 req/min)
    - Use `X-Forwarded-For` header for IP extraction via `keyGenerator`
    - Return 429 with `Retry-After` header on limit exceeded
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5_

  - [x] 2.2 Apply rate limiters in `prototype/backend/src/index.ts`
    - Apply `generalLimiter` to `/api` routes
    - Apply `authLimiter` to `/api/auth/login` and `/api/auth/register`
    - Add `trust proxy` setting for forwarded IP support
    - _Requirements: 20.1, 20.2, 20.5_

  - [x] 2.3 Write property tests for rate limiting (Properties 6, 7)
    - **Property 6: Rate limiting enforcement** — After N requests exceeding the limit, next request gets 429 with Retry-After header
    - **Property 7: Rate limiter uses forwarded IP** — X-Forwarded-For header is used as rate limiting key
    - Test file: `prototype/backend/tests/rateLimiter.property.test.ts`
    - **Validates: Requirements 20.1, 20.2, 20.3, 20.5**

- [x] 3. Health endpoint enhancement
  - [x] 3.1 Enhance `/api/health` in `prototype/backend/src/index.ts`
    - Add database connectivity check via `prisma.$queryRaw\`SELECT 1\``
    - Return `status`, `database`, `timestamp`, `environment` fields
    - Return 503 with `database: 'disconnected'` when DB is unreachable
    - _Requirements: 12.1, 12.3_

  - [x] 3.2 Write property test for health endpoint (Property 8)
    - **Property 8: Health endpoint response structure**
    - For any database state, response always contains `status`, `database`, `timestamp`, `environment`. Returns 503 when DB unreachable.
    - Test file: `prototype/backend/tests/health.property.test.ts`
    - **Validates: Requirements 12.1, 12.3**

- [x] 4. Structured logging with winston
  - [x] 4.1 Create `prototype/backend/src/config/logger.ts`
    - Install `winston` package
    - JSON format in production/acceptance, colorized console in development
    - Configure log level from `LOG_LEVEL` env var
    - Add `service: 'armouredsouls'` default metadata
    - _Requirements: 13.1_

  - [x] 4.2 Create request logging middleware `prototype/backend/src/middleware/requestLogger.ts`
    - Log method, path, status code, response time for every API request
    - Redact sensitive fields: passwords, JWT tokens, database connection strings
    - _Requirements: 13.2, 13.3, 13.6_

  - [x] 4.3 Integrate logger and request logging into `prototype/backend/src/index.ts`
    - Replace `console.log`/`console.error` calls with winston logger
    - Add request logging middleware
    - Add error handler that logs stack traces but redacts them from production responses
    - _Requirements: 13.1, 13.2, 13.3, 3.5_

  - [x] 4.4 Write property tests for logging (Properties 9, 10, 11)
    - **Property 9: Structured JSON logging in production** — All log output is valid JSON with timestamp, level, message
    - **Property 10: Request logging completeness** — Every request produces a log entry with method, path, status, response time
    - **Property 11: Sensitive data exclusion** — No raw passwords, JWT tokens, or DB connection strings in log entries
    - Test file: `prototype/backend/tests/logging.property.test.ts`
    - **Validates: Requirements 13.1, 13.2, 13.3, 13.6**

- [x] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Frontend API client and URL migration
  - [x] 6.1 Create `prototype/frontend/src/utils/apiClient.ts`
    - Create shared Axios instance with `baseURL` from `import.meta.env.VITE_API_URL || ''`
    - Add request interceptor to attach JWT from localStorage
    - Add response interceptor to clear token and redirect on 401
    - Set `withCredentials: true`
    - _Requirements: 1.1, 2.1, 2.3, 2.4_

  - [x] 6.2 Write property tests for API client interceptors (Properties 4, 5)
    - **Property 4: JWT token attachment interceptor** — For any non-empty token, request interceptor attaches `Authorization: Bearer <token>` header
    - **Property 5: 401 response clears authentication state** — For any 401 response, token is removed and redirect occurs
    - Test file: `prototype/frontend/src/__tests__/apiClient.property.test.ts`
    - **Validates: Requirements 2.3, 2.4**

  - [x] 6.3 Migrate `prototype/frontend/src/utils/userApi.ts` to use `apiClient`
    - Remove local `API_BASE_URL` constant and `getAuthHeaders()` helper
    - Replace all `axios.get`/`axios.post` calls with `apiClient.get`/`apiClient.post`
    - Use relative paths: `/api/user/profile`, `/api/auth/register`, etc.
    - _Requirements: 1.4, 2.2_

  - [x] 6.4 Migrate `prototype/frontend/src/utils/matchmakingApi.ts` to use `apiClient`
    - Remove local `API_BASE_URL` constant and `getAuthHeaders()` helper
    - Replace all API calls with `apiClient` using relative paths
    - _Requirements: 1.4, 2.2_

  - [x] 6.5 Migrate `prototype/frontend/src/utils/financialApi.ts` to use `apiClient`
    - Remove local `API_BASE_URL` constant and `getAuthHeaders()` helper
    - Replace all API calls with `apiClient` using relative paths
    - _Requirements: 1.4, 2.2_

  - [x] 6.6 Migrate `prototype/frontend/src/contexts/AuthContext.tsx` to use `apiClient`
    - Replace hardcoded `axios.get('http://localhost:3001/api/user/profile')` with `apiClient.get('/api/user/profile')`
    - Replace hardcoded `axios.post('http://localhost:3001/api/auth/login', ...)` with `apiClient.post('/api/auth/login', ...)`
    - Remove any standalone axios imports used for API calls
    - _Requirements: 1.4, 2.2_

  - [x] 6.7 Create `prototype/frontend/.env.example`
    - Document `VITE_API_URL` with usage comments
    - Note that empty string enables relative paths through the reverse proxy
    - _Requirements: 1.6_

  - [x] 6.8 Verify zero hardcoded `localhost:3001` references remain in frontend source
    - Search all files under `prototype/frontend/src/` for `localhost:3001`
    - Fix any remaining references
    - _Requirements: 1.4_

- [x] 7. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Seed data strategy
  - [x] 8.1 Modify `prototype/backend/prisma/seed.ts` for multi-environment support
    - Add environment check: `NODE_ENV` determines seed mode (development, acceptance, production)
    - In production mode: seed only essential game data (weapons, default facility configs), skip test users
    - In acceptance mode: seed weapons, facilities, and a small set of test accounts
    - In development mode: seed everything (full test data)
    - Make all seed operations idempotent using `upsert` instead of `create`
    - _Requirements: 15.1, 15.2, 15.3_

  - [x] 8.2 Write property tests for seed idempotence and filtering (Properties 12, 13)
    - **Property 12: Seed script idempotence** — Running seed N times produces the same state as running once, no duplicates
    - **Property 13: Production seed data filtering** — In production mode, no test user accounts exist
    - Test file: `prototype/backend/tests/seed.property.test.ts`
    - **Validates: Requirements 15.1, 15.2, 15.3**

- [x] 9. Cycle Scheduler implementation
  - [x] 9.1 Create `prototype/backend/src/services/cycleScheduler.ts`
    - Install `node-cron` package
    - Define `SchedulerConfig`, `JobState`, `SchedulerState` interfaces
    - Implement concurrency lock (in-memory mutex) preventing simultaneous job execution with job queuing
    - Implement `initScheduler(config)` that registers 4 cron jobs when `SCHEDULER_ENABLED=true`
    - Log that scheduling is disabled when `SCHEDULER_ENABLED` is not `true`
    - Use UTC for all schedule calculations
    - _Requirements: 24.1, 24.12, 24.13, 24.15, 24.16, 24.21_

  - [x] 9.2 Implement League Cycle job
    - Execute steps in order: repair robots → execute league battles → rebalance leagues → schedule matchmaking (24h lead)
    - Repair is always the first step
    - Read schedule from `LEAGUE_SCHEDULE` env var, default `0 20 * * *`
    - _Requirements: 24.2, 24.3, 24.24_

  - [x] 9.3 Implement Tournament Cycle job
    - Execute steps in order: repair robots → execute/schedule tournament matches → advance winners → auto-create next tournament
    - Repair is always the first step
    - Read schedule from `TOURNAMENT_SCHEDULE` env var, default `0 8 * * *`
    - _Requirements: 24.4, 24.5, 24.24_

  - [x] 9.4 Implement Tag Team Cycle job
    - Execute steps in order on odd cycles: repair robots → execute tag team battles → rebalance → schedule matchmaking (48h lead)
    - Skip battle execution on even cycles, log skip reason
    - Read schedule from `TAGTEAM_SCHEDULE` env var, default `0 12 * * *`
    - _Requirements: 24.6, 24.7, 24.8, 24.9, 24.24_

  - [x] 9.5 Implement Daily Settlement job
    - Execute steps in order: passive income → operating costs → balance logging → increment counters → analytics snapshot → auto-generate users
    - Update `cycleMetadata.totalCycles` and `lastCycleAt` after completion
    - Read schedule from `SETTLEMENT_SCHEDULE` env var, default `0 23 * * *`
    - _Requirements: 24.10, 24.11, 24.19_

  - [x] 9.6 Add error handling and logging to all scheduled jobs
    - Catch errors per job, log job name, failed step, error message
    - Do not retry failed jobs automatically
    - Do not crash the backend process on job failure
    - Log start time, end time, and duration for each job execution
    - _Requirements: 24.17, 24.18, 24.20_

  - [x] 9.7 Create `GET /admin/scheduler/status` endpoint
    - Return `SchedulerState` object: active flag, configured schedules, last/next execution times per job
    - _Requirements: 24.22_

  - [x] 9.8 Integrate scheduler into `prototype/backend/src/index.ts`
    - Call `initScheduler()` with config from `loadEnvConfig()`
    - Retain existing `POST /admin/cycles/bulk` endpoint for local dev
    - _Requirements: 24.12, 24.14_

  - [x] 9.9 Write property tests for scheduler (Properties 14–21)
    - **Property 14: Scheduler activation control** — Active if and only if `SCHEDULER_ENABLED` is exactly `'true'`
    - **Property 15: Scheduler cron configuration** — Custom cron expressions are used when provided, defaults otherwise
    - **Property 16: Battle job step ordering — repair first** — Repair is always the first step in battle jobs
    - **Property 17: Tag team odd/even cycle behavior** — Battles execute only on odd cycles
    - **Property 18: Scheduler concurrency lock** — Only one job runs at a time, others queue
    - **Property 19: Scheduler error isolation** — Errors are caught and logged, backend doesn't crash
    - **Property 20: Daily settlement updates cycle metadata** — `totalCycles` incremented by 1 after settlement
    - **Property 21: Scheduler job execution logging** — Each job logs name, start, end, duration
    - Test file: `prototype/backend/tests/scheduler.property.test.ts`
    - **Validates: Requirements 24.2, 24.4, 24.6, 24.7, 24.10, 24.12, 24.15, 24.17, 24.19, 24.20**

- [x] 10. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Infrastructure configuration files
  - [x] 11.1 Create `Caddyfile` for reverse proxy configuration
    - Configure SSL termination with automatic Let's Encrypt
    - Serve frontend static files from `/opt/armouredsouls/frontend/dist`
    - Proxy `/api/*` to `127.0.0.1:3001`
    - SPA fallback: `try_files {path} /index.html`
    - Security headers: `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`
    - Compression: gzip + zstd
    - Cache headers: long-lived for `/assets/*`, no-cache for `index.html`
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 11.2 Create `ecosystem.config.js` for PM2 process management
    - Configure backend process with auto-restart, max 10 restarts per 60s, 5s restart delay
    - Log files to `/var/log/armouredsouls/` with rotation at 50MB
    - Set `NODE_ENV` from environment
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 11.3 Create `docker-compose.production.yml`
    - PostgreSQL 16 Alpine with env var credentials
    - Named volume for persistent storage
    - Port bound to `127.0.0.1:5432` only
    - `restart: unless-stopped`
    - Enable `log_connections` and `log_disconnections`
    - Set `max_connections=20`
    - Health check with `pg_isready`
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 7.2, 7.3, 7.6_

  - [x] 11.4 Create `scripts/backup.sh` and `scripts/restore.sh`
    - `backup.sh`: daily `pg_dump`, retain 7 daily + 4 weekly backups, log status and file size
    - `restore.sh`: restore from a specified backup file with confirmation prompt
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.6_

  - [x] 11.5 Write property test for backup retention (Property 22)
    - **Property 22: Backup retention policy** — Cleanup retains exactly 7 daily and 4 weekly backups, deletes older files
    - Test file: `prototype/backend/tests/backup.property.test.ts`
    - **Validates: Requirements 8.2**

- [x] 12. Multi-environment configuration files
  - [x] 12.1 Create backend `.env.production.example` at `prototype/backend/.env.production.example`
    - Document all required production env vars with comments: `NODE_ENV`, `PORT`, `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `SCHEDULER_ENABLED`, schedule vars, `LOG_LEVEL`
    - _Requirements: 3.6, 24.23_

  - [x] 12.2 Create environment-specific `.env` example files
    - `prototype/backend/.env.example` (DEV defaults)
    - `prototype/backend/.env.acc.example` (ACC values)
    - `prototype/backend/.env.prd.example` (PRD values)
    - `prototype/frontend/.env.test.example` (Playwright config)
    - _Requirements: 25.6, 17.7_

- [x] 13. CI/CD deployment pipeline
  - [x] 13.1 Create `.github/workflows/deploy.yml`
    - Trigger on push to `main` for ACC auto-deploy
    - Add `workflow_dispatch` trigger for manual PRD promotion
    - Stage 1: Run backend unit tests + property tests (Jest), frontend build + lint
    - Stage 2 (on merge to main): E2E tests (Playwright)
    - Abort deployment if any test fails
    - _Requirements: 10.1, 10.2, 10.3, 22.5, 22.6_

  - [x] 13.2 Add ACC deployment job to `deploy.yml`
    - Transfer built artifacts to VPS via rsync over SSH
    - Run `npm ci --production` on VPS
    - Create pre-migration database backup via `pg_dump`
    - Run `npx prisma migrate deploy`
    - Restart backend via `pm2 restart ecosystem.config.js`
    - Health check: curl health endpoint within 30s
    - Use `ACC_SSH_KEY`, `ACC_VPS_IP`, `ACC_VPS_USER` secrets
    - _Requirements: 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10, 10.11, 14.1, 14.2, 14.3_

  - [x] 13.3 Add PRD deployment job to `deploy.yml`
    - Manual trigger with environment approval gate
    - Same deploy steps as ACC but with `PRD_*` secrets
    - Use GitHub Actions `production` environment with required reviewers
    - _Requirements: 10.12, 10.13, 10.14, 25.7, 25.8_

  - [x] 13.4 Add post-deployment smoke tests to `deploy.yml`
    - Verify health endpoint returns 200
    - Verify frontend loads (HTTP 200 on `/`)
    - Verify login API endpoint responds
    - Mark deployment as failed if smoke tests fail
    - _Requirements: 18.1, 18.3, 18.4_

- [x] 14. Test adaptation for multi-environment
  - [x] 14.1 Update `prototype/frontend/playwright.config.ts`
    - Read `baseURL` from `PLAYWRIGHT_BASE_URL` env var, default to `http://localhost:3000`
    - Conditionally disable `webServer` block when `PLAYWRIGHT_BASE_URL` is set (remote testing)
    - _Requirements: 22.1, 22.2, 22.3, 22.8_

  - [x] 14.2 Ensure backend test configuration supports separate `DATABASE_URL`
    - Verify Jest config reads from `.env.test` or test-specific env vars
    - _Requirements: 22.4_

- [x] 15. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Documentation
  - [x] 16.1 Create VPS setup guide at `docs/guides/VPS_SETUP.md`
    - Step-by-step guide for Scaleway DEV1-S provisioning (reference design Steps 1-21)
    - Cover: instance creation, SSH key setup, deploy user, firewall, Docker, Node.js, PM2, Caddy installation
    - Written for a developer managing a raw VPS for the first time
    - _Requirements: 17.1_

  - [x] 16.2 Create deployment guide at `docs/guides/DEPLOYMENT.md`
    - First deployment steps, subsequent deployments, environment variable configuration
    - CI/CD pipeline usage: ACC auto-deploy, PRD manual promote
    - _Requirements: 17.2_

  - [x] 16.3 Create maintenance guide at `docs/guides/MAINTENANCE.md`
    - Log inspection, backup verification, SSL certificate status, database maintenance, server resource monitoring
    - _Requirements: 17.3_

  - [x] 16.4 Create troubleshooting guide at `docs/guides/TROUBLESHOOTING.md`
    - Common deployment failures, database connection issues, SSL renewal failures, process crash recovery
    - Include rollback procedure: stop backend, swap release symlink, restore DB backup if needed, restart
    - _Requirements: 17.4, 16.2_

  - [x] 16.5 Update `prototype/README.md` with production deployment section
    - Add section on VPS deployment alongside existing local dev instructions
    - Reference the new guides
    - _Requirements: 17.5_

  - [x] 16.6 Update `docs/guides/SETUP.md` to reference VPS deployment docs
    - _Requirements: 17.6_

  - [x] 16.7 Document project structure decision and risk register
    - Record decision to retain `prototype/` structure with rationale
    - Document known risks with priority levels and mitigation strategies
    - Include guide for provisioning PRD by cloning ACC setup
    - _Requirements: 23.1, 23.2, 23.3, 21.1, 21.2, 25.10_

- [x] 17. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- VPS provisioning (Scaleway Steps 1-21) is a manual task — not included as code tasks
- The existing `POST /admin/cycles/bulk` endpoint is preserved for local development
- Property tests use `fast-check` (already installed) with minimum 100 iterations per property
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation throughout the implementation
