# Game Engine Module

## Overview

This module contains the core game logic, rules, and mechanics for Armoured Souls.

## Status

🚧 **Planning Phase** - No implementation yet

## Responsibilities

- Game rule enforcement
- Turn processing and game state management
- Resource management system
- Experience and leveling system
- Game state validation
- Event generation and handling
- Battle orchestration

## Key Questions to Resolve

1. **Battle Mechanics**: Turn-based or real-time?
2. **Game Flow**: Async or synchronous gameplay?
3. **Determinism**: Should battles be deterministic for replays?
4. **Server Authority**: Server-side or client-side game logic?

See [QUESTIONS.md](../../docs/QUESTIONS.md) for full list of design questions.

## Technologies (Proposed)

- To be determined based on battle mechanics decision
- Options: Custom engine, Phaser.js, PixiJS

## API Endpoints (Planned)

- `POST /api/v1/game/create` - Create new game instance
- `GET /api/v1/game/{id}` - Get game state
- `POST /api/v1/game/{id}/action` - Submit player action
- `GET /api/v1/game/{id}/events` - Get game events
- `GET /api/v1/game/{id}/state` - Get current game state

## Game Loop (Conceptual)

```
1. Initialize game state
2. Process player actions
3. Update game state
4. Validate state
5. Generate events
6. Repeat
```

## Dependencies

- Battle module (combat simulation)
- Robot module (unit data)
- Player module (player data)
- Database module (state persistence)

## Documentation

See [MODULE_STRUCTURE.md](../../docs/MODULE_STRUCTURE.md) for detailed module specifications.

## Future Development

Core game mechanics will be designed once key gameplay questions are answered.