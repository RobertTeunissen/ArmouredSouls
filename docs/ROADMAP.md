# Armoured Souls — Development Roadmap

**Last Updated**: April 2, 2026  
**Version**: 4.0

---

## Overview

This document tracks the development progress of Armoured Souls. The project is organized into phases, with Phase 1 (local prototype) now feature-complete and deployed to a production VPS. Phase 2 planning is underway.

For game design details, see [GAME_DESIGN.md](prd_core/GAME_DESIGN.md).  
For architecture details, see [ARCHITECTURE.md](prd_core/ARCHITECTURE.md).

---

## Phase 0 — Planning ✅

**Completed**: January 24, 2026

- Technology stack finalized (Node.js 24, TypeScript 5.8, Express 5, Prisma 7, React 19, Tailwind CSS 4, PostgreSQL 17)
- Game design documented (scheduled battle system inspired by Football Manager)
- MVP scope defined
- Architecture and security strategy documented

---

## Phase 1 — Prototype ✅

**Started**: January 24, 2026  
**Status**: Feature-complete, deployed to production VPS

Phase 1 delivered a fully functional game with 4 battle modes, 14 facilities, 47 weapons, a 5-step onboarding tutorial, automated daily cycles, and a production deployment on Scaleway. Development was tracked through 28 Kiro specs (22 in March, 6 in April) plus 23 earlier milestones.

### Core Systems (Jan–Feb 2026)

| Milestone | Summary |
|---|---|
| Authentication | JWT-based auth, admin/user roles, protected routes |
| Robot Management | 23 attributes (Decimal), 4 loadout types, 3 stances, yield threshold |
| Stable & Facilities | 14 facility types, 10 levels each, operating costs, coaching staff |
| Weapons & Loadout | 47 weapons (41 weapons + 6 shields), 4 range bands, inventory system |
| Matchmaking | LP-primary matching, ELO fallback, bye-robot system, same-stable deprioritization |
| Battle Engine | Tick-based combat simulation (100ms ticks, 120s max), deterministic, batch processing |
| League System | 6 tiers (Bronze → Champion), instance-based promotions, LP retention |
| Economy | Credits, prestige, fame, repair costs, streaming revenue, facility operating costs |
| Admin Tools | Admin portal, battle viewer, cycle controls, HP recalculation, seeding tools |
| Balance | HP formula rebalancing, armor cap, weapon control malfunction mechanic |
| BattleParticipant | N-participant battle data model, migrated from per-robot Battle columns |

### March 2026 Specs (22 completed)

| Spec | Summary |
|---|---|
| 2D Combat Arena | Spatial combat with positioning, range bands, movement AI, threat scoring |
| Admin Page Overhaul | Tabbed admin interface, cycle management, battle details modal |
| Cycle Audit Logging | AuditLog + CycleSnapshot models, event sourcing, per-robot audit events |
| Dependency Upgrades | Node 24, Express 5, Prisma 7, React 19, Vite 6, Tailwind 4, Jest 30, Vitest 4 |
| In-Game Guide | Markdown-based guide system with sections, articles, search |
| King of the Hill | 5-6 robot FFA zone control, Mon/Wed/Fri schedule, placement rewards |
| Manual Repair Cost Reduction | Repair Bay discount applied to manual repairs |
| Match Notifications | Discord integration, notification service, cycle result summaries |
| Mobile Responsiveness Audit | Responsive design fixes across all pages |
| New Player Onboarding | 5-step tutorial (9 backend steps), strategy selection, budget tracking |
| Player Profile Editor | Stable name, profile visibility, notification preferences, theme |
| Project Quality Audit | ESLint fixes, test infrastructure, code quality improvements |
| Repair Bay Multi-Robot Discount | Bulk repair discounts for multiple robots |
| Robot Detail Page Enhancement | Visual overhaul, attribute display, weapon info, battle history |
| Seeding & Auto User Creation | 144 user accounts, 471 robots, auto-generation during settlement |
| Streaming Revenue Overhaul | Streaming Studio facility, per-battle streaming revenue, BattleParticipant tracking |
| Tag Team Matches | 2v2 battles with active/reserve robots, tag-out mechanics, tag team leagues |
| Tournament Bracket Seeding | ELO-based seeding, balanced brackets, bye placement |
| User Registration Module | Public registration with validation, error handling |
| VPS Migration | Scaleway DEV1-S deployment, Caddy reverse proxy, PM2, automated backups |
| Weapon Bonus Rebalance | Weapon attribute bonuses rebalanced across all 47 weapons |
| Weapon & Roster Expansion | Storage facility limits, roster expansion enforcement |

### April 2026 Specs (6 completed)

| Spec | Summary |
|---|---|
| Backend Error Handling | AppError hierarchy, 10 domain-specific error classes, centralized error middleware |
| Unified Frontend API Layer | Consistent API client, error handling, loading states |
| Backend Service Consolidation | 41 flat services → 13 domain subdirectories with barrel files, baseOrchestrator |
| Frontend State Management | Zustand stores (robotStore, stableStore), React Context cleanup |
| Combat Event HP Tracking Fix | Name-keyed robotHP/robotShield maps replacing legacy robot1/robot2 fields |
| Tag Team Battle Phase Bugs | Shield state preservation, timestamp continuity, battle_start deduplication |

---

## Queued Specs (To-Do)

| Spec | Summary |
|---|---|
| Prototype → App Rename | Rename `/prototype/` to `/app/`, remove empty `/modules/`, update all references |
| Modular Architecture Migration | Document module boundaries and migration strategy (planning only, no code moves) |
| Battle Replay/Revert Admin | Admin tool to revert and replay buggy battles from the current cycle |
| Web Push Notifications | Browser push notifications for battle results and cycle events |

---

## Phase 2 — Production Hardening (Planned)

Phase 2 focuses on making the deployed application production-grade. The prototype is already live on a VPS — this phase is about reliability, not initial deployment.

### Planned Work
- Test suite restoration (pass rate needs improvement)
- E2E test coverage with Playwright
- CI/CD pipeline hardening (GitHub Actions)
- Performance optimization (database queries, caching)
- Security audit and hardening
- Monitoring and alerting (beyond Winston logs)
- Prototype → App directory rename
- Documentation consolidation and accuracy audit

### Not Planned (Deferred)
- AWS migration (current Scaleway VPS is sufficient)
- Redis caching layer (not needed at current scale)
- WebSocket real-time notifications (web push planned instead)
- React Native mobile app
- Microservices extraction
- OAuth social login

---

## Future Phases (Not Yet Scoped)

These are directional ideas, not commitments:

- **Phase 3**: Social features (friends, guilds, chat)
- **Phase 4**: Trading/marketplace
- **Phase 5**: Mobile app (PWA or React Native)
- **Phase 6**: Monetization (cosmetics, currency purchases)
- **Phase 7**: Advanced game modes (3v3, battle royale, story mode)

---

## Version History

| Version | Date | Changes |
|---|---|---|
| 4.0 | April 2, 2026 | Complete rewrite. Replaced 1200-line milestone-by-milestone log with concise phase summary. Added all 28 March/April specs. Removed aspirational AWS/Redis/WebSocket references. Updated to reflect actual Scaleway VPS deployment. Removed duplicate sections. |
| 3.2 | February 24, 2026 | Added milestones 12-22, updated implementation statistics |
| 3.1 | February 1, 2026 | Corrected completion claims, added economy system as critical gap |
| 3.0 | February 1, 2026 | Added 12 major milestones, 56 PRs documented |
| 2.0 | January 27, 2026 | Updated milestone progress, facility details |
| 1.0 | January 21, 2026 | Initial roadmap structure, phases 0-9 defined |
