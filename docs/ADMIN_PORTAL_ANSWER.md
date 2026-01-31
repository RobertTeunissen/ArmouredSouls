# Admin Portal - Question Answered

**Date**: January 31, 2026

---

## Your Question

> There is a mismatch somewhere. I think you try to provide access to the admin portal via the same URL as a normal user based on the role of the account. However, you provide a different port here, which does not work...
> 
> So: are there 2 separate portals, using the same account? Or is there one admin portal and one user portal with the same access path and based on the role additional functionality is unlocked?

---

## The Answer

**There is ONE single portal with role-based access**, not two separate portals.

### Architecture

```
Single Portal: http://localhost:3000
├── Login page (same for all users)
├── Regular features (all users)
│   ├── Dashboard
│   ├── My Robots
│   ├── Facilities
│   ├── Battle History
│   ├── League Standings
│   └── Weapon Shop
└── Admin Portal (ONLY admin users)
    └── ⚡ Admin link in navigation
        └── Admin controls page
```

### How It Works

1. **All users login at the same URL**: http://localhost:3000/login
2. **After login**:
   - Regular users (player1-5, test1-100) see normal navigation
   - Admin users see everything PLUS a **⚡ Admin** link (yellow text)
3. **Admin functionality** is unlocked by clicking the **⚡ Admin** link
4. **Access control** is enforced via JWT role checking

---

## The Port Mismatch (FIXED)

### What Was Wrong

The documentation incorrectly stated:
- ❌ Frontend runs on port **5173** (Vite's default)
- ❌ But we configured it to run on port **3000** in `vite.config.ts`

### What's Correct Now

- ✅ Frontend runs on port **3000**
- ✅ Backend runs on port **3001**
- ✅ All documentation updated
- ✅ Admin portal accessible at http://localhost:3000/admin

---

## How to Access Admin Portal

### Step-by-Step

1. **Start the application**:
   ```bash
   # Terminal 1: Backend
   cd prototype/backend
   npm run dev
   # Runs on http://localhost:3001

   # Terminal 2: Frontend
   cd prototype/frontend
   npm run dev
   # Runs on http://localhost:3000
   ```

2. **Login as admin**:
   - Go to: http://localhost:3000/login
   - Username: `admin`
   - Password: `admin123`
   - Click "Login"

3. **Look for the Admin link**:
   - After login, look at the navigation bar
   - On the RIGHT SIDE, you'll see: **⚡ Admin** (in yellow)
   - Click it!

4. **You're in the Admin Portal**:
   - URL: http://localhost:3000/admin
   - You'll see:
     - System statistics
     - Admin control buttons
     - Bulk cycle testing

---

## What You Can Do in Admin Portal

### System Statistics
- Total robots and battle-ready percentage
- Robots by tier (Bronze, Silver, Gold, etc.)
- Scheduled/completed matches
- Battle statistics

### One-Click Controls
- 🔧 **Auto-Repair All Robots** - Restore all HP to 100%
- 🎯 **Run Matchmaking** - Create matches for all tiers
- ⚔️ **Execute Battles** - Run all scheduled battles
- 📊 **Rebalance Leagues** - Trigger promotions/demotions

### Bulk Cycle Testing
- Run 1-100 complete daily cycles
- Optional auto-repair before each cycle
- See detailed results for each cycle
- Monitor progress in real-time

---

## Why You Didn't See Admin Functionality Before

### The Problem

When you logged in as admin, you didn't see any admin-specific features because:

1. **The Admin UI didn't exist yet** - It was only accessible via API
2. **No visual indicator** - Nothing showed you were logged in as admin
3. **Port confusion** - Documentation said 5173, but app ran on 3000

### The Solution (NOW IMPLEMENTED)

1. ✅ **Created Admin Portal page** - Full UI for admin controls
2. ✅ **Added Admin navigation link** - Visible only to admin users
3. ✅ **Fixed port numbers** - All documentation now correct
4. ✅ **Added visual indicators** - Admin link in yellow, easy to spot

---

## Regular Users vs Admin Users

### Regular User (player1, player2, etc.)
```
Navigation:
[Dashboard] [Facilities] [My Robots] [Battle History] [Leagues] [Weapon Shop]
```
**NO Admin link visible**

### Admin User
```
Navigation:
[Dashboard] [Facilities] [My Robots] [Battle History] [Leagues] [Weapon Shop] [⚡ Admin]
                                                                               ^^^^^^^^
                                                                               ONLY ADMINS SEE THIS!
```

---

## Test It Now

**Quick Test:**

1. Login as admin at http://localhost:3000/login
   - Username: `admin`
   - Password: `admin123`

2. After login, look at navigation bar (right side)

3. Click **⚡ Admin** (yellow text)

4. You're in! Try clicking:
   - "Refresh Stats" to see system state
   - "Auto-Repair All Robots" to restore HP
   - "Run Matchmaking" to create matches
   - "Execute Battles" to run battles

**Verify Regular Users Don't See It:**

1. Logout

2. Login as player1:
   - Username: `player1`
   - Password: `password123`

3. Look at navigation - NO **⚡ Admin** link!

---

## Summary

✅ **ONE portal**, not two  
✅ **Same login** for everyone  
✅ **Same URL**: http://localhost:3000  
✅ **Admin users** see extra **⚡ Admin** link  
✅ **Regular users** don't see it  
✅ **Port mismatch fixed**: 3000 (not 5173)  
✅ **Admin UI** now fully functional  

**You can now access the admin portal!** 🎉

