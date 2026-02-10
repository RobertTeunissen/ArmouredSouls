# Complete Database Schema 

**Project**: Armoured Souls  
**Document Type**: Product Requirements Document (PRD)  
**Last Updated**: February 9, 2026  
**Status**: Current Implementation  
**Version**: v1.2

---

## Version History
- v1.0 - First draft
- v1.1 - Review done by Robert Teunissen
- v1.2 - Updated to match current implementation (Decimal attributes, HP formula, tournament system, v1.2 weapon pricing)

---

## Document Purpose

This document defines the **complete database schema** for Armoured Souls, including:
- ✅ All 23 robot attributes (Decimal type for fractional values)
- ✅ All 14 facilities with 10 levels
- ✅ Complete weapon system (23 weapons in catalog)
- ✅ League tracking, damage tracking, repair costs, yield thresholds, stances
- ✅ All combat state fields (current HP, shields, damage taken)
- ✅ Loadout system (single, weapon+shield, two-handed, dual-wield)
- ✅ User stable system with prestige, credits, statistics
- ✅ Battle system with complete tracking
- ✅ Tournament system (single elimination, brackets, matches)
- ✅ Matchmaking system (scheduled matches, cycle metadata)

**This schema represents the CURRENT implementation** as of February 9, 2026.

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
  currency        Int      @default(3000000)    // Credits (₡) - Starting: ₡3,000,000
  prestige        Int      @default(0)          // Stable reputation (earned, never spent) - See PRD_PRESTIGE_AND_FAME.md
  
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
  
  // ===== 23 CORE ATTRIBUTES (Range: 1.00-50.00, precision 2 decimals) =====
  
  // Combat Systems (6 attributes)
  combatPower         Decimal  @default(1.00) @db.Decimal(5, 2)  // Base damage multiplier (all weapons)
  targetingSystems    Decimal  @default(1.00) @db.Decimal(5, 2)  // Hit chance, accuracy
  criticalSystems     Decimal  @default(1.00) @db.Decimal(5, 2)  // Critical hit chance
  penetration         Decimal  @default(1.00) @db.Decimal(5, 2)  // Bypasses armor/shields
  weaponControl       Decimal  @default(1.00) @db.Decimal(5, 2)  // Weapon handling, damage multiplier
  attackSpeed         Decimal  @default(1.00) @db.Decimal(5, 2)  // Cooldown reduction
  
  // Defensive Systems (5 attributes)
  armorPlating        Decimal  @default(1.00) @db.Decimal(5, 2)  // Physical damage reduction
  shieldCapacity      Decimal  @default(1.00) @db.Decimal(5, 2)  // Max energy shield HP
  evasionThrusters    Decimal  @default(1.00) @db.Decimal(5, 2)  // Dodge chance
  damageDampeners     Decimal  @default(1.00) @db.Decimal(5, 2)  // Critical damage reduction
  counterProtocols    Decimal  @default(1.00) @db.Decimal(5, 2)  // Counter-attack chance
  
  // Chassis & Mobility (5 attributes)
  hullIntegrity       Decimal  @default(1.00) @db.Decimal(5, 2)  // Max HP (50 + hull × 5 formula)
  servoMotors         Decimal  @default(1.00) @db.Decimal(5, 2)  // Movement speed, positioning
  gyroStabilizers     Decimal  @default(1.00) @db.Decimal(5, 2)  // Balance, reaction time
  hydraulicSystems    Decimal  @default(1.00) @db.Decimal(5, 2)  // Melee damage bonus, force
  powerCore           Decimal  @default(1.00) @db.Decimal(5, 2)  // Energy shield regen rate
  
  // AI Processing (4 attributes)
  combatAlgorithms    Decimal  @default(1.00) @db.Decimal(5, 2)  // Decision quality
  threatAnalysis      Decimal  @default(1.00) @db.Decimal(5, 2)  // Target priority, positioning
  adaptiveAI          Decimal  @default(1.00) @db.Decimal(5, 2)  // Learning over time
  logicCores          Decimal  @default(1.00) @db.Decimal(5, 2)  // Performance under pressure
  
  // Team Coordination (3 attributes) - for 2v2, 3v3+ arena battles
  syncProtocols       Decimal  @default(1.00) @db.Decimal(5, 2)  // Team damage multipliers
  supportSystems      Decimal  @default(1.00) @db.Decimal(5, 2)  // Buff adjacent allies
  formationTactics    Decimal  @default(1.00) @db.Decimal(5, 2)  // Formation bonuses
  
  // ===== COMBAT STATE =====
  currentHP           Int                       // Current health (max = 50 + hullIntegrity × 5)
  maxHP               Int                       // Max HP (calculated: 50 + hullIntegrity × 5)
  currentShield       Int                       // Current energy shield HP
  maxShield           Int                       // Max shield (calculated: shieldCapacity × 2)
  damageTaken         Int  @default(0)          // Damage since last repair
  
  // ===== PERFORMANCE TRACKING =====
  elo                 Int  @default(1200)       // Individual skill rating
  totalBattles        Int  @default(0)          // Lifetime battle count
  wins                Int  @default(0)          // Victory count
  draws               Int  @default(0)          // Draw count
  losses              Int  @default(0)          // Defeat count
  damageDealtLifetime Int  @default(0)          // Total damage output
  damageTakenLifetime Int  @default(0)          // Total damage received
  kills               Int  @default(0)          // Opponents destroyed (0 HP)
  
  // ===== LEAGUE & FAME =====
  currentLeague         String  @default("bronze") @db.VarChar(20)     // bronze/silver/gold/platinum/diamond/champion
  leagueId              String  @default("bronze_1") @db.VarChar(30)   // Specific league instance (supports multiple Bronze leagues)
  leaguePoints          Int     @default(0)                             // Points for promotion/demotion
  cyclesInCurrentLeague Int     @default(0)                             // Number of cycles robot has been in current league
  fame                  Int     @default(0)                             // Individual robot reputation - See PRD_PRESTIGE_AND_FAME.md
  titles                String? @db.Text                                // Comma-separated achievements
  
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
  user                      User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  mainWeapon                WeaponInventory?  @relation("MainWeapon", fields: [mainWeaponId], references: [id])
  offhandWeapon             WeaponInventory?  @relation("OffhandWeapon", fields: [offhandWeaponId], references: [id])
  battlesAsRobot1           Battle[]          @relation("Robot1")
  battlesAsRobot2           Battle[]          @relation("Robot2")
  scheduledMatchesAsRobot1  ScheduledMatch[]  @relation("ScheduledRobot1")
  scheduledMatchesAsRobot2  ScheduledMatch[]  @relation("ScheduledRobot2")
  tournamentsWon            Tournament[]      @relation("TournamentWinner")
  tournamentMatchesAsRobot1 TournamentMatch[] @relation("TournamentRobot1")
  tournamentMatchesAsRobot2 TournamentMatch[] @relation("TournamentRobot2")
  tournamentMatchesWon      TournamentMatch[] @relation("TournamentMatchWinner")
  
  @@unique([userId, name])
  @@index([userId])
  @@index([elo])
  @@index([currentLeague])
  @@index([currentLeague, leagueId])
}
```

**Key Schema Features**:
- All 23 attributes use `Decimal(5,2)` type for fractional values (e.g., 1.50, 10.25)
- `maxHP` and `maxShield` fields stored for performance (calculated from attributes)
- `mainWeaponId` and `offhandWeaponId` for loadout system
- `loadoutType` field for loadout configuration
- `leagueId` for multiple league instances (e.g., bronze_1, bronze_2)
- `cyclesInCurrentLeague` tracks league tenure for promotion/demotion
- `draws` field added for draw tracking
- Unique constraint on `[userId, name]` ensures unique robot names per user
- Complete combat state tracking (damage, repair costs, battle readiness)
- League and fame tracking at robot level

**Attribute Upgrade Cost Formula** (Updated Feb 8, 2026):
```
cost = (current_level + 1) × 1,500
Example: Level 1→2 = ₡3,000, Level 49→50 = ₡75,000
```

**HP Calculation**:
```
maxHP = 50 + (hullIntegrity × 5)
maxShield = shieldCapacity × 2

Examples:
- Hull Integrity 1.00: HP = 50 + 5 = 55
- Hull Integrity 10.00: HP = 50 + 50 = 100
- Shield Capacity 1.00: Shield = 2
- Shield Capacity 10.00: Shield = 20
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

**Current Implementation**: 23 weapons across all loadout types (v1.2 pricing)

**For complete weapon specifications, damage values, and pricing methodology, see:**
- **[WEAPONS_AND_LOADOUT.md](../WEAPONS_AND_LOADOUT.md)** - Complete weapon catalog with v1.2 pricing
- **[PRD_WEAPON_ECONOMY_OVERHAUL.md](../PRD_WEAPON_ECONOMY_OVERHAUL.md)** - Pricing formula and economy design
- **[SEED_DATA_SPECIFICATION.md](SEED_DATA_SPECIFICATION.md)** - Complete seed data including all 23 weapons

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
- This is the **catalog** of available weapons (23 total in current implementation)
- Players purchase weapons from this catalog into their inventory
- `loadoutType` indicates which loadouts can use this weapon
- All 23 attribute bonuses match Robot attribute names exactly
- Bonuses can be negative for weapon trade-offs
- Weapons are populated during database seeding (see SEED_DATA_SPECIFICATION.md)

**Weapon Distribution by Loadout Type**:
- **Single Loadout**: 15 one-handed weapons (Practice Sword, Machine Pistol, Laser Pistol, Combat Knife, Machine Gun, Burst Rifle, Assault Rifle, Energy Blade, Laser Rifle, Plasma Blade, Plasma Rifle, Power Sword, and others)
- **Weapon + Shield**: 15 one-handed weapons + 3 shields (Light Shield, Combat Shield, Reactive Shield)
- **Two-Handed**: 8 weapons (Shotgun, Grenade Launcher, Sniper Rifle, Battle Axe, Plasma Cannon, Heavy Hammer, Railgun, Ion Beam)
- **Dual-Wield**: 15 one-handed weapons (same as single loadout)

---

## WeaponInventory Model

Represents individual weapon instances owned by users. Players buy weapons into inventory, then equip them to robots.

**For weapon ownership rules and inventory management, see [WEAPONS_AND_LOADOUT.md](WEAPONS_AND_LOADOUT.md)**

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
4. Each weapon instance can only be equipped to ONE robot at a time
5. To use same weapon on multiple robots, purchase multiple copies
6. Storage Facility limits how many weapons can be in inventory (5 base + 5 per level)

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

1. **repair_bay** - Reduces repair costs (5%, 15%, 20%, 25%, 30%, 35%, 40%, 45%, 50%, 50%)
2. **training_facility** - Reduces attribute upgrade costs (5%, 10%, 15%, 20%, 25%, 30%, 35%, 40%, 45%, 50%)
3. **weapons_workshop** - Weapon purchase discounts (5%, 10%, 15%, 20%, 25%, 30%, 35%, 40%, 45%, 50%)
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
  battleType      String   @db.VarChar(20)     // "league", "tournament"
  leagueType      String   @db.VarChar(20)     // "bronze", "silver", "gold", etc.
  
  // ===== TOURNAMENT REFERENCE (optional) =====
  tournamentId    Int?                          // Links to tournament if this is a tournament battle
  tournamentRound Int?                          // Round number in tournament
  
  // ===== TIME-BASED COMBAT DATA =====
  battleLog       Json                          // Complete time-based combat simulation (events with timestamps)
  durationSeconds Int                           // Battle length in seconds
  
  // ===== ECONOMIC DATA =====
  winnerReward     Int?                         // Credits awarded to winner
  loserReward      Int?                         // Credits awarded to loser (can earn on loss)
  robot1RepairCost Int?                         // Repair cost for robot 1
  robot2RepairCost Int?                         // Repair cost for robot 2
  
  // ===== BATTLE REWARDS TRACKING =====
  robot1PrestigeAwarded Int @default(0)        // Prestige awarded to robot 1's user
  robot2PrestigeAwarded Int @default(0)        // Prestige awarded to robot 2's user
  robot1FameAwarded     Int @default(0)        // Fame awarded to robot 1
  robot2FameAwarded     Int @default(0)        // Fame awarded to robot 2
  
  // ===== FINAL STATE =====
  robot1FinalHP     Int                         // Ending HP
  robot2FinalHP     Int                         // Ending HP
  robot1FinalShield Int                         // Ending energy shield HP
  robot2FinalShield Int                         // Ending energy shield HP
  robot1Yielded     Boolean @default(false)     // Did robot 1 surrender?
  robot2Yielded     Boolean @default(false)     // Did robot 2 surrender?
  robot1Destroyed   Boolean @default(false)     // Did robot 1 reach 0 HP?
  robot2Destroyed   Boolean @default(false)     // Did robot 2 reach 0 HP?
  
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
  user              User              @relation("UserBattles", fields: [userId], references: [id], onDelete: Cascade)
  robot1            Robot             @relation("Robot1", fields: [robot1Id], references: [id])
  robot2            Robot             @relation("Robot2", fields: [robot2Id], references: [id])
  tournament        Tournament?       @relation("TournamentBattles", fields: [tournamentId], references: [id])
  scheduledMatch    ScheduledMatch[]
  tournamentMatches TournamentMatch[]
  
  @@index([userId])
  @@index([robot1Id])
  @@index([robot2Id])
  @@index([createdAt])
  @@index([tournamentId])
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

## ScheduledMatch Model

Tracks scheduled matchmaking battles for league play.

```prisma
model ScheduledMatch {
  id           Int      @id @default(autoincrement())
  robot1Id     Int                           // First combatant
  robot2Id     Int                           // Second combatant
  leagueType   String   @db.VarChar(20)     // "bronze", "silver", "gold", etc.
  scheduledFor DateTime                      // When the match should be executed
  status       String   @default("scheduled") @db.VarChar(20)  // "scheduled", "completed", "cancelled"
  battleId     Int?                          // Links to Battle after completion
  createdAt    DateTime @default(now())
  
  // ===== RELATIONS =====
  robot1 Robot   @relation("ScheduledRobot1", fields: [robot1Id], references: [id])
  robot2 Robot   @relation("ScheduledRobot2", fields: [robot2Id], references: [id])
  battle Battle? @relation(fields: [battleId], references: [id])
  
  @@index([robot1Id])
  @@index([robot2Id])
  @@index([scheduledFor, status])
  @@index([status])
}
```

**Notes**:
- Created by matchmaking system during cycle execution
- Links to Battle record after match is executed
- Status tracks lifecycle: scheduled → completed/cancelled

---

## CycleMetadata Model

Singleton table tracking global cycle state for admin operations.

```prisma
model CycleMetadata {
  id          Int       @id @default(1)      // Singleton: always ID 1
  totalCycles Int       @default(0)          // Total cycles executed
  lastCycleAt DateTime?                      // Timestamp of last cycle
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}
```

**Notes**:
- Singleton table (only one record with id=1)
- Tracks cycle execution for matchmaking system
- Created during seed, auto-created if missing in admin routes

---

## Tournament System Models

### Tournament Model

Tracks competitive elimination tournaments.

```prisma
model Tournament {
  id             Int    @id @default(autoincrement())
  name           String @db.VarChar(100)     // "Tournament #1", "Grand Championship"
  tournamentType String @db.VarChar(50)      // "single_elimination", "double_elimination", "swiss"
  status         String @default("pending") @db.VarChar(20)  // "pending", "active", "completed"
  
  // ===== PROGRESSION TRACKING =====
  currentRound      Int @default(1)          // Current round number (1-based)
  maxRounds         Int                      // Total rounds (calculated from participants)
  totalParticipants Int                      // Number of robots at start
  
  // ===== WINNER TRACKING =====
  winnerId Int?                              // Winner's robot ID (null until completed)
  
  // ===== TIMESTAMPS =====
  createdAt   DateTime  @default(now())
  startedAt   DateTime?                      // When first round started
  completedAt DateTime?                      // When tournament finished
  
  // ===== RELATIONS =====
  winner  Robot?            @relation("TournamentWinner", fields: [winnerId], references: [id])
  matches TournamentMatch[]
  battles Battle[]          @relation("TournamentBattles")
  
  @@index([status])
  @@index([winnerId])
}
```

### TournamentMatch Model

Tracks individual battles within a tournament bracket.

```prisma
model TournamentMatch {
  id           Int @id @default(autoincrement())
  tournamentId Int                           // Parent tournament
  round        Int                           // Round number (1 = first round, 2 = quarter-finals, etc.)
  matchNumber  Int                           // Position in round (1, 2, 3, ...)
  
  // ===== PARTICIPANTS =====
  robot1Id Int?                              // Null for placeholder matches
  robot2Id Int?                              // Null for bye matches or placeholders
  
  // ===== RESULT =====
  winnerId   Int?                            // Winner's robot ID (null until completed)
  battleId   Int?    @unique                 // Links to Battle record
  status     String  @default("pending") @db.VarChar(20)  // "pending", "scheduled", "completed"
  isByeMatch Boolean @default(false)         // True if robot advances without battle
  
  // ===== TIMESTAMPS =====
  createdAt   DateTime  @default(now())
  completedAt DateTime?
  
  // ===== RELATIONS =====
  tournament Tournament @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  robot1     Robot?     @relation("TournamentRobot1", fields: [robot1Id], references: [id])
  robot2     Robot?     @relation("TournamentRobot2", fields: [robot2Id], references: [id])
  winner     Robot?     @relation("TournamentMatchWinner", fields: [winnerId], references: [id])
  battle     Battle?    @relation(fields: [battleId], references: [id])
  
  @@index([tournamentId, round])
  @@index([status])
  @@index([robot1Id])
  @@index([robot2Id])
}
```

**Notes**:
- Tournament system supports single elimination brackets
- Bye matches handle odd-number participants
- Each match links to a Battle record for combat details
- Cascade delete ensures cleanup when tournament is deleted

---

## Seed Data

For complete seed data specifications including all 23 weapons, test users, and initial data, see:

**[SEED_DATA_SPECIFICATION.md](SEED_DATA_SPECIFICATION.md)**

**Summary**:
- 23 weapons in catalog (v1.2 pricing)
- 144 user accounts (admin, players, test users, attribute-focused, loadout-focused, bye-robot)
- 471 robots for testing
- CycleMetadata singleton initialized

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
4. Run seed script with all 11 weapons

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
- Battle.battleType: "league", "tournament"
- ScheduledMatch.status: "scheduled", "completed", "cancelled"
- Tournament.status: "pending", "active", "completed"
- Tournament.tournamentType: "single_elimination", "double_elimination", "swiss"
- TournamentMatch.status: "pending", "scheduled", "completed"
- Facility.facilityType: See 14 facility types above

### Numeric Ranges
- Robot Attributes (all 23): 1.00-50.00 (Decimal with 2 decimal places)
- Robot.yieldThreshold: 0-50 (percentage, integer)
- Robot.battleReadiness: 0-100 (percentage, integer)
- Robot.elo: 800-2500 (typical range, no hard limits, integer)
- Facility.level: 0-10 (0 = not purchased, 1-10 = upgrade levels, integer)
- Facility.maxLevel: 10 for most facilities, 9 for roster_expansion (integer)

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

These features are planned but not yet implemented:

1. **Team Battles** - 2v2, 3v3 team management models
2. **Achievement System** - Achievement tracking tables
3. **Daily Income/Expense Report** - Income tracking and reporting
4. **Custom Weapon Design** - Weapon crafting system
5. **Double Elimination Tournaments** - Extended tournament bracket support
6. **Swiss Tournament Format** - Round-robin style tournament support

---

## Related Documentation

### Core Schema Documents
- **[COMBAT_FORMULAS.md](COMBAT_FORMULAS.md)** - Combat calculations and damage formulas
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture overview
- **[SEED_DATA_SPECIFICATION.md](SEED_DATA_SPECIFICATION.md)** - Complete seed data specification

### Feature Specifications
- **[WEAPONS_AND_LOADOUT.md](../WEAPONS_AND_LOADOUT.md)** - Complete weapon system, loadout configurations
- **[ROBOT_ATTRIBUTES.md](../ROBOT_ATTRIBUTES.md)** - 23 robot attributes and combat mechanics
- **[STABLE_SYSTEM.md](../STABLE_SYSTEM.md)** - 14 facilities, prestige formulas, stable management
- **[PRD_PRESTIGE_AND_FAME.md](../PRD_PRESTIGE_AND_FAME.md)** - Prestige and Fame system specification

### Implementation Details
- **[PRD_WEAPON_ECONOMY_OVERHAUL.md](../PRD_WEAPON_ECONOMY_OVERHAUL.md)** - Weapon pricing methodology
- **[MATCHMAKING_SYSTEM_GUIDE.md](../MATCHMAKING_SYSTEM_GUIDE.md)** - Matchmaking and cycle system
- **[ROADMAP.md](../ROADMAP.md)** - Implementation phases and priorities

