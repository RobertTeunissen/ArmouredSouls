# Armoured Souls — Changelog

**Last Updated**: August 1, 2026

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

Phase 1 delivered a fully functional game with 4 battle modes, 15 facilities, 47 weapons, a 5-step onboarding tutorial, automated daily cycles, and a production deployment on Scaleway. Development was tracked through 52 Kiro specs (22 in March, 26 in April, 4 in May) plus 23 earlier milestones.

### Core Systems (Jan–Feb 2026)

| Milestone | Summary |
|---|---|
| Authentication | JWT-based auth, admin/user roles, protected routes |
| Robot Management | 23 attributes (Decimal), 4 loadout types, 3 stances, yield threshold |
| Stable & Facilities | 13 facility types, 10 levels each, operating costs |
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

### April 2026 Specs (26 completed)

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
| 20 | Robot Image Upload | Custom robot images with nsfwjs content moderation, two-step upload flow (preview + confirm), sharp image processing, orphan cleanup, admin uploads visibility |
| 21 | Service Layer Type Safety | Typed service interfaces, strict return types, Prisma payload typing |
| 22 | Admin Password Reset | Secure admin password reset endpoint with PasswordResetService, session invalidation via token version, rate limiting, audit logging |
| 23 | E2E Playwright Coverage | 11+ Playwright spec files covering registration, onboarding, robot creation, weapon shop, practice arena, financial flows, and CI blocking gate |
| 24 | In-Game Changelog | "What's New" modal and dedicated page, admin authoring with draft/publish workflow, category badges, optional images (deploy-driven draft auto-generation was removed in July 2026) |
| 25 | Tuning Bay | Per-robot tactical attribute tuning with 23 sliders, facility-gated pool size (10–110 points), combat integration, onboarding auto-allocation |
| 26 | Battle Report Overhaul | Statistics summary, Sankey damage flow diagram, responsive playback viewer, tabbed layout, design system alignment, CompactBattleCard economic enhancement |
| 27 | Achievement System | 77-achievement progression layer with badges, progress tracking, rarity, pinned showcase, toast notifications, retroactive awards |
| 28 | Admin Portal Redesign | Sidebar navigation, 18 lazy-loaded route pages, Zustand shared state, AdminRoute guard, 6 analytics dashboards, shared UI component library, server-side audit trail |

### May 2026 Specs (4 completed)

| # | Spec | Summary |
|---|---|---|
| 29 | Monitoring & Alerting | Discord webhook alerts for disk/startup/backup/deploy failures, enhanced health endpoint, daily health report, UptimeRobot external probes, Scaleway Cockpit integration |
| 30 | Fix Investment Advisor | Unified ROI calculation from CycleSnapshot data, consolidated Investments & Advisor tabs, graceful degradation with incomplete audit data, economic-only facility filtering |
| 31 | Weapon DPS Rebalance | baseDamage compression (3.0× → 2.0× DPS spread), differentiated top-tier weapon profiles (fast/standard/burst/heavy), Float schema migration, battle duration normalization (~34s → ~45s) |
| 32 | League History Tracking | Persistent tier change tracking for robots and tag teams, admin analytics dashboard with yo-yo detection, player-facing timeline visualizations, achievement data support |

### May 2026 — Additional Deliverables

| Item | Spec | Summary |
|---|---|---|
| Weapon Resale | [Spec #33](/.kiro/specs/done-may26/33-weapon-resale/) | Workshop-level-dependent rate, ₡0–100% recovery |
| Weapon Refinement | [Spec #34](/.kiro/specs/done-may26/34-weapon-refinement/) | Per-instance permanent upgrades, 4 tiers, 5-slot cap |
| Booking Office / Event Subscription | [Spec #35](/.kiro/specs/done-may26/35-booking-office-facility/) | Per-robot subscription model gating participation in all battle events |
| Cron Schedule Restructure | [Spec #36](/.kiro/specs/done-may26/36-cron-schedule-restructure/) | Daily-everything slot map |
| Team Battles 2v2 and 3v3 (League) | [Spec #37](/.kiro/specs/done-may26/37-team-battles-2v2-3v3/) | Persistent teams, simultaneous combat, shared LP-primary matchmaking |
| Untrack Generated Prisma Client | — | 68K lines out of git |
| HTTP Client Consolidation | — | Typed `api` wrapper everywhere |
| Console → Structured Logger Migration | — | FE + BE |
| Env Validation with Zod | — | Fail-fast in production |
| Pre-commit Hooks | — | husky + lint-staged |
| Dead Code Audit | — | knip Pass A + B, ~30 files removed |
| Backend `any` Eliminated | — | Removed from production source |
| Performance Optimization | — | Direct implementation |
| Smooth Prestige Multiplier Scaling | — | Direct implementation |
| Battle History URL State Persistence | — | Direct implementation |
| Hall of Records Performance Caching | — | Direct implementation |
| League & Tag Team Instance Deep Linking | — | Direct implementation |

### June 2026 Specs & Deliverables

| Item | Spec | Summary |
|---|---|---|
| Team Battle Tournaments (2v2 / 3v3) | [Spec #38](/.kiro/specs/done-june26/38-team-battle-tournaments/) | Single-elimination bracketed tournaments, daily round cadence, coordination effects |
| Battle Log Retention / TOAST Trim | [Spec #39](/.kiro/specs/to-do/39-battle-log-retention/) | Pre-computed summaries, 7-day retention, nightly cron |
| Database Unification | [Spec #40](/.kiro/specs/done-june26/40-database-unification/) | Unified standings, financial ledger, leaderboard cache |
| Unified Match Scheduling | [Spec #41](/.kiro/specs/done-june26/41-unified-match-scheduling/) | Single scheduling table, shared matchmaking pipeline |
| Tag Team System Unification | [Spec #42](/.kiro/specs/done-june26/42-tag-team-system-unification/) | Tag team as combat mode on 2v2 TeamBattle |
| Legacy Column Drop (Phase 2) | [Spec #43](/.kiro/specs/to-do/43-legacy-column-drop/) | Spec #40 follow-up |
| Grand Melee Mode | [Spec #44](/.kiro/specs/to-do/44-grand-melee/) | 20-robot FFA, F1-style placement scoring, full league system |
| Tag Team Battle Time Limit Enforcement | — | Closed as working-as-designed, documented in BATTLE_SIMULATION_ARCHITECTURE.md |
| Battle Table Denormalization Cleanup | — | 19 deprecated columns dropped (completes Spec #43 Task 6.4) |
| Mega-Orchestrator Refactor | — | Combat-critical files |
| Unimplemented Facilities Removal | — | Research Lab, Medical Bay, Coaching Staff |
| Frontend Page Hook Extraction | — | RobotsPage, RobotDetailPage |
| Vitest Performance Tuning | — | CI scripts, dot reporter, coverage gitignore |
| Test Setup Convention Cleanup | — | Co-located `__tests__/`, eliminated centralized sprawl |
| Backend Test Reclassification | — | 66 no-DB tests → unit runner, zero overlap, ~2min CI savings |

### July 2026 Specs & Deliverables

| Item | Spec | Summary |
|---|---|---|
| Season System | [Spec #45](/.kiro/specs/to-do/45-season-system/) | 100-cycle competitive seasons, 2-cycle prep windows, full archive + reset |
| Repair the Integration Test Suite | — | 149→0 compile errors, `typecheck:tests` passes, deleted 3k-line dead test file |

---

