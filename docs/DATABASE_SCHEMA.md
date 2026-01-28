# Armoured Souls - Complete Database Schema 

**Last Updated**: January 27, 2026  
**Status**: Complete Database Schema, implemented on January 27, 2026 with commit acbcefc

**Purpose**: This document defines the COMPLETE database schema with ALL features from ROBOT_ATTRIBUTES.md, STABLE_SYSTEM.md, and all requirements discussed

---

## Document Purpose

This is the **comprehensive future-state database schema** that includes:
- ✅ All 23 robot attributes from ROBOT_ATTRIBUTES.md
- ✅ All 14 facilities with 10 levels from STABLE_SYSTEM.md
- ✅ Complete weapon system with all 10 weapons and full stats
- ✅ League tracking, damage tracking, repair costs, yield thresholds, stances
- ✅ All combat state fields (current HP, shields, damage taken)
- ✅ Loadout system (single, weapon+shield, two-handed, dual-wield)
- ✅ User stable system with prestige, credits, statistics
- ✅ Battle system with complete tracking
- ✅ Everything discussed in our conversation

**This schema represents the COMPLETE implementation - not just what's currently working in frontend and backend, but what NEEDS to be in the database for full functionality.**

---

## Core Principles

1. **Database-First Design**: Everything that will be needed goes in the database NOW
2. **Future-Proof**: Even if frontend/backend don't use it yet, it's in the schema
3. **Complete Robot State**: Damage tracking, repair costs, league info, fame, titles
4. **Comprehensive Weapons**: All attribute bonuses, loadout types, special properties
5. **14 Facilities**: All facility types with 10 levels each
6. **Time-Based Combat**: All fields needed for time-based combat simulation

---

## User Model (Stable)

Represents a player's stable (account) with all resources and statistics.

```prisma
model User {
  id              Int      @id @default(autoincrement())
  username        String   @unique @db.VarChar(50)
  passwordHash    String   @db.VarChar(255)
  role            String   @default("user") @db.VarChar(20)  // "user", "admin"
  
  // ===== RESOURCES =====
  currency        Int      @default(2000000)    // Credits (₡) - Starting: ₡2,000,000
  prestige        Int      @default(0)          // Stable reputation (earned, never spent)
  
  // ===== STABLE STATISTICS (Aggregated from robots) =====
  totalBattles    Int      @default(0)          // Lifetime battle count across all robots
  totalWins       Int      @default(0)          // Victory count across all robots
  highestELO      Int      @default(1200)       // Best ELO achieved by any robot in stable
  championshipTitles Int   @default(0)          // Tournament victories
  
  // ===== TIMESTAMPS =====
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  // ===== RELATIONS =====
  robots          Robot[]
  facilities      Facility[]
  weaponInventory WeaponInventory[]
  battles         Battle[] @relation("UserBattles")
  
  @@index([username])
}
```

**Notes**:
- Starting currency: ₡2,000,000 (allows 1-2 robots + facilities + weapons)
- Prestige: Earned from victories, never spent - used as unlock threshold
- Statistics are aggregated from all robots for stable-level tracking
- No stable-level league - leagues are per robot

---

## Robot Model

Represents an individual combat robot with all 23 attributes and complete state tracking.

```prisma
model Robot {
  id              Int      @id @default(autoincrement())
  userId          Int
  name            String   @db.VarChar(50)
  frameId         Int      @default(1)          // Chassis appearance ID
  paintJob        String?  @db.VarChar(100)     // Cosmetic customization
  
  // ===== 23 CORE ATTRIBUTES (Range: 1-50) =====
  
  // Combat Systems (6 attributes)
  combatPower         Int  @default(1)          // Base damage multiplier (all weapons)
  targetingSystems    Int  @default(1)          // Hit chance, accuracy
  criticalSystems     Int  @default(1)          // Critical hit chance
  penetration         Int  @default(1)          // Bypasses armor/shields
  weaponControl       Int  @default(1)          // Weapon handling, damage multiplier
  attackSpeed         Int  @default(1)          // Cooldown reduction
  
  // Defensive Systems (5 attributes)
  armorPlating        Int  @default(1)          // Physical damage reduction
  shieldCapacity      Int  @default(1)          // Max energy shield HP
  evasionThrusters    Int  @default(1)          // Dodge chance
  damageDampeners     Int  @default(1)          // Critical damage reduction
  counterProtocols    Int  @default(1)          // Counter-attack chance
  
  // Chassis & Mobility (5 attributes)
  hullIntegrity       Int  @default(1)          // Max HP (×10 formula)
  servoMotors         Int  @default(1)          // Movement speed, positioning
  gyroStabilizers     Int  @default(1)          // Balance, reaction time
  hydraulicSystems    Int  @default(1)          // Melee damage bonus, force
  powerCore           Int  @default(1)          // Energy shield regen rate
  
  // AI Processing (4 attributes)
  combatAlgorithms    Int  @default(1)          // Decision quality
  threatAnalysis      Int  @default(1)          // Target priority, positioning
  adaptiveAI          Int  @default(1)          // Learning over time
  logicCores          Int  @default(1)          // Performance under pressure
  
  // Team Coordination (3 attributes) - for 2v2, 3v3+ arena battles
  syncProtocols       Int  @default(1)          // Team damage multipliers
  supportSystems      Int  @default(1)          // Buff adjacent allies
  formationTactics    Int  @default(1)          // Formation bonuses
  
  // ===== COMBAT STATE =====
  currentHP           Int                       // Current health (max = hullIntegrity × 10)
  maxHP               Int                       // Max HP (calculated: hullIntegrity × 10)
  currentShield       Int                       // Current energy shield HP
  maxShield           Int                       // Max shield (calculated: shieldCapacity × 2)
  damageTaken         Int  @default(0)          // Damage since last repair
  
  // ===== PERFORMANCE TRACKING =====
  elo                 Int  @default(1200)       // Individual skill rating
  totalBattles        Int  @default(0)          // Lifetime battle count
  wins                Int  @default(0)          // Victory count
  losses              Int  @default(0)          // Defeat count
  damageDealtLifetime Int  @default(0)          // Total damage output
  damageTakenLifetime Int  @default(0)          // Total damage received
  kills               Int  @default(0)          // Opponents destroyed (0 HP)
  
  // ===== LEAGUE & FAME =====
  currentLeague       String  @default("bronze") @db.VarChar(20)     // bronze/silver/gold/platinum/diamond/champion
  leagueId            String  @default("bronze_1") @db.VarChar(30)   // Specific league instance (supports multiple Bronze leagues)
  leaguePoints        Int     @default(0)                             // Points for promotion/demotion
  fame                Int     @default(0)                             // Individual robot reputation
  titles              String? @db.Text                                // Comma-separated achievements
  
  // ===== ECONOMIC STATE =====
  repairCost          Int  @default(0)          // Cost to fully repair (formula-based)
  battleReadiness     Int  @default(100)        // Percentage (100% = full HP, 0% = critical)
  totalRepairsPaid    Int  @default(0)          // Lifetime repair costs
  
  // ===== PLAYER CONFIGURATION (Settings, NOT upgradeable attributes) =====
  yieldThreshold      Int  @default(10)         // HP % where robot surrenders (0-50%)
  loadoutType         String  @default("single") @db.VarChar(20)  // "single", "weapon_shield", "two_handed", "dual_wield"
  stance              String  @default("balanced") @db.VarChar(20) // "offensive", "defensive", "balanced"
  
  // ===== EQUIPMENT (Weapon Inventory System) =====
  mainWeaponId        Int?                      // Primary weapon (all loadouts)
  offhandWeaponId     Int?                      // Secondary weapon (dual-wield, weapon+shield)
  
  // ===== TIMESTAMPS =====
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  
  // ===== RELATIONS =====
  user                User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  mainWeapon          WeaponInventory?  @relation("MainWeapon", fields: [mainWeaponId], references: [id])
  offhandWeapon       WeaponInventory?  @relation("OffhandWeapon", fields: [offhandWeaponId], references: [id])
  battlesAsRobot1     Battle[] @relation("Robot1")
  battlesAsRobot2     Battle[] @relation("Robot2")
  
  @@index([userId])
  @@index([elo])
  @@index([currentLeague])
}
```

**Key Changes from Current Schema**:
- Added `maxHP` and `maxShield` fields (calculated fields, stored for performance)
- Added `mainWeaponId` and `offhandWeaponId` for loadout system
- Added `loadoutType` field for loadout configuration
- Added `leagueId` for multiple league instances (e.g., bronze_1, bronze_2)
- All 23 attributes present with correct names from ROBOT_ATTRIBUTES.md
- Complete combat state tracking (damage, repair costs, battle readiness)
- League and fame tracking at robot level

**Attribute Upgrade Cost Formula**:
```
cost = (current_level + 1) × 1,000
Example: Level 1→2 = ₡2,000, Level 49→50 = ₡50,000
```

**HP Calculation**:
```
maxHP = hullIntegrity × 10
maxShield = shieldCapacity × 2
```

**Repair Cost Formula**:
```
base_repair = (sum_of_all_23_attributes × 100)
damage_percentage = damageTaken / maxHP

if currentHP == 0 (destroyed):
    multiplier = 2.0
elif currentHP < (maxHP * 0.10) (heavily damaged):
    multiplier = 1.5
else:
    multiplier = 1.0

repairCost = base_repair × damage_percentage × multiplier
```

---

## Weapon Model (Catalog)

Represents weapon types available for purchase. Players buy weapons into inventory.

```prisma
model Weapon {
  id              Int      @id @default(autoincrement())
  name            String   @db.VarChar(100)
  weaponType      String   @db.VarChar(20)    // "energy", "ballistic", "melee", "shield"
  baseDamage      Int                          // Base damage value
  cooldown        Int                          // Seconds between attacks (time-based combat)
  cost            Int                          // Purchase cost in Credits
  handsRequired   String   @db.VarChar(10)    // "one", "two", "shield"
  damageType      String   @db.VarChar(20)    // "energy", "ballistic", "melee", "explosive"
  loadoutType     String   @db.VarChar(20)    // "single", "weapon_shield", "two_handed", "dual_wield", "any"
  specialProperty String?  @db.Text           // Special effects description
  description     String?  @db.Text           // Flavor text
  
  // ===== ATTRIBUTE BONUSES (Can be positive or negative) =====
  // Combat Systems
  combatPowerBonus        Int  @default(0)
  targetingSystemsBonus   Int  @default(0)
  criticalSystemsBonus    Int  @default(0)
  penetrationBonus        Int  @default(0)
  weaponControlBonus      Int  @default(0)
  attackSpeedBonus        Int  @default(0)
  
  // Defensive Systems
  armorPlatingBonus       Int  @default(0)
  shieldCapacityBonus     Int  @default(0)
  evasionThrustersBonus   Int  @default(0)
  damageDampenersBonus    Int  @default(0)
  counterProtocolsBonus   Int  @default(0)
  
  // Chassis & Mobility
  hullIntegrityBonus      Int  @default(0)
  servoMotorsBonus        Int  @default(0)
  gyroStabilizersBonus    Int  @default(0)
  hydraulicSystemsBonus   Int  @default(0)
  powerCoreBonus          Int  @default(0)
  
  // AI Processing
  combatAlgorithmsBonus   Int  @default(0)
  threatAnalysisBonus     Int  @default(0)
  adaptiveAIBonus         Int  @default(0)
  logicCoresBonus         Int  @default(0)
  
  // Team Coordination
  syncProtocolsBonus      Int  @default(0)
  supportSystemsBonus     Int  @default(0)
  formationTacticsBonus   Int  @default(0)
  
  // ===== TIMESTAMPS =====
  createdAt       DateTime @default(now())
  
  // ===== RELATIONS =====
  weaponInventory WeaponInventory[]
}
```

**Notes**:
- This is the **catalog** of available weapons
- Players purchase weapons from this catalog into their inventory
- `loadoutType` indicates which loadouts can use this weapon
- All 23 attribute bonuses match Robot attribute names exactly
- Bonuses can be negative for weapon trade-offs

---

## WeaponInventory Model

Represents individual weapon instances owned by users. Players buy weapons into inventory, then equip them to robots.

```prisma
model WeaponInventory {
  id              Int      @id @default(autoincrement())
  userId          Int
  weaponId        Int                           // Reference to Weapon catalog
  
  // Custom name (optional, for named weapons)
  customName      String?  @db.VarChar(100)
  
  // ===== TIMESTAMPS =====
  purchasedAt     DateTime @default(now())
  
  // ===== RELATIONS =====
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  weapon          Weapon   @relation(fields: [weaponId], references: [id])
  robotsMain      Robot[]  @relation("MainWeapon")
  robotsOffhand   Robot[]  @relation("OffhandWeapon")
  
  @@index([userId])
  @@index([weaponId])
}
```

**How Weapon System Works**:
1. User buys weapon from Weapon catalog (costs Credits)
2. Creates WeaponInventory entry
3. User equips weapon from inventory to robot via robot detail page
4. Same weapon instance can be equipped to multiple robots (buy multiple copies if needed)
5. Storage Facility limits how many weapons can be in inventory

---

## Facility Model

Represents stable-wide upgrades. All 14 facility types with 10 levels each.

```prisma
model Facility {
  id              Int      @id @default(autoincrement())
  userId          Int
  facilityType    String   @db.VarChar(50)     // See facility types below
  level           Int      @default(0)          // Current level (0-10, where 0 = not purchased)
  maxLevel        Int      @default(10)         // Maximum level (10 for most, 9 for Roster Expansion)
  
  // ===== COACHING STAFF SPECIFIC =====
  activeCoach     String?  @db.VarChar(50)     // For coaching_staff: active coach type
  
  // ===== TIMESTAMPS =====
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  // ===== RELATIONS =====
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([userId, facilityType])
  @@index([userId])
}
```

**14 Facility Types** (from STABLE_SYSTEM.md):

1. **repair_bay** - Reduces repair costs (10%, 15%, 20%, 25%, 30%, 35%, 40%, 45%, 50%, 55%)
2. **training_facility** - Reduces attribute upgrade costs (5%, 10%, 15%, 20%, 25%, 30%, 35%, 40%, 45%, 50%)
3. **weapons_workshop** - Weapon purchase discounts (10%, 15%, 20%, 25%, 30%, 35%, 40%, 45%, 50%, 55%)
4. **research_lab** - Battle analytics, loadout presets (3→8 presets)
5. **medical_bay** - Critical damage cost reduction (15%, 25%, 35%, 45%, 55%, 65%, 75%, 85%, 95%, 100%)
6. **roster_expansion** - Robot roster slots (1→10 robots, Level 0-9)
7. **storage_facility** - Weapon storage capacity (10→125 weapons)
8. **coaching_staff** - Hire coaches for stable-wide bonuses (+3%→+7% various attributes)
9. **booking_office** - Tournament access (Bronze→World Championship)
10. **combat_training_academy** - Combat Systems attribute caps (10→50 max)
11. **defense_training_academy** - Defensive Systems attribute caps (10→50 max)
12. **mobility_training_academy** - Chassis & Mobility attribute caps (10→50 max)
13. **ai_training_academy** - AI Processing + Team Coordination attribute caps (10→50 max)
14. **income_generator** - Additional revenue streams (merchandising + streaming)

**Facility Costs**: See STABLE_SYSTEM.md for complete cost breakdown per level

**Operating Costs**: Each facility has daily operating cost that scales with level

---

## Battle Model

Records battle results with complete state tracking for time-based combat.

```prisma
model Battle {
  id              Int      @id @default(autoincrement())
  userId          Int                           // Owner of this battle record
  robot1Id        Int                           // First combatant
  robot2Id        Int                           // Second combatant
  winnerId        Int?                          // Winner's robot ID (null if draw)
  battleType      String   @db.VarChar(20)     // "1v1", "2v2", "3v3", "tournament"
  leagueType      String   @db.VarChar(20)     // "bronze", "silver", "gold", etc.
  
  // ===== TIME-BASED COMBAT DATA =====
  battleLog       Json                          // Complete time-based combat simulation (events with timestamps)
  durationSeconds Int                           // Battle length in seconds
  
  // ===== ECONOMIC DATA =====
  winnerReward    Int?                          // Credits awarded to winner
  loserReward     Int?                          // Credits awarded to loser (can earn on loss)
  robot1RepairCost Int?                         // Repair cost for robot 1
  robot2RepairCost Int?                         // Repair cost for robot 2
  
  // ===== FINAL STATE =====
  robot1FinalHP   Int                           // Ending HP
  robot2FinalHP   Int                           // Ending HP
  robot1FinalShield Int                         // Ending energy shield HP
  robot2FinalShield Int                         // Ending energy shield HP
  robot1Yielded   Boolean @default(false)       // Did robot 1 surrender?
  robot2Yielded   Boolean @default(false)       // Did robot 2 surrender?
  robot1Destroyed Boolean @default(false)       // Did robot 1 reach 0 HP?
  robot2Destroyed Boolean @default(false)       // Did robot 2 reach 0 HP?
  
  // ===== DAMAGE TRACKING =====
  robot1DamageDealt Int                         // Total damage dealt by robot 1
  robot2DamageDealt Int                         // Total damage dealt by robot 2
  
  // ===== ELO TRACKING =====
  robot1ELOBefore Int                           // ELO before battle
  robot2ELOBefore Int                           // ELO before battle
  robot1ELOAfter  Int                           // ELO after battle
  robot2ELOAfter  Int                           // ELO after battle
  eloChange       Int                           // ELO delta (winner's perspective)
  
  // ===== TIMESTAMPS =====
  createdAt       DateTime @default(now())
  
  // ===== RELATIONS =====
  user            User   @relation("UserBattles", fields: [userId], references: [id], onDelete: Cascade)
  robot1          Robot  @relation("Robot1", fields: [robot1Id], references: [id])
  robot2          Robot  @relation("Robot2", fields: [robot2Id], references: [id])
  
  @@index([userId])
  @@index([robot1Id])
  @@index([robot2Id])
  @@index([createdAt])
}
```

**Battle Log Format** (JSON):
```json
{
  "events": [
    {
      "timestamp": 0.0,
      "type": "battle_start",
      "robot1HP": 250,
      "robot2HP": 300,
      "robot1Shield": 40,
      "robot2Shield": 50
    },
    {
      "timestamp": 2.5,
      "type": "attack",
      "attacker": "robot1",
      "defender": "robot2",
      "damage": 45,
      "shieldDamage": 30,
      "hpDamage": 15,
      "critical": false,
      "hit": true
    },
    // ... more events
    {
      "timestamp": 45.2,
      "type": "battle_end",
      "winner": "robot1",
      "reason": "robot2_yielded"
    }
  ]
}
```

---

## Complete Weapon Catalog (Seed Data)

All 10 weapons from ROBOT_ATTRIBUTES.md with complete specifications:

### Energy Weapons

**1. Laser Rifle** (₡150,000)
- Base Damage: 20
- Cooldown: 3 seconds
- Weapon Type: energy
- Hands Required: one
- Damage Type: energy
- Loadout Type: single, weapon_shield, dual_wield
- Attribute Bonuses:
  - targetingSystemsBonus: +3
  - weaponControlBonus: +4
  - attackSpeedBonus: +2
- Special: +15% accuracy bonus

**2. Plasma Cannon** (₡300,000)
- Base Damage: 40
- Cooldown: 5 seconds
- Weapon Type: energy
- Hands Required: two
- Damage Type: energy
- Loadout Type: two_handed
- Attribute Bonuses:
  - combatPowerBonus: +5
  - criticalSystemsBonus: +4
  - powerCoreBonus: -3
- Special: +20% vs energy shields

**3. Ion Beam** (₡400,000)
- Base Damage: 30
- Cooldown: 4 seconds
- Weapon Type: energy
- Hands Required: two
- Damage Type: energy
- Loadout Type: two_handed
- Attribute Bonuses:
  - penetrationBonus: +8
  - shieldCapacityBonus: +4
  - attackSpeedBonus: +3
- Special: Disables enemy energy shields for 2 seconds on crit

### Ballistic Weapons

**4. Machine Gun** (₡100,000)
- Base Damage: 12
- Cooldown: 2 seconds
- Weapon Type: ballistic
- Hands Required: one
- Damage Type: ballistic
- Loadout Type: single, weapon_shield, dual_wield
- Attribute Bonuses:
  - combatPowerBonus: +2
  - attackSpeedBonus: +6
  - weaponControlBonus: +3
- Special: Can fire burst (3 shots at 40% damage each)

**5. Railgun** (₡350,000)
- Base Damage: 50
- Cooldown: 6 seconds
- Weapon Type: ballistic
- Hands Required: two
- Damage Type: ballistic
- Loadout Type: two_handed
- Attribute Bonuses:
  - penetrationBonus: +12
  - targetingSystemsBonus: +5
  - attackSpeedBonus: -3
- Special: Ignores 50% of armor

**6. Shotgun** (₡120,000)
- Base Damage: 35
- Cooldown: 4 seconds
- Weapon Type: ballistic
- Hands Required: two
- Damage Type: ballistic
- Loadout Type: two_handed
- Attribute Bonuses:
  - combatPowerBonus: +4
  - criticalSystemsBonus: +5
  - targetingSystemsBonus: -3
- Special: +30% damage at close range

### Melee Weapons

**7. Power Sword** (₡180,000)
- Base Damage: 28
- Cooldown: 3 seconds
- Weapon Type: melee
- Hands Required: one
- Damage Type: melee
- Loadout Type: single, weapon_shield, dual_wield
- Attribute Bonuses:
  - hydraulicSystemsBonus: +6
  - counterProtocolsBonus: +5
  - gyroStabilizersBonus: +3
- Special: +25% counter damage

**8. Hammer** (₡200,000)
- Base Damage: 42
- Cooldown: 5 seconds
- Weapon Type: melee
- Hands Required: two
- Damage Type: melee
- Loadout Type: two_handed
- Attribute Bonuses:
  - hydraulicSystemsBonus: +8
  - combatPowerBonus: +6
  - servoMotorsBonus: -2
- Special: High impact force

**9. Plasma Blade** (₡250,000)
- Base Damage: 24
- Cooldown: 2.5 seconds
- Weapon Type: melee
- Hands Required: one
- Damage Type: melee
- Loadout Type: single, weapon_shield, dual_wield
- Attribute Bonuses:
  - hydraulicSystemsBonus: +4
  - attackSpeedBonus: +5
  - criticalSystemsBonus: +3
- Special: Burns through energy shields (70% effective vs shields)

### Shield Weapons

**10. Combat Shield** (₡100,000)
- Base Damage: 0
- Cooldown: 0 (defensive only)
- Weapon Type: shield
- Hands Required: shield
- Damage Type: none
- Loadout Type: weapon_shield
- Attribute Bonuses:
  - armorPlatingBonus: +8
  - counterProtocolsBonus: +6
  - evasionThrustersBonus: -2
  - shieldCapacityBonus: +5
- Special: 25% chance to block ranged attacks

---

## Seed Data Specification

### Users (6 test accounts)
- **admin** / admin123 (role: admin, credits: ₡10,000,000, prestige: 50000)
- **player1** / password123 (role: user, credits: ₡2,000,000, prestige: 0)
- **player2** / password123 (role: user, credits: ₡2,000,000, prestige: 0)
- **player3** / password123 (role: user, credits: ₡2,000,000, prestige: 0)
- **player4** / password123 (role: user, credits: ₡2,000,000, prestige: 0)
- **player5** / password123 (role: user, credits: ₡2,000,000, prestige: 0)

### Weapons (10 weapons from catalog above)
All 10 weapons should be created in the Weapon table with complete specifications

### Facilities
Create on-demand when user upgrades (starts at level 0 = not purchased)

---

## API Endpoints Reference

### Authentication
- POST /api/auth/login - Login
- POST /api/auth/logout - Logout
- GET /api/user/profile - Get current user profile

### Robots
- GET /api/robots - Get current user's robots
- GET /api/robots/all/robots - Get all robots from all users (leaderboard)
- POST /api/robots - Create new robot (costs ₡500,000)
- GET /api/robots/:id - Get specific robot details
- PUT /api/robots/:id/upgrade - Upgrade robot attribute (costs vary by level)
- PUT /api/robots/:id/weapon - Equip weapon to robot
- PUT /api/robots/:id/config - Update robot configuration (yield threshold, stance, loadout)
- POST /api/robots/:id/repair - Repair robot (costs based on damage)

### Facilities
- GET /api/facilities - Get user's facilities
- POST /api/facilities/upgrade - Upgrade a facility (costs vary by type and level)

### Weapons
- GET /api/weapons - List all weapons from catalog
- GET /api/weapon-inventory - Get user's weapon inventory
- POST /api/weapon-inventory/purchase - Purchase weapon (adds to inventory)
- DELETE /api/weapon-inventory/:id - Sell weapon from inventory

### Battles
- GET /api/battles - Get user's battle history
- GET /api/battles/:id - Get specific battle details
- POST /api/battles/simulate - Simulate battle between two robots

---

## Database Migration Strategy

### Phase 1: Create Complete Schema
1. Drop existing migrations folder
2. Create new base migration with COMPLETE schema
3. Run `npx prisma migrate dev --name complete_schema`
4. Run seed script with all 10 weapons

### Schema Updates (Prisma)
```bash
cd prototype/backend

# Delete old migrations
rm -rf prisma/migrations

# Create new base migration
npx prisma migrate dev --name complete_future_state_schema

# Seed database
npx prisma db seed
```

---

## Field Constraints & Validation

### String Enums (Application Layer)
- User.role: "user", "admin"
- Robot.currentLeague: "bronze", "silver", "gold", "platinum", "diamond", "champion"
- Robot.loadoutType: "single", "weapon_shield", "two_handed", "dual_wield"
- Robot.stance: "offensive", "defensive", "balanced"
- Weapon.weaponType: "energy", "ballistic", "melee", "shield"
- Weapon.handsRequired: "one", "two", "shield"
- Weapon.damageType: "energy", "ballistic", "melee", "explosive", "none"
- Weapon.loadoutType: "single", "weapon_shield", "two_handed", "dual_wield", "any"
- Battle.battleType: "1v1", "2v2", "3v3", "tournament"
- Facility.facilityType: See 14 facility types above

### Integer Ranges
- Robot Attributes (all 23): 1-50
- Robot.yieldThreshold: 0-50 (percentage)
- Robot.battleReadiness: 0-100 (percentage)
- Robot.elo: 800-2500 (typical range, no hard limits)
- Facility.level: 0-10 (0 = not purchased, 1-10 = upgrade levels)
- Facility.maxLevel: 10 for most facilities, 9 for roster_expansion

---

## Computed Fields (Not Stored)

These are calculated in application code:

**Robot**:
- `effectiveAttributes`: Base attributes + weapon bonuses + loadout bonuses + stance modifiers
- `winRate`: (wins / totalBattles) × 100
- `availableRobotSlots`: Based on roster_expansion facility level

**User**:
- `winRate`: (totalWins / totalBattles) × 100
- `activeRobots`: Count of user's robots
- `weaponStorageLimit`: Based on storage_facility level (10→125)

**Facility**:
- `upgradeCost`: Based on facility type and current level (see STABLE_SYSTEM.md)
- `operatingCost`: Based on facility type and level (see STABLE_SYSTEM.md)
- `discountPercentage`: For repair_bay, training_facility, weapons_workshop, medical_bay
- `bonusPercentage`: For coaching_staff bonuses

---

## Future Enhancements (Not in Current Schema)

These features are documented but not yet in the schema:

1. **Energy Barrier Shield Weapon** (₡200,000) - Not yet added to weapons
2. **Tournament System** - Separate Tournament model
3. **Team Battles** - 2v2, 3v3 team management
4. **Achievement System** - Achievement tracking
5. **Daily Income/Expense Report** - Income tracking
6. **Custom Weapon Design** - Weapon crafting system

---

## References

- **ROBOT_ATTRIBUTES.md**: Complete attribute system, combat formulas, weapon specifications
- **STABLE_SYSTEM.md**: 14 facilities, prestige system, daily income/expenses
- **DATABASE_SCHEMA.md**: Original schema document (may be outdated)
- **ROADMAP.md**: Implementation phases and priorities

