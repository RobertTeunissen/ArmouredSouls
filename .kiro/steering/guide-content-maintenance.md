---
inclusion: fileMatch
fileMatchPattern: "prototype/backend/src/services/**,prototype/backend/src/game-engine/**,docs/prd_core/**,docs/balance_changes/**"
---

# In-Game Guide Content Maintenance

## When to Update Guide Content

Whenever you modify game mechanics, balance values, system behavior, or add new features that affect player decisions, you MUST also update the corresponding in-game guide content.

### Trigger Conditions

Update guide articles when changing:

1. **Combat mechanics** — damage calculations, hit chance, critical hits, stances, yield, counter-attacks, shield regeneration
2. **Robot attributes** — attribute effects, categories, caps, upgrade costs, training academy interactions
3. **League system** — tier thresholds, LP earning rates, promotion/demotion rules, matchmaking parameters, instance sizes
4. **Tournament system** — bracket generation, eligibility, rewards, seeding, bye rules
5. **Economy** — income sources, expense types, battle reward scaling, merchandising, streaming, facility costs
6. **Facilities** — new facilities, level progression, prestige requirements, operating costs, benefits
7. **Weapons & loadouts** — weapon stats, loadout types, bonuses, penalties, new weapons
8. **Prestige & Fame** — tier thresholds, earning rates, performance bonuses, rank titles
9. **Cycle system** — schedule changes, processing order, new job types
10. **Webhook/notification system** — new integrations, configuration changes, message formats

### Guide Content Location

Guide articles are stored as structured data files in the backend. When updating, locate the relevant article by section:

- Getting Started → core game loop, daily cycle, starting budget, roster strategy
- Robots → attributes, categories, HP/shield impact, upgrade costs, academy caps
- Combat → battle flow, malfunctions, stances, yield, counter-attacks
- Weapons & Loadouts → weapon categories, loadout types, bonuses, offhand rules
- Leagues & Matchmaking → tiers, LP, promotion/demotion, matchmaking
- Tournaments → format, eligibility, rewards, byes
- Economy & Finances → credits, income sources, expenses, financial cycle
- Stable & Facilities → facility types, levels, coaching, investment order
- Prestige & Fame → prestige ranks, fame tiers, income multipliers
- Strategy Guides → build archetypes, yield strategy, budget allocation
- Integrations & API → webhooks, notification service, integration setup

## Content Rules

### No Formulas
Guide content explains impact and relationships, NOT internal formulas. Use descriptions like:
- "Higher Hull Integrity → More HP"
- "Upgrading Shield Capacity strengthens your Energy Shields"
- "Higher league tiers earn significantly more battle rewards"

### UX Design Compliance
All guide UI must follow the Design System (docs/design_ux/DESIGN_SYSTEM_AND_UX_GUIDE.md):
- Direction B (Precision/Engineering) logo state
- Established color system, typography, spacing tokens
- Emotional targets: mastery, pride, deliberate ownership

### Checklist Before Committing Mechanic Changes
- [ ] Identified which guide section(s) are affected
- [ ] Updated article content to reflect new behavior
- [ ] Verified no internal formulas are exposed to players
- [ ] Updated "last updated" timestamp on modified articles
- [ ] Checked cross-links still point to valid articles
