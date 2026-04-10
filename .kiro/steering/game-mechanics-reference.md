---
inclusion: fileMatch
fileMatchPattern: "**/game-engine/**,**/services/battle*,**/services/combat*,**/services/matchmaking*,**/services/league*,**/services/cycle*,**/services/economy*,**/services/fame*,**/services/facility*,**/services/tournament*"
---

# Game Mechanics Quick Reference

## Core Game Loop

1. **Player Actions** - Manage robots, buy weapons, upgrade facilities
2. **Cycle Processing** - Automated daily/weekly cycles run battles
3. **Battle Resolution** - Combat system calculates outcomes
4. **Rewards & Progression** - Credits, fame, league standings update

## Key Game Concepts

### Robots
- Players own multiple robots
- Each robot has attributes (armor, speed, etc.)
- Robots can be equipped with weapons
- Robots participate in battles and earn/lose stats
- See: `docs/game-systems/PRD_ROBOT_ATTRIBUTES.md`

### Weapons & Loadouts
- Weapons have different types and stats
- Robots can equip multiple weapons (loadout)
- Weapon shop for purchasing
- See: `docs/game-systems/PRD_WEAPONS_LOADOUT.md`

### Combat System
- Turn-based battle resolution
- Damage calculations based on weapons and armor
- Battle stances affect outcomes
- See: `docs/architecture/COMBAT_FORMULAS.md`

### League System
- Multiple leagues (divisions)
- Promotion and relegation based on performance
- League Points (LP) determine standings
- See: `docs/game-systems/PRD_LEAGUE_SYSTEM.md`

### Economy
- Credits as primary currency
- Facilities generate income
- Investments provide returns
- Repair costs for damaged robots
- See: `docs/game-systems/PRD_ECONOMY_SYSTEM.md`

### Facilities
- Players can build/upgrade facilities
- Facilities provide passive income
- Different facility types with different benefits
- See: `docs/prd_pages/PRD_FACILITIES_PAGE.md`

### Fame & Prestige
- Fame earned through victories
- Prestige as long-term progression
- Affects matchmaking and rewards
- See: `docs/game-systems/PRD_PRESTIGE_AND_FAME.md`

### Cycle System
- Automated game progression
- Daily and weekly cycles
- Processes battles, updates standings, distributes rewards
- See: `docs/game-systems/PRD_CYCLE_SYSTEM.md`

### Matchmaking
- Pairs robots for battles
- Considers league, fame, and other factors
- Aims for balanced matches
- See: `docs/game-systems/PRD_MATCHMAKING.md`

### Tournaments
- Special competitive events
- Bracket-style competition
- Enhanced rewards
- See: `docs/game-systems/PRD_TOURNAMENT_SYSTEM.md`

## Important Game Balance Considerations

When modifying game mechanics:
- **Economy balance** - Ensure income/expenses are sustainable
- **Combat balance** - No single strategy should dominate
- **Progression pacing** - Players should feel steady advancement
- **League distribution** - Players should spread across leagues naturally

See `docs/balance_changes/` for historical balance modifications and rationale.

## Player Archetypes

Different players engage with the game differently:
- **Competitors** - Focus on winning battles and climbing leagues
- **Collectors** - Enjoy acquiring robots and weapons
- **Optimizers** - Min-max strategies and economics
- **Casual players** - Check in periodically, enjoy progression

See: `docs/PLAYER_ARCHETYPES_GUIDE.md`

## Data Flow

1. **User actions** → API endpoints → Database updates
2. **Cycle triggers** → Game engine processes → Battle resolution → Database updates
3. **Frontend requests** → API → Database queries → Response to user

## Critical Systems Interactions

- **Battles affect**: Robot stats, league standings, fame, credits (rewards)
- **Economy affects**: Ability to buy weapons, upgrade facilities, repair robots
- **Leagues affect**: Matchmaking, rewards, prestige
- **Facilities affect**: Income generation, economic sustainability
- **Fame affects**: Matchmaking, prestige progression

## When Implementing Features

Always consider:
1. **Impact on game balance** - Will this make the game too easy/hard?
2. **Economic impact** - Does this affect credit flow?
3. **Player experience** - Is this fun and engaging?
4. **System interactions** - What other systems does this affect?
5. **Edge cases** - What happens in unusual scenarios?

## Testing Game Mechanics

When testing or verifying game mechanics:
1. Check relevant PRD for expected behavior
2. Test with various input values
3. Verify database state changes correctly
4. Check impact on related systems
5. Consider edge cases (zero values, maximum values, etc.)
