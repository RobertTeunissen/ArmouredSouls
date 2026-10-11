import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { test as teardown } from '@playwright/test';
import { LOCAL_ONLY_REASON, isLocalTarget } from './helpers/automaton';

/**
 * Playwright admin teardown (Spec #55 decision 43): runs after every project
 * that depends on `admin-setup` (`admin-automatons.spec.ts`,
 * `automaton-badge.spec.ts`) has finished, and deletes the `e2e-automaton*`
 * stables they created, profiles first. Without it the local integration
 * suites that delete users wholesale fail on the Automaton_Profile's RESTRICT
 * key when they share this database.
 *
 * The backend script needs the DATABASE_URL of the backend under test: from
 * the environment, or from `app/backend/.env` locally. It refuses non-local
 * database hosts.
 */
teardown('delete the e2e Automaton stables', () => {
  teardown.skip(!isLocalTarget(), LOCAL_ONLY_REASON);
  execFileSync('pnpm', ['exec', 'tsx', 'scripts/deleteE2eAutomatons.ts'], {
    cwd: resolve(import.meta.dirname, '../../../backend'),
    stdio: 'inherit',
  });
});
