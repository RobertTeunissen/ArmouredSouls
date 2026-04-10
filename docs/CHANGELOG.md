# Armoured Souls — Changelog

**Last Updated**: April 9, 2026

Development history organized by phase and month. For the forward-looking roadmap, see [ROADMAP.md](ROADMAP.md).

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

Phase 1 delivered a fully functional game with 4 battle modes, 14 facilities, 47 weapons, a 5-step onboarding tutorial, automated daily cycles, and a production deployment on Scaleway. Development was tracked through 40 Kiro specs (22 in March, 18 in April) plus 23 earlier milestones.

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

### April 2026 Specs (18 completed)

| # | Spec | Summary |
|---|---|---|
| 1 | Backend Error Handling | AppError hierarchy, 10 domain-specific error classes, centralized error middleware |
| 2 | Unified Frontend API Layer | Consistent API client, error handling, loading states |
| 3 | Backend Service Consolidation | 41 flat services → 13 domain subdirectories with barrel files, baseOrchestrator |
| 4 | Frontend State Management | Zustand stores (robotStore, stableStore), React Context cleanup |
| 5 | Modular Architecture Migration | Module contracts, service mapping, migration strategy |
| 6 | Combat Event HP Tracking Fix | Name-keyed robotHP/robotShield maps replacing legacy robot1/robot2 fields |
| 7 | Tag Team Battle Phase Bugs | Shield state preservation, timestamp continuity, battle_start deduplication |
| 10 | Prototype → App Rename | Renamed `/prototype/` to `/app/`, removed `/modules/`, updated all references |
| 11 | Security Audit Guardrails | ESLint security plugin, Zod validation enforcement, ownership verification patterns |
| 12 | Admin Security Dashboard | Security monitoring dashboard, rate limit tracking, authorization failure logging |
| 13 | Practice Arena | Offline practice battles against synthetic opponents, daily stats tracking |
| 14 | View Other Stables | Public stable profiles, robot roster viewing, battle history |
| 15 | Route Handler Extraction | Thin route handlers, business logic extracted to service layer |
| 16 | Zod Validation Gaps | Zod schemas for all remaining routes, centralized validation primitives |
| 17 | Type Safety & Any Elimination | Removed `any` types, strict Prisma typing, typed JSON payloads |
| 18 | Frontend Component Splitting | Large components decomposed into focused sub-components |
| 19 | Frontend Testing Foundation | Vitest setup, component test patterns, coverage infrastructure |
| 21 | Service Layer Type Safety | Typed service interfaces, strict return types, Prisma payload typing |

---

