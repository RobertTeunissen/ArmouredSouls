# Armoured Souls — Architecture Decisions & Risk Register

---

## Decision: Retain `prototype/` Directory Structure

**Status**: Accepted  
**Date**: February 2026

### Context

The entire codebase lives under `prototype/` — backend, frontend, Docker Compose, infrastructure configs. During the VPS migration, we considered flattening this to a root-level `backend/` and `frontend/` structure.

### Decision

Keep the `prototype/` directory structure as-is.

### Rationale

- **CI/CD stability**: The GitHub Actions workflow references `prototype/backend` and `prototype/frontend` throughout. Renaming would require updating every path in the pipeline, test configs, and deployment scripts simultaneously.
- **Import paths**: Backend and frontend internal imports, Prisma config, and TypeScript path mappings all assume the current structure. A rename risks subtle breakage.
- **Developer workflows**: All existing documentation, setup guides, and developer muscle memory reference `prototype/`. Changing this mid-migration adds unnecessary confusion.
- **No functional benefit**: The directory name doesn't affect runtime behavior. The deployment pipeline rsyncs the contents to `/opt/armouredsouls/` on the VPS regardless of the source directory name.

### Consequences

- New developers may find the `prototype/` name misleading for a production application. The README addresses this.
- If the project grows beyond a single prototype, the directory can be renamed in a dedicated refactoring effort with proper migration tooling.

---

## Risk Register

### HIGH: Single VPS = Single Point of Failure

**Risk**: The application runs on a single Scaleway DEV1-S instance. If the VPS goes down, the entire application is unavailable.

**Impact**: Complete downtime until the VPS is restored or a new one is provisioned.

**Mitigation**:
- Automated daily database backups with 7-day daily + 4-week weekly retention
- Documented restore procedure (`scripts/restore.sh`) tested and ready
- VPS setup guide enables provisioning a replacement instance in ~30 minutes
- Scaleway provides SLA on DEV1-S instances with automatic hardware failover

**Monitoring**: Health check endpoint (`/api/health`) + CI/CD smoke tests after every deployment.

### MEDIUM: No Horizontal Scaling

**Risk**: The DEV1-S instance (2 vCPU, 2 GB RAM) cannot scale horizontally. If player count grows significantly, the single instance may become a bottleneck.

**Impact**: Degraded performance under high load. Potential timeouts during peak usage.

**Mitigation**:
- DEV1-S is sufficient for the current user base (< 1000 concurrent users)
- Scaleway allows in-place upgrades to DEV1-M, DEV1-L, or GP1 instances with minimal downtime
- The architecture (stateless backend + external PostgreSQL) is already compatible with horizontal scaling if needed later
- PM2 can run multiple instances on a larger VPS with `instances: 'max'`

**Upgrade path**: Vertical scaling (bigger instance) is the first step. Horizontal scaling (multiple VPS + load balancer) is possible but not needed yet.

### LOW: Manual PRD Promotion

**Risk**: Production deployments require manual trigger via GitHub Actions `workflow_dispatch`. A human must initiate and approve each PRD deploy.

**Impact**: Slower release cadence to production. Potential for human error in timing.

**Mitigation**:
- The manual gate is intentional — it prevents accidental production deploys
- GitHub environment protection rules require reviewer approval
- ACC auto-deploys on every push to `main`, so PRD promotion is always from a tested state
- The deploy pipeline is identical for ACC and PRD, reducing "works on ACC but not PRD" risk

---

## Provisioning PRD by Cloning ACC

To set up a production VPS, follow the same steps as ACC with these differences:

### 1. Create a new Scaleway instance

Same spec (DEV1-S), same image (Ubuntu 22.04). Name it `armouredsouls-prd`.

### 2. Follow VPS_SETUP.md

Run through the entire [VPS Setup Guide](VPS_SETUP.md) on the new instance. Every step is identical.

### 3. Use production-specific configuration

When configuring `/opt/armouredsouls/backend/.env`:

| Variable | ACC Value | PRD Value |
|----------|-----------|-----------|
| `NODE_ENV` | `acceptance` | `production` |
| `DATABASE_URL` | ACC credentials | New, unique credentials |
| `JWT_SECRET` | ACC secret | New, unique secret (`openssl rand -hex 32`) |
| `CORS_ORIGIN` | `https://acc.armouredsouls.com` | `https://armouredsouls.com,https://www.armouredsouls.com` |
| `POSTGRES_USER` | `as_acc` | `as_prd` |
| `POSTGRES_PASSWORD` | ACC password | New, unique password |
| `POSTGRES_DB` | `armouredsouls_acc` | `armouredsouls_prd` |

### 4. Set the Caddy domain

In `/etc/caddy/Caddyfile`, use the production domain:

```
armouredsouls.com {
    # ... same config as ACC
}
```

### 5. Add GitHub secrets

Add `PRD_SSH_KEY`, `PRD_VPS_IP`, and `PRD_VPS_USER` to GitHub repository secrets.

### 6. Configure GitHub environment

Create a `production` environment in GitHub with required reviewers and branch restrictions.

### 7. Seed production data

```bash
cd /opt/armouredsouls/backend
NODE_ENV=production npx prisma db seed
```

This seeds only essential game data (weapons, facilities) — no test accounts.

### 8. Deploy

Trigger a production deployment via GitHub Actions → Deploy → Run workflow → `production`.
