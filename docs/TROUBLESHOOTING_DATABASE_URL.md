# Troubleshooting: DATABASE_URL Environment Variable Not Found

## Issue

When running Prisma commands (e.g., `npx prisma migrate reset --force`), you see this error:

```
Error: Prisma schema validation - (get-config wasm)
Error code: P1012
error: Environment variable not found: DATABASE_URL.
  -->  prisma/schema.prisma:10
   | 
 9 |   provider = "postgresql"
10 |   url      = env("DATABASE_URL")
   | 

Validation Error Count: 1
[Context: getConfig]
```

## Root Cause

The `.env` file is missing from the `/prototype/backend/` directory. This file contains the `DATABASE_URL` environment variable that Prisma needs to connect to the database.

The `.env` file is intentionally not tracked by git (it's in `.gitignore`) because it contains sensitive information like database credentials and JWT secrets.

## Solution

### Quick Fix

Run these commands from the project root:

```bash
cd prototype/backend
cp .env.example .env
```

This copies the example environment file to create your local `.env` file.

### Verify the Fix

After creating the `.env` file, verify it contains the DATABASE_URL:

```bash
cat prototype/backend/.env
```

You should see:

```
# Database
DATABASE_URL="postgresql://armouredsouls:password@localhost:5432/armouredsouls"

# JWT Secret
JWT_SECRET="your-secret-key-change-this-in-production"

# Server
PORT=3001
NODE_ENV=development
```

### Test Prisma Commands

Now Prisma commands should work:

```bash
cd prototype/backend
npx prisma validate
# Should output: "The schema at prisma/schema.prisma is valid 🚀"
```

## Complete Setup Process

If you're setting up the project for the first time, follow the complete setup guide:

1. **Start the database:**
   ```bash
   cd prototype
   docker compose up -d
   ```

2. **Setup backend environment:**
   ```bash
   cd backend
   cp .env.example .env
   npm install
   ```

3. **Run database migrations:**
   ```bash
   npx prisma generate
   npx prisma migrate reset --force
   ```

4. **Start the backend server:**
   ```bash
   npm run dev
   ```

For complete setup instructions, see:
- [README.md](../README.md) - Quick start guide
- [SETUP.md](SETUP.md) - Detailed setup guide

## Why This Happens

The `.env` file must be created manually because:

1. **Security**: The `.env` file contains secrets (JWT keys, database passwords) that should never be committed to git
2. **Flexibility**: Each developer may need different values (e.g., different database URLs)
3. **Best Practice**: Environment variables should be configured per environment (development, staging, production)

The `.env.example` file is committed to git as a template showing what variables are needed and their format.

## Related Issues

- If you're still getting connection errors after creating `.env`, ensure Docker is running: `docker compose ps`
- If Docker isn't running, start it: `docker compose up -d`
- Wait 10-15 seconds for PostgreSQL to be fully ready before running Prisma commands

## Further Help

For more troubleshooting information, see:
- [SETUP.md - Troubleshooting Section](SETUP.md#-troubleshooting)
- [README.md - Quick Start](../README.md#-quick-start)
