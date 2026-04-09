# Module Contract: @armoured-souls/ui

## Purpose

The React frontend application — pages, components, stores, API client, and static assets. Communicates with the API module exclusively via HTTP (no direct code imports from backend modules).

## Dependencies

- None at build time
- `@armoured-souls/api` at runtime via HTTP (REST API calls)

## Exported Artifacts

The UI module does not export TypeScript APIs. It produces built static assets:

```
dist/
├── index.html          # SPA entry point
├── assets/
│   ├── index-[hash].js # Bundled application code
│   └── index-[hash].css # Bundled styles
└── favicon.ico
```

These are served by the API module (Express static middleware) or a reverse proxy (Caddy).

## Internal Structure

### Pages (23 routes)

| Page | Route | Description |
|------|-------|-------------|
| `DashboardPage` | `/` | Player dashboard overview |
| `RobotsPage` | `/robots` | Robot roster management |
| `RobotDetailPage` | `/robots/:id` | Individual robot detail + upgrades |
| `WeaponShopPage` | `/weapons` | Weapon marketplace |
| `FacilitiesPage` | `/facilities` | Facility management + upgrades |
| `BattleHistoryPage` | `/battles` | Battle history list |
| `BattleDetailPage` | `/battles/:id` | Individual battle replay |
| `LeagueStandingsPage` | `/leagues` | League standings by tier |
| `TagTeamManagementPage` | `/tag-teams` | Tag team creation + management |
| `HallOfRecordsPage` | `/records` | All-time records |
| `ProfilePage` | `/profile` | Player profile editor |
| `PracticeArenaPage` | `/practice` | Combat simulation lab |
| `CycleSummaryPage` | `/cycle` | Cycle financial summary |
| `StableViewPage` | `/stables/:id` | View other players' stables |
| `AdminPage` | `/admin` | Admin control panel (8 tabs) |
| `LoginPage` | `/login` | Authentication |
| `RegistrationPage` | `/register` | New account creation |
| `GuidePage` | `/guide` | In-game guide |
| `TournamentPage` | `/tournaments` | Tournament brackets |

### Component Directories

| Directory | Contents |
|-----------|----------|
| `components/admin/` | Admin panel tabs (9 components) |
| `components/battle-detail/` | Battle detail sub-components (7 + types) |
| `components/facilities/` | Facilities page sub-components (5 + types + hook) |
| `components/hall-of-records/` | Records page sub-components (8 + types) |
| `components/nav/` | Navigation sub-components (5 + types) |
| `components/onboarding/` | Onboarding flow steps |
| `components/practice-arena/` | Practice arena sub-components (9 + types + hook) |
| `components/weapon-shop/` | Weapon shop sub-components (4 + types + hook) |
| `components/guide/` | Guide page components |

### State Management

| Store/Context | Purpose |
|---------------|---------|
| `stores/stableStore.ts` | Stable (player) data shared across pages |
| `stores/robotStore.ts` | Robot roster data shared across pages |
| `contexts/AuthContext` | Authentication state (token, user) |
| `contexts/OnboardingContext` | Onboarding flow state |

### API Client

| File | Purpose |
|------|---------|
| `utils/apiClient.ts` | Axios instance with auth interceptor |
| `utils/api.ts` | Base API helpers |
| `utils/robotApi.ts` | Robot API calls |
| `utils/matchmakingApi.ts` | Matchmaking/battle API calls |
| `utils/financialApi.ts` | Financial API calls |
| `utils/tournamentApi.ts` | Tournament API calls |
| `utils/tagTeamApi.ts` | Tag team API calls |
| `utils/kothApi.ts` | KotH API calls |
| `utils/onboardingApi.ts` | Onboarding API calls |
| `utils/guideApi.ts` | Guide API calls |
| `utils/userApi.ts` | User API calls |

## Current Source Location

`prototype/frontend/` — entire directory.

## External Package Dependencies

- `react` (v19) — UI framework
- `react-router-dom` — Client-side routing
- `zustand` — State management
- `axios` — HTTP client
- `tailwindcss` (v4) — Styling
- `vite` (v6) — Build tool
- `vitest` (v4) — Testing (dev)
- `@testing-library/react` — Component testing (dev)
- `fast-check` — Property-based testing (dev)
- `mermaid` — Diagram rendering (guide pages)
- `cytoscape` — Graph visualization (guide pages)
