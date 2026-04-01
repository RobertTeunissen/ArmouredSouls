# Implementation Plan: Dependency Upgrades

## Overview

Upgrade all dependencies across the Armoured Souls project in a linear pipeline of 15 phases, ordered by dependency graph depth. Each phase is independently committable and revertable. Infrastructure and runtime first, then toolchain, then frameworks, then minor/patch updates, and finally guardrails and documentation. Every phase ends with a verification gate: build + lint + tests must pass before proceeding.

## Tasks

- [x] 1. PostgreSQL 16 → 17 (Infrastructure)
  - [x] 1.1 Update Docker Compose files to PostgreSQL 17
    - Change `image: postgres:16-alpine` to `image: postgres:17-alpine` in `prototype/docker-compose.yml`
    - Change `image: postgres:16-alpine` to `image: postgres:17-alpine` in `prototype/docker-compose.production.yml`
    - Destroy and recreate the local Docker volume to start fresh on PG 17: `docker compose down -v && docker compose up -d`
    - Run `npx prisma migrate deploy` in `prototype/backend` to verify all migrations apply cleanly against PG 17
    - Run backend build and full test suite to confirm database compatibility
    - _Requirements: 10.1, 10.2, 10.3_

- [x] 2. Node.js 20 → 24 LTS (Runtime)
  - [x] 2.1 Update Node.js version across the project
    - Update `engines` field in `prototype/backend/package.json` to `"node": ">=24.0.0"`
    - Update `engines` field in `prototype/frontend/package.json` to `"node": ">=24.0.0"`
    - Create or update `.nvmrc` in project root with `24`
    - Update `@types/node` in backend `devDependencies` to a version compatible with Node.js 24
    - Update `@types/node` in frontend `devDependencies` to a version compatible with Node.js 24
    - Run `npm ci` in both backend and frontend, then build and test to verify Node.js 24 compatibility
    - Fix any Node.js 24 API incompatibilities in source code if they arise
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 3. Checkpoint — PostgreSQL and Node.js upgrades
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. TypeScript 5.3 → 5.8 (Compiler)
  - [x] 4.1 Upgrade TypeScript in both packages
    - Update `typescript` to `^5.8.0` in both `prototype/backend/package.json` and `prototype/frontend/package.json`
    - Run `npm install` in both directories
    - Review `tsconfig.json` and `tsconfig.seed.json` (backend) and `tsconfig.json` / `tsconfig.node.json` (frontend) for new TS 5.8 compiler options worth enabling
    - Run `npm run build` in both backend and frontend; fix any new type errors surfaced by stricter checking
    - Run full test suites in both packages
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 5. Prisma 5 → 7 (ORM Migration)
  - [x] 5.1 Upgrade Prisma packages and configure generated client output
    - Update `prisma` and `@prisma/client` to `^7.0.0` in `prototype/backend/package.json`
    - Add `output = "../generated/prisma"` to the `generator client` block in `prototype/backend/prisma/schema.prisma`
    - Run `npx prisma generate` to produce the client in the new location
    - Add `prototype/backend/generated/` to `.gitignore` if the generated client should not be committed (or keep it — follow Prisma 7 recommendations)
    - _Requirements: 3.1, 3.2, 3.5_
  - [x] 5.2 Update all Prisma import paths across backend source and tests
    - Find all files in `prototype/backend/src/` and `prototype/backend/tests/` that import from `@prisma/client`
    - Replace every `@prisma/client` import with the relative path to `generated/prisma` (e.g., `import { PrismaClient } from '../generated/prisma'`)
    - Update `prisma.seed` configuration in `package.json` for Prisma 7 compatibility
    - Remove `@prisma/client` from `dependencies` in `package.json` if Prisma 7 no longer requires it as a direct dependency
    - Run `npm run build` and full backend test suite to verify all queries, transactions, and seed scripts work
    - _Requirements: 3.3, 3.4, 3.6, 3.7, 3.8_
  - [x] 5.3 Write property test: No legacy Prisma import paths (Property 2)
    - **Property 2: No legacy Prisma import paths in source code**
    - Glob all `.ts` files in `prototype/backend/src/` and `prototype/backend/tests/`; for each file, assert no import references `@prisma/client`
    - Create test in `prototype/backend/tests/dependency-upgrade-invariants.property.test.ts`
    - **Validates: Requirements 3.6**

- [x] 6. Express 4 → 5 (Web Framework)
  - [x] 6.1 Upgrade Express and apply codemod
    - Update `express` to `^5.1.0` in `prototype/backend/package.json`
    - Update `@types/express` to the Express 5 compatible version
    - Run the official Express 5 codemod: `npx @expressjs/codemod` in `prototype/backend`
    - Review codemod output and manually fix any remaining issues (removed `req.param()`, stricter path patterns, `app.del()` removal)
    - Verify async error handling works — Express 5 catches rejected promises in route handlers automatically
    - Run `npm run build` and full backend test suite
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  - [x] 6.2 Write property test: Express 5 async error propagation (Property 3)
    - **Property 3: Express 5 async error propagation**
    - Generate random async route handlers that throw various error types; mount on a test Express app; assert proper HTTP error responses (status >= 400) rather than timeouts or crashes
    - Add test to `prototype/backend/tests/dependency-upgrade-invariants.property.test.ts`
    - **Validates: Requirements 4.4**

- [x] 7. Checkpoint — Core backend upgrades (Prisma + Express)
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Jest 29 → 30 (Backend Test Runner)
  - [x] 8.1 Upgrade Jest and ts-jest
    - Update `jest` to `^30.0.0` and `ts-jest` to the Jest 30 compatible version in `prototype/backend/package.json`
    - Update `@types/jest` to the Jest 30 compatible version
    - Review and update Jest config files (`jest.config.js`, `jest.config.unit.js`, `jest.config.integration.js`, `jest.config.heavy.js`) for any changed/removed options
    - Run `npm run test:unit` and `npm run test:integration` to verify all backend tests pass
    - Fix any test files that use removed or changed Jest APIs
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 9. React 18 → 19 (UI Framework)
  - [x] 9.1 Upgrade React, ReactDOM, and type packages
    - Update `react` and `react-dom` to `^19.0.0` in `prototype/frontend/package.json`
    - Update `@types/react` and `@types/react-dom` to React 19 compatible versions
    - Update `@vitejs/plugin-react` to a version compatible with React 19
    - Run `npm install` in frontend
    - _Requirements: 6.1, 6.3_
  - [x] 9.2 Migrate React 19 breaking API changes in components
    - Search for `forwardRef` usage and refactor to use ref as a regular prop (React 19 pattern)
    - Search for `defaultProps` on function components and replace with JS default parameters
    - Search for legacy context API usage and migrate if found
    - Search for `react-dom/test-utils` imports and replace with `@testing-library/react` equivalents
    - Run `npm run build` to verify all components compile without type errors
    - Run `npx vitest --run` to verify all frontend tests pass
    - _Requirements: 6.2, 6.4, 6.5, 6.6_

- [x] 10. Vite 5 → 6 (Build Tool)
  - [x] 10.1 Upgrade Vite and update configuration
    - Update `vite` to `^6.0.0` in `prototype/frontend/package.json`
    - Ensure `@vitejs/plugin-react` is at a Vite 6 compatible version (may already be updated in React phase)
    - Update `vite-plugin-svgr` to a Vite 6 compatible version
    - Review `prototype/frontend/vite.config.ts` for deprecated or changed config options and update
    - Run `npm run build` to verify production build succeeds
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 11. Vitest 1 → 4 (Frontend Test Runner)
  - [x] 11.1 Upgrade Vitest and companion packages
    - Update `vitest` to `^4.0.0` in `prototype/frontend/package.json`
    - Update `@vitest/coverage-v8` and `@vitest/ui` to Vitest 4 compatible versions
    - Review `prototype/frontend/vitest.config.ts` for deprecated or changed config options and update
    - Run `npx vitest --run` to verify all frontend tests pass
    - Fix any test files that use removed or changed Vitest APIs
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 12. Checkpoint — Frontend framework upgrades (React + Vite + Vitest)
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Tailwind CSS 3 → 4 (Styling)
  - [x] 13.1 Migrate Tailwind to CSS-first configuration
    - Update `tailwindcss` to `^4.0.0` in `prototype/frontend/package.json`
    - Replace `@tailwind base; @tailwind components; @tailwind utilities;` in `prototype/frontend/src/index.css` with `@import "tailwindcss"` and add `@theme` block with custom theme values migrated from `tailwind.config.js`
    - Update `prototype/frontend/postcss.config.js` for Tailwind 4 (Tailwind 4 may use its own PostCSS plugin or Vite plugin instead of `tailwindcss` PostCSS plugin)
    - Delete `prototype/frontend/tailwind.config.js` after migrating all config to CSS
    - Update `autoprefixer` if needed or remove if Tailwind 4 handles it internally
    - Run `npm run build` to verify CSS output is correct
    - Spot-check key pages visually (dashboard, robot detail, weapon shop) for styling consistency — note this as a manual verification step
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [x] 14. Backend minor/patch dependency updates
  - [x] 14.1 Update all remaining backend dependencies
    - Update runtime dependencies to latest stable: `axios`, `bcrypt`, `cors`, `dotenv`, `express-rate-limit`, `jsonwebtoken`, `node-cron`, `winston`, `gray-matter`
    - Update dev dependencies to latest stable: `supertest`, `tsx`, `fast-check`, `eslint`, `globals`, `typescript-eslint`, `@eslint/js`
    - Update all `@types/*` packages to versions compatible with their runtime counterparts (`@types/bcrypt`, `@types/cors`, `@types/jsonwebtoken`, `@types/node-cron`, `@types/supertest`)
    - Run `npm install`, then `npm run build`, `npm run lint`, and full backend test suite
    - Fix any breaking changes introduced by minor/patch updates
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

- [x] 15. Frontend minor/patch dependency updates
  - [x] 15.1 Update all remaining frontend dependencies
    - Update runtime dependencies to latest stable: `axios`, `date-fns`, `mermaid`, `react-markdown`, `react-router-dom`, `recharts`, `remark-gfm`
    - Update dev dependencies to latest stable: `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `axios-mock-adapter`, `fast-check`, `jsdom`, `autoprefixer`, `postcss`, `eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals`, `typescript-eslint`, `@eslint/js`, `vite-plugin-svgr`
    - Update `@playwright/test` to latest 1.58.x patch
    - Run `npm install`, then `npm run build`, `npm run lint`, and `npx vitest --run`
    - Fix any breaking changes introduced by minor/patch updates
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

- [x] 16. Checkpoint — All dependency versions updated
  - Ensure all tests pass, ask the user if questions arise.

- [x] 17. CI/CD pipeline updates
  - [x] 17.1 Update GitHub Actions workflows for new versions
    - In `.github/workflows/ci.yml`: update all `node-version: '20'` to `node-version: '24'`
    - In `.github/workflows/ci.yml`: update PostgreSQL service images from `postgres:15` to `postgres:17` (in `backend-integration-tests` job)
    - In `.github/workflows/deploy.yml`: update all `node-version: '20'` to `node-version: '24'`
    - In `.github/workflows/deploy.yml`: update PostgreSQL service images from `postgres:15` to `postgres:17` (in `backend-integration-tests` and `e2e-tests` jobs)
    - Verify cache keys in workflows will invalidate correctly with new `package-lock.json` hashes
    - Push to a branch and verify CI pipeline passes end-to-end
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

- [x] 18. Regression guardrails
  - [x] 18.1 Add engine-strict and version pinning guardrails
    - Create `prototype/backend/.npmrc` with `engine-strict=true`
    - Create `prototype/frontend/.npmrc` with `engine-strict=true`
    - Verify `engines` field exists in both `package.json` files with `"node": ">=24.0.0"` (should already be set from task 2.1)
    - Add `overrides` section to backend `package.json` if needed to prevent transitive dependencies pulling deprecated major versions (e.g., Prisma 5, Express 4)
    - Add `overrides` section to frontend `package.json` if needed to prevent transitive dependencies pulling deprecated major versions (e.g., React 18)
    - Verify all dependency version strings use caret-pinned (`^X.Y.Z`) or exact (`X.Y.Z`) format — no `*`, `latest`, or pre-release tags
    - _Requirements: 15.1, 15.2, 15.5, 15.6_
  - [x] 18.2 Add steering rules and Kiro hook for version enforcement
    - Update `.kiro/steering/project-overview.md` to reference post-upgrade versions (Node.js 24, TS 5.8, Prisma 7, Express 5, Jest 30, React 19, Vite 6, Vitest 4, Tailwind 4, PG 17)
    - Update `.kiro/steering/coding-standards.md` to reference new framework versions and patterns (React 19 component patterns, Express 5 async handling, Prisma 7 import paths)
    - Create `.kiro/hooks/dependency-version-check.kiro.hook` that triggers on `fileEdited` for `**/package.json` and checks for version downgrades below the post-upgrade baseline
    - _Requirements: 15.4, 15.8, 16.1, 16.2_
  - [x] 18.3 Write property test: Node.js version consistency (Property 1)
    - **Property 1: Node.js version consistency across all configuration sources**
    - Scan `package.json` engines fields, `.nvmrc`, CI workflow `node-version` fields; assert all resolve to Node.js 24.x
    - Add test to `prototype/backend/tests/dependency-upgrade-invariants.property.test.ts`
    - **Validates: Requirements 1.1, 1.4, 1.5, 14.1**
  - [x] 18.4 Write property test: Stable pinned versions (Property 4)
    - **Property 4: All dependency versions are stable and properly pinned**
    - Parse both `package.json` files; for each dependency version string, assert it matches caret-pinned or exact semver and contains no pre-release identifiers
    - Add test to `prototype/backend/tests/dependency-upgrade-invariants.property.test.ts`
    - **Validates: Requirements 11.1, 11.2, 12.1, 12.2, 15.5**
  - [x] 18.5 Write property test: Engines field enforces minimum versions (Property 5)
    - **Property 5: Engines field enforces post-upgrade minimum versions**
    - Parse both `package.json` files; assert `engines.node` specifies `>=24.0.0`
    - Add test to `prototype/backend/tests/dependency-upgrade-invariants.property.test.ts`
    - **Validates: Requirements 15.1**

- [x] 19. Documentation updates
  - [x] 19.1 Update version reference table and project documentation
    - Add or update the version reference table in the design document or a dedicated section listing every upgraded dependency with pre-upgrade and post-upgrade versions
    - Update `docs/guides/SETUP.md` if it references specific Node.js, PostgreSQL, or dependency versions
    - Update `docs/guides/DEPLOYMENT.md` if it references specific Docker images or Node.js versions
    - Verify the version reference table matches actual installed versions in both `package.json` files
    - _Requirements: 16.1, 16.2, 16.3, 16.4_
  - [x] 19.2 Write property test: Version reference table round-trip consistency (Property 6)
    - **Property 6: Version reference table round-trip consistency**
    - Parse the version reference table from documentation; for each row, look up the dependency in the corresponding `package.json`; assert documented version matches actual version
    - Add test to `prototype/backend/tests/dependency-upgrade-invariants.property.test.ts`
    - **Validates: Requirements 16.4**

- [x] 20. Final checkpoint — Full verification
  - Ensure all tests pass across backend and frontend (unit, integration, property, e2e)
  - Verify builds succeed for both packages
  - Verify linting passes for both packages
  - Ask the user to perform manual verification: Tailwind visual regression check, Vite HMR, Prisma Studio, full application smoke test
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation between major upgrade groups
- Property tests validate upgrade invariants and act as regression guardrails
- The linear phase ordering follows the dependency graph: infrastructure → runtime → compiler → ORM → framework → test runners → UI → build tools → styling → minor updates → CI/CD → guardrails → docs
- Every phase should be committed independently so any single upgrade can be reverted with `git revert`
