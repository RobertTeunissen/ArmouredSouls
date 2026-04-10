# Provisioning PRD by Cloning ACC

**Last Updated**: April 9, 2026  
**Status**: ✅ Current

To set up a production VPS, follow the same steps as ACC with these differences:

---

## 1. Create a new Scaleway instance

Same spec (DEV1-S), same image (Ubuntu 22.04). Name it `armouredsouls-prd`.

## 2. Follow VPS_SETUP.md

Run through the entire [VPS Setup Guide](VPS_SETUP.md) on the new instance. Every step is identical.

## 3. Use production-specific configuration

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

## 4. Set the Caddy domain

In `/etc/caddy/Caddyfile`, use the production domain:

```
armouredsouls.com {
    # ... same config as ACC
}
```

## 5. Add GitHub secrets

Add `PRD_SSH_KEY`, `PRD_VPS_IP`, and `PRD_VPS_USER` to GitHub repository secrets.

## 6. Configure GitHub environment

Create a `production` environment in GitHub with required reviewers and branch restrictions.

## 7. Seed production data

```bash
cd /opt/armouredsouls/backend
NODE_ENV=production npx prisma db seed
```

This seeds only essential game data (weapons, facilities) — no test accounts.

## 8. Deploy

Trigger a production deployment via GitHub Actions → Deploy → Run workflow → `production`.
