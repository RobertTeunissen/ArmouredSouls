# Requirements Document

## Introduction

Upgrade all dependencies across the Armoured Souls project (backend, frontend, and infrastructure) to their latest stable versions. This covers major version bumps for Node.js, TypeScript, Prisma, Express, React, Vite, Vitest, Tailwind CSS, Jest, and PostgreSQL, plus minor/patch updates for all remaining packages. Only stable releases are permitted — no release candidates, betas, or alphas.

## Glossary

- **Upgrade_Pipeline**: The end-to-end process of updating dependency versions, applying code migrations, and verifying correctness across the Armoured Souls project
- **Backend**: The Node.js/Express/Prisma application located at `app/backend`
- **Frontend**: The React/Vite application located at `app/frontend`
- **Stable_Version**: A published release that is not tagged as alpha, beta, release candidate (RC), canary, next, or experimental
- **Breaking_Change**: A change in a dependency's API or behavior that requires modifications to existing application code
- **Migration_Codemod**: An automated tool provided by a dependency author to transform source code for compatibility with a new major version
- **Test_Suite**: The collection of unit, integration, property-based, and end-to-end tests across both Backend and Frontend
- **Build_Pipeline**: The TypeScript compilation and Vite bundling steps that produce deployable artifacts
- **Docker_Compose**: The container orchestration configuration files (`docker-compose.yml`, `docker-compose.production.yml`) that define the PostgreSQL service

## Requirements

### Requirement 1: Node.js Runtime Upgrade

**User Story:** As a developer, I want to upgrade the Node.js runtime from version 20 LTS to version 24 LTS, so that the project benefits from performance improvements, new language features, and continued security support before Node 20 reaches end-of-life in April 2026.

#### Acceptance Criteria

1. WHEN the upgrade is applied, THE Upgrade_Pipeline SHALL set the Node.js runtime version to 24 LTS (24.x) across all environments (development, CI/CD, production)
2. WHEN the Node.js version is updated, THE Backend SHALL start without errors using Node.js 24 LTS
3. WHEN the Node.js version is updated, THE Build_Pipeline SHALL complete TypeScript compilation and Vite bundling without errors
4. WHEN the Node.js version is updated, THE Upgrade_Pipeline SHALL update the `engines` field in all `package.json` files to reflect Node.js 24 LTS
5. WHEN the Node.js version is updated, THE Upgrade_Pipeline SHALL update any `.nvmrc`, `.node-version`, or CI/CD workflow files to specify Node.js 24 LTS
6. IF a Node.js 24 API incompatibility is detected, THEN THE Upgrade_Pipeline SHALL document the incompatibility and apply the necessary code fix before proceeding

### Requirement 2: TypeScript Upgrade

**User Story:** As a developer, I want to upgrade TypeScript from ~5.3 to 5.8 stable on both Backend and Frontend, so that the project benefits from improved type checking, new language features, and better editor tooling.

#### Acceptance Criteria

1. WHEN the upgrade is applied, THE Upgrade_Pipeline SHALL set the TypeScript version to 5.8.x stable in both Backend and Frontend `package.json` files
2. WHEN TypeScript 5.8 is installed, THE Build_Pipeline SHALL compile all Backend source files without type errors
3. WHEN TypeScript 5.8 is installed, THE Build_Pipeline SHALL compile all Frontend source files without type errors
4. WHEN TypeScript 5.8 is installed, THE Upgrade_Pipeline SHALL update `tsconfig.json` files to leverage any new compiler options appropriate for the project
5. IF TypeScript 5.8 introduces stricter type checking that causes compilation failures, THEN THE Upgrade_Pipeline SHALL fix the affected source files to satisfy the new type constraints

### Requirement 3: Prisma ORM Upgrade (5 → 7)

**User Story:** As a developer, I want to upgrade Prisma from version 5.22 to version 7.x stable, so that the project benefits from the new TypeScript/WASM-based architecture, improved performance, and continued support.

#### Acceptance Criteria

1. WHEN the upgrade is applied, THE Upgrade_Pipeline SHALL set both `prisma` and `@prisma/client` to version 7.x stable
2. WHEN Prisma 7 is installed, THE Backend SHALL generate the Prisma client without errors
3. WHEN Prisma 7 is installed, THE Backend SHALL run all existing database migrations without errors against the PostgreSQL database
4. WHEN Prisma 7 is installed, THE Backend SHALL execute all database queries (CRUD operations, transactions, raw queries) without runtime errors
5. WHEN Prisma 7 is installed, THE Upgrade_Pipeline SHALL relocate generated client code from `node_modules` to the project-local output directory as required by Prisma 7 architecture
6. WHEN Prisma 7 is installed, THE Upgrade_Pipeline SHALL update all import paths referencing the Prisma client to match the new generated output location
7. IF Prisma 7 deprecates or removes APIs used by the Backend, THEN THE Upgrade_Pipeline SHALL replace deprecated API calls with their Prisma 7 equivalents
8. WHEN Prisma 7 is installed, THE Upgrade_Pipeline SHALL update the `prisma.seed` configuration in `package.json` to remain compatible with Prisma 7

### Requirement 4: Express Upgrade (4 → 5)

**User Story:** As a developer, I want to upgrade Express from version 4.18 to version 5.1, so that the project benefits from improved async error handling, modern routing, and continued maintenance.

#### Acceptance Criteria

1. WHEN the upgrade is applied, THE Upgrade_Pipeline SHALL set the Express version to 5.x stable in the Backend `package.json`
2. WHEN Express 5 is installed, THE Backend SHALL start and respond to HTTP requests without errors
3. WHEN Express 5 is installed, THE Upgrade_Pipeline SHALL apply the official Express 5 codemod to migrate route handlers and middleware
4. WHEN Express 5 is installed, THE Backend SHALL handle async errors in route handlers without unhandled promise rejections
5. WHEN Express 5 is installed, THE Upgrade_Pipeline SHALL update the `@types/express` package to the version compatible with Express 5
6. IF Express 5 removes or changes middleware APIs used by the Backend (e.g., `req.param()`, path pattern syntax), THEN THE Upgrade_Pipeline SHALL update the affected route handlers to use Express 5 equivalents

### Requirement 5: Jest Upgrade (29 → 30)

**User Story:** As a developer, I want to upgrade Jest from version 29.7 to version 30.x stable on the Backend, so that the test runner benefits from performance improvements and new features.

#### Acceptance Criteria

1. WHEN the upgrade is applied, THE Upgrade_Pipeline SHALL set Jest to version 30.x stable and ts-jest to the compatible version in the Backend `package.json`
2. WHEN Jest 30 is installed, THE Test_Suite SHALL execute all Backend unit tests and report results without framework errors
3. WHEN Jest 30 is installed, THE Test_Suite SHALL execute all Backend integration tests and report results without framework errors
4. WHEN Jest 30 is installed, THE Upgrade_Pipeline SHALL update all Jest configuration files (`jest.config.unit.js`, `jest.config.integration.js`, `jest.config.heavy.js`) to be compatible with Jest 30
5. IF Jest 30 changes or removes configuration options or APIs used by the Backend tests, THEN THE Upgrade_Pipeline SHALL update the affected test files and configurations


### Requirement 6: React Upgrade (18 → 19)

**User Story:** As a developer, I want to upgrade React and ReactDOM from version 18.2 to version 19.x stable, so that the Frontend benefits from the React Compiler, improved performance, and new APIs like `useActionState`.

#### Acceptance Criteria

1. WHEN the upgrade is applied, THE Upgrade_Pipeline SHALL set `react` and `react-dom` to version 19.x stable in the Frontend `package.json`
2. WHEN React 19 is installed, THE Frontend SHALL render all existing pages and components without runtime errors
3. WHEN React 19 is installed, THE Upgrade_Pipeline SHALL update `@types/react` and `@types/react-dom` to versions compatible with React 19
4. WHEN React 19 is installed, THE Build_Pipeline SHALL compile all Frontend components without type errors related to React API changes
5. IF React 19 removes or changes APIs used by the Frontend (e.g., `forwardRef` behavior, `defaultProps` on function components, legacy context), THEN THE Upgrade_Pipeline SHALL update the affected components to use React 19 equivalents
6. WHEN React 19 is installed, THE Test_Suite SHALL execute all Frontend component tests using `@testing-library/react` without framework errors

### Requirement 7: Vite Upgrade (5 → 6)

**User Story:** As a developer, I want to upgrade Vite from version 5.0 to version 6.x stable, so that the Frontend build tooling benefits from improved performance, new features, and continued support.

#### Acceptance Criteria

1. WHEN the upgrade is applied, THE Upgrade_Pipeline SHALL set Vite to version 6.x stable in the Frontend `package.json`
2. WHEN Vite 6 is installed, THE Build_Pipeline SHALL produce a working production build of the Frontend without errors
3. WHEN Vite 6 is installed, THE Upgrade_Pipeline SHALL update `@vitejs/plugin-react` to the version compatible with Vite 6
4. WHEN Vite 6 is installed, THE Upgrade_Pipeline SHALL update the Vite configuration file (`vite.config.ts`) to address any deprecated or changed configuration options
5. IF Vite 6 changes the dev server or HMR behavior, THEN THE Frontend SHALL continue to serve the application in development mode without errors

### Requirement 8: Vitest Upgrade (1 → 4)

**User Story:** As a developer, I want to upgrade Vitest from version 1.2 to version 4.x stable, so that the Frontend test runner benefits from improved performance, better compatibility, and new features.

#### Acceptance Criteria

1. WHEN the upgrade is applied, THE Upgrade_Pipeline SHALL set Vitest to version 4.x stable in the Frontend `package.json`
2. WHEN Vitest 4 is installed, THE Upgrade_Pipeline SHALL update `@vitest/coverage-v8` and `@vitest/ui` to versions compatible with Vitest 4
3. WHEN Vitest 4 is installed, THE Test_Suite SHALL execute all Frontend unit tests and report results without framework errors
4. WHEN Vitest 4 is installed, THE Upgrade_Pipeline SHALL update the Vitest configuration to address any deprecated or changed configuration options
5. IF Vitest 4 changes test runner APIs or assertion behavior, THEN THE Upgrade_Pipeline SHALL update the affected test files

### Requirement 9: Tailwind CSS Upgrade (3 → 4)

**User Story:** As a developer, I want to upgrade Tailwind CSS from version 3.4 to version 4.x stable, so that the Frontend benefits from the new CSS-first configuration model, improved performance, and modern CSS features.

#### Acceptance Criteria

1. WHEN the upgrade is applied, THE Upgrade_Pipeline SHALL set Tailwind CSS to version 4.x stable in the Frontend `package.json`
2. WHEN Tailwind CSS 4 is installed, THE Upgrade_Pipeline SHALL migrate the existing `tailwind.config.js` configuration to the CSS-first configuration model using `@theme` directives in the main CSS file
3. WHEN Tailwind CSS 4 is installed, THE Build_Pipeline SHALL produce CSS output that applies all existing utility classes correctly
4. WHEN Tailwind CSS 4 is installed, THE Frontend SHALL render all pages with visual styling consistent with the pre-upgrade appearance
5. WHEN Tailwind CSS 4 is installed, THE Upgrade_Pipeline SHALL remove the `tailwind.config.js` file and update PostCSS configuration as required by Tailwind 4
6. IF Tailwind CSS 4 renames, removes, or changes utility classes used by the Frontend, THEN THE Upgrade_Pipeline SHALL update the affected component templates

### Requirement 10: PostgreSQL Upgrade (16 → 17)

**User Story:** As a developer, I want to upgrade PostgreSQL from version 16 to version 17 stable, so that the database benefits from performance improvements, new SQL features, and extended support.

#### Acceptance Criteria

1. WHEN the upgrade is applied, THE Upgrade_Pipeline SHALL update the Docker_Compose files (`docker-compose.yml` and `docker-compose.production.yml`) to use the `postgres:17-alpine` image
2. WHEN PostgreSQL 17 is running, THE Backend SHALL connect to the database and execute all Prisma queries without errors
3. WHEN PostgreSQL 17 is running, THE Upgrade_Pipeline SHALL verify that all existing migrations apply cleanly to a fresh PostgreSQL 17 instance
4. WHEN upgrading in production, THE Upgrade_Pipeline SHALL document the data migration procedure including backup, dump, restore, and verification steps
5. IF PostgreSQL 17 changes default behavior for any SQL features used by the Backend, THEN THE Upgrade_Pipeline SHALL update the affected queries or Prisma schema

### Requirement 11: Backend Minor and Patch Dependency Updates

**User Story:** As a developer, I want to update all remaining Backend dependencies to their latest stable versions, so that the project benefits from bug fixes, security patches, and minor improvements.

#### Acceptance Criteria

1. WHEN the upgrade is applied, THE Upgrade_Pipeline SHALL update the following Backend dependencies to their latest stable versions: `axios`, `bcrypt`, `cors`, `dotenv`, `express-rate-limit`, `jsonwebtoken`, `node-cron`, `winston`, `gray-matter`
2. WHEN the upgrade is applied, THE Upgrade_Pipeline SHALL update the following Backend dev dependencies to their latest stable versions: `supertest`, `tsx`, `fast-check`, `eslint`, `globals`, `typescript-eslint`, `@eslint/js`
3. WHEN the upgrade is applied, THE Upgrade_Pipeline SHALL update all `@types/*` packages to versions compatible with their corresponding runtime packages
4. WHEN all Backend dependencies are updated, THE Test_Suite SHALL execute all Backend tests (unit, integration, heavy) without failures caused by dependency changes
5. WHEN all Backend dependencies are updated, THE Build_Pipeline SHALL compile the Backend without errors
6. IF any updated dependency introduces a Breaking_Change, THEN THE Upgrade_Pipeline SHALL apply the necessary code modifications before proceeding

### Requirement 12: Frontend Minor and Patch Dependency Updates

**User Story:** As a developer, I want to update all remaining Frontend dependencies to their latest stable versions, so that the project benefits from bug fixes, security patches, and minor improvements.

#### Acceptance Criteria

1. WHEN the upgrade is applied, THE Upgrade_Pipeline SHALL update the following Frontend dependencies to their latest stable versions: `axios`, `date-fns`, `mermaid`, `react-markdown`, `react-router-dom`, `recharts`, `remark-gfm`
2. WHEN the upgrade is applied, THE Upgrade_Pipeline SHALL update the following Frontend dev dependencies to their latest stable versions: `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `axios-mock-adapter`, `fast-check`, `jsdom`, `autoprefixer`, `postcss`, `eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals`, `typescript-eslint`, `@eslint/js`, `vite-plugin-svgr`
3. WHEN the upgrade is applied, THE Upgrade_Pipeline SHALL update `@playwright/test` to the latest 1.58.x patch version
4. WHEN all Frontend dependencies are updated, THE Test_Suite SHALL execute all Frontend tests (unit, component, e2e) without failures caused by dependency changes
5. WHEN all Frontend dependencies are updated, THE Build_Pipeline SHALL produce a working production build without errors
6. IF any updated dependency introduces a Breaking_Change, THEN THE Upgrade_Pipeline SHALL apply the necessary code modifications before proceeding

### Requirement 13: Upgrade Verification and Rollback Safety

**User Story:** As a developer, I want the upgrade process to include verification gates and rollback procedures, so that I can confidently apply upgrades without risking project stability.

#### Acceptance Criteria

1. THE Upgrade_Pipeline SHALL execute the full Test_Suite (Backend unit, integration, heavy; Frontend unit, component, e2e) after each major dependency upgrade and confirm all tests pass before proceeding to the next upgrade
2. THE Upgrade_Pipeline SHALL verify that the Build_Pipeline produces successful builds for both Backend and Frontend after each major upgrade step
3. THE Upgrade_Pipeline SHALL organize upgrades into discrete, independently committable steps so that any single upgrade can be reverted without affecting other upgrades
4. WHEN all upgrades are complete, THE Upgrade_Pipeline SHALL verify that the application starts, serves pages, and processes API requests in a local development environment
5. THE Upgrade_Pipeline SHALL document any manual verification steps required beyond automated testing (e.g., visual inspection of Tailwind styling, Prisma Studio functionality)

### Requirement 14: CI/CD Pipeline Compatibility

**User Story:** As a developer, I want the CI/CD pipeline to remain functional after all upgrades, so that automated builds, tests, and deployments continue to work.

#### Acceptance Criteria

1. WHEN all upgrades are complete, THE Upgrade_Pipeline SHALL update GitHub Actions workflow files to use Node.js 24 LTS
2. WHEN all upgrades are complete, THE Upgrade_Pipeline SHALL verify that the CI/CD pipeline executes the full Test_Suite without errors
3. WHEN all upgrades are complete, THE Upgrade_Pipeline SHALL verify that the CI/CD pipeline produces deployable build artifacts
4. IF the CI/CD pipeline uses cached dependencies, THEN THE Upgrade_Pipeline SHALL invalidate or update the cache configuration to reflect the new dependency versions

### Requirement 15: Dependency Version Regression Prevention

**User Story:** As a developer, I want automated guardrails that prevent outdated or pre-upgrade dependency versions from being reintroduced when adding new features, so that the project never regresses to old versions after this upgrade effort.

#### Acceptance Criteria

1. THE Upgrade_Pipeline SHALL pin exact minimum versions for all major dependencies using the `engines` field in both Backend and Frontend `package.json` files (e.g., `"node": ">=24.0.0"`, and via `packageManager` or `.npmrc` settings)
2. THE Upgrade_Pipeline SHALL configure an `.npmrc` file (or equivalent) in both Backend and Frontend with `engine-strict=true` so that `npm install` fails if the Node.js version does not meet the `engines` constraint
3. THE Upgrade_Pipeline SHALL add a CI/CD check that runs `npm outdated` (or equivalent) and fails the pipeline if any dependency falls below the minimum major version established by this upgrade
4. THE Upgrade_Pipeline SHALL add a steering rule (`.kiro/steering/`) that instructs AI assistants to always use the upgraded dependency versions and APIs when generating code for new features — never the pre-upgrade versions
5. THE Upgrade_Pipeline SHALL use exact or caret-pinned versions (e.g., `^19.2.4` not `*`) for all dependencies in `package.json` to prevent accidental installation of older major versions
6. THE Upgrade_Pipeline SHALL add a `package.json` `overrides` (npm) or `resolutions` (yarn) section if needed to enforce that transitive dependencies do not pull in deprecated major versions of key packages (e.g., React 18, Prisma 5, Express 4)
7. WHEN a developer adds a new dependency, THE CI/CD pipeline SHALL verify that the new dependency is compatible with the project's minimum Node.js, TypeScript, and React versions before the PR can be merged
8. THE Upgrade_Pipeline SHALL create a Kiro agent hook (`fileEdited` on `**/package.json`) that checks whether any dependency version was downgraded below the post-upgrade baseline and alerts the developer if so

### Requirement 16: Post-Upgrade Version Reference Documentation

**User Story:** As a developer, I want a single reference document listing all target dependency versions after this upgrade, so that the team and AI assistants can always look up the correct versions when building new features.

#### Acceptance Criteria

1. THE Upgrade_Pipeline SHALL update the `project-overview.md` steering file to reflect the post-upgrade technology stack versions, including at minimum: Node.js 24 LTS, TypeScript 5.8, Prisma 7.x, Express 5.x, Jest 30.x, React 19.x, Vite 6.x, Vitest 4.x, Tailwind CSS 4.x, PostgreSQL 17
2. THE Upgrade_Pipeline SHALL update the `coding-standards.md` steering file to reference the new dependency versions where applicable (e.g., testing framework versions, React component patterns for React 19)
3. THE Upgrade_Pipeline SHALL include a version reference table in the requirements or design document listing every upgraded dependency with its pre-upgrade and post-upgrade version, structured as:

| Dependency | Pre-Upgrade | Post-Upgrade | Scope |
|---|---|---|---|
| Node.js | 20 LTS | 24 LTS | Runtime |
| TypeScript | ~5.3 | 5.8.x | Backend + Frontend |
| Prisma | ^5.22 | 7.x | Backend |
| Express | ^4.18 | 5.x | Backend |
| Jest | ^29.7 | 30.x | Backend |
| React | ^18.2 | 19.x | Frontend |
| react-dom | ^18.2 | 19.x | Frontend |
| Vite | ^5.0 | 6.x | Frontend |
| Vitest | ^1.2 | 4.x | Frontend |
| Tailwind CSS | ^3.4 | 4.x | Frontend |
| PostgreSQL | 16 | 17 | Infrastructure |
| @vitejs/plugin-react | ^4.2 | latest Vite 6 compat | Frontend |
| @vitest/coverage-v8 | ^1.6 | latest Vitest 4 compat | Frontend |
| @vitest/ui | ^1.2 | latest Vitest 4 compat | Frontend |
| ts-jest | ^29.4 | latest Jest 30 compat | Backend |
| @types/react | ^18.2 | latest React 19 compat | Frontend |
| @types/react-dom | ^18.2 | latest React 19 compat | Frontend |
| @types/express | ^4.17 | latest Express 5 compat | Backend |

4. WHEN all upgrades are complete, THE Upgrade_Pipeline SHALL verify that the version reference table matches the actual installed versions in both `package.json` files
