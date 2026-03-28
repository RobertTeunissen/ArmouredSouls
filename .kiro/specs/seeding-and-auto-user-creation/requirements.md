# Requirements Document

## Introduction

This document specifies the changes to the database seeding system and the automated user/robot generation that occurs during daily cycles in Armoured Souls. The goal is to simplify the seed data by removing archetype users and legacy player accounts, restructure the initial WimpBot population, and introduce a tiered auto-generation system that creates stables with WimpBots, AverageBots, and ExpertBots during cycle execution. All archetype-related documentation is also removed from the codebase.

## Glossary

- **Seed_System**: The database initialization process that populates the database with initial data (weapons, users, robots) on first setup
- **Cycle_System**: The automated daily game loop that processes battles, income, expenses, repairs, matchmaking, and optionally generates new users
- **Auto_Generation_System**: The subsystem within the Cycle_System responsible for creating new AI-controlled users and robots during each cycle
- **WimpBot**: A robot with all 23 attributes set to 1.00, equipped with Budget-tier weapons (cost < ₡100,000)
- **AverageBot**: A robot with all 23 attributes set to 5.00, equipped with Mid-tier weapons (cost ₡100,000–₡250,000)
- **ExpertBot**: A robot with all 23 attributes set to 10.00, equipped with Premium-tier weapons (cost ₡250,000–₡400,000)
- **Stable**: A user account and its associated robots, facilities, and resources (the in-game term for a player's holdings)
- **Loadout_Type**: The weapon configuration of a robot — one of: Single, Weapon+Shield, Dual-Wield, Two-Handed
- **Range_Band**: The preferred engagement distance of a weapon — one of: Melee, Short, Mid, Long
- **Price_Tier**: Weapon cost classification — Budget (< ₡100K), Mid (₡100K–₡250K), Premium (₡250K–₡400K), Luxury (₡400K+)
- **Tag_Team**: A registered pair of robots from the same stable that compete in tag team league matches
- **Bye_Robot**: A special matchmaking placeholder robot used when a league has an odd number of participants
- **Bronze_League**: The entry-level competitive tier where all new robots are placed (bronze_1, bronze_2, etc.)

## Requirements

### Requirement 1: Simplify Admin Seed Account

**User Story:** As a developer, I want the admin seed account to have realistic starting resources, so that admin testing reflects actual gameplay conditions.

#### Acceptance Criteria

1. THE Seed_System SHALL create one admin user with username "admin", password "admin123", and role "admin"
2. THE Seed_System SHALL set the admin user currency to ₡3,000,000
3. THE Seed_System SHALL set the admin user prestige to 0
4. THE Seed_System SHALL assign a Stable_Name to the admin user

### Requirement 2: Remove Legacy Player Accounts from Seed

**User Story:** As a developer, I want to remove the manual player accounts (player1–player5) from the seed, so that the seed only contains accounts needed for system operation.

#### Acceptance Criteria

1. THE Seed_System SHALL NOT create any user accounts with usernames "player1" through "player5"
2. THE Seed_System SHALL retain the admin account and the bye_robot_user account as the only named seed accounts

### Requirement 3: Remove Archetype Users from Seed

**User Story:** As a developer, I want to remove all archetype test users from the seed, so that the seed is simplified and archetype-specific balance maintenance is eliminated.

#### Acceptance Criteria

1. THE Seed_System SHALL NOT create any user accounts with usernames starting with "archetype_"
2. THE Seed_System SHALL NOT create any robots associated with archetype users
3. THE Seed_System SHALL NOT create any facilities associated with archetype users
4. THE Seed_System SHALL NOT create any tag teams associated with archetype users

### Requirement 4: Remove Archetype Documentation and References

**User Story:** As a developer, I want all archetype-related documentation and seed data references removed, so that the codebase does not reference obsolete archetype configurations.

#### Acceptance Criteria

1. THE Seed_System SHALL remove the "Player Archetype Test Users" section and all 10 archetype definitions from SEED_DATA_SPECIFICATION.md
2. THE Seed_System SHALL remove the "Dynamic User Generation" archetype cycling logic from SEED_DATA_SPECIFICATION.md
3. WHEN archetype references exist in other documentation files, THE Seed_System SHALL remove those references
4. THE Seed_System SHALL preserve the PLAYER_ARCHETYPES_GUIDE.md file as a standalone player strategy guide, removing only references that tie it to seed data generation

### Requirement 5: Restructure WimpBot Seed Population

**User Story:** As a developer, I want the seed to create 200 WimpBots distributed evenly across the four practice weapons, so that the initial population covers all weapon types.

#### Acceptance Criteria

1. THE Seed_System SHALL create 200 test user accounts with usernames "test_user_001" through "test_user_200"
2. THE Seed_System SHALL set each test user's currency to ₡100,000
3. THE Seed_System SHALL assign a Stable_Name to each test user
4. THE Seed_System SHALL create one robot per test user with all 23 attributes set to 1.00
5. THE Seed_System SHALL distribute robots evenly across the four practice weapons: 50 with Practice Sword, 50 with Practice Blaster, 50 with Training Rifle, 50 with Training Beam
6. THE Seed_System SHALL assign the Loadout_Type "Single" to robots with Practice Sword or Practice Blaster, and "Two-Handed" to robots with Training Rifle or Training Beam
7. THE Seed_System SHALL set each robot's ELO to 1200 and league to Bronze_League
8. THE Seed_System SHALL distribute all 200 robots evenly across Bronze_League instances
9. THE Seed_System SHALL name each robot using the format `{Tier} {LoadoutTitle} {WeaponCodename} {Number}` (e.g., "WimpBot Lone Rusty 1" for a Practice Sword with Single loadout, "WimpBot Heavy Cadet 51" for a Training Rifle with Two-Handed loadout)

### Requirement 6: Retain Bye Robot

**User Story:** As a developer, I want the bye robot to remain unchanged in the seed, so that matchmaking continues to function for odd-numbered leagues.

#### Acceptance Criteria

1. THE Seed_System SHALL create the bye_robot_user account with username "bye_robot_user" and ₡0 currency
2. THE Seed_System SHALL create the "Bye Robot" with all attributes at 1.00, ELO 1200, league "bronze_bye", and yield threshold 0
3. THE Seed_System SHALL equip the Bye Robot with a Practice Sword

### Requirement 7: Retain Full Weapon Catalog

**User Story:** As a developer, I want all 47 weapons to remain in the seed, so that the weapon shop and robot equipment systems function correctly.

#### Acceptance Criteria

1. THE Seed_System SHALL seed all 47 weapons with their current stats, pricing, and attributes unchanged

### Requirement 8: Tiered Auto-Generation During Cycles

**User Story:** As a developer, I want the cycle auto-generation to create three tiers of stables (WimpBot, AverageBot, ExpertBot), so that the generated population has varied competitive strength.

#### Acceptance Criteria

1. WHEN the Auto_Generation_System creates users during a cycle, THE Auto_Generation_System SHALL create N users where N equals the current cycle number
2. THE Auto_Generation_System SHALL distribute the N users equally across three tiers: one-third WimpBot stables (3 robots each), one-third AverageBot stables (2 robots each), and one-third ExpertBot stables (1 robot each)
3. WHEN N is not evenly divisible by 3, THE Auto_Generation_System SHALL distribute the remainder across tiers in order (WimpBot first, then AverageBot, then ExpertBot)
4. THE Auto_Generation_System SHALL set each generated user's currency to ₡100,000
5. THE Auto_Generation_System SHALL assign a Stable_Name to each generated user

### Requirement 9: WimpBot Stable Generation (3-Robot Tier)

**User Story:** As a developer, I want WimpBot stables to contain 3 weak robots with budget weapons, so that they represent the lowest competitive tier in the ecosystem.

#### Acceptance Criteria

1. WHEN the Auto_Generation_System creates a WimpBot stable, THE Auto_Generation_System SHALL create 3 robots with all 23 attributes set to 1.00
2. THE Auto_Generation_System SHALL assign each robot a random Loadout_Type with equal probability (25% Single, 25% Weapon+Shield, 25% Dual-Wield, 25% Two-Handed)
3. THE Auto_Generation_System SHALL assign each robot a random Range_Band with equal probability (25% Melee, 25% Short, 25% Mid, 25% Long)
4. THE Auto_Generation_System SHALL equip each robot with a randomly selected weapon from the Budget Price_Tier (cost < ₡100,000) that matches the robot's Loadout_Type and Range_Band
5. WHEN a robot's Loadout_Type is Weapon+Shield, THE Auto_Generation_System SHALL also equip a randomly selected shield from the Budget Price_Tier
6. WHEN a robot's Loadout_Type is Dual-Wield, THE Auto_Generation_System SHALL equip two copies of the same weapon
7. THE Auto_Generation_System SHALL set each robot's ELO to 1200 and assign it to Bronze_League
8. THE Auto_Generation_System SHALL register a Tag_Team containing the robots from the WimpBot stable

### Requirement 10: AverageBot Stable Generation (2-Robot Tier)

**User Story:** As a developer, I want AverageBot stables to contain 2 mid-strength robots with mid-tier weapons, so that they represent a moderate competitive tier.

#### Acceptance Criteria

1. WHEN the Auto_Generation_System creates an AverageBot stable, THE Auto_Generation_System SHALL create 2 robots with all 23 attributes set to 5.00
2. THE Auto_Generation_System SHALL assign each robot a random Loadout_Type with equal probability (25% each)
3. THE Auto_Generation_System SHALL assign each robot a random Range_Band with equal probability (25% each)
4. THE Auto_Generation_System SHALL equip each robot with a randomly selected weapon from the Mid Price_Tier (cost ₡100,000–₡250,000) that matches the robot's Loadout_Type and Range_Band
5. WHEN a robot's Loadout_Type is Weapon+Shield, THE Auto_Generation_System SHALL also equip a randomly selected shield from the Mid Price_Tier
6. WHEN a robot's Loadout_Type is Dual-Wield, THE Auto_Generation_System SHALL equip two copies of the same weapon
7. THE Auto_Generation_System SHALL set each robot's ELO to 1200 and assign it to Bronze_League
8. THE Auto_Generation_System SHALL register a Tag_Team containing the robots from the AverageBot stable

### Requirement 11: ExpertBot Stable Generation (1-Robot Tier)

**User Story:** As a developer, I want ExpertBot stables to contain 1 strong robot with premium weapons, so that they represent the highest auto-generated competitive tier.

#### Acceptance Criteria

1. WHEN the Auto_Generation_System creates an ExpertBot stable, THE Auto_Generation_System SHALL create 1 robot with all 23 attributes set to 10.00
2. THE Auto_Generation_System SHALL assign the robot a random Loadout_Type with equal probability (25% each)
3. THE Auto_Generation_System SHALL assign the robot a random Range_Band with equal probability (25% each)
4. THE Auto_Generation_System SHALL equip the robot with a randomly selected weapon from the Premium Price_Tier (cost ₡250,000–₡400,000) that matches the robot's Loadout_Type and Range_Band
5. WHEN the robot's Loadout_Type is Weapon+Shield, THE Auto_Generation_System SHALL also equip a randomly selected shield from the Premium Price_Tier
6. WHEN the robot's Loadout_Type is Dual-Wield, THE Auto_Generation_System SHALL equip two copies of the same weapon
7. THE Auto_Generation_System SHALL set the robot's ELO to 1200 and assign it to Bronze_League

### Requirement 12: Robot Stance and Yield Assignment

**User Story:** As a developer, I want auto-generated robots to have randomized stances and yield thresholds, so that combat encounters are varied and unpredictable.

#### Acceptance Criteria

1. WHEN the Auto_Generation_System creates a robot, THE Auto_Generation_System SHALL assign a random stance with equal probability (33% Balanced, 33% Aggressive, 33% Defensive)
2. WHEN the Auto_Generation_System creates a robot, THE Auto_Generation_System SHALL assign a random yield threshold between 0% and 20% (inclusive)

### Requirement 13: Robot and Stable Naming Convention

**User Story:** As a developer, I want auto-generated robots and stables to have names that encode their loadout configuration for internal identification while remaining thematic to players.

#### Acceptance Criteria

1. WHEN the Auto_Generation_System creates a robot, THE Auto_Generation_System SHALL name it using the format `{Tier} {LoadoutTitle} {WeaponCodename} {Number}` where Tier is "WimpBot", "AverageBot", or "ExpertBot"
2. THE Auto_Generation_System SHALL map each Loadout_Type to a LoadoutTitle: Single → "Lone", Weapon+Shield → "Guardian", Dual-Wield → "Twin", Two-Handed → "Heavy"
3. THE Auto_Generation_System SHALL assign each of the 47 weapons a unique thematic WeaponCodename (e.g., Beam Pistol → "Radiant", Practice Sword → "Rusty", Sniper Rifle → "Hawkeye", Plasma Rifle → "Nova", Combat Knife → "Fang", Shotgun → "Thunder")
4. THE Auto_Generation_System SHALL append a sequential Number suffix to each robot name to ensure uniqueness across the database
5. THE Auto_Generation_System SHALL assign a unique Stable_Name to each generated user using neutral Adjective+Noun pairs that do not reveal the tier or loadout configuration to players
6. THE Auto_Generation_System SHALL ensure all generated robot names and stable names are unique across the entire database

### Requirement 14: Weapon Selection Fallback

**User Story:** As a developer, I want the auto-generation to handle cases where no weapon matches the exact loadout + range + price tier combination, so that robot creation does not fail.

#### Acceptance Criteria

1. IF no weapon exists matching the selected Loadout_Type, Range_Band, and Price_Tier combination, THEN THE Auto_Generation_System SHALL select a weapon from the same Price_Tier that matches the Loadout_Type but from a different Range_Band
2. IF no weapon exists matching the selected Loadout_Type and Price_Tier, THEN THE Auto_Generation_System SHALL log a warning and select any weapon from the same Price_Tier
3. THE Auto_Generation_System SHALL log the fallback selection for debugging purposes

### Requirement 15: League Distribution for Generated Robots

**User Story:** As a developer, I want all generated robots to start in Bronze league and be evenly distributed across league instances, so that leagues remain balanced.

#### Acceptance Criteria

1. THE Auto_Generation_System SHALL place all newly generated robots in Bronze_League with ELO 1200
2. THE Auto_Generation_System SHALL distribute newly generated robots evenly across existing Bronze_League instances
3. WHEN a Bronze_League instance reaches capacity, THE Auto_Generation_System SHALL create a new Bronze_League instance

### Requirement 16: Bankruptcy Tracking Readiness

**User Story:** As a developer, I want all generated users to start with exactly ₡100,000, so that I can monitor which stables go bankrupt over time due to repair costs exceeding income.

#### Acceptance Criteria

1. THE Auto_Generation_System SHALL set every generated user's starting currency to exactly ₡100,000
2. THE Seed_System SHALL set every seeded test user's starting currency to exactly ₡100,000
3. IF a user's currency drops below ₡0 during cycle processing, THEN THE Cycle_System SHALL log the bankruptcy event with the user's username and cycle number
