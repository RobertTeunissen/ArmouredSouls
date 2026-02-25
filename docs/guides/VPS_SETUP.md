# Armoured Souls — VPS Setup Guide

Step-by-step guide for provisioning a Scaleway DEV1-S instance from scratch. Written for developers managing a raw VPS for the first time.

---

## 1. Create a Scaleway Instance

1. Sign in at [console.scaleway.com](https://console.scaleway.com)
2. Go to **Instances → Create Instance**
3. Select:
   - **Type**: DEV1-S (2 vCPU, 2 GB RAM, 20 GB SSD)
   - **Image**: Ubuntu 22.04 LTS
   - **Region**: Choose the region closest to your players (e.g. `nl-ams-1` for Europe)
4. Under **SSH Keys**, add your public key (see next section if you don't have one)
5. Name the instance (e.g. `armouredsouls-acc` or `armouredsouls-prd`)
6. Click **Create Instance** and note the public IP address

## 2. SSH Key Setup

If you don't already have an SSH key pair:

```bash
ssh-keygen -t ed25519 -C "your-email@example.com"
# Accept default path (~/.ssh/id_ed25519), set a passphrase if desired
```

Copy the public key to Scaleway via the console, or if the instance is already running:

```bash
ssh-copy-id root@YOUR_VPS_IP
```

Connect for the first time:

```bash
ssh root@YOUR_VPS_IP
```

## 3. System Updates

```bash
apt update && apt upgrade -y
```

## 4. Create Deploy User

Never run your application as root. Create a dedicated `deploy` user:

```bash
adduser deploy
usermod -aG sudo deploy
```

Copy your SSH key to the new user:

```bash
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

Test login in a new terminal before closing the root session:

```bash
ssh deploy@YOUR_VPS_IP
sudo whoami  # Should print: root
```

Optional — disable root SSH login:

```bash
sudo sed -i 's/^PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart sshd
```

## 5. Firewall Setup (UFW)

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (Caddy redirect)
sudo ufw allow 443/tcp   # HTTPS
sudo ufw --force enable
sudo ufw status
```

Expected output:

```
Status: active
To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere
80/tcp                     ALLOW       Anywhere
443/tcp                    ALLOW       Anywhere
```

## 6. Install Docker & Docker Compose

```bash
# Install Docker
curl -fsSL https://get.docker.com | sudo sh

# Add deploy user to docker group (no sudo needed for docker commands)
sudo usermod -aG docker deploy

# Log out and back in for group change to take effect
exit
ssh deploy@YOUR_VPS_IP

# Verify
docker --version
docker compose version
```

## 7. Install Node.js 18 via nvm

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Reload shell
source ~/.bashrc

# Install Node.js 18
nvm install 18
nvm alias default 18

# Verify
node --version   # v18.x.x
npm --version
```

## 8. Install PM2

```bash
npm install -g pm2

# Verify
pm2 --version
```

Set PM2 to start on boot:

```bash
pm2 startup
# Follow the printed command (copy-paste and run it)
```

## 9. Install Caddy

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

Verify:

```bash
caddy version
```

## 10. Create Directory Structure

```bash
sudo mkdir -p /opt/armouredsouls/{backend,frontend,scripts,backups}
sudo chown -R deploy:deploy /opt/armouredsouls
```

Create the log directory for PM2:

```bash
sudo mkdir -p /var/log/armouredsouls
sudo chown deploy:deploy /var/log/armouredsouls
```

## 11. Start PostgreSQL

Copy the production Docker Compose file to the server (CI/CD does this later, but for initial setup):

```bash
# On your local machine:
scp prototype/docker-compose.production.yml deploy@YOUR_VPS_IP:/opt/armouredsouls/
```

On the VPS, create the `.env` file first (see next step), then start PostgreSQL:

```bash
cd /opt/armouredsouls
docker compose -f docker-compose.production.yml up -d
```

Verify it's running:

```bash
docker ps
# Should show armouredsouls-db-prod with status "healthy"
```

## 12. Configure Environment Variables

Copy the example env file and fill in real values:

```bash
# On your local machine:
scp prototype/backend/.env.production.example deploy@YOUR_VPS_IP:/opt/armouredsouls/backend/.env
```

On the VPS, edit the `.env` file:

```bash
nano /opt/armouredsouls/backend/.env
```

Required changes:

| Variable | What to set |
|----------|-------------|
| `DATABASE_URL` | Use the password you chose for `POSTGRES_PASSWORD` |
| `JWT_SECRET` | Generate with `openssl rand -hex 32` |
| `CORS_ORIGIN` | Your domain(s), e.g. `https://acc.armouredsouls.com` |
| `POSTGRES_PASSWORD` | A strong password (used by Docker Compose) |

The `POSTGRES_USER`, `POSTGRES_DB`, and schedule variables can stay at their defaults unless you have a reason to change them.

## 13. Configure Caddy

Copy the Caddyfile:

```bash
# On your local machine:
scp prototype/Caddyfile deploy@YOUR_VPS_IP:/etc/caddy/Caddyfile
```

Edit to set your domain:

```bash
sudo nano /etc/caddy/Caddyfile
```

Replace `{$DOMAIN:localhost}` with your actual domain:

```
acc.armouredsouls.com {
    # ... rest stays the same
}
```

Restart Caddy:

```bash
sudo systemctl restart caddy
sudo systemctl status caddy
```

Caddy automatically provisions SSL certificates from Let's Encrypt. Make sure your domain's DNS A record points to the VPS IP before restarting Caddy.

## 14. Set Up Automated Backups

Copy the backup script:

```bash
# On your local machine:
scp prototype/scripts/backup.sh deploy@YOUR_VPS_IP:/opt/armouredsouls/scripts/
scp prototype/scripts/restore.sh deploy@YOUR_VPS_IP:/opt/armouredsouls/scripts/
```

Make executable and set up the daily cron job:

```bash
chmod +x /opt/armouredsouls/scripts/backup.sh
chmod +x /opt/armouredsouls/scripts/restore.sh

# Add daily backup at 2:00 AM
crontab -e
```

Add this line:

```
0 2 * * * /opt/armouredsouls/scripts/backup.sh >> /var/log/armouredsouls/backup.log 2>&1
```

## 15. Verify Everything

Run through this checklist:

```bash
# Docker running
docker ps

# Node.js available
node --version

# PM2 available
pm2 --version

# Caddy running
sudo systemctl status caddy

# Firewall active
sudo ufw status

# Directory structure
ls -la /opt/armouredsouls/

# Database accessible
docker exec armouredsouls-db-prod pg_isready -U as_prd
```

Your VPS is now ready for deployment. See [DEPLOYMENT.md](DEPLOYMENT.md) for deploying the application.
