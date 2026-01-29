# Troubleshooting Guide

## Installation Issues

### Problem: "Generating client into node_modules/@prisma/client is not allowed"

This error occurs when Prisma's client generation tries to write to a restricted location. This commonly happens after:
- Upgrading/downgrading Prisma versions
- Corrupted node_modules
- Interrupted installations

#### Solution: Complete Clean Installation

Follow these steps **in order** to fix your installation:

```bash
# 1. Navigate to the backend directory
cd prototype/backend

# 2. Remove all generated and installed files
rm -rf node_modules package-lock.json
rm -rf node_modules/.prisma
rm -rf node_modules/@prisma

# 3. Install dependencies (this may take a few minutes)
npm install

# 4. Generate Prisma Client
npx prisma generate

# 5. Reset and seed the database (if needed)
npx prisma migrate reset --force

# 6. Start the development server
npm run dev
```

#### Expected Output

After running `npx prisma generate`, you should see:
```
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma

✔ Generated Prisma Client (v5.20.0) to ./node_modules/@prisma/client in XXXms
```

#### Common Mistakes to Avoid

1. **Typo in package name**: Make sure you type `prisma` not `prima`
2. **Don't manually edit schema.prisma output path**: The default configuration is correct
3. **Always use exact commands**: Don't skip the `rm -rf` step - it's crucial
4. **Check your .env file**: Ensure `DATABASE_URL` is correctly configured

### Problem: Database Connection Issues

If you see errors about connecting to the database:

```bash
# 1. Ensure Docker containers are running
cd prototype
docker-compose up -d

# 2. Wait a few seconds for PostgreSQL to start
sleep 5

# 3. Verify the connection
cd backend
npx prisma db push
```

### Problem: "Cannot convert undefined or null to object" during prisma generate

This error typically means:
- Your Prisma schema has a syntax error
- Environment variables are not loaded correctly

**Solution:**

```bash
# 1. Verify your .env file exists and has DATABASE_URL
cat .env | grep DATABASE_URL

# 2. If missing, copy from example
cp .env.example .env

# 3. Edit .env with your database credentials
nano .env
```

### Problem: Login Not Working After Prisma Upgrade

If you can't log in after a Prisma upgrade/downgrade:

```bash
# The database schema and client are out of sync
# Run a complete reset:

cd prototype/backend
npx prisma migrate reset --force
```

**Warning:** This will delete all data in your database and reseed it with default values.

---

## Development Workflow

### Starting Fresh

```bash
# 1. Start database
cd prototype
docker-compose up -d

# 2. Install and setup backend
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

### After Pulling New Changes

```bash
cd prototype/backend

# If schema.prisma changed:
npx prisma generate
npx prisma migrate dev

# If dependencies changed:
npm install
```

---

## Getting Help

If you're still experiencing issues after following this guide:

1. Check the [GitHub Issues](https://github.com/RobertTeunissen/ArmouredSouls/issues)
2. Include the **full terminal output** when asking for help
3. Mention which steps you've already tried
