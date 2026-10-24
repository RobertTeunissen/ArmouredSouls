import fs from 'fs';
import path from 'path';
import {
  STRATEGY_DIRECTORY,
  StrategyRegistryError,
  checkStrategyDirectory,
  loadStrategyRegistry,
  readStrategyDirectory,
  runStrategyStartupCheck,
} from '../registry';
import type { StrategyDefinitionFile } from '../strategyTypes';
import { TEST_WEIGHTS } from '../../__tests__/helpers/automatonFixtures';
import { BUILD_FOCUS_WEIGHTS } from '../../buildFocus';
import { FIXTURE_STRATEGY_DIRECTORY } from './helpers/strategyTestSupport';

jest.mock('../../../../config/logger', () => ({ __esModule: true, default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const FIXTURE: StrategyDefinitionFile = JSON.parse(
  fs.readFileSync(path.join(FIXTURE_STRATEGY_DIRECTORY, 'fixture.v1.json'), 'utf8'),
) as StrategyDefinitionFile;

// Scratch directories live beside this file (inside the workspace) and are removed after each test.
const scratch: string[] = [];
function scratchDirectory(files: Record<string, unknown>): string {
  const directory = fs.mkdtempSync(path.join(__dirname, '.tmp-registry-'));
  scratch.push(directory);
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(directory, name), typeof content === 'string' ? content : JSON.stringify(content));
  }
  return directory;
}

afterEach(() => {
  while (scratch.length > 0) fs.rmSync(scratch.pop() as string, { recursive: true, force: true });
});

describe('Strategy_Registry (R6.2, R6.6, R6.8, design §14.0)', () => {
  it('resolves the repository strategy directory to src/config/automaton-strategies', () => {
    expect(STRATEGY_DIRECTORY.endsWith(path.join('src', 'config', 'automaton-strategies'))).toBe(true);
    expect(fs.existsSync(STRATEGY_DIRECTORY)).toBe(true);
  });

  it('holds the six strategies in versions 1 and 2 and they pass the startup check (task 4.2, R6.1–R6.3)', () => {
    const registry = loadStrategyRegistry({ weightTable: BUILD_FOCUS_WEIGHTS });
    expect(registry.all().map((s) => `${s.key}.v${s.version}`)).toEqual([
      'duo.v1', 'duo.v2', 'generalist.v1', 'generalist.v2', 'paragon.v1', 'paragon.v2',
      'swarm.v1', 'swarm.v2', 'trio.v1', 'trio.v2', 'tycoon.v1', 'tycoon.v2',
    ]);
    const stored = registry.all().map((s) => ({ strategyKey: s.key, strategyVersion: s.version }));
    expect(checkStrategyDirectory(stored)).toEqual({ passed: true, strategyFiles: 12, problems: [] });
  });

  it('loads a directory, derives Goal ids and builds every Goal through the factories', () => {
    const registry = loadStrategyRegistry({ directory: FIXTURE_STRATEGY_DIRECTORY, weightTable: TEST_WEIGHTS });
    const strategy = registry.getStrategy('fixture', 1);
    expect(strategy).toBeDefined();
    expect(strategy?.displayName).toBe('Fixture');
    expect(strategy?.buildOrder.map((g) => g.id)).toEqual(FIXTURE.buildOrder.map((entry) => {
      const position = String(entry.position).padStart(2, '0');
      const suffix = entry.goal.type === 'facility' ? `facility.${entry.goal.facilityType}` : entry.goal.type;
      return `fixture.v1.${position}.${suffix}`;
    }));
    for (const definition of strategy?.buildOrder ?? []) {
      expect(definition.goal.id).toBe(definition.id);
      expect(typeof definition.goal.evaluate).toBe('function');
    }
    expect(registry.latestVersion('fixture')).toBe(1);
    expect(registry.latestVersion('missing')).toBeUndefined();
    expect(registry.getStrategy('fixture', 2)).toBeUndefined();
  });

  it('generates the parameter schema from the bounds', () => {
    const strategy = loadStrategyRegistry({ directory: FIXTURE_STRATEGY_DIRECTORY, weightTable: TEST_WEIGHTS }).getStrategy('fixture', 1);
    const targets = Object.fromEntries((strategy?.buildOrder ?? []).map((g) => [g.id, g.defaultTarget]));
    expect(strategy?.parameterSchema.safeParse({ targets }).success).toBe(true);
    expect(strategy?.parameterSchema.safeParse({ targets: { ...targets, 'fixture.v1.01.robots': 4 } }).success).toBe(false);
  });

  it('picks up a new file with no code change and keeps versions apart (R6.8)', () => {
    const v2 = { ...FIXTURE, version: 2, displayName: 'Fixture II' };
    const other = { ...FIXTURE, key: 'raider', displayName: 'Raider' };
    const directory = scratchDirectory({ 'fixture.v1.json': FIXTURE, 'fixture.v2.json': v2, 'raider.v1.json': other, 'README.md': 'ignored' });
    const registry = loadStrategyRegistry({ directory, weightTable: TEST_WEIGHTS });
    expect(registry.all().map((s) => `${s.key}.v${s.version}`)).toEqual(['fixture.v1', 'fixture.v2', 'raider.v1']);
    expect(registry.latestVersion('fixture')).toBe(2);
    expect(registry.getStrategy('fixture', 2)?.buildOrder[0].id).toBe('fixture.v2.01.robots');
    expect(registry.latestVersions()).toEqual(new Map([['fixture', 2], ['raider', 1]]));
  });

  it('accepts an empty directory', () => {
    const directory = scratchDirectory({ '.gitkeep': '' });
    expect(loadStrategyRegistry({ directory, weightTable: TEST_WEIGHTS }).all()).toEqual([]);
    expect(checkStrategyDirectory([], directory)).toEqual({ passed: true, strategyFiles: 0, problems: [] });
  });

  describe('invalid files', () => {
    it.each([
      ['a builder-rule violation', 'fixture.v1.json', { ...FIXTURE, buildOrder: FIXTURE.buildOrder.slice(0, -1) }, 'last goal'],
      ['invalid JSON', 'fixture.v1.json', '{ not json', 'Not valid JSON'],
      ['a file name that does not match its content', 'other.v1.json', FIXTURE, 'File name must be fixture.v1.json'],
    ])('rejects %s', (_label, name, content, fragment) => {
      const directory = scratchDirectory({ [name]: content });
      expect(() => loadStrategyRegistry({ directory, weightTable: TEST_WEIGHTS })).toThrow(StrategyRegistryError);
      const check = checkStrategyDirectory([], directory);
      expect(check.passed).toBe(false);
      expect(check.problems.join(' ').toLowerCase()).toContain(fragment.toLowerCase());
    });

    it('reports every problem of every file', () => {
      const directory = scratchDirectory({ 'a.v1.json': '{', 'fixture.v1.json': { ...FIXTURE, buildOrder: [] } });
      const load = readStrategyDirectory(directory);
      expect(load.problems.map((p) => p.file)).toEqual(['a.v1.json', 'fixture.v1.json']);
    });

    it('fails when the directory is missing', () => {
      expect(checkStrategyDirectory([], path.join(__dirname, 'does-not-exist')).passed).toBe(false);
    });
  });

  describe('startup check (R6.2, R6.6)', () => {
    it('passes when every stored version has a file', async () => {
      const alert = jest.fn().mockResolvedValue(true);
      const result = await runStrategyStartupCheck({
        directory: FIXTURE_STRATEGY_DIRECTORY,
        listStoredVersions: async () => [{ strategyKey: 'fixture', strategyVersion: 1 }],
        alert,
      });
      expect(result).toEqual({ passed: true, strategyFiles: 1, problems: [] });
      expect(alert).not.toHaveBeenCalled();
    });

    it('refuses to start when a stored (strategyKey, strategyVersion) has no file, and alerts', async () => {
      const alert = jest.fn().mockResolvedValue(true);
      const result = await runStrategyStartupCheck({
        directory: FIXTURE_STRATEGY_DIRECTORY,
        listStoredVersions: async () => [
          { strategyKey: 'fixture', strategyVersion: 1 },
          { strategyKey: 'fixture', strategyVersion: 2 },
          { strategyKey: 'swarm', strategyVersion: 1 },
        ],
        alert,
      });
      expect(result.passed).toBe(false);
      expect(result.problems).toEqual([
        'fixture.v2.json: an Automaton_Profile uses this Strategy_Version but the file is missing',
        'swarm.v1.json: an Automaton_Profile uses this Strategy_Version but the file is missing',
      ]);
      expect(alert).toHaveBeenCalledTimes(1);
      expect(alert.mock.calls[0][0]).toContain('STARTUP FAILED');
    });

    it('refuses to start on an invalid file', async () => {
      const directory = scratchDirectory({ 'fixture.v1.json': { ...FIXTURE, version: 'one' } });
      const alert = jest.fn().mockResolvedValue(true);
      const result = await runStrategyStartupCheck({ directory, listStoredVersions: async () => [], alert });
      expect(result.passed).toBe(false);
      expect(alert).toHaveBeenCalledTimes(1);
    });

    it('checks the files only when the stored versions cannot be read', async () => {
      const result = await runStrategyStartupCheck({
        directory: FIXTURE_STRATEGY_DIRECTORY,
        listStoredVersions: async () => { throw new Error('database unreachable'); },
        alert: jest.fn(),
      });
      expect(result.passed).toBe(true);
    });
  });
});
