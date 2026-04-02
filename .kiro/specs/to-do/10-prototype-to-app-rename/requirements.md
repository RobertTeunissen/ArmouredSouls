# Requirements Document

## Introduction

The Armoured Souls project has outgrown its "prototype" label. The codebase contains 41 services, 150+ test files, Prisma migrations, CI/CD pipelines, and production deployment configurations. The `/prototype/` directory name no longer reflects the maturity of the project and creates a misleading impression for contributors and tooling.

This spec covers renaming `/prototype/` to `/app/`, removing the empty `/modules/` directory (which contains only placeholder READMEs with no implementation code), and updating every reference across the codebase to maintain a fully functional build, test suite, and deployment pipeline.

This spec MUST be executed AFTER spec 3 (backend-service-consolidation) to avoid debugging two structural changes simultaneously.

## Glossary

- **Rename_Script**: A shell script or sequence of git commands that performs the directory rename from `prototype/` to `app/` using `git mv` to preserve file history
- **Reference_Updater**: The process (manual or scripted) that finds and replaces all occurrences of `prototype/` paths with `app/` paths across the codebase
- **Steering_File**: A configuration file in `.kiro/steering/` that provides contextual guidance to the AI assistant, often containing file path patterns
- **CI_Pipeline**: The GitHub Actions workflow defined in `.github/workflows/ci.yml` that runs tests, linting, and builds on push and pull request events
- **Blast_Radius**: The complete set of files that contain references to `prototype/` or `modules/` and must be updated as part of this rename

## Requirements

### Requirement 1: Rename the prototype directory to app

**User Story:** As a developer, I want the main application directory named `app/` instead of `prototype/`, so that the directory structure reflects the maturity of the codebase.

#### Acceptance Criteria

1. WHEN the rename is executed, THE Rename_Script SHALL move the `prototype/` directory to `app/` using `git mv` to preserve version control history
2. THE `app/` directory SHALL contain the identical file tree that existed under `prototype/`, including `backend/`, `frontend/`, `docker-compose.yml`, `.gitignore`, and all nested contents
3. WHEN the rename is complete, THE `prototype/` directory SHALL no longer exist in the repository working tree
4. WHEN the rename is complete, THE repository SHALL have zero references to the path `prototype/` in any tracked file

### Requirement 2: Remove the empty modules directory

**User Story:** As a developer, I want the unused `modules/` directory removed, so that the repository does not contain misleading placeholder directories with no implementation code.

#### Acceptance Criteria

1. WHEN the cleanup is executed, THE Reference_Updater SHALL delete the entire `modules/` directory including all subdirectories and placeholder README files
2. WHEN the cleanup is complete, THE repository SHALL have zero references to the `modules/` directory path in any tracked file, except where documentation explicitly describes the historical context of the removal
3. IF a documentation file previously linked to `modules/` content, THEN THE Reference_Updater SHALL remove or replace that link with the appropriate `app/` path or a note that the modules directory was removed

### Requirement 3: Update CI/CD pipeline references

**User Story:** As a developer, I want the CI/CD pipeline to work without modification after the rename, so that automated testing and deployment continue uninterrupted.

#### Acceptance Criteria

1. WHEN the rename is complete, THE CI_Pipeline SHALL reference `app/backend` instead of `prototype/backend` in all `working-directory`, `cache-dependency-path`, and path filter configurations
2. WHEN the rename is complete, THE CI_Pipeline SHALL reference `app/frontend` instead of `prototype/frontend` in all `working-directory`, `cache-dependency-path`, and path filter configurations
3. WHEN the CI_Pipeline is executed after the rename, THE CI_Pipeline SHALL pass all existing backend unit tests, backend integration tests, frontend tests, and security audit jobs without failures caused by path changes

### Requirement 4: Update Kiro steering files

**User Story:** As a developer, I want all Kiro steering files to reference the new `app/` paths, so that AI-assisted development continues to work correctly.

#### Acceptance Criteria

1. WHEN the rename is complete, THE Reference_Updater SHALL update all path references in `.kiro/steering/project-overview.md` from `prototype/` to `app/`
2. WHEN the rename is complete, THE Reference_Updater SHALL update all path references in `.kiro/steering/common-tasks.md` from `prototype/` to `app/`
3. WHEN the rename is complete, THE Reference_Updater SHALL update the `fileMatchPattern` in `.kiro/steering/guide-content-maintenance.md` from `prototype/backend` to `app/backend`
4. WHEN the rename is complete, THE Reference_Updater SHALL update all path references in `.kiro/steering/environments-and-deployment.md` from `prototype/` to `app/`
5. WHEN the rename is complete, THE Reference_Updater SHALL update path references in every other steering file under `.kiro/steering/` that contains `prototype/` paths

### Requirement 5: Update documentation references

**User Story:** As a developer, I want all documentation to reference the correct `app/` paths, so that setup guides, architecture docs, and contributor instructions remain accurate.

#### Acceptance Criteria

1. WHEN the rename is complete, THE Reference_Updater SHALL update all `prototype/` path references in the root `README.md` to `app/`
2. WHEN the rename is complete, THE Reference_Updater SHALL update all `prototype/` path references in `prototype/README.md` (now `app/README.md`) to reflect the new directory name
3. WHEN the rename is complete, THE Reference_Updater SHALL update all `prototype/` path references in `docs/guides/MODULE_STRUCTURE.md`, and remove or revise sections that describe the `modules/` directory as a future production codebase
4. WHEN the rename is complete, THE Reference_Updater SHALL update all `prototype/` and `modules/` path references in every file under the `docs/` directory
5. WHEN the rename is complete, THE Reference_Updater SHALL update the `CONTRIBUTING.md` file if it contains `prototype/` or `modules/` path references

### Requirement 6: Update deployment and infrastructure configuration

**User Story:** As a developer, I want deployment configs to reference the new `app/` paths, so that local development, ACC, and PRD environments continue to function.

#### Acceptance Criteria

1. WHEN the rename is complete, THE Reference_Updater SHALL update all `prototype/` references in `app/docker-compose.yml` (formerly `prototype/docker-compose.yml`) if the file contains self-referential paths
2. WHEN the rename is complete, THE Reference_Updater SHALL update all `prototype/` references in any Caddyfile or Caddy configuration present in the repository
3. WHEN the rename is complete, THE Reference_Updater SHALL update all `prototype/` references in any `ecosystem.config.js` or PM2 configuration present in the repository
4. WHEN the rename is complete, THE Reference_Updater SHALL update all `prototype/` references in any shell scripts (`.sh` files) in the repository

### Requirement 7: Update in-progress spec references

**User Story:** As a developer, I want other in-progress specs to reference the correct `app/` paths, so that future spec execution does not produce broken file references.

#### Acceptance Criteria

1. WHEN the rename is complete, THE Reference_Updater SHALL update all `prototype/` path references in every file under `.kiro/specs/`
2. IF a spec document references `modules/` paths, THEN THE Reference_Updater SHALL remove or update those references to reflect the removal of the `modules/` directory

### Requirement 8: Verify internal import paths remain functional

**User Story:** As a developer, I want to confirm that internal TypeScript imports within backend and frontend continue to resolve correctly, so that the rename does not break the build.

#### Acceptance Criteria

1. WHEN the rename is complete, THE backend application SHALL compile without errors using `npm run build` from the `app/backend` directory
2. WHEN the rename is complete, THE frontend application SHALL compile without errors using `npm run build` from the `app/frontend` directory
3. WHEN the rename is complete, THE backend test suite SHALL pass without errors caused by import path resolution failures
4. WHEN the rename is complete, THE frontend test suite SHALL pass without errors caused by import path resolution failures

### Requirement 9: Update the project-overview steering file to remove modules reference

**User Story:** As a developer, I want the project overview to accurately describe the repository structure without referencing the removed `modules/` directory, so that AI-assisted tooling has an accurate mental model of the project.

#### Acceptance Criteria

1. WHEN the rename is complete, THE Reference_Updater SHALL remove the `/modules/` entry from the Project Structure section of `.kiro/steering/project-overview.md`
2. WHEN the rename is complete, THE Reference_Updater SHALL update the `/prototype/backend` and `/prototype/frontend` entries in `.kiro/steering/project-overview.md` to `/app/backend` and `/app/frontend`

### Requirement 10: Update root-level repository structure documentation

**User Story:** As a developer, I want the repository structure diagrams in README files to accurately reflect the new layout, so that new contributors understand the project organization.

#### Acceptance Criteria

1. WHEN the rename is complete, THE Reference_Updater SHALL update the repository structure diagram in the root `README.md` to show `app/` instead of `prototype/` and to remove the `modules/` section
2. WHEN the rename is complete, THE Reference_Updater SHALL update the project structure diagram in `app/README.md` (formerly `prototype/README.md`) to show `app/` instead of `prototype/`
3. WHEN the rename is complete, THE Reference_Updater SHALL update the Phase 2 references in the root `README.md` that describe `modules/` as a future production codebase, replacing them with a note that the modular architecture is planned as a future refactor within `app/`
