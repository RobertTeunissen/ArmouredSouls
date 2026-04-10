# Implementation Plan: E2E Playwright Coverage

## Overview

This plan converts the E2E Playwright coverage design into incremental implementation steps. The approach is bottom-up: first fix the broken auth foundation (player1 → test_user_001), then create reusable helpers, then write new spec files for each user flow, then audit/rewrite existing specs to remove anti-patterns, then wire up the CI pipeline, update documentation, and finally verify the spec delivered what it promised.

All code is TypeScript. All new tests use Playwright role-based/label-based locators and condition-based waits (no CSS selectors, no `waitForTimeout`).

## Tasks

- [x] 1. Update auth foundation — player1 → test_user_001
  - [x] 1.1 Update `app/frontend/tests/e2e/auth.setup.ts` to log in as `test_user_001` with password `testpass123` and save storage state to `.auth/test_user_001.json`
    - Change `authFile` from `.auth/player1.json` to `.auth/test_user_001.json`
    - Change `loginAndGoToDashboard(page, 'player1', 'password123')` to `loginAndGoToDashboard(page, 'test_user_001', 'testpass123')`
    - Update the setup test name from `'authenticate as player1'` to `'authenticate as test_user_001'`
    - _Requirements: 10.3_
  - [x] 1.2 Update `app/frontend/tests/e2e/helpers/login.ts` default credentials from `player1` / `password123` to `test_user_001` / `testpass123`
    - Change the default parameter values in `loginAndGoToDashboard` function signature
    - _Requirements: 10.3_
  - [x] 1.3 Update `app/frontend/tests/e2e/helpers/navigate.ts` fallback credentials from `player1` to `test_user_001` / `testpass123`
    - Change the `loginAndGoToDashboard(page, 'player1', 'password123')` call in the fallback path
    - _Requirements: 10.2_
  - [x] 1.4 Update `app/frontend/playwright.config.ts` storage state path from `.auth/player1.json` to `.auth/test_user_001.json`
    - Change the `storageState` value in the `chromium` project configuration
    - _Requirements: 10.3_

- [x] 2. Create registration helper — `tests/e2e/helpers/register.ts`
  - [x] 2.1 Create `app/frontend/tests/e2e/helpers/register.ts` with `registerNewUser` and `generateUniqueId` functions
    - `generateUniqueId()` returns `e2e_{timestamp}_{randomSuffix}` format
    - `registerNewUser(page, options?)` navigates to `/login`, switches to Register tab, fills username/email/password/stableName, submits, and waits for redirect to `/onboarding` or `/dashboard`
    - Returns `RegisterResult` with the credentials used
    - Uses role-based and label-based locators only
    - _Requirements: 10.1, 10.4, 10.5_

- [x] 3. Checkpoint — Verify auth foundation
  - Ensure the auth setup, helpers, and config changes are consistent. Run `npx playwright test --project=setup` from `app/frontend/` to verify the auth setup project logs in successfully with the new credentials. Ask the user if questions arise.

- [x] 4. Write new spec — `registration.spec.ts`
  - [x] 4.1 Create `app/frontend/tests/e2e/registration.spec.ts` with tests for the complete registration flow
    - Test: valid registration redirects to `/onboarding` or `/dashboard` (uses `registerNewUser` helper with unique credentials)
    - Test: duplicate username shows error message
    - Test: duplicate email shows error message
    - Test: password shorter than minimum length shows validation error
    - Test: empty required field prevents submission and shows validation indicator
    - All tests use unique usernames/emails per run via `generateUniqueId`
    - Use role-based/label-based locators, no CSS selectors, no `waitForTimeout`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 5. Write new spec — `onboarding.spec.ts`
  - [x] 5.1 Create `app/frontend/tests/e2e/onboarding.spec.ts` with tests for the onboarding tutorial flow
    - Test: newly registered user sees progress indicator at step 1 of 5
    - Test: completing each step advances the progress indicator
    - Test: clicking "Skip Tutorial" and confirming redirects to `/dashboard`
    - Test: completing all 5 display steps redirects to `/dashboard`
    - Test: budget tracker component is visible on non-mobile viewports during onboarding
    - Each test registers a fresh user via `registerNewUser` helper
    - Use role-based/label-based locators, no CSS selectors, no `waitForTimeout`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 6. Write new spec — `battle-history.spec.ts`
  - [x] 6.1 Create `app/frontend/tests/e2e/battle-history.spec.ts` with tests for the battle history page
    - Test: battle history page displays battle records with robot names, outcomes, and ELO changes (uses test_user_001 auth state)
    - Test: outcome filter filters displayed battles to selected outcome type
    - Test: clicking a battle record navigates to `/battle/:id` detail page
    - Test: empty state shows "No battles yet" message (may need fresh user or conditional check)
    - Test: changing sort order reorders battle records
    - Test: search term filters battles by robot/opponent names
    - Use `navigateToProtectedPage` helper for navigation
    - Use role-based/label-based locators, no CSS selectors, no `waitForTimeout`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 7. Write new spec — `practice-arena.spec.ts`
  - [x] 7.1 Create `app/frontend/tests/e2e/practice-arena.spec.ts` with tests for the practice arena
    - Test: practice arena displays battle slot panels and run controls (uses test_user_001 auth state)
    - Test: selecting robot in slot 1 and sparring partner in slot 2, clicking "Run Simulation" shows battle result with win/loss/draw outcome
    - Test: running batch simulation (count > 1) displays batch summary with win/loss/draw counts
    - Test: completed practice battle result appears in history panel
    - Test: "Run Simulation" button is disabled when no robot is selected in a battle slot
    - Use `navigateToProtectedPage` helper for navigation
    - Use role-based/label-based locators, no CSS selectors, no `waitForTimeout`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 8. Write new spec — `financial-flow.spec.ts`
  - [x] 8.1 Create `app/frontend/tests/e2e/financial-flow.spec.ts` with tests for facility upgrades, robot upgrades, and income dashboard
    - Test: upgrading an affordable facility increases its level and decreases credit balance (uses test_user_001 auth state)
    - Test: unaffordable facility upgrade button is disabled or shows insufficient credits indicator
    - Test: upgrading a robot attribute on the upgrades tab increases attribute level and decreases credit balance
    - Test: income dashboard at `/income` displays financial health indicator, current balance, and daily income/expense breakdown
    - Test: switching to per-robot tab on income dashboard displays per-robot financial data
    - Use `navigateToProtectedPage` helper for navigation
    - Use role-based/label-based locators, no CSS selectors, no `waitForTimeout`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 9. Write new spec — `protected-pages.spec.ts`
  - [x] 9.1 Create `app/frontend/tests/e2e/protected-pages.spec.ts` with smoke tests for protected pages and auth security verification
    - Test: each of `/dashboard`, `/robots`, `/weapon-shop`, `/battle-history`, `/league-standings`, `/facilities`, `/profile` loads and displays its primary heading (uses test_user_001 auth state)
    - Test: unauthenticated user navigating to a protected route is redirected to `/login` (uses fresh browser context with no auth)
    - Test: `/robots` page displays either a list of robots or an empty state prompt
    - Test: `/facilities` page displays facility upgrade options
    - Test: invalid login credentials show generic "Invalid credentials" error (does not reveal which field was wrong)
    - Test: removing JWT token from localStorage and navigating to a protected route redirects to `/login`
    - Use role-based/label-based locators, no CSS selectors, no `waitForTimeout`
    - _Requirements: 11.1, 11.2, 11.4, 12.1, 12.2, 12.3, 12.4_

- [x] 10. Checkpoint — Verify new spec files
  - Ensure all 6 new spec files compile and list their tests correctly. Run `npx playwright test --list` from `app/frontend/` to verify test discovery. Ask the user if questions arise.

- [x] 11. Write new spec — `critical-journey.spec.ts`
  - [x] 11.1 Create `app/frontend/tests/e2e/critical-journey.spec.ts` with the sequential critical user journey test
    - Single sequential test: register fresh user → skip onboarding → create robot (verify ₡500,000 deduction) → purchase weapon → equip weapon on battle-config tab (verify battle readiness — no loadout warnings) → run practice battle (verify win/loss/draw outcome) → navigate to `/battle-history` (verify page loads without errors)
    - Uses `registerNewUser` helper for fresh account creation
    - Each step verifies its specific acceptance criteria inline
    - Use role-based/label-based locators, no CSS selectors, no `waitForTimeout`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 12. Audit and rewrite existing spec — `login.spec.ts`
  - [x] 12.1 Update `app/frontend/tests/e2e/login.spec.ts` to fix anti-patterns
    - Update valid-login test credentials from `player1` / `password123` to `test_user_001` / `testpass123`
    - Remove all manual `page.screenshot()` calls (redundant with playwright.config.ts `screenshot: 'on'` setting)
    - Verify the invalid credentials test checks for a generic error message per Req 11.2
    - Verify password validation test covers minimum length per Req 11.3 (add test if missing for password < 8 chars on registration form)
    - _Requirements: 11.2, 11.3, 13.1, 13.2_

- [x] 13. Audit and rewrite existing spec — `dashboard.spec.ts`
  - [x] 13.1 Update `app/frontend/tests/e2e/dashboard.spec.ts` to fix anti-patterns
    - Replace CSS class selectors (`.bg-surface.border.border-gray-700.rounded-lg`) with role-based or text-based locators
    - Replace `waitForTimeout(1000)` with explicit element visibility waits
    - Remove conditional logic that hides failures (the `if (hasRobots) ... else if (noRobots) ... else` pattern that swallows missing sections)
    - Remove all manual `page.screenshot()` calls
    - _Requirements: 12.1, 13.1, 13.2_

- [x] 14. Audit and rewrite existing spec — `robot-creation.spec.ts`
  - [x] 14.1 Update `app/frontend/tests/e2e/robot-creation.spec.ts` to fix anti-patterns
    - Replace `waitForTimeout(500)` with explicit element visibility waits
    - Simplify regex label locators where possible
    - Remove all manual `page.screenshot()` calls
    - Verify tests cover: form display with cost (₡500,000) and balance, empty name validation (required attribute), robot creation success navigating to `/robots/:id`, robot appearing in list at `/robots`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 13.1, 13.2_

- [x] 15. Audit and rewrite existing spec — `weapon-shop.spec.ts`
  - [x] 15.1 Major rewrite of `app/frontend/tests/e2e/weapon-shop.spec.ts` to fix anti-patterns
    - Replace ALL CSS class selectors (`.bg-gray-800.p-6.rounded-lg`, `.bg-purple-900`, `.text-xl.font-semibold.cursor-pointer`, `.flex.gap-2`, `.bg-blue-900`, `.fixed.inset-0`, `.bg-gray-700.rounded-full.h-4`) with role-based, text-based, or label-based locators
    - Replace ALL `waitForTimeout` calls with condition-based waits (element visibility, URL change, network idle)
    - Remove all manual `page.screenshot()` calls
    - Verify tests cover: weapon list with names/costs/damage types, purchase flow with credit deduction, insufficient credits indicator
    - Note: weapon equipping (Req 5.3) and battle readiness verification (Req 5.4) are covered by `critical-journey.spec.ts` (task 11.1) per the design's traceability mapping
    - _Requirements: 5.1, 5.2, 5.5, 13.1, 13.2_

- [x] 16. Checkpoint — Verify all spec files pass locally
  - Run `npx playwright test` from `app/frontend/` against a local environment. Ensure all tests pass. Ask the user if questions arise.

- [x] 17. Add E2E test job to CI pipeline
  - [x] 17.1 Add `e2e-tests` job to `.github/workflows/ci.yml`
    - Job depends on `backend-unit-tests` and `frontend-tests` (fail fast on obvious issues)
    - `timeout-minutes: 15`
    - PostgreSQL 17 service container with health checks (same pattern as `backend-integration-tests`)
    - Steps: checkout → Node.js setup → install backend deps → generate Prisma client → run migrations → seed database → start backend server (background) → install frontend deps → build frontend → install Playwright browsers → run Playwright tests with `PLAYWRIGHT_BASE_URL` → upload HTML report and failure artifacts
    - Remove the existing comment block in `frontend-tests` job that says "E2E tests (Playwright) are skipped in CI"
    - Ensure no `|| true` bypass on the E2E test command — failures must block the pipeline
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [x] 18. Update steering files
  - [x] 18.1 Update `.kiro/steering/testing-strategy.md`
    - Change "E2E Tests (Future)" section heading to "E2E Tests (Implemented)"
    - Replace the "Not yet implemented" content with Playwright test conventions, file locations (`app/frontend/tests/e2e/`), helper descriptions, and running instructions (`cd app/frontend && npx playwright test`)
    - Update "Medium Term" roadmap to mark "Add E2E tests with Playwright" as done
    - _Requirements: 13.3, 13.4, 13.5_
  - [x] 18.2 Update `.kiro/steering/pre-deployment-checklist.md`
    - Update step 2 ("Frontend Tests Pass Locally") to reference the CI E2E gate — clarify that CI now blocks on E2E failures automatically, and local E2E runs are optional but recommended
    - _Requirements: 9.2_
  - [x] 18.3 Update `.kiro/steering/environments-and-deployment.md`
    - Update the "E2E Stage" description in the deployment pipeline section to reflect the actual CI job configuration (PostgreSQL service container, Playwright browsers, artifact upload)
    - _Requirements: 9.1_

- [x] 19. Update guide and architecture documents
  - [x] 19.1 Update `docs/guides/operations/DEPLOYMENT.md`
    - Update Stage 2 E2E description to reflect the actual CI job with PostgreSQL service container, database seeding, and Playwright execution
    - _Requirements: 9.1, 9.3_
  - [x] 19.2 Update `docs/guides/operations/LOCAL_SETUP.md`
    - Update E2E section with current test user credentials (`test_user_001` / `testpass123`) and new helper usage (`registerNewUser`, updated `navigateToProtectedPage`)
    - _Requirements: 10.1, 10.2_
  - [x] 19.3 Update `docs/architecture/ARCHITECTURE.md`
    - Update Playwright version reference if the installed version differs from what's documented
    - _Requirements: 13.3_
  - [x] 19.4 Update `docs/prd_pages/PRD_WEAPON_SHOP.md`
    - Update "E2E Tests" section status from "⏳ awaiting execution" to reflect actual test state after the weapon-shop.spec.ts audit/rewrite
    - _Requirements: 5.1, 5.2, 5.5_
  - [x] 19.5 Update `CONTRIBUTING.md`
    - Update testing pyramid section to reflect that E2E tests are now implemented and blocking in CI
    - _Requirements: 9.2_

- [x] 20. Final checkpoint — Verification criteria
  - Run the verification criteria from the requirements document to confirm the spec delivered:
    1. `ls app/frontend/tests/e2e/*.spec.ts | wc -l` — should return 11 or more spec files
    2. `grep -c "|| true" .github/workflows/ci.yml` — should return 0 (no non-blocking E2E bypass)
    3. `grep -q "e2e-tests" .github/workflows/ci.yml && echo "E2E job exists"` — should print "E2E job exists"
    4. `grep -q "services:" .github/workflows/ci.yml && echo "DB service configured"` — should confirm PostgreSQL service container
    5. `npx playwright test --list 2>/dev/null | grep -c "test"` (from `app/frontend/`) — should list 35+ individual test cases
    6. `ls app/frontend/tests/e2e/helpers/*.ts | wc -l` — should return 3 or more helper files
    7. `grep -l "facility\|financial\|income" app/frontend/tests/e2e/*.spec.ts | wc -l` — should return at least 1 spec file covering the financial flow
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are mandatory — no optional markers
- Every task references specific requirement acceptance criteria for traceability
- TypeScript is used throughout (matching the existing codebase and design document)
- New tests use Playwright role-based/label-based locators exclusively (Req 13.2)
- New tests use condition-based waits only, no `waitForTimeout` (Req 13.1)
- Existing spec audits (tasks 12–15) enforce the same locator and wait standards
- The critical journey test (task 11) covers weapon equipping (Req 5.3, 5.4) as designed
- Checkpoints at tasks 3, 10, 16, and 20 ensure incremental validation
