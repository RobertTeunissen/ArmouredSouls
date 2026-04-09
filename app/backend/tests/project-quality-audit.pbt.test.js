"use strict";
/**
 * Bug Condition Exploration Tests — Project Quality Audit
 *
 * These tests encode the EXPECTED (fixed) behavior for all defect categories
 * found in the quality audit. On UNFIXED code they MUST FAIL — failure
 * confirms the defects exist.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10
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
describe('Bug Condition Exploration — Project Quality Audit', () => {
    /**
     * **Validates: Requirements 1.1, 1.2**
     *
     * Parse README.md for all markdown links [text](path) where path is a
     * relative file path (not http/https, not anchors, not inline code).
     * Assert every target file exists in the filesystem.
     */
    test('all relative markdown links in README.md resolve to existing files', () => {
        const readme = readRootFile('README.md');
        // Extract markdown links: [text](target)
        const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
        let match;
        const relativeLinks = [];
        while ((match = linkRegex.exec(readme)) !== null) {
            const target = match[2];
            // Skip external URLs, anchors, and mailto links
            if (target.startsWith('http://') ||
                target.startsWith('https://') ||
                target.startsWith('#') ||
                target.startsWith('mailto:')) {
                continue;
            }
            relativeLinks.push(target);
        }
        expect(relativeLinks.length).toBeGreaterThan(0);
        // Use fast-check to sample from the discovered links and assert existence
        fc.assert(fc.property(fc.constantFrom(...relativeLinks), (linkPath) => {
            const exists = existsInRoot(linkPath);
            expect(exists).toBe(true);
        }), { numRuns: relativeLinks.length });
    });
    /**
     * **Validates: Requirement 1.4**
     *
     * Parse .github/workflows/ci.yml and assert all node-version values are '20'.
     */
    test('all CI node-version values should be 20', () => {
        const ciYml = readRootFile('.github/workflows/ci.yml');
        const nodeVersionRegex = /node-version:\s*'(\d+)'/g;
        let match;
        const versions = [];
        while ((match = nodeVersionRegex.exec(ciYml)) !== null) {
            versions.push(match[1]);
        }
        expect(versions.length).toBeGreaterThan(0);
        fc.assert(fc.property(fc.constantFrom(...versions), (version) => {
            expect(version).toBe('20');
        }), { numRuns: versions.length });
    });
    /**
     * **Validates: Requirement 1.5**
     *
     * Parse ci.yml frontend-tests job steps and assert a step containing
     * 'vitest --run' exists.
     */
    test('CI frontend-tests job should contain a vitest --run step', () => {
        const ciYml = readRootFile('.github/workflows/ci.yml');
        // Extract the frontend-tests job block (from "frontend-tests:" to the next
        // top-level job or end of file)
        const frontendJobMatch = ciYml.match(/frontend-tests:[\s\S]*?(?=\n  \w[\w-]*:|$)/);
        expect(frontendJobMatch).not.toBeNull();
        const frontendJob = frontendJobMatch[0];
        const hasVitest = frontendJob.includes('vitest --run');
        expect(hasVitest).toBe(true);
    });
    /**
     * **Validates: Requirement 1.6**
     *
     * Assert app/backend/.env.prd.example does NOT exist.
     */
    test('.env.prd.example should NOT exist (duplicate of .env.production.example)', () => {
        const exists = existsInRoot('app/backend/.env.prd.example');
        expect(exists).toBe(false);
    });
    /**
     * **Validates: Requirement 1.7**
     *
     * Parse app/backend/.env.example and assert it contains all five
     * scheduler environment variables.
     */
    test('.env.example should contain all scheduler environment variables', () => {
        const envExample = readRootFile('app/backend/.env.example');
        const requiredVars = [
            'LEAGUE_SCHEDULE',
            'TOURNAMENT_SCHEDULE',
            'TAGTEAM_SCHEDULE',
            'SETTLEMENT_SCHEDULE',
            'KOTH_SCHEDULE',
        ];
        fc.assert(fc.property(fc.constantFrom(...requiredVars), (varName) => {
            expect(envExample).toContain(varName);
        }), { numRuns: requiredVars.length });
    });
    /**
     * **Validates: Requirement 1.8**
     *
     * Parse adminTournaments.ts and count route registrations for
     * '/eligible-robots'; assert exactly 1.
     */
    test('adminTournaments.ts should have exactly one /eligible-robots route', () => {
        const routeFile = readRootFile('app/backend/src/routes/adminTournaments.ts');
        // Count occurrences of route registration for '/eligible-robots'
        const routeRegex = /router\.\w+\(\s*['"]\/eligible-robots['"]/g;
        const matches = routeFile.match(routeRegex) || [];
        expect(matches.length).toBe(1);
    });
    /**
     * **Validates: Requirement 1.9**
     *
     * Assert dead code files do NOT exist.
     */
    describe('dead code files should NOT exist', () => {
        test('LoginPage.tsx should not exist', () => {
            const exists = existsInRoot('app/frontend/src/pages/LoginPage.tsx');
            expect(exists).toBe(false);
        });
        test('SystemHealthPage.tsx should not exist', () => {
            const exists = existsInRoot('app/frontend/src/pages/SystemHealthPage.tsx');
            expect(exists).toBe(false);
        });
        test('RobotUpcomingMatches.pbt.test.tsx should not exist', () => {
            const exists = existsInRoot('app/frontend/src/components/__tests__/RobotUpcomingMatches.pbt.test.tsx');
            expect(exists).toBe(false);
        });
    });
});
