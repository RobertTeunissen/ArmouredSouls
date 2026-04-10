# Requirements Document

## Introduction

This feature establishes meaningful E2E test coverage for the Armoured Souls application using Playwright. The existing Playwright infrastructure (config, auth setup, helper utilities) is in place but the CI job is non-blocking and test coverage is minimal. The goal is to cover the critical user flows — registration, onboarding, robot creation, battle cycle, and battle history — and make the E2E suite a blocking CI gate so that deploys cannot proceed without verifying these key user journeys.

## Glossary

- **E2E_Test_Suite**: The collection of Playwright test files located in `app/frontend/tests/e2e/` that exercise the application through a real browser
- **CI_Pipeline**: The GitHub Actions workflow defined in `.github/workflows/ci.yml` that runs automated checks on push and pull request events
- **Auth_Setup**: The Playwright setup project (`auth.setup.ts`) that logs in once as a test user and saves browser storage state for reuse by subsequent tests
- **Test_Runner**: The Playwright test runner configured via `playwright.config.ts` with serial execution, single worker, and HTML reporting
- **Registration_Form**: The form on the FrontPage (`/login`) under the "Register" tab that accepts username, email, password, and stable name
- **Onboarding_Flow**: The 5-display-step tutorial at `/onboarding` that guides new players through strategy selection, facility investment, battle-ready setup, attribute upgrades, and completion
- **Robot_Creation_Form**: The form at `/robots/create` that accepts a robot name and deducts ₡500,000 from the player's balance
- **Battle_History_Page**: The page at `/battle-history` that displays paginated battle records with filtering, sorting, and search capabilities
- **Battle_Detail_Page**: The page at `/battle/:id` that displays the full details of a single battle
- **Protected_Route**: Any route wrapped in the `ProtectedRoute` component that requires JWT authentication to access
- **Storage_State**: The serialized browser cookies and localStorage saved by Auth_Setup to `.auth/test_user_001.json` for session reuse
- **Test_Helper**: Utility functions in `tests/e2e/helpers/` that encapsulate common test operations like login and navigation
- **Seeded_Database**: A PostgreSQL database populated with test data including an admin user, 200 WimpBot users, robots, weapons, and loadouts
- **Weapon_Shop_Page**: The page at `/weapon-shop` that displays purchasable weapons with filtering by type, range band, and damage type, and allows buying weapons into inventory
- **Robot_Detail_Page**: The page at `/robots/:id` with tabs (overview, matches, battle-config, upgrades, stats, analytics) where players equip weapons, set stance, loadout type, and yield threshold
- **Battle_Readiness**: A robot's eligibility for combat, determined by having all required weapons equipped for its loadout type (single = main weapon, dual_wield = main + offhand, weapon_shield = main + shield, two_handed = main weapon)
- **Practice_Arena**: The page at `/practice-arena` (Combat Simulation Lab) where players run consequence-free 1v1 battles against owned robots or AI sparring partners (WimpBot, AverageBot, ExpertBot, UltimateBot)
- **Sparring_Partner**: A configurable AI opponent in the Practice_Arena with selectable bot tier, loadout type, range band, stance, and yield threshold
- **Facility_Upgrade**: The action of spending credits to increase a facility's level via `POST /api/facility/upgrade`, with costs following the formula (level + 1) × ₡100,000
- **Attribute_Upgrade**: The action of spending credits to increase a robot's attribute levels via `POST /api/robots/:id/upgrades`, with costs reduced by Training Facility level
- **Financial_Report_Page**: The page at `/income` (Income Dashboard) that displays financial health, current balance, daily income/expenses, streaming revenue breakdown, projections, and per-robot financial analysis

## Expected Contribution

This spec addresses the gap identified in the backlog: "Playwright infrastructure exists but the CI job is non-blocking and there's no meaningful test coverage." Currently, CI deploys without verifying any user flows in a real browser.

1. **E2E test file count**: Before: 4 spec files with minimal coverage → After: 11+ spec files covering all critical user flows (registration, onboarding, robot creation, weapon shop, practice arena, financial flow, battle history, protected page smoke tests, critical journey)
2. **CI E2E gate**: Before: E2E job skipped with comment "require a running backend with a seeded database" → After: fully provisioned E2E job that blocks deployment on failure
3. **Critical flow coverage**: Before: 0 critical user journeys tested end-to-end → After: registration → onboarding → robot creation → weapon purchase → weapon equip → practice battle → battle history validated as a single sequential flow
4. **Economy flow coverage**: Before: 0 financial flows tested → After: facility upgrades, robot attribute upgrades, and income dashboard verified end-to-end
5. **Protected page smoke coverage**: Before: 0 pages verified for basic load/render → After: 7 key protected pages verified (dashboard, robots, weapon-shop, battle-history, league-standings, facilities, profile)
6. **Test helper reusability**: Before: 1 login helper → After: registration helper, navigation helper with retry logic, unique data generators — reducing boilerplate for future E2E test authors

### Verification Criteria

After all tasks are complete, run these checks to confirm the spec delivered:

1. `ls app/frontend/tests/e2e/*.spec.ts | wc -l` — should return 11 or more spec files
2. `grep -c "|| true" .github/workflows/ci.yml` — should return 0 (no non-blocking E2E bypass)
3. `grep -q "e2e-tests" .github/workflows/ci.yml && echo "E2E job exists"` — should print "E2E job exists"
4. `grep -q "services:" .github/workflows/ci.yml && echo "DB service configured"` — should confirm PostgreSQL service container is defined in the E2E job
5. `npx playwright test --list 2>/dev/null | grep -c "test"` (run from `app/frontend/`) — should list 35+ individual test cases
6. `ls app/frontend/tests/e2e/helpers/*.ts | wc -l` — should return 3 or more helper files (login, register, navigation)
7. `grep -l "facility\|financial\|income" app/frontend/tests/e2e/*.spec.ts | wc -l` — should return at least 1 spec file covering the financial flow

## Requirements

### Requirement 1: Registration E2E Flow

**User Story:** As a QA engineer, I want E2E tests that verify the complete registration flow, so that regressions in account creation are caught before deployment.

#### Acceptance Criteria

1. WHEN a valid username, email, password, and stable name are submitted via the Registration_Form, THE E2E_Test_Suite SHALL verify that the application redirects to either `/onboarding` or `/dashboard`
2. WHEN a username that already exists is submitted via the Registration_Form, THE E2E_Test_Suite SHALL verify that the Registration_Form displays a duplicate username error message
3. WHEN an email that is already registered is submitted via the Registration_Form, THE E2E_Test_Suite SHALL verify that the Registration_Form displays a duplicate email error message
4. WHEN a password shorter than the minimum length is submitted via the Registration_Form, THE E2E_Test_Suite SHALL verify that the Registration_Form displays a validation error message
5. WHEN the Registration_Form is submitted with an empty required field, THE E2E_Test_Suite SHALL verify that the Registration_Form prevents submission and displays a validation indicator
6. THE E2E_Test_Suite SHALL use a unique username and email per test run to avoid conflicts with Seeded_Database entries

### Requirement 2: Onboarding E2E Flow

**User Story:** As a QA engineer, I want E2E tests that verify the onboarding tutorial flow, so that new player experience regressions are caught before deployment.

#### Acceptance Criteria

1. WHEN a newly registered user is redirected to `/onboarding`, THE E2E_Test_Suite SHALL verify that the Onboarding_Flow displays the progress indicator showing step 1 of 5
2. WHEN the user completes each step of the Onboarding_Flow, THE E2E_Test_Suite SHALL verify that the progress indicator advances to the next display step
3. WHEN the user clicks "Skip Tutorial" and confirms the skip, THE E2E_Test_Suite SHALL verify that the application redirects to `/dashboard`
4. WHEN the user completes all 5 display steps of the Onboarding_Flow, THE E2E_Test_Suite SHALL verify that the application redirects to `/dashboard`
5. WHEN the Onboarding_Flow is active, THE E2E_Test_Suite SHALL verify that the budget tracker component is visible on non-mobile viewports

### Requirement 3: Robot Creation E2E Flow

**User Story:** As a QA engineer, I want E2E tests that verify the robot creation workflow end-to-end, so that regressions in robot creation are caught before deployment.

#### Acceptance Criteria

1. WHEN a valid robot name is submitted via the Robot_Creation_Form and the user has sufficient credits, THE E2E_Test_Suite SHALL verify that the application creates the robot and navigates to the robot detail page at `/robots/:id`
2. WHEN the Robot_Creation_Form is submitted with an empty name, THE E2E_Test_Suite SHALL verify that the form prevents submission via the required attribute on the name input
3. WHEN the user has fewer than ₡500,000 credits, THE E2E_Test_Suite SHALL verify that the Robot_Creation_Form displays an insufficient credits warning and disables the submit button
4. WHEN a robot is successfully created, THE E2E_Test_Suite SHALL verify that the robot appears in the robot list at `/robots`
5. THE E2E_Test_Suite SHALL verify that the Robot_Creation_Form displays the frame cost of ₡500,000 and the user's current balance

### Requirement 4: Battle History E2E Flow

**User Story:** As a QA engineer, I want E2E tests that verify the battle history page, so that regressions in battle record display are caught before deployment.

#### Acceptance Criteria

1. WHEN the user navigates to `/battle-history` and battles exist, THE E2E_Test_Suite SHALL verify that the Battle_History_Page displays a list of battle records with robot names, outcomes, and ELO changes
2. WHEN the user selects an outcome filter on the Battle_History_Page, THE E2E_Test_Suite SHALL verify that the displayed battles are filtered to show only the selected outcome type
3. WHEN the user clicks on a battle record in the Battle_History_Page, THE E2E_Test_Suite SHALL verify that the application navigates to the Battle_Detail_Page at `/battle/:id`
4. WHEN no battles exist for the user, THE E2E_Test_Suite SHALL verify that the Battle_History_Page displays the empty state message "No battles yet"
5. WHEN the user changes the sort order on the Battle_History_Page, THE E2E_Test_Suite SHALL verify that the battle records are reordered according to the selected sort criterion
6. WHEN the user enters a search term on the Battle_History_Page, THE E2E_Test_Suite SHALL verify that the displayed battles are filtered to match the search term against robot or opponent names

### Requirement 5: Weapon Shop and Equipping E2E Flow

**User Story:** As a QA engineer, I want E2E tests that verify the weapon purchase and equipping flow, so that regressions in the weapon economy and loadout system are caught before deployment.

#### Acceptance Criteria

1. WHEN an authenticated user navigates to `/weapon-shop`, THE E2E_Test_Suite SHALL verify that the Weapon_Shop_Page displays a list of purchasable weapons with names, costs, and damage types
2. WHEN the user purchases a weapon they can afford, THE E2E_Test_Suite SHALL verify that the weapon appears in their inventory and their credit balance decreases by the weapon cost
3. WHEN the user navigates to the Robot_Detail_Page battle-config tab and selects a weapon from their inventory, THE E2E_Test_Suite SHALL verify that the weapon is equipped and the robot's loadout display updates
4. WHEN the user equips all required weapons for the robot's loadout type, THE E2E_Test_Suite SHALL verify that the Robot_Detail_Page no longer displays Battle_Readiness warnings
5. WHEN the user has insufficient credits to purchase a weapon, THE E2E_Test_Suite SHALL verify that the Weapon_Shop_Page displays an insufficient credits indicator

### Requirement 6: Practice Arena E2E Flow

**User Story:** As a QA engineer, I want E2E tests that verify the practice arena battle simulation, so that regressions in the combat simulation system are caught before deployment.

#### Acceptance Criteria

1. WHEN an authenticated user with a battle-ready robot navigates to `/practice-arena`, THE E2E_Test_Suite SHALL verify that the Practice_Arena displays the battle slot panels and run controls
2. WHEN the user selects their robot in slot 1 and a Sparring_Partner in slot 2 and clicks "Run Simulation", THE E2E_Test_Suite SHALL verify that the Practice_Arena displays a battle result with a winner/loser or draw outcome
3. WHEN the user runs a batch simulation (count > 1), THE E2E_Test_Suite SHALL verify that the Practice_Arena displays a batch summary with win/loss/draw counts
4. WHEN the practice battle completes, THE E2E_Test_Suite SHALL verify that the result appears in the Practice_Arena history panel
5. WHEN no robot is selected in a battle slot, THE E2E_Test_Suite SHALL verify that the "Run Simulation" button is disabled

### Requirement 7: Financial Flow E2E — Facility Upgrades, Robot Upgrades, and Income

**User Story:** As a QA engineer, I want E2E tests that verify the financial flow — upgrading facilities, upgrading robot attributes, and viewing the income dashboard — so that regressions in the credit economy are caught before deployment.

#### Acceptance Criteria

1. WHEN an authenticated user navigates to `/facilities` and clicks upgrade on a facility they can afford, THE E2E_Test_Suite SHALL verify that the facility level increases and the user's credit balance decreases by the upgrade cost
2. WHEN the user cannot afford a Facility_Upgrade, THE E2E_Test_Suite SHALL verify that the upgrade button is disabled or displays an insufficient credits indicator
3. WHEN an authenticated user navigates to the Robot_Detail_Page upgrades tab and upgrades an attribute, THE E2E_Test_Suite SHALL verify that the attribute level increases and the user's credit balance decreases
4. WHEN the user navigates to `/income`, THE E2E_Test_Suite SHALL verify that the Financial_Report_Page displays the financial health indicator, current balance, and daily income/expense breakdown
5. WHEN the user switches to the per-robot tab on the Financial_Report_Page, THE E2E_Test_Suite SHALL verify that per-robot financial data is displayed

### Requirement 8: Critical User Journey — Registration Through Practice Battle

**User Story:** As a QA engineer, I want an end-to-end test that exercises the complete critical path from registration through running a practice battle, so that the full new-player journey is validated as a single flow.

#### Acceptance Criteria

1. THE E2E_Test_Suite SHALL include a sequential test that performs: registration → skip onboarding → create robot → purchase weapon → equip weapon → run practice battle → verify battle result
2. WHEN the critical journey test creates a robot, THE E2E_Test_Suite SHALL verify that the user's credit balance decreases by ₡500,000
3. WHEN the critical journey test purchases and equips a weapon, THE E2E_Test_Suite SHALL verify that the robot achieves Battle_Readiness (no loadout warnings displayed)
4. WHEN the critical journey test runs a practice battle, THE E2E_Test_Suite SHALL verify that a battle result is displayed with an outcome (win, loss, or draw)
5. WHEN the critical journey test completes, THE E2E_Test_Suite SHALL verify that the user can navigate to `/battle-history` and the page loads without errors

### Requirement 9: CI Pipeline E2E Gate

**User Story:** As a DevOps engineer, I want the E2E test suite to be a blocking gate in the CI pipeline, so that deploys cannot proceed when critical user flows are broken.

#### Acceptance Criteria

1. THE CI_Pipeline SHALL include an E2E test job that runs the E2E_Test_Suite against a fully provisioned environment with a Seeded_Database
2. WHEN any E2E test fails, THE CI_Pipeline SHALL fail the overall pipeline and block the deployment
3. THE CI_Pipeline SHALL provision a PostgreSQL service container, run database migrations, seed test data, and start the backend server before executing E2E tests
4. THE CI_Pipeline SHALL install Playwright browsers as part of the E2E test job setup
5. THE CI_Pipeline SHALL upload Playwright HTML reports and failure artifacts (screenshots, videos, traces) as GitHub Actions artifacts for debugging
6. IF the E2E test job exceeds 15 minutes, THEN THE CI_Pipeline SHALL terminate the job and report a timeout failure

### Requirement 10: Test Infrastructure and Helpers

**User Story:** As a developer, I want reusable test helpers and fixtures, so that writing new E2E tests is efficient and consistent.

#### Acceptance Criteria

1. THE E2E_Test_Suite SHALL provide a Test_Helper function that registers a new user with a unique username and returns the authenticated page context
2. THE E2E_Test_Suite SHALL provide a Test_Helper function that navigates to any Protected_Route with retry logic to handle auth initialization race conditions
3. THE E2E_Test_Suite SHALL reuse the existing Auth_Setup pattern for tests that operate on the pre-seeded test_user_001 account
4. THE E2E_Test_Suite SHALL generate unique test data identifiers using timestamps or random suffixes to prevent test-to-test data collisions
5. IF a test requires a fresh user account, THEN THE E2E_Test_Suite SHALL register the account via the Registration_Form rather than directly seeding the database, to exercise the registration code path

### Requirement 11: Auth Security E2E Verification

**User Story:** As a security engineer, I want E2E tests that verify authentication and authorization boundaries, so that security regressions in access control are caught before deployment.

#### Acceptance Criteria

1. WHEN an unauthenticated user navigates to any Protected_Route, THE E2E_Test_Suite SHALL verify that the application redirects to `/login` and does not render the protected page content
2. WHEN a user submits invalid credentials on the login form, THE E2E_Test_Suite SHALL verify that the error message is generic ("Invalid credentials") and does not reveal whether the username or password was incorrect
3. WHEN a user registers with a password shorter than 8 characters, THE E2E_Test_Suite SHALL verify that the Registration_Form rejects the submission with a validation error
4. WHEN an authenticated user's JWT token is removed from localStorage, THE E2E_Test_Suite SHALL verify that subsequent navigation to a Protected_Route redirects to `/login`

### Requirement 12: Protected Page Navigation Coverage

**User Story:** As a QA engineer, I want E2E smoke tests for key protected pages, so that navigation and basic rendering regressions are caught.

#### Acceptance Criteria

1. THE E2E_Test_Suite SHALL verify that each of the following Protected_Routes loads without errors and displays its primary heading: `/dashboard`, `/robots`, `/weapon-shop`, `/battle-history`, `/league-standings`, `/facilities`, `/profile`
2. WHEN an unauthenticated user navigates to a Protected_Route, THE E2E_Test_Suite SHALL verify that the application redirects to `/login`
3. WHEN an authenticated user navigates to `/robots`, THE E2E_Test_Suite SHALL verify that the page displays either a list of robots or an empty state prompt
4. WHEN an authenticated user navigates to `/facilities`, THE E2E_Test_Suite SHALL verify that the page displays facility upgrade options

### Requirement 13: Test Reliability and Flake Prevention

**User Story:** As a developer, I want the E2E tests to be reliable and deterministic, so that test failures represent real regressions rather than flaky infrastructure.

#### Acceptance Criteria

1. THE E2E_Test_Suite SHALL use `page.waitForLoadState('networkidle')` or explicit element visibility waits instead of fixed `waitForTimeout` delays for synchronization
2. THE E2E_Test_Suite SHALL use Playwright role-based and label-based locators (`getByRole`, `getByLabel`, `getByText`) instead of CSS class selectors for element targeting
3. THE Test_Runner SHALL configure 2 retries in CI and 0 retries locally, consistent with the existing `playwright.config.ts` settings
4. THE Test_Runner SHALL capture screenshots on failure, retain video on failure, and generate traces on first retry, consistent with the existing configuration
5. WHILE tests execute in CI, THE Test_Runner SHALL use serial execution with a single worker to prevent parallel test interference, consistent with the existing configuration
