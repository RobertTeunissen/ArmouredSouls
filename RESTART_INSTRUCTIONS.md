# Backend Restart Instructions

## The Problem

The backend is running OLD compiled code from before the purchase tracking changes were made. Even though the code has been updated and compiled, the running server hasn't loaded the new code yet.

## What's Already Fixed (in the compiled code)

✅ Robot creation logging - READY
✅ Attribute upgrade logging - READY  
✅ Weapon purchase logging - READY
✅ Facility purchase logging - READY
✅ Cycle 0 purchase aggregation - READY

All the code is written, compiled, and ready to go. It just needs the backend to restart.

## Step-by-Step Restart Process

### 1. Stop the Backend

In your terminal where the backend is running:
- Press `Ctrl+C` to stop the server
- Or if it's running in the background, find and kill the process:
  ```bash
  # Find the process
  lsof -i :3001
  
  # Kill it (replace PID with the actual process ID)
  kill -9 <PID>
  ```

### 2. Start the Backend Fresh

```bash
cd prototype/backend
npm run dev
```

Wait for the message: `Server running on port 3001`

### 3. Reset the Database

```bash
# In a new terminal
cd prototype/backend
npm run reset-db
```

This will:
- Drop all tables
- Run migrations
- Run seed file
- Create fresh test data

### 4. Test the New Logging

Now when you:

1. **Create robots** through the UI
   - Go to http://localhost:3000/robots
   - Click "Create Robot"
   - Name it and create
   - ✅ Should log `credit_change` event with -₡500,000

2. **Upgrade attributes**
   - Select a robot
   - Click upgrade on any attribute
   - ✅ Should log `attribute_upgrade` event with cost
   - ✅ Should log `credit_change` event

3. **Buy weapons**
   - Go to weapon shop
   - Purchase a weapon
   - ✅ Should log `weapon_purchase` event
   - ✅ Should log `credit_change` event

4. **Buy/upgrade facilities**
   - Go to facilities page
   - Purchase or upgrade
   - ✅ Should log `facility_purchase`/`facility_upgrade` event
   - ✅ Should log `credit_change` event

### 5. Run Cycle 1

```bash
# Or use the admin UI
curl -X POST http://localhost:3001/api/admin/run-cycle
```

### 6. Check Cycle Summary

Go to http://localhost:3000/cycle-summary

You should now see:
- **Purchases column** showing the total of all purchases
- **Hover tooltip** showing breakdown (weapons, facilities, robots, upgrades)
- **Accurate net profit** = Income - Expenses - Purchases

### Expected Results for Player1

If you:
- Created 2 robots (₡1,000,000)
- Bought 4 weapons (₡752,000 with discount)
- Bought 2 facilities (₡250,000)
- Upgraded 1 facility (₡200,000)
- Upgraded attributes (varies)

Cycle 1 should show approximately ₡2,200,000+ in purchases.

## Verification

To verify the logging is working, check the audit log:

```bash
cd prototype/backend
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const events = await prisma.auditLog.findMany({
    where: { cycleNumber: 0 },
    orderBy: { sequenceNumber: 'asc' }
  });
  
  console.log('Cycle 0 events:', events.length);
  
  const byType = {};
  events.forEach(e => {
    byType[e.eventType] = (byType[e.eventType] || 0) + 1;
  });
  
  console.log('By type:', byType);
  
  await prisma.\$disconnect();
})();
"
```

You should see:
- `weapon_purchase` events
- `facility_purchase` events
- `facility_upgrade` events
- `attribute_upgrade` events
- `credit_change` events

## Troubleshooting

### Still not logging?

1. **Check the compiled code has the changes:**
   ```bash
   cd prototype/backend
   grep "Log robot creation" dist/routes/robots.js
   grep "Log attribute upgrade" dist/routes/robots.js
   ```
   Both should return results.

2. **Check the backend is using the new code:**
   - Look at the backend console logs
   - You should see event logging messages when making purchases

3. **Rebuild if needed:**
   ```bash
   cd prototype/backend
   npm run build
   # Then restart the backend
   ```

### Database issues?

If you get database errors:
```bash
cd prototype/backend
npx prisma migrate reset --force
```

This will completely reset and reseed the database.

## Summary

The code is ready. Just:
1. **Stop backend** (Ctrl+C)
2. **Start backend** (`npm run dev`)
3. **Reset database** (`npm run reset-db`)
4. **Test purchases** - they should now be logged
5. **Run cycle** - purchases should appear in cycle summary

That's it!
