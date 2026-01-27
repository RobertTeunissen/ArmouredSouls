# Database Schema - Comprehensive Single-Source-of-Truth

**Last Updated**: January 27, 2026
**Status**: AUTHORITATIVE - Complete, consistent schema for ONE database
**Purpose**: After multiple schema/database mismatches, this document defines the EXACT database state

---

## 🚨 CRITICAL NOTES

**This schema represents the ACTUAL database state after running the 4 official migrations:**
1. `20260125213123_` - Initial schema
2. `20260125213329_add_facilities` - Adds facilities table
3. `20260126181101_update_schema_to_match_docs` - Renames attributes, adds WeaponInventory
4. `20260127000000_add_loadout_type_to_weapons` - Adds loadoutType to weapons table

**What this schema DOES NOT have (yet):**
- `stableName` on User model (not implemented - removed in reverts)
- `mainWeaponId` / `offhandWeaponId` / `loadoutType` on Robot model (not migrated - planned for future)
- Dashboard robots table (UI feature, not database)

**What this schema DOES have:**
- Simple weapon system: Robot has ONE `weaponInventoryId` link
- Weapon model has `loadoutType` field (for future dual-weapon system)
- 23 robot attributes with correct names
- 4 facility types with 5 levels each
- User starts with ₡2,000,000

---

## Complete Prisma Schema

```prisma
// This is your Prisma schema file

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           Int      @id @default(autoincrement())
  username     String   @unique @db.VarChar(50)
  passwordHash String   @map("password_hash") @db.VarChar(255)
  role         String   @default("user") @db.VarChar(20)  // "user" or "admin"
  currency     Int      @default(2000000)  // Starting balance: ₡2,000,000
  prestige     Int      @default(0)        // Stable reputation (never spent)
  createdAt    DateTime @default(now()) @map("created_at")
  
  robots          Robot[]
  facilities      Facility[]
  weaponInventory WeaponInventory[]
  
  @@map("users")
}

model Facility {
  id           Int      @id @default(autoincrement())
  userId       Int      @map("user_id")
  facilityType String   @map("facility_type") @db.VarChar(50)
  level        Int      @default(0)  // 0-5 (0 = not purchased, 1-5 = upgrade levels)
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")
  
  user         User     @relation(fields: [userId], references: [id])
  
  @@unique([userId, facilityType])
  @@map("facilities")
}

model Robot {
  id                  Int      @id @default(autoincrement())
  userId              Int      @map("user_id")
  name                String   @db.VarChar(100)
  weaponInventoryId   Int?     @map("weapon_inventory_id")  // Link to user's weapon inventory (SIMPLE system)
  elo                 Int      @default(1200)  // ELO is robot-level, not user-level
  
  // Combat Systems (6 attributes)
  combatPower         Int      @default(1) @map("combat_power")
  targetingSystems    Int      @default(1) @map("targeting_systems")
  criticalSystems     Int      @default(1) @map("critical_systems")
  penetration         Int      @default(1)
  weaponControl       Int      @default(1) @map("weapon_control")
  attackSpeed         Int      @default(1) @map("attack_speed")
  
  // Defensive Systems (5 attributes)
  armorPlating        Int      @default(1) @map("armor_plating")
  shieldCapacity      Int      @default(1) @map("shield_capacity")
  evasionThrusters    Int      @default(1) @map("evasion_thrusters")
  damageDampeners     Int      @default(1) @map("damage_dampeners")
  counterProtocols    Int      @default(1) @map("counter_protocols")
  
  // Chassis & Mobility (5 attributes)
  hullIntegrity       Int      @default(1) @map("hull_integrity")
  servoMotors         Int      @default(1) @map("servo_motors")
  gyroStabilizers     Int      @default(1) @map("gyro_stabilizers")
  hydraulicSystems    Int      @default(1) @map("hydraulic_systems")
  powerCore           Int      @default(1) @map("power_core")
  
  // AI Processing (4 attributes)
  combatAlgorithms    Int      @default(1) @map("combat_algorithms")
  threatAnalysis      Int      @default(1) @map("threat_analysis")
  adaptiveAI          Int      @default(1) @map("adaptive_ai")
  logicCores          Int      @default(1) @map("logic_cores")
  
  // Team Coordination (3 attributes)
  syncProtocols       Int      @default(1) @map("sync_protocols")
  supportSystems      Int      @default(1) @map("support_systems")
  formationTactics    Int      @default(1) @map("formation_tactics")
  
  createdAt           DateTime @default(now()) @map("created_at")
  
  user                User             @relation(fields: [userId], references: [id])
  weaponInventory     WeaponInventory? @relation(fields: [weaponInventoryId], references: [id])
  
  battlesAsRobot1     Battle[] @relation("Robot1Battles")
  battlesAsRobot2     Battle[] @relation("Robot2Battles")
  battlesWon          Battle[] @relation("WinnerBattles")
  
  @@map("robots")
}

model WeaponInventory {
  id          Int      @id @default(autoincrement())
  userId      Int      @map("user_id")
  weaponId    Int      @map("weapon_id")
  purchasedAt DateTime @default(now()) @map("purchased_at")
  
  user        User     @relation(fields: [userId], references: [id])
  weapon      Weapon   @relation(fields: [weaponId], references: [id])
  robots      Robot[]  // Weapons can be equipped to robots
  
  @@map("weapon_inventory")
}

model Weapon {
  id              Int      @id @default(autoincrement())
  name            String   @db.VarChar(100)
  weaponType      String   @db.VarChar(20) @map("weapon_type") // 'energy', 'ballistic', 'melee', 'explosive'
  loadoutType     String   @db.VarChar(20) @map("loadout_type") // 'single', 'two-handed', 'dual-wield', 'weapon+shield'
  description     String?  @db.Text
  baseDamage      Int      @map("base_damage")
  cost            Int      // Cost in Credits to purchase
  
  // Attribute Bonuses (can be negative for penalties)
  combatPowerBonus        Int      @default(0) @map("combat_power_bonus")
  targetingSystemsBonus   Int      @default(0) @map("targeting_systems_bonus")
  criticalSystemsBonus    Int      @default(0) @map("critical_systems_bonus")
  penetrationBonus        Int      @default(0) @map("penetration_bonus")
  weaponControlBonus      Int      @default(0) @map("weapon_control_bonus")
  attackSpeedBonus        Int      @default(0) @map("attack_speed_bonus")
  armorPlatingBonus       Int      @default(0) @map("armor_plating_bonus")
  shieldCapacityBonus     Int      @default(0) @map("shield_capacity_bonus")
  evasionThrustersBonus   Int      @default(0) @map("evasion_thrusters_bonus")
  counterProtocolsBonus   Int      @default(0) @map("counter_protocols_bonus")
  servoMotorsBonus        Int      @default(0) @map("servo_motors_bonus")
  gyroStabilizersBonus    Int      @default(0) @map("gyro_stabilizers_bonus")
  hydraulicSystemsBonus   Int      @default(0) @map("hydraulic_systems_bonus")
  powerCoreBonus          Int      @default(0) @map("power_core_bonus")
  threatAnalysisBonus     Int      @default(0) @map("threat_analysis_bonus")
  
  createdAt       DateTime @default(now()) @map("created_at")
  
  inventory       WeaponInventory[]
  
  @@map("weapons")
}

model Battle {
  id               Int      @id @default(autoincrement())
  robot1Id         Int      @map("robot1_id")
  robot2Id         Int      @map("robot2_id")
  winnerId         Int?     @map("winner_id")
  
  battleLog        Json     @map("battle_log")
  
  turnsTaken       Int?     @map("turns_taken")
  robot1DamageDealt Int?    @map("robot1_damage_dealt")
  robot2DamageDealt Int?    @map("robot2_damage_dealt")
  
  // Battle rewards and costs
  winnerReward     Int?     @map("winner_reward")
  loserReward      Int?     @map("loser_reward")
  robot1RepairCost Int?     @map("robot1_repair_cost")
  robot2RepairCost Int?     @map("robot2_repair_cost")
  
  createdAt        DateTime @default(now()) @map("created_at")
  
  robot1           Robot    @relation("Robot1Battles", fields: [robot1Id], references: [id])
  robot2           Robot    @relation("Robot2Battles", fields: [robot2Id], references: [id])
  winner           Robot?   @relation("WinnerBattles", fields: [winnerId], references: [id])
  
  @@map("battles")
}
```

---

## Facility Types (4 facilities, 5 levels each)

| Facility Type | Key | Max Level | Effect |
|---------------|-----|-----------|--------|
| Repair Bay | `repair_bay` | 5 | 10%/15%/20%/25%/30% discount on repair costs |
| Training Facility | `training_facility` | 5 | 5%/10%/15%/20%/25% discount on attribute upgrades |
| Weapons Workshop | `weapons_workshop` | 5 | 10%/20%/30%/40%/50% discount on weapon purchases |
| Roster Expansion | `roster_expansion` | 5 | 2/3/4/5/6 robot slots (level 0 = 1 slot) |

**Implementation Notes:**
- Level 0 means facility not purchased yet
- Levels 1-5 provide incremental benefits
- All discounts calculated in backend before displaying costs to user
- Roster expansion enforced when creating robots

---

## Database State After Migrations

**Tables Created:**
1. `users` - User accounts
2. `facilities` - User's facility upgrades
3. `robots` - Combat robots (with 23 attributes)
4. `weapon_inventory` - User's purchased weapons
5. `weapons` - Weapon catalog
6. `battles` - Battle records

**Columns on robots table:**
- Basic: `id`, `user_id`, `name`, `weapon_inventory_id`, `elo`, `created_at`
- Combat (6): `combat_power`, `targeting_systems`, `critical_systems`, `penetration`, `weapon_control`, `attack_speed`
- Defense (5): `armor_plating`, `shield_capacity`, `evasion_thrusters`, `damage_dampeners`, `counter_protocols`
- Chassis (5): `hull_integrity`, `servo_motors`, `gyro_stabilizers`, `hydraulic_systems`, `power_core`
- AI (4): `combat_algorithms`, `threat_analysis`, `adaptive_ai`, `logic_cores`
- Team (3): `sync_protocols`, `support_systems`, `formation_tactics`

**Columns on weapons table:**
- Basic: `id`, `name`, `weapon_type`, `loadout_type`, `description`, `base_damage`, `cost`, `created_at`
- Bonuses (15): `combat_power_bonus`, `targeting_systems_bonus`, etc.

**Foreign Keys:**
- `robots.user_id` → `users.id`
- `robots.weapon_inventory_id` → `weapon_inventory.id` (nullable)
- `facilities.user_id` → `users.id`
- `weapon_inventory.user_id` → `users.id`
- `weapon_inventory.weapon_id` → `weapons.id`
- `battles.robot1_id` → `robots.id`
- `battles.robot2_id` → `robots.id`
- `battles.winner_id` → `robots.id` (nullable)

---

## Seed Data

**Users (6):**
- `player1` through `player6` (password: `password123`)
- `admin` (password: `admin123`, role: "admin")
- All start with ₡2,000,000

**Weapons (10):**
1. Plasma Rifle (energy, single, ₡150k)
2. Gatling Cannon (ballistic, single, ₡180k)
3. Laser Sword (melee, single, ₡120k)
4. Rocket Launcher (explosive, two-handed, ₡250k)
5. Dual Pistols (ballistic, dual-wield, ₡200k)
6. Energy Shield (energy, weapon+shield, ₡130k)
7. Machine Gun (ballistic, single, ₡160k)
8. Flame Thrower (explosive, single, ₡170k)
9. Sniper Rifle (ballistic, two-handed, ₡220k)
10. Power Fist (melee, single, ₡140k)

All weapons have `loadoutType` field set appropriately.

**Facilities:**
- Created on-demand when user upgrades (starts at level 0)

**Robots:**
- None created by default (user creates them)

---

## API Endpoints (Verified Working)

### Auth
- `POST /api/auth/login` - Login with username/password
- `POST /api/auth/logout` - Logout (clears session)

### User
- `GET /api/user/profile` - Get current user profile (username, role, prestige, currency)

### Robots
- `GET /api/robots` - Get current user's robots
- `GET /api/robots/all/robots` - Get all robots from all users (leaderboard)
- `POST /api/robots` - Create new robot (costs ₡500k, requires name)
- `GET /api/robots/:id` - Get specific robot details
- `PUT /api/robots/:id/upgrade` - Upgrade robot attribute
- `PUT /api/robots/:id/weapon` - Equip weapon to robot

### Facilities
- `GET /api/facilities` - Get user's facilities
- `POST /api/facilities/upgrade` - Upgrade a facility

### Weapons
- `GET /api/weapons` - List all weapons in catalog
- `GET /api/weapon-inventory` - Get user's purchased weapons
- `POST /api/weapon-inventory/purchase` - Purchase weapon from catalog

---

## Common Pitfalls (Lessons Learned)

### ❌ What Went Wrong Multiple Times

1. **Schema/Database Mismatch**: Added fields to Prisma schema WITHOUT creating migrations
   - Result: "column does not exist" errors
   - Solution: ALWAYS create migration when adding/removing fields

2. **Wrong API Endpoints**: Frontend calling endpoints that don't match backend routes
   - Wrong: `/api/buildings` (doesn't exist)
   - Right: `/api/facilities`
   - Wrong: `/api/all/robots` (doesn't exist)
   - Right: `/api/robots/all/robots`

3. **Field Naming Inconsistency**: Schema uses camelCase, database uses snake_case
   - Wrong: Querying `weaponsWorkshop` (doesn't exist)
   - Right: Querying `weapons_workshop` (matches database)
   - Solution: Use `@map` in Prisma schema

4. **Stale Prisma Client**: Schema changes not reflected in generated client
   - Solution: Run `npx prisma generate` after schema changes

5. **Missing .env File**: Backend can't connect to database
   - Solution: Always ensure `.env` file exists with `DATABASE_URL`

### ✅ Correct Workflow

1. **Make schema changes** in `prisma/schema.prisma`
2. **Create migration**: `npx prisma migrate dev --name description_of_change`
3. **Generate client**: `npx prisma generate` (usually automatic)
4. **Update backend code** to use new fields
5. **Update frontend** to match backend API
6. **Test with** `npx prisma migrate reset --force` to verify clean state

---

## Testing Instructions

### Full Clean Setup

```bash
cd prototype/backend

# Ensure .env exists
cp .env.example .env

# Reset database (drops, recreates, migrates, seeds)
npx prisma migrate reset --force

# Regenerate Prisma Client
npx prisma generate

# Start backend
npm run dev
```

### Frontend Setup

```bash
cd prototype/frontend

# Start frontend
npm run dev
```

### Verification

1. Open http://localhost:3000
2. Login with `player1` / `password123`
3. Should see dashboard with ₡2,000,000
4. Click "Upgrade Facilities" - should see 4 facilities at level 0
5. Click "Create Robot" - should be able to create robot for ₡500k
6. Navigate to "My Robots" - should see created robot
7. Navigate to "Weapon Shop" - should see 10 weapons

---

## Future Enhancements (Not Yet Implemented)

### Stable Naming System
- Add `stableName` field to User model (nullable)
- Create migration to add column
- Add `/api/user/stable-name` PUT endpoint
- Optional field in dashboard (not blocking modal)

### Dual Weapon System
- Add `mainWeaponId`, `offhandWeaponId`, `loadoutType` to Robot model
- Create migration to add columns
- Update robot creation/update endpoints
- Update frontend to support dual weapon selection
- Weapon `loadoutType` field already exists and ready

### Dashboard Robots Table
- Frontend feature only (no database changes)
- Query robots with stats
- Display in dashboard

---

## Maintenance

**When to Update This Document:**
- Any time a migration is created
- Any time the Prisma schema changes
- Any time API endpoints change
- Any time seed data changes

**This document is the SINGLE SOURCE OF TRUTH for the database schema.**

---

Last Updated: January 27, 2026 - After identifying and fixing schema/database mismatches
