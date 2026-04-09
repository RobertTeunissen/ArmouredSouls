"use strict";
/**
 * Preservation Property Tests — Project Quality Audit
 *
 * These tests capture CURRENT CORRECT behavior on unfixed code.
 * They MUST PASS before and after the fix — failure after fix means regression.
 *
 * Observation-first methodology: each test observes a non-defective artifact
 * and asserts it remains in its expected state.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fc = __importStar(require("fast-check"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/** Workspace root (three levels up from this file: tests → backend → prototype → root) */
const ROOT = path.resolve(__dirname, '..', '..', '..');
/** Helper: read a file relative to the workspace root */
function readRootFile(relPath) {
    return fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
}
/** Helper: check whether a path exists relative to the workspace root */
function existsInRoot(relPath) {
    return fs.existsSync(path.join(ROOT, relPath));
}
describe('Preservation — Existing Behavior Unchanged', () => {
    /**
     * **Validates: Requirement 3.1**
     *
     * The CONTRIBUTING.md link in README currently resolves correctly.
     * This must remain true after the fix.
     */
    test('CONTRIBUTING.md link in README resolves to an existing file', () => {
        const readme = readRootFile('README.md');
        // Extract the CONTRIBUTING.md link
        const contributingLinkMatch = readme.match(/\[CONTRIBUTING\.md\]\(([^)]+)\)/);
        expect(contributingLinkMatch).not.toBeNull();
        const linkTarget = contributingLinkMatch[1];
        expect(existsInRoot(linkTarget)).toBe(true);
    });
    /**
     * **Validates: Requirement 3.2**
     *
     * Backend CI jobs (backend-unit-tests, backend-integration-tests,
     * security-audit) have their current test commands in ci.yml.
     * These commands must be preserved after the fix (aside from Node version).
     */
    test('backend CI jobs preserve their test commands', () => {
        const ciYml = readRootFile('.github/workflows/ci.yml');
        const expectedCommands = [
            {
                jobName: 'backend-unit-tests',
                requiredCommand: 'npm run test:unit -- --silent',
            },
            {
                jobName: 'backend-integration-tests',
                requiredCommand: 'npm run test:integration -- --silent',
            },
            {
                jobName: 'security-audit',
                requiredCommand: 'npm audit --audit-level=moderate',
            },
        ];
        fc.assert(fc.property(fc.constantFrom(...expectedCommands), (expectation) => {
            // Extract the job block from ci.yml
            const jobRegex = new RegExp(`${expectation.jobName}:[\\s\\S]*?(?=\\n  \\w[\\w-]*:|$)`);
            const jobMatch = ciYml.match(jobRegex);
            expect(jobMatch).not.toBeNull();
            const jobBlock = jobMatch[0];
            expect(jobBlock).toContain(expectation.requiredCommand);
        }), { numRuns: expectedCommands.length });
    });
    /**
     * **Validates: Requirement 3.3**
     *
     * env.ts default values for scheduler variables must remain identical.
     * These are the cron expressions used when env vars are not set.
     */
    test('env.ts scheduler defaults are preserved', () => {
        const envTs = readRootFile('app/backend/src/config/env.ts');
        const schedulerDefaults = [
            { envVar: 'LEAGUE_SCHEDULE', defaultValue: '0 20 * * *' },
            { envVar: 'TOURNAMENT_SCHEDULE', defaultValue: '0 8 * * *' },
            { envVar: 'TAGTEAM_SCHEDULE', defaultValue: '0 12 * * *' },
            { envVar: 'SETTLEMENT_SCHEDULE', defaultValue: '0 23 * * *' },
            { envVar: 'KOTH_SCHEDULE', defaultValue: '0 16 * * 1,3,5' },
        ];
        fc.assert(fc.property(fc.constantFrom(...schedulerDefaults), (sched) => {
            // Verify the default value appears in the env.ts source
            const pattern = `process.env.${sched.envVar} || '${sched.defaultValue}'`;
            expect(envTs).toContain(pattern);
        }), { numRuns: schedulerDefaults.length });
    });
    /**
     * **Validates: Requirement 3.7**
     *
     * .env.acc.example must exist and be available for acceptance environment setup.
     */
    test('.env.acc.example exists and is available', () => {
        const exists = existsInRoot('app/backend/.env.acc.example');
        expect(exists).toBe(true);
        // Verify it has content (not empty)
        const content = readRootFile('app/backend/.env.acc.example');
        expect(content.trim().length).toBeGreaterThan(0);
    });
    /**
     * **Validates: Requirement 3.7**
     *
     * .env.production.example must exist as the canonical production template.
     */
    test('.env.production.example exists as canonical production template', () => {
        const exists = existsInRoot('app/backend/.env.production.example');
        expect(exists).toBe(true);
        // Verify it has content (not empty)
        const content = readRootFile('app/backend/.env.production.example');
        expect(content.trim().length).toBeGreaterThan(0);
    });
    /**
     * **Validates: Requirement 3.5**
     *
     * The first /eligible-robots handler at line ~103 in adminTournaments.ts
     * has the correct ordering comment and response shape.
     */
    test('first /eligible-robots handler has correct comment and response shape', () => {
        const routeFile = readRootFile('app/backend/src/routes/adminTournaments.ts');
        // Verify the ordering comment exists (must be before /:id)
        expect(routeFile).toContain('Must be defined before /:id to avoid Express matching "eligible-robots" as an :id param');
        // Find the first handler block for /eligible-robots
        const handlerMatch = routeFile.match(/router\.get\('\/eligible-robots'[\s\S]*?res\.json\(\{([\s\S]*?)\}\)/);
        expect(handlerMatch).not.toBeNull();
        const responseBody = handlerMatch[1];
        // Verify the response shape contains all expected fields
        const expectedFields = ['success', 'eligibleRobots', 'count', 'timestamp'];
        fc.assert(fc.property(fc.constantFrom(...expectedFields), (field) => {
            expect(responseBody).toContain(field);
        }), { numRuns: expectedFields.length });
    });
    /**
     * **Validates: Requirement 3.6**
     *
     * ci.yml frontend-tests job contains lint and build steps.
     * These must be preserved when the vitest step is added.
     */
    test('frontend-tests CI job contains lint and build steps', () => {
        const ciYml = readRootFile('.github/workflows/ci.yml');
        // Extract the frontend-tests job block
        const frontendJobMatch = ciYml.match(/frontend-tests:[\s\S]*?(?=\n  \w[\w-]*:|$)/);
        expect(frontendJobMatch).not.toBeNull();
        const frontendJob = frontendJobMatch[0];
        const requiredSteps = ['npm run lint', 'npm run build'];
        fc.assert(fc.property(fc.constantFrom(...requiredSteps), (step) => {
            expect(frontendJob).toContain(step);
        }), { numRuns: requiredSteps.length });
    });
});
