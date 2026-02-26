# Requirements Document: VPS Migration

## Introduction

This document defines the requirements for migrating the Armoured Souls application from a local-only development setup to a production-ready deployment on a Virtual Private Server (VPS). The current architecture runs entirely on localhost with hardcoded URLs, a local Docker PostgreSQL container, no HTTPS, no process management, and no production build pipeline. This migration covers infrastructure provisioning, code changes to support environment-based configuration, reverse proxy setup, SSL/TLS, database hardening, CI/CD deployment, monitoring, backup strategies, documentation updates, and testing.

## Decisions and Configuration

The following decisions have been finalized based on user input:

1. **VPS Provider & Specs**: Scaleway DEV1-S instance (2 vCPU, 2 GB RAM, 20 GB SSD, 200 Mbps bandwidth) at ~€6.42/month. Single VPS approach chosen over serverless containers because the app requires always-on processes for the Cycle_Scheduler (cron-based match execution at 08:00, 12:00, 20:00, and 23:00 UTC). Account created, instance not yet provisioned. The initial DEV1-S is for the ACC_Environment; a second DEV1-S will be provisioned later for the PRD_Environment.
2. **Domain Name**: A new domain will be claimed (e.g., `armouredsouls.com` or similar). ACC_Environment will use `acc.armouredsouls.com`, PRD_Environment will use `armouredsouls.com` (root domain). The existing `gobdroid.webdroids.nl` (DNS managed at Hostnet) may still be used or redirected. DNS A records will be updated to point to the respective Scaleway VPS public IPs after provisioning.
3. **Target OS**: Ubuntu (latest LTS).
4. **SSL Strategy**: Let's Encrypt — free, automated certificate issuance and renewal via the Reverse_Proxy.
5. **Deployment Trigger**: Push to `main` deploys to ACC_Environment automatically. PRD_Environment deployment is a manual promotion from ACC via GitHub Actions (`workflow_dispatch` or environment approval gate).
6. **SSH Access**: SSH key pair for CI/CD authentication. Key-based auth must be configured on the VPS; password auth will be disabled.
7. **Database Strategy**: PostgreSQL runs inside Docker on the VPS, managed via `docker-compose.production.yml`. The previous Hostnet shared hosting only offered MariaDB (incompatible with the Prisma/PostgreSQL schema), which drove the move to a VPS.
8. **Backup Destination**: Local VPS disk for now (sufficient for ~10 users). Offsite S3-compatible storage (e.g., Scaleway Object Storage or Backblaze B2) can be added later.
9. **Monitoring**: UptimeRobot free tier — 50 monitors, 5-minute check intervals, external health endpoint monitoring.
10. **Expected User Count**: Maximum 10 concurrent users — minimal resource requirements.
11. **Budget Constraints**: Maximum $50/month — Scaleway DEV1-S is well within budget.
12. **Environment Strategy**: Three environments: DEV_Environment (local laptop), ACC_Environment (Scaleway DEV1-S VPS), and PRD_Environment (separate Scaleway DEV1-S VPS, provisioned later). Each environment is fully isolated with its own database, domain, SSL certificate, and configuration.

### Additional Context

- The user originally attempted Hostnet shared hosting (Plesk-managed) but it lacked Docker, root access, and PostgreSQL — completely incompatible with the application's requirements.
- The user has Node.js experience but this is their first time managing a raw VPS; documentation should include step-by-step guidance for VPS setup tasks.
- Serverless containers (Scaleway Serverless Containers) were evaluated but rejected because the Cycle_Scheduler requires an always-on process to trigger scheduled match execution. Serverless containers only run on incoming HTTP requests and would require additional Serverless Jobs for cron triggers, adding complexity with no benefit at the expected 10-user scale.

## Glossary

- **VPS**: Virtual Private Server — a Scaleway DEV1-S instance (2 vCPU, 2 GB RAM, 20 GB SSD) running Ubuntu
- **Reverse_Proxy**: A server (Caddy or Nginx) that sits in front of the application, handles SSL termination via Let's Encrypt, and forwards requests to the backend
- **Process_Manager**: A tool (PM2 or systemd) that keeps the Node.js backend running, restarts it on crash, and manages logs
- **CI_CD_Pipeline**: The GitHub Actions workflow that builds, tests, and deploys the application automatically
- **SSL_Certificate**: A TLS certificate enabling HTTPS connections, obtained via Let's Encrypt for `gobdroid.webdroids.nl`
- **Connection_Pool**: The set of reusable database connections managed by Prisma to avoid opening a new connection per request
- **Frontend_Build**: The static HTML/CSS/JS output produced by `vite build` from the React frontend
- **Backend_Service**: The Express.js + Prisma API server running on Node.js
- **Database_Service**: The PostgreSQL 16 database storing all application data
- **Environment_Configuration**: The `.env` files and environment variables controlling runtime behavior per environment
- **Health_Endpoint**: The `/api/health` route used to verify the Backend_Service is operational
- **Firewall**: The VPS-level network filter (UFW or iptables) restricting which ports accept incoming traffic
- **Migration_Script**: Prisma migration commands that apply schema changes to the Database_Service
- **Seed_Script**: The `prisma/seed.ts` script that populates the Database_Service with initial game data
- **E2E_Tests**: End-to-end Playwright tests that exercise the full application stack through a browser
- **Unit_Tests**: Backend Jest tests that verify individual modules without requiring running servers or production databases
- **Cycle_Scheduler**: The automated scheduling system (cron-based) that triggers match execution, repairs, rebalancing, and matchmaking at configured UTC times
- **Scheduled_Job**: A discrete unit of work triggered by the Cycle_Scheduler at a specific time. There are four Scheduled_Jobs: League Cycle, Tournament Cycle, Tag Team Cycle, and Daily Settlement
- **Daily_Settlement**: The end-of-day Scheduled_Job that processes passive income, operating costs, balance logging, cycle counter increments, analytics snapshots, and optional user generation
- **DEV_Environment**: The developer's local machine running the application with local Docker PostgreSQL and Vite dev server for development and testing
- **ACC_Environment**: The Acceptance environment on a Scaleway DEV1-S VPS, used for integration testing and pre-production validation. Domain: `acc.armouredsouls.com`
- **PRD_Environment**: The Production environment on a separate Scaleway DEV1-S VPS (provisioned later), serving end users. Domain: `armouredsouls.com`

## Requirements

### Requirement 1: Environment-Based API URL Configuration

**User Story:** As a developer, I want the frontend to use environment-based API URLs instead of hardcoded `localhost:3001` references, so that the same codebase works in development, staging, and production.

#### Acceptance Criteria

1. THE Frontend_Build SHALL resolve all API endpoint URLs from a single configurable environment variable (`VITE_API_URL`).
2. WHEN `VITE_API_URL` is not set, THE Frontend_Build SHALL default to an empty string (enabling relative URL paths through the Reverse_Proxy).
3. WHEN a developer runs the frontend locally, THE Frontend_Build SHALL use the Vite dev server proxy to forward `/api` requests to `http://localhost:3001`.
4. THE Frontend_Build SHALL contain zero hardcoded references to `http://localhost:3001` after the migration is complete.
5. WHEN the Frontend_Build is compiled for production, THE Frontend_Build SHALL embed the value of `VITE_API_URL` at build time.
6. THE Frontend_Build SHALL provide a `.env.example` file documenting `VITE_API_URL` and any other frontend environment variables with usage comments.

#### Known Hardcoded Locations (to be migrated)

The following files contain hardcoded `http://localhost:3001/api` references that must be replaced with the centralized API client:

- `prototype/frontend/src/utils/userApi.ts` (line 8): `const API_BASE_URL = 'http://localhost:3001/api'`
- `prototype/frontend/src/utils/matchmakingApi.ts` (line 3): `const API_BASE_URL = 'http://localhost:3001/api'`
- `prototype/frontend/src/utils/financialApi.ts` (line 5): `const API_BASE_URL = 'http://localhost:3001/api'`
- `prototype/frontend/src/contexts/AuthContext.tsx` (line 60): `axios.get('http://localhost:3001/api/user/profile')`
- `prototype/frontend/src/contexts/AuthContext.tsx` (line 86): `axios.post('http://localhost:3001/api/auth/login', ...)`

Additionally, the Vite dev proxy in `prototype/frontend/vite.config.ts` targets `http://localhost:3001` — this is correct for development but will not exist in production (the Reverse_Proxy handles routing instead).

---

### Requirement 2: Centralized API Client

**User Story:** As a developer, I want all API calls routed through a single Axios instance with a configurable base URL, so that URL changes only need to happen in one place.

#### Acceptance Criteria

1. THE Frontend_Build SHALL provide a shared Axios instance configured with the `VITE_API_URL` base URL.
2. WHEN any frontend page makes an API request, THE Frontend_Build SHALL use the shared Axios instance instead of raw `fetch()` or standalone `axios` calls.
3. THE shared Axios instance SHALL automatically attach the JWT authorization header from localStorage when a token is present.
4. IF a 401 response is received, THEN THE shared Axios instance SHALL clear the stored token and redirect the user to the login page.

#### Migration Notes

Each of the following API utility files currently creates its own `API_BASE_URL` constant and `getAuthHeaders()` helper — these must be refactored to use the shared Axios instance:

- `prototype/frontend/src/utils/userApi.ts` — user profile, registration, admin endpoints
- `prototype/frontend/src/utils/matchmakingApi.ts` — matchmaking and battle endpoints
- `prototype/frontend/src/utils/financialApi.ts` — economy and financial endpoints
- `prototype/frontend/src/contexts/AuthContext.tsx` — login and profile fetch (uses raw `axios.get`/`axios.post` with hardcoded URLs)

---

### Requirement 3: Backend Environment Configuration for Production

**User Story:** As a developer, I want the backend to read all sensitive and environment-specific values from environment variables, so that the same code runs securely in production without code changes.

#### Acceptance Criteria

1. THE Backend_Service SHALL read `DATABASE_URL`, `JWT_SECRET`, `PORT`, `NODE_ENV`, and `CORS_ORIGIN` from environment variables.
2. THE Backend_Service SHALL validate that `JWT_SECRET` is not the default placeholder value when `NODE_ENV` is set to `production`.
3. IF `JWT_SECRET` contains the default placeholder value in production, THEN THE Backend_Service SHALL refuse to start and log an error message.
4. WHEN `CORS_ORIGIN` is set, THE Backend_Service SHALL restrict CORS to the specified origin(s) (e.g., `https://gobdroid.webdroids.nl`) instead of allowing all origins.
5. WHEN `NODE_ENV` is set to `production`, THE Backend_Service SHALL disable verbose error stack traces in API responses.
6. THE Backend_Service SHALL provide a `.env.production.example` file documenting all required production environment variables.

#### Current Code to Migrate

- `prototype/backend/src/index.ts` line 26: `app.use(cors())` — currently allows all origins with no restrictions; must be replaced with environment-based CORS configuration reading `CORS_ORIGIN`.
- `prototype/backend/src/index.ts` line 29: Health endpoint returns only `{ status: 'ok', message: 'Armoured Souls API is running' }` with no database connectivity check — must be enhanced per Requirement 12.

---

### Requirement 4: Production Frontend Build and Serving

**User Story:** As a developer, I want the frontend to be built as static files and served efficiently by a reverse proxy, so that the production deployment does not require a Vite dev server.

#### Acceptance Criteria

1. WHEN `npm run build` is executed in the frontend directory, THE Frontend_Build SHALL produce optimized static files in the `dist/` directory.
2. THE Reverse_Proxy SHALL serve the Frontend_Build static files directly for all non-API routes.
3. THE Reverse_Proxy SHALL forward all requests matching `/api/*` to the Backend_Service.
4. WHEN a user navigates to a client-side route directly (e.g., `/robots/5`), THE Reverse_Proxy SHALL serve `index.html` to support single-page application routing.
5. THE Reverse_Proxy SHALL set appropriate cache headers: long-lived caching for hashed asset files, and no-cache for `index.html`.

---

### Requirement 5: Reverse Proxy and SSL/TLS Setup

**User Story:** As a developer, I want HTTPS enabled with automatic certificate renewal, so that all traffic between users and the server is encrypted.

#### Acceptance Criteria

1. THE Reverse_Proxy SHALL terminate SSL/TLS connections using a valid SSL_Certificate.
2. THE Reverse_Proxy SHALL automatically obtain and renew SSL_Certificates via Let's Encrypt for the domain `gobdroid.webdroids.nl`.
3. WHEN an HTTP request is received on port 80, THE Reverse_Proxy SHALL redirect the request to HTTPS on port 443.
4. THE Reverse_Proxy SHALL include security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security` with a minimum max-age of 31536000 seconds.
5. THE Reverse_Proxy SHALL enable gzip or Brotli compression for text-based responses (HTML, CSS, JS, JSON).
6. THE Reverse_Proxy SHALL set appropriate WebSocket upgrade headers if WebSocket support is needed in the future.

---

### Requirement 6: Process Management for the Backend

**User Story:** As a developer, I want the backend to run as a managed process that auto-restarts on failure, so that the application stays available without manual intervention.

#### Acceptance Criteria

1. THE Process_Manager SHALL start the Backend_Service automatically when the VPS boots.
2. WHEN the Backend_Service process crashes, THE Process_Manager SHALL restart the Backend_Service within 5 seconds.
3. THE Process_Manager SHALL limit restart attempts to a maximum of 10 restarts within a 60-second window to prevent restart loops.
4. THE Process_Manager SHALL capture stdout and stderr logs from the Backend_Service and write them to rotated log files.
5. THE Process_Manager SHALL expose a command to view the Backend_Service status (running, stopped, errored).

---

### Requirement 7: Database Hardening for Production

**User Story:** As a developer, I want the production database to be secured with strong credentials, restricted network access, and proper connection pooling, so that game data is protected.

#### Acceptance Criteria

1. THE Database_Service SHALL use a unique, randomly generated password of at least 32 characters for the production database user.
2. THE Database_Service SHALL only accept connections from localhost (127.0.0.1) when running on the same VPS as the Backend_Service.
3. THE Database_Service SHALL be configured with a connection pool limit appropriate for the Scaleway DEV1-S resources (2 GB RAM, ~10 concurrent users): minimum 10, maximum 20 connections.
4. IF a database connection attempt originates from an unauthorized IP address, THEN THE Database_Service SHALL reject the connection.
5. THE Database_Service SHALL run as a non-root system user with minimal filesystem permissions.
6. THE Database_Service SHALL have `log_connections` and `log_disconnections` enabled for audit purposes.

---

### Requirement 8: Database Backup and Restore

**User Story:** As a developer, I want automated database backups with a tested restore procedure, so that game data can be recovered in case of failure.

#### Acceptance Criteria

1. THE VPS SHALL execute an automated `pg_dump` backup of the Database_Service at least once every 24 hours.
2. THE VPS SHALL retain a minimum of 7 daily backups and 4 weekly backups.
3. THE VPS SHALL store backups on local VPS disk in a location separate from the Database_Service data directory. Offsite storage (e.g., Scaleway Object Storage or Backblaze B2) can be added as a future enhancement.
4. WHEN a backup completes, THE VPS SHALL log the backup status (success or failure) and the backup file size.
5. IF a backup fails, THEN THE VPS SHALL send a notification via UptimeRobot webhook or equivalent alert channel.
6. THE documentation SHALL include a step-by-step database restore procedure that has been tested at least once.

---

### Requirement 9: Firewall and Network Security

**User Story:** As a developer, I want the VPS to expose only the necessary ports, so that the attack surface is minimized.

#### Acceptance Criteria

1. THE Firewall SHALL allow incoming traffic only on ports 22 (SSH), 80 (HTTP), and 443 (HTTPS).
2. THE Firewall SHALL block all other incoming ports by default.
3. THE Firewall SHALL allow all outgoing traffic from the VPS.
4. WHEN SSH access is configured, THE VPS SHALL disable password-based SSH authentication and require SSH key authentication.
5. THE VPS SHALL run `fail2ban` or equivalent intrusion prevention to block repeated failed SSH login attempts.
6. THE Backend_Service SHALL listen only on `127.0.0.1` (not `0.0.0.0`) so that the Reverse_Proxy is the sole entry point.

---

### Requirement 10: CI/CD Deployment Pipeline

**User Story:** As a developer, I want an automated deployment pipeline that builds, tests, and deploys the application to the VPS on merge to main, so that releases are consistent and repeatable.

#### Acceptance Criteria

1. WHEN a commit is merged to the `main` branch, THE CI_CD_Pipeline SHALL trigger a deployment workflow.
2. THE CI_CD_Pipeline SHALL run the existing backend tests and frontend build before deploying.
3. IF any test fails, THEN THE CI_CD_Pipeline SHALL abort the deployment and report the failure.
4. THE CI_CD_Pipeline SHALL transfer the built artifacts to the VPS via SSH (using SCP, rsync, or equivalent).
5. THE CI_CD_Pipeline SHALL execute `prisma migrate deploy` on the VPS to apply any pending database migrations.
6. THE CI_CD_Pipeline SHALL restart the Backend_Service via the Process_Manager after deployment.
7. THE CI_CD_Pipeline SHALL verify the deployment by checking the Health_Endpoint returns a 200 status within 30 seconds of restart.
8. IF the Health_Endpoint check fails after deployment, THEN THE CI_CD_Pipeline SHALL report the failure and retain the previous deployment artifacts for manual rollback.
9. THE CI_CD_Pipeline SHALL store VPS SSH key and secrets as encrypted GitHub Actions secrets.
10. THE CI_CD_Pipeline SHALL define environment-specific deployment jobs for ACC_Environment and PRD_Environment.
11. WHEN a commit is merged to the `main` branch, THE CI_CD_Pipeline SHALL automatically deploy to the ACC_Environment only.
12. THE CI_CD_Pipeline SHALL provide a manual trigger (GitHub Actions `workflow_dispatch` or environment approval gate) to promote a tested ACC build to the PRD_Environment.
13. THE CI_CD_Pipeline SHALL use environment-specific GitHub Actions secrets (e.g., `ACC_SSH_KEY`, `ACC_VPS_IP`, `PRD_SSH_KEY`, `PRD_VPS_IP`) to target the correct VPS.
14. THE CI_CD_Pipeline SHALL use environment-specific `.env` variable sets for each deployment target.

---

### Requirement 11: Docker Compose Production Configuration

**User Story:** As a developer, I want a production-ready Docker Compose configuration, so that the database (and optionally the full stack) can be managed consistently on the VPS.

#### Acceptance Criteria

1. THE VPS SHALL provide a `docker-compose.production.yml` file that configures the Database_Service (PostgreSQL running in Docker) with production-grade settings.
2. THE `docker-compose.production.yml` SHALL use named volumes for persistent database storage.
3. THE `docker-compose.production.yml` SHALL read database credentials from environment variables, not hardcoded values.
4. THE `docker-compose.production.yml` SHALL configure the Database_Service to restart automatically (`restart: unless-stopped`).
5. THE `docker-compose.production.yml` SHALL expose the PostgreSQL port only to localhost (127.0.0.1:5432), not to the public network.
6. WHEN the VPS reboots, THE Docker containers defined in `docker-compose.production.yml` SHALL start automatically.

---

### Requirement 12: Application Health Monitoring

**User Story:** As a developer, I want basic health monitoring and alerting, so that I am notified when the application goes down.

#### Acceptance Criteria

1. THE Health_Endpoint SHALL return a JSON response including the Backend_Service status and database connectivity status.
2. THE Health_Endpoint SHALL respond within 5 seconds under normal operating conditions.
3. IF the Database_Service is unreachable, THEN THE Health_Endpoint SHALL return a 503 status with a descriptive error.
4. THE VPS SHALL be monitored by UptimeRobot (free tier) checking the Health_Endpoint at least every 5 minutes.
5. WHEN the Health_Endpoint is unreachable for 2 consecutive checks, UptimeRobot SHALL send an alert notification.
6. UptimeRobot SHALL track uptime percentage and response time history.

---

### Requirement 13: Logging Strategy

**User Story:** As a developer, I want structured, rotated logs for the backend, so that I can diagnose production issues without filling up disk space.

#### Acceptance Criteria

1. WHEN `NODE_ENV` is set to `production`, THE Backend_Service SHALL output structured JSON log entries including timestamp, log level, and message.
2. THE Backend_Service SHALL log all incoming API requests with method, path, status code, and response time.
3. THE Backend_Service SHALL log all unhandled errors with stack traces.
4. THE Process_Manager or log rotation tool SHALL rotate log files when they exceed 50 MB or daily, whichever comes first.
5. THE VPS SHALL retain log files for a minimum of 30 days before automatic deletion.
6. THE Backend_Service SHALL NOT log sensitive data (passwords, JWT tokens, full database connection strings) in any log level.

---

### Requirement 14: Database Migration Safety

**User Story:** As a developer, I want database migrations to run safely in production without data loss, so that schema updates do not break the running application.

#### Acceptance Criteria

1. THE CI_CD_Pipeline SHALL run `prisma migrate deploy` (not `prisma migrate dev`) in the production environment.
2. WHEN a migration is applied, THE CI_CD_Pipeline SHALL create a database backup before executing the migration.
3. IF a migration fails, THEN THE CI_CD_Pipeline SHALL halt the deployment and preserve the pre-migration backup.
4. THE documentation SHALL include a procedure for rolling back a failed migration using the pre-migration backup.
5. THE Backend_Service SHALL NOT run seed scripts automatically in production; seeding SHALL require an explicit manual command.

---

### Requirement 15: Seed Data Strategy for Production

**User Story:** As a developer, I want a clear strategy for initial production data seeding that separates test data from essential game data, so that the production database contains only what is needed.

#### Acceptance Criteria

1. THE Seed_Script SHALL support a `--production` flag (or equivalent environment check) that seeds only essential game data (weapons, default configuration) without test users or test robots.
2. WHEN `NODE_ENV` is set to `production`, THE Seed_Script SHALL skip creation of test user accounts (player1-6, admin, test_attr_* accounts).
3. THE Seed_Script SHALL be idempotent: running the seed script multiple times SHALL NOT create duplicate records.
4. THE documentation SHALL specify which seed data is required for production and which is test-only.

---

### Requirement 16: Rollback Procedure

**User Story:** As a developer, I want a documented rollback procedure, so that a failed deployment can be reverted quickly.

#### Acceptance Criteria

1. THE CI_CD_Pipeline SHALL retain the previous deployment's built artifacts on the VPS for at least one release cycle.
2. THE documentation SHALL include a step-by-step rollback procedure covering: stopping the current Backend_Service, restoring previous artifacts, restoring the database backup if needed, and restarting the Backend_Service.
3. WHEN a rollback is performed, THE Backend_Service SHALL be restored to the previous working state within 10 minutes.
4. THE rollback procedure SHALL be testable in a non-production environment.

---

### Requirement 17: Documentation Updates

**User Story:** As a developer, I want all project documentation updated to reflect the VPS deployment, so that any team member can set up, deploy, and maintain the production environment.

#### Acceptance Criteria

1. THE documentation SHALL include a VPS initial setup guide covering: Scaleway DEV1-S provisioning with Ubuntu, user creation, SSH key setup, firewall configuration, Docker installation, Node.js installation, and Reverse_Proxy installation. The guide SHALL be written for a developer who is managing a raw VPS for the first time.
2. THE documentation SHALL include a deployment guide covering: first deployment steps, subsequent deployment steps, and environment variable configuration.
3. THE documentation SHALL include a maintenance guide covering: log inspection, backup verification, SSL certificate status, database maintenance, and server resource monitoring.
4. THE documentation SHALL include a troubleshooting guide covering: common deployment failures, database connection issues, SSL certificate renewal failures, and process crash recovery.
5. THE `prototype/README.md` SHALL be updated to include a section on production deployment alongside the existing local development instructions.
6. THE `docs/guides/SETUP.md` SHALL be updated to reference the new VPS deployment documentation.
7. THE `.env.example` files SHALL be updated to document all production-specific environment variables with comments.

---

### Requirement 18: Testing the Production Deployment

**User Story:** As a developer, I want a testing strategy for verifying the production deployment, so that I can confirm the application works correctly on the VPS before exposing it to users.

#### Acceptance Criteria

1. THE CI_CD_Pipeline SHALL execute a post-deployment smoke test that verifies: the Health_Endpoint returns 200, the frontend loads successfully (HTTP 200 on `/`), and the login API endpoint responds.
2. THE documentation SHALL include a manual verification checklist covering: user registration, user login, robot creation, facility upgrade, battle execution (admin cycle), and leaderboard display.
3. WHEN the smoke test passes, THE CI_CD_Pipeline SHALL mark the deployment as successful.
4. IF the smoke test fails, THEN THE CI_CD_Pipeline SHALL mark the deployment as failed and trigger the rollback alert.
5. THE testing strategy SHALL include a procedure for running the existing backend test suite against the production database schema (using a separate test database on the VPS).

---

### Requirement 19: CORS Configuration for Production

**User Story:** As a developer, I want CORS properly configured for the production domain, so that the frontend can communicate with the backend securely without allowing unauthorized origins.

#### Acceptance Criteria

1. WHEN `NODE_ENV` is set to `production`, THE Backend_Service SHALL accept CORS requests only from the configured `CORS_ORIGIN` value.
2. THE Backend_Service SHALL support multiple allowed origins via a comma-separated `CORS_ORIGIN` value (e.g., `https://acc.armouredsouls.com` for ACC_Environment, `https://armouredsouls.com,https://www.armouredsouls.com` for PRD_Environment).
3. WHEN `NODE_ENV` is set to `development`, THE Backend_Service SHALL allow CORS from all origins to preserve the local development experience.
4. THE Backend_Service SHALL include `credentials: true` in CORS configuration to support JWT cookie-based authentication if adopted in the future.

---

### Requirement 20: Rate Limiting and Basic DDoS Protection

**User Story:** As a developer, I want basic rate limiting on the API, so that the backend is protected from abuse and excessive request volumes.

#### Acceptance Criteria

1. THE Backend_Service SHALL enforce a rate limit of no more than 100 requests per minute per IP address on all API endpoints.
2. THE Backend_Service SHALL enforce a stricter rate limit of no more than 10 requests per minute per IP address on the `/api/auth/login` and `/api/auth/register` endpoints.
3. WHEN a client exceeds the rate limit, THE Backend_Service SHALL return a 429 (Too Many Requests) status with a `Retry-After` header.
4. THE Reverse_Proxy SHALL be configured to pass the real client IP address to the Backend_Service via `X-Forwarded-For` or `X-Real-IP` headers.
5. THE Backend_Service SHALL use the forwarded IP header (not the Reverse_Proxy IP) for rate limiting decisions.

---

### Requirement 21: Potential Problems and Risk Mitigation

**User Story:** As a developer, I want known risks documented with mitigation strategies, so that the team is prepared for common VPS migration issues.

#### Acceptance Criteria

1. THE documentation SHALL identify and document the following risks with mitigation strategies:
   - **Hardcoded URLs**: Over 30 frontend files contain `http://localhost:3001` — mitigation: centralized API client (Requirement 2).
   - **Mixed fetch/axios usage**: Frontend uses both `fetch()` and `axios` inconsistently — mitigation: standardize on the shared Axios instance.
   - **Default JWT secret**: The `.env.example` contains a placeholder JWT secret — mitigation: production startup validation (Requirement 3).
   - **Open CORS policy**: `app.use(cors())` allows all origins — mitigation: environment-based CORS (Requirement 19).
   - **No process supervision**: Backend runs via `tsx watch` in development — mitigation: Process_Manager (Requirement 6).
   - **Database credentials in docker-compose**: Hardcoded `password` in `docker-compose.yml` — mitigation: environment variable injection (Requirement 11).
   - **Test data in production**: Seed script creates test accounts with known passwords — mitigation: production seed flag (Requirement 15).
   - **No HTTPS**: Current setup has no SSL — mitigation: Reverse_Proxy with Let's Encrypt for `gobdroid.webdroids.nl` (Requirement 5).
   - **No backups**: No backup strategy exists — mitigation: automated backups to local VPS disk (Requirement 8).
   - **48.7% test pass rate**: Many tests are failing — risk of deploying broken code — mitigation: fix critical tests before production deployment.
   - **Hardcoded test URLs**: Playwright config and backend tests use hardcoded localhost URLs — mitigation: environment-based test configuration (Requirement 22).
   - **No test separation**: Unit tests and E2E tests are not separated for CI — mitigation: test stage separation (Requirement 22).
   - **No rate limiting**: API is unprotected against abuse — mitigation: rate limiting (Requirement 20).
   - **Disk space exhaustion**: Battle logs stored as JSON in database can grow large — mitigation: monitoring and log rotation.
   - **Environment configuration drift**: ACC and PRD environments may diverge over time if configurations are managed manually — mitigation: parameterized infrastructure scripts and environment-specific `.env` files (Requirement 25).
   - **Monolithic cycle in production**: The current single-endpoint cycle (`POST /admin/cycles/bulk`) is not suitable for production scheduling — mitigation: decompose into scheduled jobs (Requirement 24).
2. THE documentation SHALL prioritize risks as Critical, High, Medium, or Low based on impact and likelihood.

---

### Requirement 22: Test Adaptation for Production Environments

**User Story:** As a developer, I want the test suite adapted for environment-based configuration and clearly separated by type, so that unit tests run reliably in CI and E2E tests can target any environment including production.

#### Acceptance Criteria

1. THE Playwright configuration (`prototype/frontend/playwright.config.ts`) SHALL read `baseURL` from the `PLAYWRIGHT_BASE_URL` environment variable instead of hardcoding `http://localhost:3000`.
2. WHEN `PLAYWRIGHT_BASE_URL` is not set, THE Playwright configuration SHALL default to `http://localhost:3000` to preserve the local development experience.
3. THE Playwright configuration SHALL read the `webServer.command` and `webServer.url` from environment variables or conditionally disable the `webServer` block when targeting a remote environment.
4. THE Backend_Service test configuration SHALL support a separate `DATABASE_URL` for test execution, distinct from the production database.
5. THE CI_CD_Pipeline SHALL run backend unit tests (Jest) without requiring a running backend server or production database.
6. THE CI_CD_Pipeline SHALL separate test execution into two stages: unit tests (run on every push) and E2E tests (run on merge to `main` or on-demand).
7. THE project SHALL provide a test environment configuration file (`.env.test.example`) documenting all environment variables needed for test execution in each mode (unit, E2E local, E2E remote).
8. WHEN E2E tests target a remote environment, THE Playwright configuration SHALL disable the `webServer` auto-start and use the remote `PLAYWRIGHT_BASE_URL` directly.

#### Known Hardcoded Locations (to be migrated)

- `prototype/frontend/playwright.config.ts` line 33: `baseURL: 'http://localhost:3000'` — must be replaced with `process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'`
- `prototype/frontend/playwright.config.ts` lines 57-61: `webServer` block hardcodes `command: 'npm run dev'` and `url: 'http://localhost:3000'` — must be conditionally disabled for remote testing
- Backend Jest tests rely on `DATABASE_URL` from the local `.env` file — must support a test-specific database URL

---

### Requirement 23: Project Structure Decision and Documentation

**User Story:** As a developer, I want the project directory structure decision documented with rationale, so that the team understands why the current structure is retained and what would need to change if restructuring is done later.

#### Acceptance Criteria

1. THE documentation SHALL record the decision to retain the current `prototype/backend`, `prototype/frontend`, `prototype/shared` directory structure for this migration.
2. THE documentation SHALL state the rationale: the shared code is minimal (only `prototype/shared/utils/discounts.ts`), and restructuring during a migration adds unnecessary risk and scope.
3. THE documentation SHALL list what would need to change if the project is restructured in the future, including: CI/CD pipeline paths, Docker build contexts, import paths, Prisma schema location references, and deployment scripts.
4. THE CI_CD_Pipeline SHALL reference all build and deploy paths relative to the `prototype/` directory to ensure compatibility with the current structure.
5. THE Reverse_Proxy configuration SHALL serve the Frontend_Build from `prototype/frontend/dist/` (or the deployed artifact location) without requiring a directory rename.

---

### Requirement 24: Automated Cycle Scheduling

**User Story:** As a developer, I want the monolithic game cycle decomposed into four discrete scheduled jobs that run automatically at configured UTC times on the VPS, so that matches execute on a predictable daily schedule without manual admin intervention.

#### Acceptance Criteria

1. THE Cycle_Scheduler SHALL decompose the current monolithic cycle (`POST /admin/cycles/bulk`) into four independent Scheduled_Jobs: League Cycle, Tournament Cycle, Tag Team Cycle, and Daily Settlement.

**League Cycle (default: 20:00 UTC)**

2. THE Cycle_Scheduler SHALL execute the League Cycle Scheduled_Job daily at the time configured in the `LEAGUE_SCHEDULE` environment variable (cron format), defaulting to `0 20 * * *` (20:00 UTC).
3. WHEN the League Cycle Scheduled_Job runs, THE Cycle_Scheduler SHALL execute the following steps in order: repair all robots (auto-repair with cost deduction), execute scheduled league battles (1v1), rebalance leagues, and schedule league matchmaking for the next cycle with a 24-hour lead time.

**Tournament Cycle (default: 08:00 UTC)**

4. THE Cycle_Scheduler SHALL execute the Tournament Cycle Scheduled_Job daily at the time configured in the `TOURNAMENT_SCHEDULE` environment variable (cron format), defaulting to `0 8 * * *` (08:00 UTC).
5. WHEN the Tournament Cycle Scheduled_Job runs, THE Cycle_Scheduler SHALL execute the following steps in order: repair all robots (auto-repair with cost deduction), execute or schedule tournament matches, advance winners to next rounds, and auto-create the next tournament if none are active.

**Tag Team Cycle (default: 12:00 UTC, odd cycles only)**

6. THE Cycle_Scheduler SHALL execute the Tag Team Cycle Scheduled_Job daily at the time configured in the `TAGTEAM_SCHEDULE` environment variable (cron format), defaulting to `0 12 * * *` (12:00 UTC).
7. THE Tag Team Cycle Scheduled_Job SHALL only execute match battles on odd-numbered cycles, consistent with the existing odd-cycle-only logic.
8. WHEN the Tag Team Cycle Scheduled_Job runs on an odd cycle, THE Cycle_Scheduler SHALL execute the following steps in order: repair all robots (auto-repair with cost deduction), execute tag team battles, rebalance tag team leagues, and schedule tag team matchmaking with a 48-hour lead time.
9. WHEN the Tag Team Cycle Scheduled_Job runs on an even cycle, THE Cycle_Scheduler SHALL skip battle execution and log that the cycle was skipped due to even-cycle scheduling.

**Daily Settlement (default: 23:00 UTC)**

10. THE Cycle_Scheduler SHALL execute the Daily Settlement Scheduled_Job daily at the time configured in the `SETTLEMENT_SCHEDULE` environment variable (cron format), defaulting to `0 23 * * *` (23:00 UTC).
11. WHEN the Daily Settlement Scheduled_Job runs, THE Cycle_Scheduler SHALL execute the following steps in order: calculate and credit passive income for all users, calculate and debit facility operating costs for all users, log end-of-cycle balances for all users, increment cycle counters (cyclesInCurrentLeague for robots, cyclesInTagTeamLeague for tag teams), create a cycle snapshot for analytics, and auto-generate new users if enabled.

**Scheduling and Configuration**

12. THE Cycle_Scheduler SHALL only activate when the `SCHEDULER_ENABLED` environment variable is set to `true`.
13. WHEN `SCHEDULER_ENABLED` is not set or is set to `false`, THE Cycle_Scheduler SHALL remain inactive and log that automated scheduling is disabled.
14. THE Backend_Service SHALL retain the existing `POST /admin/cycles/bulk` endpoint for manual cycle triggering during local development and testing.

**Concurrency and Error Handling**

15. THE Cycle_Scheduler SHALL implement a concurrency lock that prevents two Scheduled_Jobs from executing simultaneously.
16. IF a Scheduled_Job attempts to start while another Scheduled_Job is already running, THEN THE Cycle_Scheduler SHALL queue the incoming job and execute it after the running job completes.
17. IF a Scheduled_Job fails during execution, THEN THE Cycle_Scheduler SHALL log the error with full context (job name, step that failed, error message) and send an alert notification without crashing the Backend_Service.
18. IF a Scheduled_Job fails, THEN THE Cycle_Scheduler SHALL NOT retry the failed job automatically; the failure SHALL be resolved via manual intervention or the next scheduled run.

**Cycle Metadata and Logging**

19. THE Cycle_Scheduler SHALL update the `cycleMetadata.totalCycles` counter and `lastCycleAt` timestamp after the Daily Settlement Scheduled_Job completes (as it is the final job of the day).
20. THE Cycle_Scheduler SHALL log the start time, end time, and duration of each Scheduled_Job execution.
21. THE Cycle_Scheduler SHALL use UTC for all schedule calculations to avoid daylight saving time issues.

**Status and Documentation**

22. THE Backend_Service SHALL provide a `GET /admin/scheduler/status` endpoint that returns the current state of the Cycle_Scheduler, including: whether the scheduler is active, the configured schedule for each of the four jobs, the last execution time of each job, and the next scheduled execution time.
23. THE `.env.production.example` file SHALL document all Cycle_Scheduler environment variables (`SCHEDULER_ENABLED`, `LEAGUE_SCHEDULE`, `TOURNAMENT_SCHEDULE`, `TAGTEAM_SCHEDULE`, `SETTLEMENT_SCHEDULE`) with usage comments and default values.

**Repair Before Battle Rationale**

24. EACH battle-related Scheduled_Job (League Cycle, Tournament Cycle, Tag Team Cycle) SHALL execute robot repairs as the FIRST step before battle execution, giving players a window to repair manually via the GUI between the previous battle and the next auto-repair.


---

### Requirement 25: Multi-Environment Strategy

**User Story:** As a developer, I want a clear multi-environment strategy with isolated DEV, ACC, and PRD environments, so that I can develop locally, validate on acceptance, and promote to production with confidence.

#### Acceptance Criteria

1. THE project SHALL support three environments: DEV_Environment (local laptop), ACC_Environment (Scaleway VPS), and PRD_Environment (separate Scaleway VPS, provisioned later).
2. EACH environment SHALL have its own isolated PostgreSQL database with separate credentials and connection strings.
3. EACH environment SHALL have its own domain and SSL certificate: `localhost` for DEV_Environment, `acc.armouredsouls.com` for ACC_Environment, and `armouredsouls.com` for PRD_Environment.
4. THE Backend_Service SHALL determine its runtime behavior based on the `NODE_ENV` environment variable: `development` for DEV_Environment, `acceptance` for ACC_Environment, and `production` for PRD_Environment.
5. THE Cycle_Scheduler SHALL be configurable per environment: disabled in DEV_Environment (manual trigger only), enabled with configurable schedules in ACC_Environment and PRD_Environment.
6. THE project SHALL provide environment-specific `.env` example files: `.env.example` (DEV_Environment), `.env.acc.example` (ACC_Environment), `.env.prd.example` (PRD_Environment), each documenting the required variables for that environment.
7. THE CI_CD_Pipeline SHALL use GitHub Actions environments (`acceptance` and `production`) with environment-specific secrets and protection rules.
8. THE PRD_Environment GitHub Actions environment SHALL require manual approval before deployment proceeds.
9. THE infrastructure setup (VPS provisioning, Nginx/Caddy config, Docker Compose, PM2/systemd config) SHALL be parameterized so that the same scripts and configurations work for both ACC_Environment and PRD_Environment with only environment variables differing.
10. THE documentation SHALL include a guide for provisioning a new environment (PRD_Environment) by cloning the ACC_Environment setup with different environment variables and domain configuration.
11. WHEN the PRD_Environment is provisioned, THE CI_CD_Pipeline SHALL support promoting a specific commit or tag from ACC_Environment to PRD_Environment without rebuilding artifacts.
12. THE ACC_Environment SHALL use test and seed data appropriate for acceptance testing, while the PRD_Environment SHALL use production seed data only (per Requirement 15).
13. THE Cycle_Scheduler in ACC_Environment MAY use accelerated schedules (e.g., every hour instead of daily) for testing purposes, configurable via the four job schedule environment variables (`LEAGUE_SCHEDULE`, `TOURNAMENT_SCHEDULE`, `TAGTEAM_SCHEDULE`, `SETTLEMENT_SCHEDULE`).
