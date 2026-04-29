---
inclusion: auto
---

# Zero Broken Tests Policy

Every test in the repository must pass. There is no such thing as a "pre-existing" or "unrelated" failure that can be ignored.

## Rules

1. **If you encounter a failing test — fix it.** Whether you caused it or not, whether it's related to your current task or not. A broken test is a broken test.

2. **If you encounter a flaky test — stabilize it.** Flaky property-based tests, timing-dependent tests, or tests that pass locally but fail in CI must be fixed, not skipped or ignored.

3. **Before pushing any commit**, run the relevant test suites and confirm zero failures:
   - Backend unit tests: `cd app/backend && npx jest --config jest.config.unit.js --maxWorkers=1 --silent`
   - Frontend tests: `cd app/frontend && npx vitest run --silent`
   - If you modified files that integration tests cover: `cd app/backend && npx jest --config jest.config.integration.js --maxWorkers=1 --silent`

4. **Never dismiss a test failure as "not my problem."** If it's failing in the repo, it's your problem. Fix it in the same commit or a dedicated fix commit before pushing.

5. **Never skip or `.skip` a test to make CI green.** The test exists for a reason. Fix the code or fix the test — don't hide the failure.

6. **CI must be green before requesting review.** If CI fails after pushing, fix the failures immediately in a follow-up commit on the same branch.

7. **E2E and integration test failures are real failures.** Do not dismiss them as "environment issues" or "pre-existing." If an E2E test fails, investigate and fix the root cause — whether it's a test bug, a code bug, or a deployment configuration issue.

8. **Never say "pre-existing" or "unrelated" to justify leaving a failure unfixed.** The codebase should always be in a passing state. If you discover a broken test during your work, fixing it is part of your work.
