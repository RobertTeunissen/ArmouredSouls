# Phase 1: Local Prototype - Detailed Plan

**Last Updated**: January 24, 2026

## Overview

**Goal**: Build a minimal working prototype of Armoured Souls running locally to validate the core game concept with friends.

**Team**: 2 people (Robert + AI)  
**Development Style**: Async (AI builds, Robert reviews)  
**Testing**: 6 user accounts for local testing  
**Target**: Demo-ready prototype to show friends

---

## What Makes This Prototype Successful?

The prototype should demonstrate:
1. ✅ Robot creation with stat customization
2. ✅ Component system (weapons, armor) affecting gameplay
3. ✅ Battle simulation that produces interesting outcomes
4. ✅ Battle logs that are engaging to read
5. ✅ Different strategies lead to different results
6. ✅ Friends want to play more battles after seeing it

---

## Core Features for Prototype

### Must Have (Critical for Demo)

1. **User Management** (NEW for prototype)
   - Basic username/password authentication
   - 6 test user accounts
   - Admin user with elevated rights
   - Login/logout functionality

2. **Robot Creator**
   - Create robot with name
   - Distribute stat points (attack, defense, speed, health)
   - Select chassis type
   - Equip weapon and armor
   - Save robot to database

3. **Robot Upgrading** (NEW for prototype)
   - Simple currency system
   - Spend currency to upgrade robot stats
   - Track currency balance per user

4. **Stable Management** (NEW for prototype)
   - View all robots owned by user
   - Organize robot collection
   - Select robots for battles

5. **Battle Simulator**
   - Input: Two robots
   - Process: Turn-based simulation
   - Output: Winner + detailed battle log
   - Shows damage dealt, health remaining, actions taken
   - Manual trigger for battles (no automated scheduling)

6. **Component Library**
   - 5-10 weapons with different stats
   - 5-10 armor pieces with different stats  
   - 3-5 chassis types
   - Components modify robot effectiveness

7. **Simple UI** (Text-based, no animations)
   - Login page
   - Robot list page
   - Robot creation page
   - Robot upgrade page
   - Stable management page
   - Battle setup page
   - Battle results page with log

8. **Battle History**
   - Store all battles in database
   - View past battles
   - See win/loss record per robot

### Explicitly NOT in Prototype

- ❌ OAuth/social login (basic username/password only)
- ❌ Matchmaking or queues
- ❌ Automated battle scheduling (manual trigger only)
- ❌ Achievements or complex progression
- ❌ Social features (friends, guilds, chat)
- ❌ Deployment to cloud
- ❌ Mobile support
- ❌ Professional UI/UX design
- ❌ Animations or visual effects
- ❌ Battle replay visualizations
- ❌ Robot comparison tools

---

## Technical Architecture (Simplified)

**Project Structure**: Isolated prototype in `/prototype` directory

```
ArmouredSouls/
├── docs/                 # Project documentation
├── prototype/            # Phase 1 isolated prototype codebase
│   ├── backend/          # Node.js + Express + Prisma
│   ├── frontend/         # React + Tailwind CSS
│   └── docker-compose.yml
└── modules/              # Future production codebase (Phase 2+)
```

**Architecture Diagram**:

```
┌─────────────────────────────────────────┐
│    React + Tailwind CSS (Port 3000)     │
│                                         │
│  • Login/Logout                         │
│  • User Management                      │
│  • Robot List & Creator                 │
│  • Robot Upgrading                      │
│  • Stable Management                    │
│  • Battle Setup                         │
│  • Battle Results & History             │
└─────────────────┬───────────────────────┘
                  │ HTTP/REST
┌─────────────────▼───────────────────────┐
│  Node.js + Express Backend (Port 3001)  │
│                                         │
│  • REST API (Express)                   │
│  • Authentication (JWT + bcrypt)        │
│  • Battle Simulation Engine             │
│  • Database ORM (Prisma)                │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│      PostgreSQL (Port 5432)             │
│      via Docker Compose                 │
│                                         │
│  • Users (username, password_hash, role)│
│  • Robots                               │
│  • Components                           │
│  • Battles                              │
│  • Currency balances                    │
└─────────────────────────────────────────┘
```

**Technology Stack**:
- **Backend**: Express (finalized)
- **ORM**: Prisma (finalized)
- **Frontend**: React + Tailwind CSS (finalized)
- **Database**: PostgreSQL + Docker
- **Testing**: Automated tests on every commit (CI/CD via GitHub Actions)

---

## Database Schema (Minimal)

### Users Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'user', -- 'user' or 'admin'
  currency INTEGER DEFAULT 1000, -- Starting currency
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Robots Table
```sql
CREATE TABLE robots (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  name VARCHAR(100) NOT NULL,
  chassis_id INTEGER REFERENCES components(id),
  weapon_id INTEGER REFERENCES components(id),
  armor_id INTEGER REFERENCES components(id),
  
  -- Base stats (before components)
  base_attack INTEGER NOT NULL,
  base_defense INTEGER NOT NULL,
  base_speed INTEGER NOT NULL,
  base_health INTEGER NOT NULL,
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Components Table
```sql
CREATE TABLE components (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL, -- 'chassis', 'weapon', 'armor'
  description TEXT,
  
  -- Stat modifiers
  attack_modifier INTEGER DEFAULT 0,
  defense_modifier INTEGER DEFAULT 0,
  speed_modifier INTEGER DEFAULT 0,
  health_modifier INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Battles Table
```sql
CREATE TABLE battles (
  id SERIAL PRIMARY KEY,
  robot1_id INTEGER REFERENCES robots(id),
  robot2_id INTEGER REFERENCES robots(id),
  winner_id INTEGER REFERENCES robots(id),
  
  battle_log JSONB NOT NULL, -- Full turn-by-turn log
  
  turns_taken INTEGER,
  robot1_damage_dealt INTEGER,
  robot2_damage_dealt INTEGER,
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Battle Simulation Algorithm

### Core Logic

```typescript
interface Robot {
  id: number;
  name: string;
  attack: number;  // Final attack (base + modifiers)
  defense: number; // Final defense (base + modifiers)
  speed: number;   // Determines turn order
  health: number;  // Current health
  maxHealth: number; // Starting health
}

interface BattleLog {
  turns: Turn[];
  winner: number; // Robot ID
  totalTurns: number;
}

interface Turn {
  turnNumber: number;
  attacker: string; // Robot name
  defender: string; // Robot name
  damageDealt: number;
  defenderHealthAfter: number;
  action: string; // e.g., "Laser strikes for 25 damage"
}

function simulateBattle(robot1: Robot, robot2: Robot): BattleLog {
  const log: BattleLog = { turns: [], winner: 0, totalTurns: 0 };
  
  let currentHealth1 = robot1.maxHealth;
  let currentHealth2 = robot2.maxHealth;
  
  let turnNumber = 0;
  const maxTurns = 100; // Prevent infinite battles
  
  while (currentHealth1 > 0 && currentHealth2 > 0 && turnNumber < maxTurns) {
    turnNumber++;
    
    // Determine who attacks first (higher speed)
    const firstAttacker = robot1.speed >= robot2.speed ? robot1 : robot2;
    const firstDefender = robot1.speed >= robot2.speed ? robot2 : robot1;
    
    // First attacker's turn
    const damage1 = calculateDamage(firstAttacker.attack, firstDefender.defense);
    if (firstAttacker === robot1) {
      currentHealth2 -= damage1;
    } else {
      currentHealth1 -= damage1;
    }
    
    log.turns.push({
      turnNumber,
      attacker: firstAttacker.name,
      defender: firstDefender.name,
      damageDealt: damage1,
      defenderHealthAfter: firstAttacker === robot1 ? currentHealth2 : currentHealth1,
      action: `${firstAttacker.name} attacks ${firstDefender.name} for ${damage1} damage`
    });
    
    // Check if defender is defeated
    if ((firstAttacker === robot1 && currentHealth2 <= 0) || 
        (firstAttacker === robot2 && currentHealth1 <= 0)) {
      log.winner = firstAttacker.id;
      log.totalTurns = turnNumber;
      return log;
    }
    
    // Second attacker's turn (if they survived)
    const damage2 = calculateDamage(firstDefender.attack, firstAttacker.defense);
    if (firstDefender === robot1) {
      currentHealth2 -= damage2;
    } else {
      currentHealth1 -= damage2;
    }
    
    log.turns.push({
      turnNumber,
      attacker: firstDefender.name,
      defender: firstAttacker.name,
      damageDealt: damage2,
      defenderHealthAfter: firstDefender === robot1 ? currentHealth2 : currentHealth1,
      action: `${firstDefender.name} attacks ${firstAttacker.name} for ${damage2} damage`
    });
    
    // Check winner
    if (currentHealth1 <= 0) {
      log.winner = robot2.id;
      log.totalTurns = turnNumber;
      return log;
    }
    if (currentHealth2 <= 0) {
      log.winner = robot1.id;
      log.totalTurns = turnNumber;
      return log;
    }
  }
  
  // If we hit max turns, higher health wins
  log.winner = currentHealth1 > currentHealth2 ? robot1.id : robot2.id;
  log.totalTurns = maxTurns;
  return log;
}

function calculateDamage(attack: number, defense: number): number {
  // Simple formula: damage = max(1, attack - defense)
  // Always deal at least 1 damage
  const damage = attack - defense;
  return Math.max(1, damage);
}
```

### Enhancements for Interest

Add some randomness while keeping determinism:
- Critical hits (10% chance, 2x damage)
- Miss chance (5% chance, 0 damage)
- Use seeded random based on battle ID + turn number

---

## Sample Components

### Chassis Types

| Name | Health | Speed | Defense | Attack |
|------|--------|-------|---------|--------|
| Tank | +50 | -5 | +10 | +0 |
| Scout | +0 | +10 | -5 | +5 |
| Balanced | +20 | +0 | +0 | +0 |
| Berserker | +10 | +5 | -10 | +15 |
| Fortress | +100 | -10 | +20 | -5 |

### Weapons

| Name | Attack Bonus | Description |
|------|-------------|-------------|
| Laser Rifle | +15 | Standard energy weapon |
| Plasma Cannon | +25 | High damage, heavy |
| Machine Gun | +10 | Rapid fire |
| Hammer | +20 | Melee weapon |
| Sniper Laser | +30 | Precision weapon |
| Sword | +12 | Basic melee |
| Rocket Launcher | +35 | Maximum damage |

### Armor

| Name | Defense Bonus | Speed Penalty |
|------|--------------|---------------|
| Heavy Plate | +20 | -5 |
| Light Armor | +10 | +0 |
| Energy Shield | +15 | +2 |
| Stealth Coating | +5 | +5 |
| Reactive Armor | +25 | -8 |
| Nano-Weave | +12 | +3 |

---

## Development Workflow

### Week 1: Foundation
**Days 1-2**: Environment Setup
- Install Node.js, Docker
- Initialize project with TypeScript
- Set up PostgreSQL via Docker Compose
- Create basic project structure

**Days 3-4**: Database & ORM
- Define schema
- Set up Prisma or TypeORM
- Create seed data script
- Test database connection

**Days 5-7**: Battle Engine
- Implement core simulation algorithm
- Test with various robot configurations
- Ensure deterministic results
- Create CLI tool to test battles

### Week 2: API & Components
**Days 8-10**: REST API
- Set up Express/Fastify
- Create robot CRUD endpoints
- Create battle endpoints
- Test with Postman/Thunder Client

**Days 11-14**: Component System
- Add component endpoints
- Integrate components into battle simulation
- Test various component combinations
- Verify stat calculations

### Week 3: UI Foundation
**Days 15-17**: React Setup
- Initialize React app
- Set up routing
- Create layout components
- Connect to backend API

**Days 18-21**: Core Pages
- Robot list page
- Robot creation form
- Battle setup page
- Battle results viewer

### Week 4: Polish & Demo Prep
**Days 22-24**: Testing & Refinement
- Test all features end-to-end
- Fix bugs
- Balance adjustments
- Performance testing

**Days 25-28**: Demo Preparation
- Create interesting preset robots
- Pre-run sample battles
- Write setup documentation
- Test on fresh machine
- Practice demo script

---

## Success Metrics for Prototype

### Technical Success
- ✅ Battle simulation completes in <100ms
- ✅ Can process 100 battles in <10 seconds
- ✅ Zero crashes during demo
- ✅ Database persists correctly
- ✅ UI responsive on laptop screen

### Game Design Success
- ✅ At least 3 different viable strategies
- ✅ Battle outcomes feel logical given stats
- ✅ Battle logs are interesting to read
- ✅ Friends understand how to create robots
- ✅ Friends want to try more battles

### Feedback Goals
- What did friends like most?
- What was confusing?
- What would make it more fun?
- Would they play this regularly?
- What features are they asking for?

---

## Demo Script

### Part 1: Introduction (2 minutes)
"This is Armoured Souls - think Football Manager but for robot battles. You configure your robots, schedule battles, and see how they perform."

### Part 2: Robot Creation (3 minutes)
1. Show robot creator
2. Explain stat system
3. Select chassis, weapon, armor
4. Create a balanced robot
5. Create a specialized robot (e.g., glass cannon)

### Part 3: Battle Simulation (3 minutes)
1. Select two robots to fight
2. Run battle simulation
3. Show battle log turn-by-turn
4. Highlight interesting moments
5. Explain why winner won

### Part 4: Strategy (2 minutes)
1. Show how different builds perform
2. "Tank vs Scout" matchup
3. "High attack vs High defense" matchup
4. Emphasize strategy matters

### Part 5: Feedback (5 minutes)
Ask:
- What did you think?
- Would you play this?
- What would make it better?
- What's missing?
- Any confusion?

---

## Risk Management

### Technical Risks
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Battle engine too slow | Low | Medium | Profile early, optimize algorithm |
| Database issues | Low | High | Use proven ORM, test thoroughly |
| UI bugs | Medium | Low | Focus on functionality over polish |
| Docker problems | Medium | Medium | Document setup well, test on multiple machines |

### Schedule Risks
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Scope creep | High | High | **Strict feature list, no additions** |
| Over-engineering | Medium | Medium | Keep it simple, refactor in Phase 2 |
| Time estimates wrong | Medium | Low | Buffer week built into 4-8 week estimate |

### Game Design Risks
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Not fun | Medium | High | **Get feedback early and often** |
| Too complex | Medium | Medium | Simplify if friends are confused |
| Too simple | Low | Medium | Easy to add depth in Phase 2 |

---

## Documentation Deliverables

At end of Phase 1, create/update:

1. **Setup Guide** (`docs/SETUP.md`)
   - How to install dependencies
   - How to run locally
   - How to seed database
   - Troubleshooting common issues

2. **Battle Mechanics** (`docs/BATTLE_MECHANICS.md`)
   - Damage calculation formulas
   - Turn order rules
   - Component effects
   - Stat ranges and balance

3. **Lessons Learned** (`docs/PHASE1_LESSONS.md`)
   - What worked well
   - What didn't work
   - Friends' feedback summary
   - Recommendations for Phase 2

4. **Component Catalog** (`docs/COMPONENTS.md`)
   - List of all components
   - Stats for each
   - Recommended builds

---

## Next Steps After Phase 1

Based on feedback, decide:

### Path A: Continue (Feedback is positive)
- Proceed to Phase 2 (Foundation & Infrastructure)
- Implement authentication
- Deploy to AWS
- Add matchmaking

### Path B: Pivot (Feedback reveals issues)
- Revisit game mechanics
- Adjust battle system
- Simplify or add complexity
- Run another prototype iteration

### Path C: Stop (Feedback is negative)
- Document learnings
- Archive project
- Consider different game concept

---

**The goal of Phase 1 is to fail fast or validate fast. Either outcome is valuable!**