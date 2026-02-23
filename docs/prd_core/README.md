# Core PRDs

This folder contains Product Requirements Documents (PRDs) for the core systems and mechanics of Armoured Souls.

## Purpose

Core PRDs define the fundamental game systems, mechanics, and architecture that power the entire game. These are the foundational specifications that all other features build upon.

## Contents

### Architecture & Data
- `ARCHITECTURE.md` - Overall system architecture
- `DATABASE_SCHEMA.md` - Complete database schema reference
- `PRD_BATTLE_DATA_ARCHITECTURE.md` - BattleParticipant table and battle data design
- `PRD_AUDIT_SYSTEM.md` - Audit logging architecture
- `SEED_DATA_SPECIFICATION.md` - Test data and seeding specifications

### Core Game Systems
- `GAME_DESIGN.md` - Overall game design philosophy
- `PRD_ROBOT_ATTRIBUTES.md` - 23-attribute system specification
- `PRD_WEAPONS_LOADOUT.md` - Weapon and loadout system
- `PRD_ECONOMY_SYSTEM.md` - Credit system and economic design
- `STABLE_SYSTEM.md` - Facility and stable management

### Combat & Battles
- `COMBAT_FORMULAS.md` - All combat calculation formulas
- `COMBAT_MESSAGES.md` - Battle message generation system
- `PRD_BATTLE_STANCES_AND_YIELD.md` - Battle stance mechanics

### Progression Systems
- `PRD_CYCLE_SYSTEM.md` - Time progression and cycle execution
- `PRD_MATCHMAKING.md` - ELO-based matchmaking system
- `PRD_MATCHMAKING_LP_UPDATE.md` - League points matchmaking updates
- `PRD_LEAGUE_PROMOTION.md` - League promotion mechanics
- `PRD_LEAGUE_REBALANCING.md` - League instance balancing
- `LEAGUE_SYSTEM_IMPLEMENTATION_GUIDE.md` - Complete league system guide
- `PRD_PRESTIGE_AND_FAME.md` - Prestige and fame systems
- `PRD_FAME_SYSTEM.md` - Fame system details

### Advanced Features
- `PRD_TOURNAMENT_SYSTEM.md` - Tournament mechanics
- `PRD_AUTO_USER_GENERATION.md` - Automated user generation for testing

## Related Documentation

For page-specific requirements, see:
- `docs/prd_pages/` - Individual page PRDs
- `docs/design_ux/` - Design system and UX guidelines
- `docs/guides/` - Setup and operational guides
- `docs/balance_changes/` - Balance adjustment documentation

## PRD Structure

Core PRDs typically include:
1. Executive Summary
2. Background and Context
3. System Architecture/Design
4. Technical Specifications
5. Formulas and Calculations
6. Implementation Details
7. Testing Requirements
8. Related Systems
9. Future Enhancements

## Usage

When working on core systems:
1. Read the relevant PRD thoroughly
2. Understand dependencies on other systems
3. Follow specified formulas and calculations exactly
4. Update PRDs when requirements change
5. Ensure changes are reflected in related documentation
