# Database Schema

**Last Updated**: January 25, 2026  
**Status**: Design Document - Authoritative Source for All Database Models

This document contains the complete, authoritative database schema for Armoured Souls. All models, fields, relationships, and constraints are defined here.

---

## Core Models

### User Model

**Purpose**: Represents a player's stable (account)

```prisma
model User {
  id              Int      @id @default(autoincrement())
  username        String   @unique
  passwordHash    String
  role            String   @default("user")     // "user", "admin"
  
  // Resources
  currency        Int      @default(2000000)    // Credits (₡) - Starting balance increased
  prestige        Int      @default(0)          // Stable reputation (never spent)
  
  // Statistics
  totalBattles    Int      @default(0)          // Aggregate of all robot battles
  totalWins       Int      @default(0)          // Aggregate of all robot wins
  highestELO      Int      @default(1200)       // Best ELO achieved by any robot
  
  // Timestamps
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  // Relations
  robots          Robot[]
  facilities      Facility[]
  battles         Battle[] @relation("UserBattles")
}
```

**Notes**:
- Starting currency increased from ₡1M to ₡2M to accommodate facility system
- Prestige is earned, never spent - used for unlocking content
- Statistics are aggregated from individual robots for overall stable performance
- No leagueTier at User level - leagues are per robot

---

### Robot Model

**Purpose**: Represents an individual combat robot

```prisma
model Robot {
  id              Int      @id @default(autoincrement())
  userId          Int
  name            String
  frameId         Int      @default(1)          // Chassis appearance identifier
  paintJob        String?                       // Cosmetic customization
  
  // ===== 23 CORE ATTRIBUTES =====
  
  // Combat Systems (6 attributes)
  combatPower         Int  @default(1)          // Base damage output (all weapons)
  targetingSystems    Int  @default(1)          // Hit chance, minor crit bonus
  criticalSystems     Int  @default(1)          // Critical hit chance
  penetration         Int  @default(1)          // Bypasses armor/shields
  weaponControl       Int  @default(1)          // Damage multiplier, handling
  attackSpeed         Int  @default(1)          // Cooldown reduction
  
  // Defensive Systems (5 attributes)
  armorPlating        Int  @default(1)          // Physical damage reduction
  shieldCapacity      Int  @default(1)          // Max energy shield HP
  evasionThrusters    Int  @default(1)          // Dodge chance
  damageDampeners     Int  @default(1)          // Critical damage reduction
  counterProtocols    Int  @default(1)          // Counter-attack chance
  
  // Chassis & Mobility (5 attributes)
  hullIntegrity       Int  @default(1)          // Max HP (×10)
  servoMotors         Int  @default(1)          // Positioning, movement
  gyroStabilizers     Int  @default(1)          // Dodge bonus, reaction time
  hydraulicSystems    Int  @default(1)          // Melee damage bonus
  powerCore           Int  @default(1)          // Energy shield regen rate
  
  // AI Processing (4 attributes)
  combatAlgorithms    Int  @default(1)          // Decision quality
  threatAnalysis      Int  @default(1)          // Positioning bonuses
  adaptiveAI          Int  @default(1)          // Learning (turn 3+)
  logicCores          Int  @default(1)          // Low HP performance, yield decisions
  
  // Team Coordination (3 attributes) - for 2v2, 3v3+ arena battles
  syncProtocols       Int  @default(1)          // Team damage multipliers
  supportSystems      Int  @default(1)          // Buff adjacent allies
  formationTactics    Int  @default(1)          // Formation bonuses
  
  // ===== COMBAT STATE =====
  
  currentHP           Int                       // Current health (set by formula on creation)
  currentShield       Int                       // Current energy shield HP
  damageTaken         Int  @default(0)          // Damage since last repair
  
  // ===== PERFORMANCE TRACKING =====
  
  elo                 Int  @default(1200)       // Individual skill rating
  totalBattles        Int  @default(0)          // Lifetime battle count
  wins                Int  @default(0)          // Victory count
  losses              Int  @default(0)          // Defeat count
  damageDealtLifetime Int  @default(0)          // Total damage dealt
  damageTakenLifetime Int  @default(0)          // Total damage received
  kills               Int  @default(0)          // Opponents destroyed (0 HP)
  
  // ===== LEAGUE & FAME =====
  
  currentLeague       String  @default("bronze")    // Bronze/Silver/Gold/Platinum/Diamond/Champion
  leagueId            String  @default("bronze_1")  // Specific league instance (e.g., "bronze_1", "bronze_2")
  leaguePoints        Int     @default(0)           // Points for promotion/demotion
  fame                Int     @default(0)           // Individual robot reputation
  titles              String?                       // Comma-separated achievements
  
  // ===== ECONOMIC STATE =====
  
  repairCost          Int  @default(0)          // Cost to fully repair
  battleReadiness     Int  @default(100)        // Percentage (100% = full HP)
  totalRepairsPaid    Int  @default(0)          // Lifetime repair costs
  
  // ===== CONFIGURATION (Not attributes - player settings) =====
  
  yieldThreshold      Int  @default(10)         // HP % where robot surrenders (0-50)
  loadout             String  @default("single")    // "weapon_shield", "two_handed", "dual_wield", "single"
  stance              String  @default("balanced")  // "offensive", "defensive", "balanced"
  
  // ===== EQUIPMENT =====
  
  weaponId            Int?                      // Equipped weapon
  secondWeaponId      Int?                      // For dual-wield loadout
  shieldId            Int?                      // For weapon_shield loadout (weapon type, not energy shield)
  
  // Timestamps
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  
  // Relations
  user                User     @relation(fields: [userId], references: [id])
  weapon              Weapon?  @relation("PrimaryWeapon", fields: [weaponId], references: [id])
  secondWeapon        Weapon?  @relation("SecondaryWeapon", fields: [secondWeaponId], references: [id])
  shield              Weapon?  @relation("ShieldWeapon", fields: [shieldId], references: [id])
  battlesAsRobot1     Battle[] @relation("Robot1")
  battlesAsRobot2     Battle[] @relation("Robot2")
}
```

**Notes**:
- All 23 attributes have mechanical effects in combat formulas (see ROBOT_ATTRIBUTES.md)
- `currentHP` calculated on creation: `hullIntegrity × 10`
- `currentShield` calculated on creation: `shieldCapacity × 2`
- `yieldThreshold`, `loadout`, and `stance` are player-controlled settings, NOT upgradeable attributes
- Leagues are per robot, not per stable - supports multiple Bronze leagues (identified by `leagueId`)
- Shield equipment (`shieldId`) refers to physical shield weapons, not energy shields
- Energy shields are represented by `currentShield` field (powered by `shieldCapacity` attribute)

---

### Weapon Model

**Purpose**: Represents weapons that robots can equip

```prisma
model Weapon {
  id              Int      @id @default(autoincrement())
  name            String
  weaponType      String                        // "energy", "ballistic", "melee", "shield"
  baseDamage      Int                           // Base damage value
  cooldown        Int                           // Seconds between attacks (time-based combat)
  cost            Int                           // Purchase cost in Credits
  handsRequired   String                        // "one", "two", "shield"
  damageType      String                        // "energy", "ballistic", "melee", "explosive"
  specialProperty String?                       // Optional special effects
  description     String?                       // Flavor text
  
  // Attribute Bonuses (can be positive or negative)
  // These modify robot attributes when weapon is equipped
  combatPowerBonus        Int  @default(0)
  targetingSystemsBonus   Int  @default(0)
  criticalSystemsBonus    Int  @default(0)
  penetrationBonus        Int  @default(0)
  weaponControlBonus      Int  @default(0)
  attackSpeedBonus        Int  @default(0)
  armorPlatingBonus       Int  @default(0)
  shieldCapacityBonus     Int  @default(0)
  evasionThrustersBonus   Int  @default(0)
  damageDampenersBonus    Int  @default(0)
  counterProtocolsBonus   Int  @default(0)
  servoMotorsBonus        Int  @default(0)
  gyroStabilizersBonus    Int  @default(0)
  hydraulicSystemsBonus   Int  @default(0)
  powerCoreBonus          Int  @default(0)
  
  // Relations
  robotsPrimary   Robot[] @relation("PrimaryWeapon")
  robotsSecondary Robot[] @relation("SecondaryWeapon")
  robotsShield    Robot[] @relation("ShieldWeapon")
}
```

**Notes**:
- `weaponType` "shield" indicates this is a physical shield weapon (for loadout "weapon_shield")
- `damageType` determines damage calculation (energy weapons get +20% vs energy shields)
- All attribute bonuses must match Robot attribute names exactly
- Bonuses can be negative for weapon trade-offs
- Physical shields have `weaponType: "shield"` and provide defensive bonuses
- Energy shields are a separate concept (robot's `currentShield` field)

---

### Battle Model

**Purpose**: Records battle results and statistics

```prisma
model Battle {
  id              Int      @id @default(autoincrement())
  userId          Int                           // Owner of this battle record
  robot1Id        Int                           // First combatant
  robot2Id        Int                           // Second combatant
  winnerId        Int?                          // Winner's robot ID (null if draw)
  battleType      String                        // "1v1", "2v2", "3v3", "tournament"
  
  // Battle Data
  battleLog       Json                          // Time-based combat simulation data (events with timestamps)
  durationSeconds Int                           // Battle length in seconds
  
  // Economic Data
  winnerReward    Int?                          // Credits awarded to winner
  loserReward     Int?                          // Credits awarded to loser
  robot1RepairCost Int?                         // Repair cost for robot 1
  robot2RepairCost Int?                         // Repair cost for robot 2
  
  // Results
  robot1FinalHP   Int                           // Ending HP
  robot2FinalHP   Int                           // Ending HP
  robot1Yielded   Boolean @default(false)       // Did robot 1 surrender?
  robot2Yielded   Boolean @default(false)       // Did robot 2 surrender?
  robot1Destroyed Boolean @default(false)       // Did robot 1 reach 0 HP?
  robot2Destroyed Boolean @default(false)       // Did robot 2 reach 0 HP?
  
  // ELO Changes
  robot1ELOBefore Int                           // ELO before battle
  robot2ELOBefore Int                           // ELO before battle
  robot1ELOAfter  Int                           // ELO after battle
  robot2ELOAfter  Int                           // ELO after battle
  
  // Timestamps
  createdAt       DateTime @default(now())
  
  // Relations
  user            User   @relation("UserBattles", fields: [userId], references: [id])
  robot1          Robot  @relation("Robot1", fields: [robot1Id], references: [id])
  robot2          Robot  @relation("Robot2", fields: [robot2Id], references: [id])
}
```

**Notes**:
- `battleLog` contains time-based combat simulation data with timestamped events
- Destroyed robots (0 HP) incur 2.0x repair cost multiplier
- Heavily damaged robots (HP < 10%) incur 1.5x repair cost multiplier
- Yielded robots (surrendered above 10% HP) pay normal repair costs
- ELO tracking allows for historical analysis

---

### Facility Model

**Purpose**: Represents stable-wide upgrades (facilities)

```prisma
model Facility {
  id              Int      @id @default(autoincrement())
  userId          Int
  facilityType    String                        // Facility category
  level           Int      @default(0)          // Current level (0-10)
  maxLevel        Int      @default(10)         // Maximum achievable level
  
  // Timestamps
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  // Relations
  user            User     @relation(fields: [userId], references: [id])
  
  @@unique([userId, facilityType])
}
```

**Facility Types** (14 total):
- `"repair_bay"` - Reduces repair costs
- `"training_facility"` - Reduces attribute upgrade costs
- `"weapons_workshop"` - Weapon discounts and crafting
- `"research_lab"` - Battle analytics, loadout presets
- `"medical_bay"` - Critical damage cost reduction
- `"roster_expansion"` - Increases robot slots (max 10)
- `"storage_facility"` - Weapon storage capacity
- `"coaching_staff"` - Hire coaches for stable-wide bonuses
- `"booking_office"` - Unlocks tournaments and prestige content
- `"combat_training_academy"` - Unlocks Combat Systems attribute caps (6 attributes)
- `"defense_training_academy"` - Unlocks Defensive Systems attribute caps (5 attributes)
- `"mobility_training_academy"` - Unlocks Chassis & Mobility attribute caps (5 attributes)
- `"ai_training_academy"` - Unlocks AI Processing + Team Coordination attribute caps (7 attributes)
- `"income_generator"` - Additional revenue streams (merchandising, streaming)

**Notes**:
- Each facility has 10 levels (0-10) for granular progression
- Some facilities require prestige thresholds to unlock upgrades
- Facilities have operating costs (see STABLE_SYSTEM.md)
- See STABLE_SYSTEM.md for detailed facility specifications and costs

---

## Relationships Summary

```
User (1) ──< (many) Robot
User (1) ──< (many) Facility
User (1) ──< (many) Battle

Robot (many) >── (1) Weapon [primary]
Robot (many) >── (0-1) Weapon [secondary, dual-wield only]
Robot (many) >── (0-1) Weapon [shield, weapon_shield loadout only]

Robot (many) >── (many) Battle [as robot1 or robot2]
```

---

## Field Constraints

### String Enums (Enforced in Application Layer)

**User.role**: `"user"`, `"admin"`

**Robot.currentLeague**: `"bronze"`, `"silver"`, `"gold"`, `"platinum"`, `"diamond"`, `"champion"`

**Robot.loadout**: `"weapon_shield"`, `"two_handed"`, `"dual_wield"`, `"single"`

**Robot.stance**: `"offensive"`, `"defensive"`, `"balanced"`

**Weapon.weaponType**: `"energy"`, `"ballistic"`, `"melee"`, `"shield"`

**Weapon.handsRequired**: `"one"`, `"two"`, `"shield"`

**Weapon.damageType**: `"energy"`, `"ballistic"`, `"melee"`, `"explosive"`

**Battle.battleType**: `"1v1"`, `"2v2"`, `"3v3"`, `"tournament"`

**Facility.facilityType**: See facility types list above

### Integer Constraints

**Robot Attributes**: Range 1-50 (enforced in application)
- All 23 core attributes: `combatPower`, `targetingSystems`, etc.

**Robot.yieldThreshold**: Range 0-50 (percentage)

**Robot.battleReadiness**: Range 0-100 (percentage)

**Robot.elo**: Typically 800-2500 (no hard limits, standard ELO scale)

**Facility.level**: Range 0-10 (0 = not purchased, 1-10 = upgrade levels)

---

## Indexes (Performance Optimization)

```prisma
// Recommended indexes for query performance
@@index([userId]) on Robot
@@index([elo]) on Robot
@@index([currentLeague]) on Robot
@@index([userId]) on Battle
@@index([robot1Id]) on Battle
@@index([robot2Id]) on Battle
@@index([userId, facilityType]) on Facility (unique constraint serves as index)
```

---

## Computed Fields (Application Layer)

These are NOT stored in database but calculated on-demand:

**Robot**:
- `maxHP`: Calculated as `hullIntegrity × 10`
- `maxShield`: Calculated as `shieldCapacity × 2`
- `winRate`: Calculated as `wins / totalBattles × 100`
- `effectiveAttributes`: Base attributes + weapon bonuses + loadout bonuses + stance modifiers

**User**:
- `winRate`: Calculated as `totalWins / totalBattles × 100`

---

## Migration Strategy

**Initial Setup** (No existing data):
1. Delete existing migrations folder (if any)
2. Copy complete schema to `prisma/schema.prisma`
3. Run `npx prisma migrate dev --name init`
4. Run seed script to populate test data

**For Production** (When data exists):
- NOT APPLICABLE - This is a prototype with no production data yet
- Future migrations will be handled incrementally

---

## See Also

- **ROBOT_ATTRIBUTES.md** - Complete attribute system and combat formulas
- **STABLE_SYSTEM.md** - Facility specifications and stable management
- **ROADMAP.md** - Implementation phases and priorities
- `/prototype/backend/prisma/schema.prisma` - Actual Prisma schema file
- `/prototype/backend/prisma/seed.ts` - Database seed script

---

**This is the authoritative source for all database schema information. All other documents reference this file for schema details.**
