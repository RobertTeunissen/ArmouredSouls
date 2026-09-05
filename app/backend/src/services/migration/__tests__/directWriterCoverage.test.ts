import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  checkDirectWriterCoverage,
  discoverDirectCurrencyMutations,
} from '../directWriterCoverage';

let workspaceRoot: string;

function writeProductionFixture(relativePath: string, source: string): void {
  const target = path.join(workspaceRoot, 'app/backend/src', relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, source);
}

beforeEach(() => {
  workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'direct-writer-coverage-'));
});

afterEach(() => {
  fs.rmSync(workspaceRoot, { recursive: true, force: true });
});

describe('direct User.currency writer coverage', () => {
  it('should resolve data and args aliases through static object spreads', () => {
    writeProductionFixture('services/alias-writers.ts', `
      const increment = { increment: 25 };
      const dataAlias = { currency: increment };
      const argsAlias = { where: { id: 1 }, data: dataAlias };
      prisma.user.update(argsAlias);

      const baseData = { currency: { decrement: 10 } };
      const spreadData = { ...baseData };
      const options = { where: { id: 2 }, data: spreadData };
      tx.user.update(options);

      const nestedArgs = { ...{ data: { ...{ currency: 8 } } } };
      client.user.update(nestedArgs);
    `);

    expect(discoverDirectCurrencyMutations(workspaceRoot)).toEqual([
      {
        file: 'app/backend/src/services/alias-writers.ts',
        operation: 'decrement',
        occurrence: 1,
      },
      {
        file: 'app/backend/src/services/alias-writers.ts',
        operation: 'increment',
        occurrence: 1,
      },
      {
        file: 'app/backend/src/services/alias-writers.ts',
        operation: 'set',
        occurrence: 1,
      },
    ]);
  });

  it('should fail closed for nested and bracketed currency alias assignments', () => {
    writeProductionFixture('services/nested-alias-writers.ts', `
      const nestedArgs = { where: { id: 1 }, data: {} };
      nestedArgs.data.currency = { increment: 10 };
      prisma.user.update(nestedArgs);

      const bracketedArgs = { where: { id: 2 }, data: {} };
      bracketedArgs.data['currency'] = { decrement: 5 };
      tx.user.update(bracketedArgs);
    `);

    expect(discoverDirectCurrencyMutations(workspaceRoot)).toEqual([
      {
        file: 'app/backend/src/services/nested-alias-writers.ts',
        operation: 'set',
        occurrence: 1,
      },
      {
        file: 'app/backend/src/services/nested-alias-writers.ts',
        operation: 'set',
        occurrence: 2,
      },
    ]);
  });

  it('should fail closed for unresolved args, data aliases, and object spreads', () => {
    writeProductionFixture('services/dynamic-writers.ts', `
      const dynamicArgs = buildArgs();
      prisma.user.update(dynamicArgs);

      declare const dynamicData: unknown;
      prisma.user.update({ where: { id: 2 }, data: dynamicData });

      const dynamicPatch = buildPatch();
      tx.user.update({ where: { id: 3 }, data: { ...dynamicPatch } });

      prisma.robot.update({ data: { currency: { increment: 5 } } });
    `);

    const result = checkDirectWriterCoverage(workspaceRoot);
    expect(result.discovered).toEqual([
      {
        file: 'app/backend/src/services/dynamic-writers.ts',
        operation: 'set',
        occurrence: 1,
      },
      {
        file: 'app/backend/src/services/dynamic-writers.ts',
        operation: 'set',
        occurrence: 2,
      },
      {
        file: 'app/backend/src/services/dynamic-writers.ts',
        operation: 'set',
        occurrence: 3,
      },
    ]);
    expect(result.uncovered).toEqual(result.discovered);
  });
});
