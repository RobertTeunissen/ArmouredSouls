# Complete Database Schema 

**Project**: Armoured Souls  
**Document Type**: Product Requirements Document (PRD)  
**Last Updated**: April 2, 2026  
**Status**: Current Implementation  
**Version**: v2.0

---

## Version History
- v1.0 - First draft
- v1.1 - Review done by Robert Teunissen
- v1.2 - Updated to match current implementation (Decimal attributes, HP formula, tournament system, v1.2 weapon pricing)
- v1.3 - Added onboarding tracking fields to User model (7 new columns for tutorial system) and ResetLog table for account reset tracking
- v1.4 - Added King of the Hill (KotH) tables: ScheduledKothMatch, ScheduledKothMatchParticipant. Extended Robot model with 8 KotH cumulative stat fields. Added KotH relation on Battle model.
- v2.0 - Full schema audit against Prisma schema. Added BattleParticipant, AuditLog, CycleSnapshot, TagTeam, ScheduledTagTeamMatch models. Updated Battle model (removed per-robot columns migrated to BattleParticipant, added tag team fields). Updated User model (removed stale stats fields, added email and profile fields). Renamed ScheduledMatch → ScheduledLeagueMatch, TournamentMatch → ScheduledTournamentMatch. Fixed HP/Shield formulas. Added Weapon.rangeBand, Robot.imageUrl.

---

## Document Purpose

This document defines the **complete database schema** for Armoured Souls, including:
- ✅ All 23 robot attributes (Decimal type for fractional values)
- ✅ All 14 facilities with 10 levels
- ✅ Complete weapon system (47 weapons in catalog) with range bands
- ✅ League tracking, damage tracking, repair costs, yield thresholds, stances
- ✅ All combat state fields (current HP, shields, damage taken)
- ✅ Loadout system (single, weapon+shield, two-handed, dual-wield)
- ✅ User stable system with prestige, credits, profile settings
- ✅ Battle system with BattleParticipant per-robot tracking
- ✅ Tournament system (single elimination, brackets, matches)
- ✅ Matchmaking system (scheduled league matches, cycle metadata)
- ✅ King of the Hill system (scheduled KotH matches, participants, cumulative robot stats)
- ✅ Tag Team system (tag teams, scheduled tag team matches, per-robot stats)
- ✅ Audit log and cycle snapshot system for event sourcing and analytics

**This schema represents the CURRENT implementation** as of April 2, 2026.

---

## Core Principles

1. **Database-First Design**: Everything that will be needed goes in the database NOW
2. **Future-Proof**: Even if frontend/backend don't use it yet, it's in the schema
3. **Complete Robot State**: Damage tracking, repair costs, league info, fame, titles
4. **Comprehensive Weapons**: All attribute bonuses, loadout types, special properties, range bands
5. **14 Facilities**: All facility types with 10 levels each
6. **Time-Based Combat**: All fields needed for time-based combat simulation
7. **N-Participant Battles**: BattleParticipant model supports any number of robots per battle

---

## User Model (Stable)

Represents a player's stable (account) with all resources, profile settings, and onboarding state.

```prisma
model User {
  id           Int     @id @default(autoincrement())
  username     String  @unique @db.VarChar(50)
  email        String? @unique @db.VarChar(50)
  passwordHash String  @map("password_hash") @db.VarChar(255)
  role         String  @default("user") @db.VarChar(20)  // "user", "admin"
  
  // ===== RESOURCES =====
  currency     Int     @default(3000000)    // Credits (₡) - Starting: ₡3,000,000
  prestige     Int     @default(0)          // Stable reputation (earned, never spent)
  
  // ===== STABLE STATISTICS (Aggregated from robots) =====
  championshipTitles Int @default(0) @map("championship_titles")  // Tournament victories
  
  // ===== PROFILE FIELDS =====
  stableName          String?  @unique @map("stable_name") @db.VarChar(30)
  profileVisibility   String   @default("public") @map("profile_visibility") @db.VarChar(10)
  notificationsBattle Boolean  @default(true) @map("notifications_battle")
  notificationsLeague Boolean  @default(true) @map("notifications_league")
  themePreference     String   @default("dark") @map("theme_preference") @db.VarChar(20)
  
  // ===== ONBOARDING TRACKING =====
  hasCompletedOnboarding Boolean   @default(false) @map("has_completed_onboarding")
  onboardingSkipped      Boolean   @default(false) @map("onboarding_skipped")
  onboardingStep         Int       @default(1) @map("onboarding_step")
  onboardingStrategy     String?   @map("onboarding_strategy") @db.VarChar(20)
  onboardingChoices      Json      @default("{}") @map("onboarding_choices")
  onboardingStartedAt    DateTime? @map("onboarding_started_at")
  onboardingCompletedAt  DateTime? @map("onboarding_completed_at")
  
  // ===== TIMESTAMPS =====
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  
  // ===== RELATIONS =====
  robots          Robot[]
  facilities      Facility[]
  weaponInventory WeaponInventory[]
  tagTeams        TagTeam[]
  
  @@map("users")
}
```

**Notes**:
- `email` is optional (nullable) and unique when present
- Prestige: Earned from victories, never spent — used as unlock threshold
- `championshipTitles` is the only aggregated stat kept at user level
- Profile fields: `stableName` (unique display name), visibility, notification preferences, theme
- No `totalBattles`, `totalWins`, or `highestELO` at user level — these are computed from robot data at query time
- No `userId` on Battle — battle ownership is derived through robot ownership
- Onboarding: Backend tracks steps 1–9 internally; UI shows 5 consolidated steps
- Onboarding strategy values: `"1_mighty"`, `"2_average"`, `"3_flimsy"`

---

## Robot Model

Represents an individual combat robot with all 23 attributes and complete state tracking.

```prisma
model Robot {
  id       Int     @id @default(autoincrement())
  userId   Int     @map("user_id")
  name     String  @unique @db.VarChar(50)
  frameId  Int     @default(1) @map("frame_id")
  paintJob String? @map("paint_job") @db.VarChar(100)
  
  // ===== 23 CORE ATTRIBUTES (Range: 1.00-50.00, precision 2 decimals) =====
  
  // Combat Systems (6 attributes)
  combatPower      Decimal @default(1.00) @map("combat_power") @db.Decimal(5, 2)
  targetingSystems Decimal @default(1.00) @map("targeting_systems") @db.Decimal(5, 2)
  criticalSystems  Decimal @default(1.00) @map("critical_systems") @db.Decimal(5, 2)
  penetration      Decimal @default(1.00) @db.Decimal(5, 2)
  weaponControl    Decimal @default(1.00) @map("weapon_control") @db.Decimal(5, 2)
  attackSpeed      Decimal @default(1.00) @map("attack_speed") @db.Decimal(5, 2)
  
  // Defensive Systems (5 attributes)
  armorPlating     Decimal @default(1.00) @map("armor_plating") @db.Decimal(5, 2)
  shieldCapacity   Decimal @default(1.00) @map("shield_capacity") @db.Decimal(5, 2)
  evasionThrusters Decimal @default(1.00) @map("evasion_thrusters") @db.Decimal(5, 2)
  damageDampeners  Decimal @default(1.00) @map("damage_dampeners") @db.Decimal(5, 2)
  counterProtocols Decimal @default(1.00) @map("counter_protocols") @db.Decimal(5, 2)
  
  // Chassis & Mobility (5 attributes)
  hullIntegrity    Decimal @default(1.00) @map("hull_integrity") @db.Decimal(5, 2)
  servoMotors      Decimal @default(1.00) @map("servo_motors") @db.Decimal(5, 2)
  gyroStabilizers  Decimal @default(1.00) @map("gyro_stabilizers") @db.Decimal(5, 2)
  hydraulicSystems Decimal @default(1.00) @map("hydraulic_systems") @db.Decimal(5, 2)
  powerCore        Decimal @default(1.00) @map("power_core") @db.Decimal(5, 2)
  
  // AI Processing (4 attributes)
  combatAlgorithms Decimal @default(1.00) @map("combat_algorithms") @db.Decimal(5, 2)
  threatAnalysis   Decimal @default(1.00) @map("threat_analysis") @db.Decimal(5, 2)
  adaptiveAI       Decimal @default(1.00) @map("adaptive_ai") @db.Decimal(5, 2)
  logicCores       Decimal @default(1.00) @map("logic_cores") @db.Decimal(5, 2)
  
  // Team Coordination (3 attributes)
  syncProtocols    Decimal @default(1.00) @map("sync_protocols") @db.Decimal(5, 2)
  supportSystems   Decimal @default(1.00) @map("support_systems") @db.Decimal(5, 2)
  formationTactics Decimal @default(1.00) @map("formation_tactics") @db.Decimal(5, 2)
  
  // ===== COMBAT STATE =====
  currentHP     Int @map("current_hp")
  maxHP         Int @map("max_hp")          // Calculated: hullIntegrity × 10
  currentShield Int @map("current_shield")
  maxShield     Int @map("max_shield")      // Calculated: shieldCapacity × 2
  damageTaken   Int @default(0) @map("damage_taken")
  
  // ===== PERFORMANCE TRACKING =====
  elo                 Int @default(1200)
  totalBattles        Int @default(0) @map("total_battles")
  wins                Int @default(0)
  draws               Int @default(0)
  losses              Int @default(0)
  damageDealtLifetime Int @default(0) @map("damage_dealt_lifetime")
  damageTakenLifetime Int @default(0) @map("damage_taken_lifetime")
  kills               Int @default(0)
  
  // ===== LEAGUE & FAME =====
  currentLeague         String  @default("bronze") @map("current_league") @db.VarChar(20)
  leagueId              String  @default("bronze_1") @map("league_id") @db.VarChar(30)
  leaguePoints          Int     @default(0) @map("league_points")
  cyclesInCurrentLeague Int     @default(0) @map("cycles_in_current_league")
  fame                  Int     @default(0)
  titles                String? @db.Text
  
  // ===== TAG TEAM STATISTICS =====
  totalTagTeamBattles Int @default(0) @map("total_tag_team_battles")
  totalTagTeamWins    Int @default(0) @map("total_tag_team_wins")
  totalTagTeamLosses  Int @default(0) @map("total_tag_team_losses")
  totalTagTeamDraws   Int @default(0) @map("total_tag_team_draws")
  timesTaggedIn       Int @default(0) @map("times_tagged_in")
  timesTaggedOut      Int @default(0) @map("times_tagged_out")
  
  // ===== KOTH CUMULATIVE STATISTICS =====
  kothWins             Int   @default(0) @map("koth_wins")
  kothMatches          Int   @default(0) @map("koth_matches")
  kothTotalZoneScore   Float @default(0) @map("koth_total_zone_score")
  kothTotalZoneTime    Float @default(0) @map("koth_total_zone_time")
  kothKills            Int   @default(0) @map("koth_kills")
  kothBestPlacement    Int?  @map("koth_best_placement")
  kothCurrentWinStreak Int   @default(0) @map("koth_current_win_streak")
  kothBestWinStreak    Int   @default(0) @map("koth_best_win_streak")
  
  // ===== ECONOMIC STATE =====
  repairCost       Int @default(0) @map("repair_cost")
  battleReadiness  Int @default(100) @map("battle_readiness")
  totalRepairsPaid Int @default(0) @map("total_repairs_paid")
  
  // ===== PLAYER CONFIGURATION =====
  yieldThreshold Int    @default(10) @map("yield_threshold")
  loadoutType    String @default("single") @map("loadout_type") @db.VarChar(20)
  stance         String @default("balanced") @db.VarChar(20)
  
  // ===== EQUIPMENT =====
  mainWeaponId    Int? @map("main_weapon_id")
  offhandWeaponId Int? @map("offhand_weapon_id")
  
  // ===== APPEARANCE =====
  imageUrl String? @map("image_url") @db.VarChar(255)
  
  // ===== TIMESTAMPS =====
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  
  // ===== RELATIONS =====
  user                      User                            @relation(fields: [userId], references: [id], onDelete: Cascade)
  mainWeapon                WeaponInventory?                @relation("MainWeapon", fields: [mainWeaponId], references: [id])
  offhandWeapon             WeaponInventory?                @relation("OffhandWeapon", fields: [offhandWeaponId], references: [id])
  battlesAsRobot1           Battle[]                        @relation("Robot1")
  battlesAsRobot2           Battle[]                        @relation("Robot2")
  scheduledMatchesAsRobot1  ScheduledLeagueMatch[]          @relation("ScheduledRobot1")
  scheduledMatchesAsRobot2  ScheduledLeagueMatch[]          @relation("ScheduledRobot2")
  tournamentsWon            Tournament[]                    @relation("TournamentWinner")
  tournamentMatchesAsRobot1 ScheduledTournamentMatch[]      @relation("TournamentRobot1")
  tournamentMatchesAsRobot2 ScheduledTournamentMatch[]      @relation("TournamentRobot2")
  tournamentMatchesWon      ScheduledTournamentMatch[]      @relation("TournamentMatchWinner")
  tagTeamsAsActive          TagTeam[]                       @relation("TagTeamActiveRobot")
  tagTeamsAsReserve         TagTeam[]                       @relation("TagTeamReserveRobot")
  battleParticipations      BattleParticipant[]
  kothMatchParticipations   ScheduledKothMatchParticipant[]
  
  @@index([userId])
  @@index([elo])
  @@index([currentLeague])
  @@index([currentLeague, leagueId])
  @@map("robots")
}
```

**Key Schema Features**:
- Robot `name` is globally unique (not per-user)
- All 23 attributes use `Decimal(5,2)` for fractional values (e.g., 1.50, 10.25)
- `imageUrl` for optional robot portrait image
- `maxHP` and `maxShield` stored for performance (calculated from attributes)
- `loadoutType` and weapon ID fields for loadout system
- `leagueId` for multiple league instances (e.g., bronze_1, bronze_2)
- Complete tag team and KotH cumulative statistics at robot level

**HP Calculation**:
```
maxHP = hullIntegrity × 10
maxShield = shieldCapacity × 2

Examples:
- Hull Integrity 1.00: HP = 10
- Hull Integrity 10.00: HP = 100
- Shield Capacity 1.00: Shield = 2
- Shield Capacity 10.00: Shield = 20
```

**Attribute Upgrade Cost Formula**:
```
cost = (current_level + 1) × 1,500
Example: Level 1→2 = ₡3,000, Level 49→50 = ₡75,000
```

---

## Weapon Model (Catalog)

Represents weapon types available for purchase. Players buy weapons into inventory.

**Current Implementation**: 47 weapons across all loadout types (v1.5 pricing)

```prisma
model Weapon {
  id              Int     @id @default(autoincrement())
  name            String  @db.VarChar(100)
  weaponType      String  @map("weapon_type") @db.VarChar(20)
  baseDamage      Int     @map("base_damage")
  cooldown        Int
  cost            Int
  handsRequired   String  @map("hands_required") @db.VarChar(10)
  damageType      String  @map("damage_type") @db.VarChar(20)
  loadoutType     String  @map("loadout_type") @db.VarChar(20)
  specialProperty String? @map("special_property") @db.Text
  description     String? @db.Text
  rangeBand       String  @map("range_band") @db.VarChar(10)  // "melee", "short", "mid", "long"
  
  // ===== ATTRIBUTE BONUSES (Can be positive or negative) =====
  // All 23 attribute bonuses match Robot attribute names
  combatPowerBonus      Int @default(0) @map("combat_power_bonus")
  targetingSystemsBonus Int @default(0) @map("targeting_systems_bonus")
  criticalSystemsBonus  Int @default(0) @map("critical_systems_bonus")
  penetrationBonus      Int @default(0) @map("penetration_bonus")
  weaponControlBonus    Int @default(0) @map("weapon_control_bonus")
  attackSpeedBonus      Int @default(0) @map("attack_speed_bonus")
  armorPlatingBonus     Int @default(0) @map("armor_plating_bonus")
  shieldCapacityBonus   Int @default(0) @map("shield_capacity_bonus")
  evasionThrustersBonus Int @default(0) @map("evasion_thrusters_bonus")
  damageDampenersBonus  Int @default(0) @map("damage_dampeners_bonus")
  counterProtocolsBonus Int @default(0) @map("counter_protocols_bonus")
  hullIntegrityBonus    Int @default(0) @map("hull_integrity_bonus")
  servoMotorsBonus      Int @default(0) @map("servo_motors_bonus")
  gyroStabilizersBonus  Int @default(0) @map("gyro_stabilizers_bonus")
  hydraulicSystemsBonus Int @default(0) @map("hydraulic_systems_bonus")
  powerCoreBonus        Int @default(0) @map("power_core_bonus")
  combatAlgorithmsBonus Int @default(0) @map("combat_algorithms_bonus")
  threatAnalysisBonus   Int @default(0) @map("threat_analysis_bonus")
  adaptiveAIBonus       Int @default(0) @map("adaptive_ai_bonus")
  logicCoresBonus       Int @default(0) @map("logic_cores_bonus")
  syncProtocolsBonus    Int @default(0) @map("sync_protocols_bonus")
  supportSystemsBonus   Int @default(0) @map("support_systems_bonus")
  formationTacticsBonus Int @default(0) @map("formation_tactics_bonus")
  
  createdAt DateTime @default(now()) @map("created_at")
  
  weaponInventory WeaponInventory[]
  
  @@map("weapons")
}
```

**Notes**:
- `rangeBand` field added for 2D arena combat: `"melee"`, `"short"`, `"mid"`, `"long"`
- All 23 attribute bonuses match Robot attribute names exactly
- Bonuses can be negative for weapon trade-offs
- Weapons are populated during database seeding (see SEED_DATA_SPECIFICATION.md)

---

## WeaponInventory Model

Represents individual weapon instances owned by users.

```prisma
model WeaponInventory {
  id         Int      @id @default(autoincrement())
  userId     Int      @map("user_id")
  weaponId   Int      @map("weapon_id")
  customName String?  @map("custom_name") @db.VarChar(100)
  purchasedAt DateTime @default(now()) @map("purchased_at")
  
  user          User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  weapon        Weapon  @relation(fields: [weaponId], references: [id])
  robotsMain    Robot[] @relation("MainWeapon")
  robotsOffhand Robot[] @relation("OffhandWeapon")
  
  @@index([userId])
  @@index([weaponId])
  @@map("weapon_inventory")
}
```

---

## Facility Model

Represents stable-wide upgrades. All 14 facility types with 10 levels each.

```prisma
model Facility {
  id           Int    @id @default(autoincrement())
  userId       Int    @map("user_id")
  facilityType String @map("facility_type") @db.VarChar(50)
  level        Int    @default(0)       // 0-10, where 0 = not purchased
  maxLevel     Int    @default(10) @map("max_level")
  activeCoach  String? @map("active_coach") @db.VarChar(50)
  
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([userId, facilityType])
  @@index([userId])
  @@map("facilities")
}
```

**14 Facility Types** (from STABLE_SYSTEM.md):

1. **repair_bay** - Reduces repair costs
2. **training_facility** - Reduces attribute upgrade costs
3. **weapons_workshop** - Weapon purchase discounts
4. **research_lab** - Battle analytics, loadout presets
5. **medical_bay** - Critical damage cost reduction
6. **roster_expansion** - Robot roster slots (Level 0-9, maxLevel=9)
7. **storage_facility** - Weapon storage capacity
8. **coaching_staff** - Hire coaches for stable-wide bonuses
9. **booking_office** - Tournament access tiers
10. **combat_training_academy** - Combat Systems attribute caps
11. **defense_training_academy** - Defensive Systems attribute caps
12. **mobility_training_academy** - Chassis & Mobility attribute caps
13. **ai_training_academy** - AI Processing + Team Coordination attribute caps
14. **merchandising_hub** - Merchandising revenue (scales with prestige)

---

## Battle Model

Records battle results. Per-robot combat data (damage, HP, ELO changes, rewards) is stored in BattleParticipant records, not on the Battle itself.

```prisma
model Battle {
  id         Int    @id @default(autoincrement())
  robot1Id   Int    @map("robot1_id")
  robot2Id   Int    @map("robot2_id")
  winnerId   Int?   @map("winner_id")
  battleType String @map("battle_type") @db.VarChar(20)  // "league", "tournament", "tag_team", "koth"
  leagueType String @map("league_type") @db.VarChar(20)
  
  // ===== TOURNAMENT REFERENCE =====
  tournamentId    Int? @map("tournament_id")
  tournamentRound Int? @map("tournament_round")
  
  // ===== TAG TEAM FIELDS =====
  team1ActiveRobotId  Int?    @map("team1_active_robot_id")
  team1ReserveRobotId Int?    @map("team1_reserve_robot_id")
  team2ActiveRobotId  Int?    @map("team2_active_robot_id")
  team2ReserveRobotId Int?    @map("team2_reserve_robot_id")
  team1TagOutTime     BigInt? @map("team1_tag_out_time")
  team2TagOutTime     BigInt? @map("team2_tag_out_time")
  
  // ===== TIME-BASED COMBAT DATA =====
  battleLog       Json @map("battle_log")
  durationSeconds Int  @map("duration_seconds")
  
  // ===== ECONOMIC DATA =====
  winnerReward Int? @map("winner_reward")
  loserReward  Int? @map("loser_reward")
  
  // ===== TAG TEAM PER-ROBOT STATS =====
  team1ActiveDamageDealt  Int @default(0) @map("team1_active_damage_dealt")
  team1ReserveDamageDealt Int @default(0) @map("team1_reserve_damage_dealt")
  team2ActiveDamageDealt  Int @default(0) @map("team2_active_damage_dealt")
  team2ReserveDamageDealt Int @default(0) @map("team2_reserve_damage_dealt")
  team1ActiveFameAwarded  Int @default(0) @map("team1_active_fame_awarded")
  team1ReserveFameAwarded Int @default(0) @map("team1_reserve_fame_awarded")
  team2ActiveFameAwarded  Int @default(0) @map("team2_active_fame_awarded")
  team2ReserveFameAwarded Int @default(0) @map("team2_reserve_fame_awarded")
  
  // ===== ELO TRACKING (kept for backward compat and aggregate queries) =====
  robot1ELOBefore Int @map("robot1_elo_before")
  robot2ELOBefore Int @map("robot2_elo_before")
  robot1ELOAfter  Int @map("robot1_elo_after")
  robot2ELOAfter  Int @map("robot2_elo_after")
  eloChange       Int @map("elo_change")
  
  createdAt DateTime @default(now()) @map("created_at")
  
  // ===== RELATIONS =====
  robot1             Robot                      @relation("Robot1", fields: [robot1Id], references: [id])
  robot2             Robot                      @relation("Robot2", fields: [robot2Id], references: [id])
  tournament         Tournament?                @relation("TournamentBattles", fields: [tournamentId], references: [id])
  scheduledMatch     ScheduledLeagueMatch[]
  tournamentMatches  ScheduledTournamentMatch[]
  tagTeamMatches     ScheduledTagTeamMatch[]    @relation("TagTeamBattle")
  participants       BattleParticipant[]
  scheduledKothMatch ScheduledKothMatch[]
  
  @@index([robot1Id])
  @@index([robot2Id])
  @@index([createdAt])
  @@index([tournamentId])
  @@index([battleType])
  @@map("battles")
}
```

**Key differences from earlier schema versions**:
- No `userId` field — battle ownership is derived through robot ownership
- No per-robot final state columns (`robot1FinalHP`, `robot1Yielded`, etc.) — migrated to `BattleParticipant`
- No per-robot reward columns (`robot1PrestigeAwarded`, etc.) — migrated to `BattleParticipant`
- No per-robot damage columns (`robot1DamageDealt`, etc.) — migrated to `BattleParticipant`
- ELO columns kept for backward compatibility and aggregate queries; canonical per-robot ELO is in `BattleParticipant`
- Tag team fields store team composition and tag-out timing for replay reconstruction

---

## BattleParticipant Model

Per-robot battle data for N-participant battles. This is the canonical source for per-robot combat stats, rewards, and ELO changes. Supports 1v1, 2v2 tag team, KotH (5-6 robots), and future N-robot modes.

```prisma
model BattleParticipant {
  id       Int     @id @default(autoincrement())
  battleId Int     @map("battle_id")
  robotId  Int     @map("robot_id")
  team     Int                          // 1 or 2 (team affiliation)
  role     String? @db.VarChar(20)      // "active"/"reserve" for tag team, null for 1v1
  
  // KotH placement (null for non-KotH battles)
  placement Int?                        // 1-6 final placement
  
  // Economic effects
  credits          Int
  streamingRevenue Int @default(0) @map("streaming_revenue")
  
  // Stat changes
  eloBefore       Int @map("elo_before")
  eloAfter        Int @map("elo_after")
  prestigeAwarded Int @default(0) @map("prestige_awarded")
  fameAwarded     Int @default(0) @map("fame_awarded")
  
  // Battle stats
  damageDealt Int     @default(0) @map("damage_dealt")
  finalHP     Int     @map("final_hp")
  yielded     Boolean @default(false)
  destroyed   Boolean @default(false)
  
  createdAt DateTime @default(now()) @map("created_at")
  
  battle Battle @relation(fields: [battleId], references: [id], onDelete: Cascade)
  robot  Robot  @relation(fields: [robotId], references: [id])
  
  @@unique([battleId, robotId])
  @@index([battleId])
  @@index([robotId])
  @@index([battleId, team])
  @@map("battle_participants")
}
```

**Records per battle type**:
- League (1v1): 2 participants
- Tournament (1v1): 2 participants
- Tag Team (2v2): 4 participants (role = "active" or "reserve")
- KotH (FFA): 5-6 participants (placement = 1-6)

---

## ScheduledLeagueMatch Model

Tracks scheduled matchmaking battles for league play. Previously named `ScheduledMatch`.

```prisma
model ScheduledLeagueMatch {
  id           Int      @id @default(autoincrement())
  robot1Id     Int      @map("robot1_id")
  robot2Id     Int      @map("robot2_id")
  leagueType   String   @map("league_type") @db.VarChar(20)
  scheduledFor DateTime @map("scheduled_for")
  status       String   @default("scheduled") @db.VarChar(20)
  battleId     Int?     @map("battle_id")
  createdAt    DateTime @default(now()) @map("created_at")
  
  robot1 Robot   @relation("ScheduledRobot1", fields: [robot1Id], references: [id])
  robot2 Robot   @relation("ScheduledRobot2", fields: [robot2Id], references: [id])
  battle Battle? @relation(fields: [battleId], references: [id])
  
  @@index([robot1Id])
  @@index([robot2Id])
  @@index([scheduledFor, status])
  @@index([status])
  @@map("scheduled_matches")
}
```

**Note**: The Prisma model is named `ScheduledLeagueMatch` but maps to the `scheduled_matches` table for backward compatibility.

---

## Tournament System Models

### Tournament Model

```prisma
model Tournament {
  id             Int    @id @default(autoincrement())
  name           String @db.VarChar(100)
  tournamentType String @map("tournament_type") @db.VarChar(50)
  status         String @default("pending") @db.VarChar(20)
  
  currentRound      Int @default(1) @map("current_round")
  maxRounds         Int @map("max_rounds")
  totalParticipants Int @map("total_participants")
  winnerId          Int? @map("winner_id")
  
  createdAt   DateTime  @default(now()) @map("created_at")
  startedAt   DateTime? @map("started_at")
  completedAt DateTime? @map("completed_at")
  
  winner  Robot?                     @relation("TournamentWinner", fields: [winnerId], references: [id])
  matches ScheduledTournamentMatch[]
  battles Battle[]                   @relation("TournamentBattles")
  
  @@index([status])
  @@index([winnerId])
  @@map("tournaments")
}
```

### ScheduledTournamentMatch Model

Previously named `TournamentMatch`.

```prisma
model ScheduledTournamentMatch {
  id           Int @id @default(autoincrement())
  tournamentId Int @map("tournament_id")
  round        Int
  matchNumber  Int @map("match_number")
  
  robot1Id   Int?    @map("robot1_id")
  robot2Id   Int?    @map("robot2_id")
  winnerId   Int?    @map("winner_id")
  battleId   Int?    @unique @map("battle_id")
  status     String  @default("pending") @db.VarChar(20)
  isByeMatch Boolean @default(false) @map("is_bye_match")
  
  createdAt   DateTime  @default(now()) @map("created_at")
  completedAt DateTime? @map("completed_at")
  
  tournament Tournament @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  robot1     Robot?     @relation("TournamentRobot1", fields: [robot1Id], references: [id])
  robot2     Robot?     @relation("TournamentRobot2", fields: [robot2Id], references: [id])
  winner     Robot?     @relation("TournamentMatchWinner", fields: [winnerId], references: [id])
  battle     Battle?    @relation(fields: [battleId], references: [id])
  
  @@index([tournamentId, round])
  @@index([status])
  @@index([robot1Id])
  @@index([robot2Id])
  @@map("tournament_matches")
}
```

---

## Tag Team System Models

### TagTeam Model

Represents a 2v2 team composition owned by a stable.

```prisma
model TagTeam {
  id             Int @id @default(autoincrement())
  stableId       Int @map("stable_id")
  activeRobotId  Int @map("active_robot_id")
  reserveRobotId Int @map("reserve_robot_id")
  
  // League tracking
  tagTeamLeague         String @default("bronze") @map("tag_team_league") @db.VarChar(20)
  tagTeamLeagueId       String @default("bronze_1") @map("tag_team_league_id") @db.VarChar(30)
  tagTeamLeaguePoints   Int    @default(0) @map("tag_team_league_points")
  cyclesInTagTeamLeague Int    @default(0) @map("cycles_in_tag_team_league")
  
  // Performance tracking
  totalTagTeamWins   Int @default(0) @map("total_tag_team_wins")
  totalTagTeamLosses Int @default(0) @map("total_tag_team_losses")
  totalTagTeamDraws  Int @default(0) @map("total_tag_team_draws")
  
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  
  stable         User                    @relation(fields: [stableId], references: [id], onDelete: Cascade)
  activeRobot    Robot                   @relation("TagTeamActiveRobot", fields: [activeRobotId], references: [id])
  reserveRobot   Robot                   @relation("TagTeamReserveRobot", fields: [reserveRobotId], references: [id])
  matchesAsTeam1 ScheduledTagTeamMatch[] @relation("Team1")
  matchesAsTeam2 ScheduledTagTeamMatch[] @relation("Team2")
  
  @@unique([activeRobotId, reserveRobotId])
  @@index([stableId])
  @@index([tagTeamLeague, tagTeamLeagueId])
  @@index([activeRobotId])
  @@index([reserveRobotId])
  @@map("tag_teams")
}
```

### ScheduledTagTeamMatch Model

```prisma
model ScheduledTagTeamMatch {
  id            Int      @id @default(autoincrement())
  team1Id       Int      @map("team1_id")
  team2Id       Int?     @map("team2_id")       // Nullable for bye-matches
  tagTeamLeague String   @map("tag_team_league") @db.VarChar(20)
  scheduledFor  DateTime @map("scheduled_for")
  status        String   @default("scheduled") @db.VarChar(20)
  battleId      Int?     @map("battle_id")
  createdAt     DateTime @default(now()) @map("created_at")
  
  team1  TagTeam  @relation("Team1", fields: [team1Id], references: [id])
  team2  TagTeam? @relation("Team2", fields: [team2Id], references: [id])
  battle Battle?  @relation("TagTeamBattle", fields: [battleId], references: [id])
  
  @@index([team1Id])
  @@index([team2Id])
  @@index([scheduledFor, status])
  @@index([status])
  @@map("tag_team_matches")
}
```

---

## KotH System Models

### ScheduledKothMatch Model

```prisma
model ScheduledKothMatch {
  id           Int      @id @default(autoincrement())
  scheduledFor DateTime @map("scheduled_for")
  status       String   @default("scheduled") @db.VarChar(20)
  battleId     Int?     @map("battle_id")
  rotatingZone Boolean  @default(false) @map("rotating_zone")
  
  scoreThreshold Int? @map("score_threshold")
  timeLimit      Int? @map("time_limit")
  zoneRadius     Int? @map("zone_radius")
  
  createdAt DateTime @default(now()) @map("created_at")
  
  battle       Battle?                         @relation(fields: [battleId], references: [id])
  participants ScheduledKothMatchParticipant[]
  
  @@index([scheduledFor, status])
  @@index([status])
  @@map("scheduled_koth_matches")
}
```

### ScheduledKothMatchParticipant Model

```prisma
model ScheduledKothMatchParticipant {
  id      Int @id @default(autoincrement())
  matchId Int @map("match_id")
  robotId Int @map("robot_id")
  
  match ScheduledKothMatch @relation(fields: [matchId], references: [id], onDelete: Cascade)
  robot Robot              @relation(fields: [robotId], references: [id])
  
  @@unique([matchId, robotId])
  @@index([matchId])
  @@index([robotId])
  @@map("scheduled_koth_match_participants")
}
```

---

## Audit & Analytics Models

### AuditLog Model

Event sourcing table for all game events. One event per robot per battle.

```prisma
model AuditLog {
  id             BigInt   @id @default(autoincrement())
  cycleNumber    Int      @map("cycle_number")
  eventType      String   @map("event_type") @db.VarChar(100)
  eventTimestamp  DateTime @default(now()) @map("event_timestamp")
  sequenceNumber Int      @map("sequence_number")
  
  userId   Int? @map("user_id")
  robotId  Int? @map("robot_id")
  battleId Int? @map("battle_id")
  
  payload  Json
  metadata Json?
  
  @@unique([cycleNumber, sequenceNumber], name: "audit_logs_cycle_sequence")
  @@index([cycleNumber])
  @@index([userId])
  @@index([robotId])
  @@index([battleId])
  @@index([eventType])
  @@index([eventTimestamp])
  @@index([cycleNumber, userId])
  @@index([cycleNumber, robotId])
  @@index([cycleNumber, battleId])
  @@index([cycleNumber, eventType])
  @@map("audit_logs")
}
```

**Notes**:
- `id` is `BigInt` for high-volume event storage
- `sequenceNumber` is unique within a cycle for deterministic ordering
- `payload` is a flexible JSONB field containing event-specific data
- `metadata` is optional calculation metadata for debugging
- Heavily indexed for cycle-based, user-based, and robot-based queries

### CycleSnapshot Model

Pre-aggregated metrics per cycle for fast historical queries.

```prisma
model CycleSnapshot {
  id          Int    @id @default(autoincrement())
  cycleNumber Int    @unique @map("cycle_number")
  triggerType String @map("trigger_type") @db.VarChar(20)  // "manual" or "scheduled"
  
  startTime  DateTime @map("start_time")
  endTime    DateTime @map("end_time")
  durationMs Int      @map("duration_ms")
  
  stableMetrics Json @map("stable_metrics")
  robotMetrics  Json @map("robot_metrics")
  stepDurations Json @map("step_durations")
  
  totalBattles           Int    @default(0) @map("total_battles")
  totalCreditsTransacted BigInt @default(0) @map("total_credits_transacted")
  totalPrestigeAwarded   Int    @default(0) @map("total_prestige_awarded")
  
  createdAt DateTime @default(now()) @map("created_at")
  
  @@index([cycleNumber])
  @@index([startTime])
  @@map("cycle_snapshots")
}
```

---

## CycleMetadata Model

Singleton table tracking global cycle state.

```prisma
model CycleMetadata {
  id          Int       @id @default(1)
  totalCycles Int       @default(0) @map("total_cycles")
  lastCycleAt DateTime? @map("last_cycle_at")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")
  
  @@map("cycle_metadata")
}
```

---

## ResetLog Model

Tracks account reset history for the onboarding system.

```prisma
model ResetLog {
  id     Int @id @default(autoincrement())
  userId Int @map("user_id")
  
  robotsDeleted      Int     @map("robots_deleted")
  weaponsDeleted     Int     @map("weapons_deleted")
  facilitiesDeleted  Int     @map("facilities_deleted")
  creditsBeforeReset Decimal @map("credits_before_reset") @db.Decimal(15, 2)
  
  reason  String?  @db.Text
  resetAt DateTime @default(now()) @map("reset_at")
  
  @@index([userId])
  @@index([resetAt])
  @@map("reset_logs")
}
```

---

## Complete Model Summary

| Model | Table Name | Purpose |
|---|---|---|
| `User` | `users` | Player accounts, resources, profile, onboarding |
| `Robot` | `robots` | 23 attributes, combat state, league/fame/KotH/tag team stats |
| `Weapon` | `weapons` | Weapon catalog (47 weapons) with range bands |
| `WeaponInventory` | `weapon_inventory` | Player weapon ownership |
| `Facility` | `facilities` | 14 facility types, levels 0-10 |
| `Battle` | `battles` | Battle records with combat logs |
| `BattleParticipant` | `battle_participants` | Per-robot battle data (N-participant) |
| `ScheduledLeagueMatch` | `scheduled_matches` | Scheduled 1v1 league battles |
| `Tournament` | `tournaments` | Tournament lifecycle |
| `ScheduledTournamentMatch` | `tournament_matches` | Tournament bracket matches |
| `TagTeam` | `tag_teams` | 2v2 team compositions |
| `ScheduledTagTeamMatch` | `tag_team_matches` | Scheduled 2v2 battles |
| `ScheduledKothMatch` | `scheduled_koth_matches` | KotH match scheduling |
| `ScheduledKothMatchParticipant` | `scheduled_koth_match_participants` | KotH match participants |
| `CycleMetadata` | `cycle_metadata` | Global cycle state (singleton) |
| `AuditLog` | `audit_logs` | Event sourcing for all game events |
| `CycleSnapshot` | `cycle_snapshots` | Pre-aggregated cycle metrics |
| `ResetLog` | `reset_logs` | Account reset tracking |

---

## Field Constraints & Validation

### String Enums (Application Layer)
- `User.role`: `"user"`, `"admin"`
- `Robot.currentLeague`: `"bronze"`, `"silver"`, `"gold"`, `"platinum"`, `"diamond"`, `"champion"`
- `Robot.loadoutType`: `"single"`, `"weapon_shield"`, `"two_handed"`, `"dual_wield"`
- `Robot.stance`: `"offensive"`, `"defensive"`, `"balanced"`
- `Weapon.weaponType`: `"energy"`, `"ballistic"`, `"melee"`, `"shield"`
- `Weapon.handsRequired`: `"one"`, `"two"`, `"shield"`
- `Weapon.damageType`: `"energy"`, `"ballistic"`, `"melee"`, `"explosive"`, `"none"`
- `Weapon.loadoutType`: `"single"`, `"weapon_shield"`, `"two_handed"`, `"dual_wield"`, `"any"`
- `Weapon.rangeBand`: `"melee"`, `"short"`, `"mid"`, `"long"`
- `Battle.battleType`: `"league"`, `"tournament"`, `"tag_team"`, `"koth"`
- `ScheduledLeagueMatch.status`: `"scheduled"`, `"completed"`, `"cancelled"`
- `ScheduledKothMatch.status`: `"scheduled"`, `"completed"`, `"failed"`, `"cancelled"`
- `Tournament.status`: `"pending"`, `"active"`, `"completed"`
- `Tournament.tournamentType`: `"single_elimination"`, `"double_elimination"`, `"swiss"`
- `ScheduledTournamentMatch.status`: `"pending"`, `"scheduled"`, `"completed"`
- `Facility.facilityType`: See 14 facility types above

### Numeric Ranges
- Robot Attributes (all 23): 1.00-50.00 (Decimal with 2 decimal places)
- `Robot.yieldThreshold`: 0-50 (percentage)
- `Robot.battleReadiness`: 0-100 (percentage)
- `Robot.elo`: 800-2500 (typical range, no hard limits)
- `Facility.level`: 0-10 (0 = not purchased)
- `Facility.maxLevel`: 10 for most, 9 for `roster_expansion`

---

## Computed Fields (Not Stored)

These are calculated in application code:

**Robot**:
- `effectiveAttributes`: Base attributes + weapon bonuses + loadout bonuses + stance modifiers
- `winRate`: (wins / totalBattles) × 100
- `availableRobotSlots`: Based on roster_expansion facility level

**User**:
- `winRate`: Computed from robot data
- `totalBattles`, `totalWins`: Aggregated from robots at query time
- `activeRobots`: Count of user's robots
- `weaponStorageLimit`: Based on storage_facility level

**Facility**:
- `upgradeCost`: Based on facility type and current level (see STABLE_SYSTEM.md)
- `operatingCost`: Based on facility type and level
- `discountPercentage`: For repair_bay, training_facility, weapons_workshop, medical_bay
- `bonusPercentage`: For coaching_staff bonuses

---

## Related Documentation

### Core Schema Documents
- **[COMBAT_FORMULAS.md](COMBAT_FORMULAS.md)** - Combat calculations and damage formulas
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture overview
- **[SEED_DATA_SPECIFICATION.md](SEED_DATA_SPECIFICATION.md)** - Complete seed data specification
- **[PRD_BATTLE_DATA_ARCHITECTURE.md](PRD_BATTLE_DATA_ARCHITECTURE.md)** - BattleParticipant design and migration
- **[PRD_AUDIT_SYSTEM.md](PRD_AUDIT_SYSTEM.md)** - Audit log architecture

### Feature Specifications
- **[PRD_WEAPONS_LOADOUT.md](PRD_WEAPONS_LOADOUT.md)** - Complete weapon system, loadout configurations
- **[PRD_ROBOT_ATTRIBUTES.md](PRD_ROBOT_ATTRIBUTES.md)** - 23 robot attributes and combat mechanics
- **[STABLE_SYSTEM.md](STABLE_SYSTEM.md)** - 14 facilities, prestige formulas, stable management
- **[PRD_PRESTIGE_AND_FAME.md](PRD_PRESTIGE_AND_FAME.md)** - Prestige and Fame system specification
- **[PRD_TOURNAMENT_SYSTEM.md](PRD_TOURNAMENT_SYSTEM.md)** - Tournament bracket system
- **[PRD_MATCHMAKING.md](PRD_MATCHMAKING.md)** - Matchmaking and cycle system
