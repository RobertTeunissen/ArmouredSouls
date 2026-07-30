# Edge DDoS Protection (Backlog #62)

## Current State

The Caddyfile now includes server-level hardening:
- **Timeouts**: 5s read header, 10s read body, 30s write, 60s idle — sheds slow/stalled connections
- **Request body limit**: 2 MB at the Caddy level (Express enforces 1 MB downstream)
- **Header size limit**: 16 KB

In-process rate limiting via `express-rate-limit` covers application-layer abuse:
- General: 300 req/min per IP
- Login: 10 req/15min per IP
- Register: 30 req/min per IP
- Admin: 120 req/min per IP
- Economic (per-user): 100 req/min
- Upload: 5 per 10min per user
- Account reset: 3 req/hr per user
- Admin password reset: 10 req/15min per admin

## What's Missing

Every abusive request still costs TLS termination + a Node event-loop turn on a
2 vCPU / 2 GB DEV1-S. There is no edge layer to absorb volumetric attacks, no
origin IP hiding, and no connection-level rate limiting outside the process.

## Recommended: Cloudflare Free Tier

Cloudflare's free plan provides:
- L3/L4 DDoS mitigation (volumetric, SYN floods)
- L7 rate limiting (5 free rules)
- Origin IP hiding (attackers can't bypass Caddy and hit the box directly)
- Bot detection (known-bad IPs, JavaScript challenges)
- Shared-IP fairness (Cloudflare's `CF-Connecting-IP` is the real client, not the NAT)

### Setup Steps

1. **Add domain to Cloudflare** (free plan) — change nameservers at your registrar.
2. **Set SSL mode to "Full (strict)"** — Caddy already has a valid cert from Let's Encrypt.
3. **Create a Firewall Rule** to block direct-IP access:
   - If `not http.host eq "armouredsouls.com"` → Block
4. **Update `trust proxy` in Express** — Cloudflare adds `CF-Connecting-IP`. Since
   Caddy sits between Cloudflare and Express, the proxy chain is Cloudflare → Caddy → Express.
   Set `app.set('trust proxy', 2)` so Express reads the correct client IP from
   `X-Forwarded-For` (Cloudflare sets the first hop, Caddy adds the second).
5. **Restrict origin firewall (UFW)** to Cloudflare IPs only for ports 80/443:
   ```bash
   # Fetch Cloudflare IP ranges
   curl -s https://www.cloudflare.com/ips-v4 | while read ip; do
     sudo ufw allow from $ip to any port 80,443 proto tcp
   done
   # Then deny direct access
   sudo ufw deny 80/tcp
   sudo ufw deny 443/tcp
   ```
   This ensures nobody can hit the origin by IP even if they discover it.

6. **Configure Cloudflare rate limiting rules** (5 free rules):
   - `/api/auth/login` → 10 req/15min per IP (mirror Express limiter)
   - `/api/auth/register` → 30 req/min per IP
   - `/api/*` → 300 req/min per IP (general)

### After Cloudflare

Once Cloudflare is in front:
- Remove `app.set('trust proxy', 1)` and set to `2`
- The Caddy timeouts still help for legitimate slow clients
- Express rate limiters remain as a defense-in-depth layer
- Monitor via Cloudflare Analytics (free) + the existing Discord health alerts

## Alternative: Caddy rate_limit Plugin

If Cloudflare is not desired, the `caddy-ratelimit` plugin can be compiled into
Caddy via `xcaddy`:

```bash
xcaddy build --with github.com/mholt/caddy-ratelimit
```

Then add to the Caddyfile:
```
rate_limit {
    zone api_zone {
        match {
            path /api/*
        }
        key {remote_host}
        events 300
        window 60s
    }
}
```

This is more operational overhead (custom binary, rebuild on Caddy updates) but
keeps everything self-hosted.
