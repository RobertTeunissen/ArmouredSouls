import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';

const NUM_RUNS = 100;

/**
 * Recursively collects all .ts files under the given directory.
 */
function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

const backendRoot = path.resolve(__dirname, '..');
const srcDir = path.join(backendRoot, 'src');
const testsDir = path.join(backendRoot, 'tests');

const allTsFiles = [...collectTsFiles(srcDir), ...collectTsFiles(testsDir)];

/**
 * Feature: dependency-upgrades, Property 2: No legacy Prisma import paths
 *
 * **Validates: Requirements 3.6**
 *
 * For any TypeScript source file in prototype/backend/src or prototype/backend/tests,
 * if the file imports from a Prisma client module, the import path must reference the
 * project-local generated output directory and must NOT import from `@prisma/client`.
 */
describe('Feature: dependency-upgrades', () => {
  /**
   * Feature: dependency-upgrades, Property 1: Node.js version consistency
   *
   * **Validates: Requirements 1.1, 1.4, 1.5, 14.1**
   *
   * For any file in the project that specifies a Node.js version (including
   * package.json engines fields, .nvmrc, and GitHub Actions workflow node-version
   * fields), the specified version must resolve to Node.js 24.x.
   */
  describe('Property 1: Node.js version consistency across all configuration sources', () => {
    const projectRoot = path.resolve(__dirname, '..', '..', '..');
    const frontendRoot = path.resolve(__dirname, '..', '..', 'frontend');

    interface ConfigSource {
      name: string;
      filePath: string;
      extractVersion: () => string[];
    }

    /**
     * Extracts the engines.node field from a package.json file.
     */
    function extractEnginesNode(pkgPath: string): string[] {
      const content = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const enginesNode: string | undefined = content?.engines?.node;
      return enginesNode ? [enginesNode] : [];
    }

    /**
     * Extracts all node-version values from a GitHub Actions workflow file
     * using regex (avoids needing a YAML parser dependency).
     */
    function extractWorkflowNodeVersions(workflowPath: string): string[] {
      const content = fs.readFileSync(workflowPath, 'utf-8');
      const versions: string[] = [];
      const pattern = /node-version:\s*['"]?(\d+[^'"\s]*)['"]?/g;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(content)) !== null) {
        versions.push(match[1]);
      }
      return versions;
    }

    const configSources: ConfigSource[] = [
      {
        name: 'backend package.json engines.node',
        filePath: path.resolve(backendRoot, 'package.json'),
        extractVersion: () => extractEnginesNode(path.resolve(backendRoot, 'package.json')),
      },
      {
        name: 'frontend package.json engines.node',
        filePath: path.resolve(frontendRoot, 'package.json'),
        extractVersion: () => extractEnginesNode(path.resolve(frontendRoot, 'package.json')),
      },
      {
        name: '.nvmrc',
        filePath: path.resolve(projectRoot, '.nvmrc'),
        extractVersion: () => [fs.readFileSync(path.resolve(projectRoot, '.nvmrc'), 'utf-8').trim()],
      },
      {
        name: 'ci.yml node-version',
        filePath: path.resolve(projectRoot, '.github', 'workflows', 'ci.yml'),
        extractVersion: () =>
          extractWorkflowNodeVersions(path.resolve(projectRoot, '.github', 'workflows', 'ci.yml')),
      },
      {
        name: 'deploy.yml node-version',
        filePath: path.resolve(projectRoot, '.github', 'workflows', 'deploy.yml'),
        extractVersion: () =>
          extractWorkflowNodeVersions(path.resolve(projectRoot, '.github', 'workflows', 'deploy.yml')),
      },
    ];

    /**
     * Asserts that a version string resolves to Node.js 24.x.
     * Accepts: "24", ">=24.0.0", "24.x", or any string starting with "24".
     */
    function assertNode24(version: string, sourceName: string): void {
      const normalized = version.replace(/^[>=^~]+/, '').trim();
      expect({
        source: sourceName,
        version,
        startsWithNode24: normalized.startsWith('24'),
      }).toEqual(
        expect.objectContaining({ startsWithNode24: true })
      );
    }

    test('all config source files should exist', () => {
      for (const source of configSources) {
        expect(fs.existsSync(source.filePath)).toBe(true);
      }
    });

    test('every config source specifies Node.js 24.x', () => {
      // Flatten all sources into individual (name, version) pairs
      const allVersionEntries: { name: string; version: string }[] = [];
      for (const source of configSources) {
        const versions = source.extractVersion();
        for (const v of versions) {
          allVersionEntries.push({ name: source.name, version: v });
        }
      }

      expect(allVersionEntries.length).toBeGreaterThan(0);

      fc.assert(
        fc.property(
          fc.constantFrom(...allVersionEntries),
          (entry: { name: string; version: string }) => {
            assertNode24(entry.version, entry.name);
          }
        ),
        { numRuns: Math.min(NUM_RUNS, allVersionEntries.length) }
      );
    });

    test('deterministic full scan: every version reference resolves to Node.js 24.x', () => {
      const violations: string[] = [];

      for (const source of configSources) {
        const versions = source.extractVersion();
        if (versions.length === 0) {
          violations.push(`${source.name}: no Node.js version found`);
          continue;
        }
        for (const v of versions) {
          const normalized = v.replace(/^[>=^~]+/, '').trim();
          if (!normalized.startsWith('24')) {
            violations.push(`${source.name}: expected Node.js 24.x but found "${v}"`);
          }
        }
      }

      expect(violations).toEqual([]);
    });
  });

  describe('Property 2: No legacy Prisma import paths', () => {
    // Regex that matches import/require statements referencing @prisma/client
    const legacyPrismaImportPattern = /(?:from\s+['"]@prisma\/client['"])|(?:require\s*\(\s*['"]@prisma\/client['"]\s*\))/;

    test('should have .ts files to scan', () => {
      expect(allTsFiles.length).toBeGreaterThan(0);
    });

    test('no .ts file in src/ or tests/ should import from @prisma/client', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...allTsFiles),
          (filePath: string) => {
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n');

            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              if (legacyPrismaImportPattern.test(line)) {
                const relativePath = path.relative(backendRoot, filePath);
                throw new Error(
                  `Legacy @prisma/client import found in ${relativePath} at line ${i + 1}: ${line.trim()}`
                );
              }
            }
          }
        ),
        { numRuns: Math.min(NUM_RUNS, allTsFiles.length) }
      );
    });

    test('deterministic full scan: every .ts file is free of @prisma/client imports', () => {
      const violations: string[] = [];

      for (const filePath of allTsFiles) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          if (legacyPrismaImportPattern.test(lines[i])) {
            const relativePath = path.relative(backendRoot, filePath);
            violations.push(`${relativePath}:${i + 1} — ${lines[i].trim()}`);
          }
        }
      }

      expect(violations).toEqual([]);
    });
  });

  /**
   * Feature: dependency-upgrades, Property 3: Express 5 async error propagation
   *
   * **Validates: Requirements 4.4**
   *
   * For any Express route handler that returns a rejected promise (throws an async
   * error), Express 5 must catch the rejection and forward it to the error-handling
   * middleware, resulting in a proper HTTP error response rather than an unhandled
   * promise rejection or process crash.
   */
  describe('Property 3: Express 5 async error propagation', () => {
    /** Custom error class for testing non-standard error types. */
    class CustomAppError extends Error {
      statusCode: number;
      constructor(message: string, statusCode: number) {
        super(message);
        this.name = 'CustomAppError';
        this.statusCode = statusCode;
      }
    }

    /**
     * Arbitrary that produces a throwable value: either a standard Error with a
     * random message, a CustomAppError with a random status code, or a plain
     * string throw.
     */
    const errorArbitrary: fc.Arbitrary<{ kind: string; value: unknown }> = fc.oneof(
      fc.string({ minLength: 1, maxLength: 80 }).map((msg) => ({
        kind: 'Error',
        value: new Error(msg),
      })),
      fc.record({
        msg: fc.string({ minLength: 1, maxLength: 80 }),
        status: fc.integer({ min: 400, max: 599 }),
      }).map(({ msg, status }) => ({
        kind: 'CustomAppError',
        value: new CustomAppError(msg, status),
      })),
      fc.string({ minLength: 1, maxLength: 80 }).map((msg) => ({
        kind: 'string',
        value: msg,
      }))
    );

    /**
     * Creates a minimal Express 5 app with:
     * - An async GET route at /test that throws the provided value
     * - Error-handling middleware that returns a JSON error response
     */
    function createTestApp(throwable: unknown): express.Express {
      const app = express();

      app.get('/test', async (_req: Request, _res: Response) => {
        throw throwable;
      });

      // Error-handling middleware (4-arg signature)
      app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
        const statusCode =
          err instanceof CustomAppError ? err.statusCode : 500;
        const message =
          err instanceof Error ? err.message : String(err);
        res.status(statusCode).json({ error: message });
      });

      return app;
    }

    test('async route handlers that throw are caught and produce HTTP error responses', async () => {
      await fc.assert(
        fc.asyncProperty(errorArbitrary, async ({ value }) => {
          const app = createTestApp(value);
          const res = await request(app).get('/test');

          // Must receive a proper HTTP error, not a timeout or crash
          expect(res.status).toBeGreaterThanOrEqual(400);
          expect(res.status).toBeLessThan(600);
          expect(res.body).toHaveProperty('error');
        }),
        { numRuns: NUM_RUNS }
      );
    });

    test('rejected promises with Error objects produce 500 responses', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 80 }),
          async (message: string) => {
            const app = createTestApp(new Error(message));
            const res = await request(app).get('/test');

            expect(res.status).toBe(500);
            expect(res.body.error).toBe(message);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('rejected promises with CustomAppError preserve status codes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 80 }),
          fc.integer({ min: 400, max: 599 }),
          async (message: string, statusCode: number) => {
            const app = createTestApp(new CustomAppError(message, statusCode));
            const res = await request(app).get('/test');

            expect(res.status).toBe(statusCode);
            expect(res.body.error).toBe(message);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('rejected promises with string throws produce error responses', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 80 }),
          async (message: string) => {
            const app = createTestApp(message);
            const res = await request(app).get('/test');

            expect(res.status).toBeGreaterThanOrEqual(400);
            expect(res.body.error).toBe(message);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * Feature: dependency-upgrades, Property 4: All dependency versions are stable and properly pinned
   *
   * **Validates: Requirements 11.1, 11.2, 12.1, 12.2, 15.5**
   *
   * For any dependency entry (both dependencies and devDependencies) in both
   * prototype/backend/package.json and prototype/frontend/package.json, the version
   * string must: (a) match a caret-pinned (^X.Y.Z) or exact (X.Y.Z) semver pattern,
   * (b) not contain pre-release identifiers, and (c) not use wildcard (*) or latest.
   */
  describe('Property 4: All dependency versions are stable and properly pinned', () => {
    const backendPkgPath = path.resolve(__dirname, '..', 'package.json');
    const frontendPkgPath = path.resolve(__dirname, '..', '..', 'frontend', 'package.json');

    /** Matches caret-pinned (^X.Y.Z) or exact (X.Y.Z) semver — no pre-release suffix. */
    const validSemverPattern = /^(\^)?\d+\.\d+\.\d+$/;

    /** Matches pre-release identifiers that indicate unstable versions. */
    const preReleasePattern = /-(alpha|beta|rc|canary|next|experimental|dev|preview)/i;

    interface DepEntry {
      source: string;
      name: string;
      version: string;
    }

    /**
     * Extracts all dependency entries from a package.json file.
     */
    function extractDeps(pkgPath: string, sourceLabel: string): DepEntry[] {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const entries: DepEntry[] = [];

      for (const section of ['dependencies', 'devDependencies'] as const) {
        const deps: Record<string, string> | undefined = pkg[section];
        if (!deps) continue;
        for (const [name, version] of Object.entries(deps)) {
          entries.push({ source: `${sourceLabel} ${section}`, name, version });
        }
      }

      return entries;
    }

    const allDeps: DepEntry[] = [
      ...extractDeps(backendPkgPath, 'backend'),
      ...extractDeps(frontendPkgPath, 'frontend'),
    ];

    test('should have dependency entries to validate', () => {
      expect(allDeps.length).toBeGreaterThan(0);
    });

    test('every dependency version matches caret-pinned or exact semver with no pre-release tags', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...allDeps),
          (dep: DepEntry) => {
            // Must not use wildcard or latest
            expect({
              dep: `${dep.source} > ${dep.name}`,
              version: dep.version,
              isWildcardOrLatest: dep.version === '*' || dep.version === 'latest',
            }).toEqual(
              expect.objectContaining({ isWildcardOrLatest: false })
            );

            // Must match valid semver pattern (^X.Y.Z or X.Y.Z)
            expect({
              dep: `${dep.source} > ${dep.name}`,
              version: dep.version,
              matchesValidSemver: validSemverPattern.test(dep.version),
            }).toEqual(
              expect.objectContaining({ matchesValidSemver: true })
            );

            // Must not contain pre-release identifiers
            expect({
              dep: `${dep.source} > ${dep.name}`,
              version: dep.version,
              containsPreRelease: preReleasePattern.test(dep.version),
            }).toEqual(
              expect.objectContaining({ containsPreRelease: false })
            );
          }
        ),
        { numRuns: Math.min(NUM_RUNS, allDeps.length) }
      );
    });

    test('deterministic full scan: every dependency version is stable and properly pinned', () => {
      const violations: string[] = [];

      for (const dep of allDeps) {
        if (dep.version === '*' || dep.version === 'latest') {
          violations.push(`${dep.source} > ${dep.name}: uses "${dep.version}" (wildcard/latest not allowed)`);
          continue;
        }

        if (!validSemverPattern.test(dep.version)) {
          violations.push(`${dep.source} > ${dep.name}: version "${dep.version}" is not caret-pinned (^X.Y.Z) or exact (X.Y.Z)`);
        }

        if (preReleasePattern.test(dep.version)) {
          violations.push(`${dep.source} > ${dep.name}: version "${dep.version}" contains a pre-release identifier`);
        }
      }

      expect(violations).toEqual([]);
    });
  });

  /**
   * Feature: dependency-upgrades, Property 5: Engines field enforces post-upgrade minimum versions
   *
   * **Validates: Requirements 15.1**
   *
   * For any `package.json` file in the project (backend and frontend), the `engines`
   * field must exist and specify a minimum Node.js version of `>=24.0.0`.
   */
  describe('Property 5: Engines field enforces post-upgrade minimum versions', () => {
    const EXPECTED_ENGINES_NODE = '>=24.0.0';

    interface PkgEnginesEntry {
      label: string;
      filePath: string;
    }

    const packageJsonFiles: PkgEnginesEntry[] = [
      {
        label: 'backend package.json',
        filePath: path.resolve(__dirname, '..', 'package.json'),
      },
      {
        label: 'frontend package.json',
        filePath: path.resolve(__dirname, '..', '..', 'frontend', 'package.json'),
      },
    ];

    test('all package.json files should exist', () => {
      for (const entry of packageJsonFiles) {
        expect(fs.existsSync(entry.filePath)).toBe(true);
      }
    });

    test('every package.json has an engines field with node >= 24.0.0', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...packageJsonFiles),
          (entry: PkgEnginesEntry) => {
            const pkg = JSON.parse(fs.readFileSync(entry.filePath, 'utf-8'));

            // engines field must exist
            expect({
              source: entry.label,
              hasEngines: pkg.engines != null,
            }).toEqual(
              expect.objectContaining({ hasEngines: true })
            );

            // engines.node must exist
            expect({
              source: entry.label,
              hasEnginesNode: pkg.engines?.node != null,
            }).toEqual(
              expect.objectContaining({ hasEnginesNode: true })
            );

            // engines.node must equal >=24.0.0
            expect({
              source: entry.label,
              enginesNode: pkg.engines?.node,
              expected: EXPECTED_ENGINES_NODE,
            }).toEqual(
              expect.objectContaining({ enginesNode: EXPECTED_ENGINES_NODE })
            );
          }
        ),
        { numRuns: Math.min(NUM_RUNS, packageJsonFiles.length) }
      );
    });

    test('deterministic full scan: every package.json enforces engines.node >= 24.0.0', () => {
      const violations: string[] = [];

      for (const entry of packageJsonFiles) {
        const pkg = JSON.parse(fs.readFileSync(entry.filePath, 'utf-8'));

        if (!pkg.engines) {
          violations.push(`${entry.label}: missing "engines" field`);
          continue;
        }

        if (!pkg.engines.node) {
          violations.push(`${entry.label}: missing "engines.node" field`);
          continue;
        }

        if (pkg.engines.node !== EXPECTED_ENGINES_NODE) {
          violations.push(
            `${entry.label}: engines.node is "${pkg.engines.node}", expected "${EXPECTED_ENGINES_NODE}"`
          );
        }
      }

      expect(violations).toEqual([]);
    });
  });

  /**
   * Feature: dependency-upgrades, Property 6: Version reference table round-trip consistency
   *
   * **Validates: Requirements 16.4**
   *
   * For any dependency listed in the post-upgrade version reference table in the
   * documentation, the documented post-upgrade version must match the actual version
   * range installed in the corresponding package.json file (backend or frontend,
   * as indicated by the scope column).
   */
  describe('Property 6: Version reference table round-trip consistency', () => {
    const designDocPath = path.resolve(__dirname, '..', '..', '..', '.kiro', 'specs', 'dependency-upgrades', 'design.md');
    const backendPkgPath = path.resolve(__dirname, '..', 'package.json');
    const frontendPkgPath = path.resolve(__dirname, '..', '..', 'frontend', 'package.json');

    /**
     * Mapping from human-readable dependency names in the version reference table
     * to their npm package names and where to find them in package.json.
     */
    const DEP_NAME_MAP: Record<string, { npmName: string; section: 'dependencies' | 'devDependencies' }> = {
      'TypeScript': { npmName: 'typescript', section: 'devDependencies' },
      'Prisma': { npmName: 'prisma', section: 'devDependencies' },
      'Express': { npmName: 'express', section: 'dependencies' },
      'Jest': { npmName: 'jest', section: 'devDependencies' },
      'React': { npmName: 'react', section: 'dependencies' },
      'react-dom': { npmName: 'react-dom', section: 'dependencies' },
      'Vite': { npmName: 'vite', section: 'devDependencies' },
      'Vitest': { npmName: 'vitest', section: 'devDependencies' },
      'Tailwind CSS': { npmName: 'tailwindcss', section: 'devDependencies' },
      '@vitejs/plugin-react': { npmName: '@vitejs/plugin-react', section: 'devDependencies' },
      '@vitest/coverage-v8': { npmName: '@vitest/coverage-v8', section: 'devDependencies' },
      '@vitest/ui': { npmName: '@vitest/ui', section: 'devDependencies' },
      'ts-jest': { npmName: 'ts-jest', section: 'devDependencies' },
      '@types/react': { npmName: '@types/react', section: 'devDependencies' },
      '@types/react-dom': { npmName: '@types/react-dom', section: 'devDependencies' },
      '@types/express': { npmName: '@types/express', section: 'devDependencies' },
    };

    /** Scopes to skip — these aren't npm packages in package.json. */
    const SKIP_SCOPES = ['Runtime', 'Infrastructure'];

    interface TableRow {
      dependency: string;
      postUpgrade: string;
      scope: string;
    }

    interface VersionCheckEntry {
      dependency: string;
      scope: string;
      pkgLabel: string;
      documentedVersion: string;
      actualVersion: string | undefined;
    }

    /**
     * Parses the Version Reference Table from the design.md markdown content.
     * Returns an array of rows with dependency name, post-upgrade version, and scope.
     */
    function parseVersionTable(markdown: string): TableRow[] {
      const lines = markdown.split('\n');
      const rows: TableRow[] = [];

      // Find the table header line
      let tableStart = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('| Dependency') && lines[i].includes('Post-Upgrade') && lines[i].includes('Scope')) {
          tableStart = i;
          break;
        }
      }

      if (tableStart === -1) return rows;

      // Skip header and separator lines, parse data rows
      for (let i = tableStart + 2; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line.startsWith('|')) break; // End of table

        const cells = line.split('|').map(c => c.trim()).filter(c => c.length > 0);
        if (cells.length >= 4) {
          rows.push({
            dependency: cells[0],
            postUpgrade: cells[2],
            scope: cells[3],
          });
        }
      }

      return rows;
    }

    /**
     * Resolves which package.json files to check for a given scope.
     * Returns an array of { label, filePath } objects.
     */
    function resolvePackageFiles(scope: string): { label: string; filePath: string }[] {
      if (scope === 'Backend') {
        return [{ label: 'backend', filePath: backendPkgPath }];
      }
      if (scope === 'Frontend') {
        return [{ label: 'frontend', filePath: frontendPkgPath }];
      }
      if (scope === 'Backend + Frontend') {
        return [
          { label: 'backend', filePath: backendPkgPath },
          { label: 'frontend', filePath: frontendPkgPath },
        ];
      }
      return [];
    }

    // Parse the design doc and build the list of version check entries
    const designDoc = fs.readFileSync(designDocPath, 'utf-8');
    const tableRows = parseVersionTable(designDoc);

    const versionCheckEntries: VersionCheckEntry[] = [];

    for (const row of tableRows) {
      if (SKIP_SCOPES.includes(row.scope)) continue;

      const mapping = DEP_NAME_MAP[row.dependency];
      if (!mapping) continue;

      const pkgFiles = resolvePackageFiles(row.scope);
      for (const pkgFile of pkgFiles) {
        const pkg = JSON.parse(fs.readFileSync(pkgFile.filePath, 'utf-8'));
        const actualVersion: string | undefined = pkg[mapping.section]?.[mapping.npmName];

        versionCheckEntries.push({
          dependency: row.dependency,
          scope: row.scope,
          pkgLabel: pkgFile.label,
          documentedVersion: row.postUpgrade,
          actualVersion,
        });
      }
    }

    test('design doc should exist and contain a version reference table', () => {
      expect(fs.existsSync(designDocPath)).toBe(true);
      expect(tableRows.length).toBeGreaterThan(0);
    });

    test('should have version check entries to validate (npm packages only)', () => {
      expect(versionCheckEntries.length).toBeGreaterThan(0);
    });

    test('randomly sampled table rows: documented post-upgrade version matches package.json', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...versionCheckEntries),
          (entry: VersionCheckEntry) => {
            // The dependency must exist in the package.json
            expect({
              dependency: entry.dependency,
              pkg: entry.pkgLabel,
              found: entry.actualVersion != null,
            }).toEqual(
              expect.objectContaining({ found: true })
            );

            // The documented version must match the actual version
            expect({
              dependency: entry.dependency,
              pkg: entry.pkgLabel,
              documented: entry.documentedVersion,
              actual: entry.actualVersion,
            }).toEqual(
              expect.objectContaining({ documented: entry.actualVersion })
            );
          }
        ),
        { numRuns: Math.min(NUM_RUNS, versionCheckEntries.length) }
      );
    });

    test('deterministic full scan: every documented version matches package.json', () => {
      const violations: string[] = [];

      for (const entry of versionCheckEntries) {
        if (entry.actualVersion == null) {
          violations.push(
            `${entry.dependency} (${entry.pkgLabel}): not found in package.json`
          );
          continue;
        }

        if (entry.documentedVersion !== entry.actualVersion) {
          violations.push(
            `${entry.dependency} (${entry.pkgLabel}): documented "${entry.documentedVersion}" but package.json has "${entry.actualVersion}"`
          );
        }
      }

      expect(violations).toEqual([]);
    });
  });
});
