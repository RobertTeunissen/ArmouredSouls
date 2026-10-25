import fs from 'fs';
import os from 'os';
import path from 'path';
import { CATALOGUE_DIRECTORY } from '../automatonCatalogueService';
import { rewriteCatalogueStrategy, upgradeCatalogueDirectory, upgradeCatalogueStrategy } from '../catalogueUpgrade';
import { getStrategyRegistry } from '../strategies/defaultRegistry';

const registry = getStrategyRegistry();

describe('Catalogue_Upgrade', () => {
  it('carries overrides by Goal type and occurrence, not by position', () => {
    // Generalist v1 goal 14 is its third Robots goal; in v2 that goal is at 15.
    expect(upgradeCatalogueStrategy({ key: 'generalist', version: 1, targetOverrides: { 14: 3 } }, registry))
      .toEqual({ kind: 'upgraded', strategy: { key: 'generalist', version: 2, targetOverrides: { 15: 3 } } });
    // Duo v1: Booking Office L4 (goal 11) and the second Robots goal (13).
    expect(upgradeCatalogueStrategy({ key: 'duo', version: 1, targetOverrides: { 11: 6, 13: 3 } }, registry))
      .toEqual({ kind: 'upgraded', strategy: { key: 'duo', version: 2, targetOverrides: { 12: 6, 14: 3 } } });
    expect(upgradeCatalogueStrategy({ key: 'duo', version: 1, targetOverrides: {} }, registry))
      .toEqual({ kind: 'upgraded', strategy: { key: 'duo', version: 2, targetOverrides: {} } });
  });

  it('leaves a current entry alone and refuses an unknown strategy or an invalid override', () => {
    expect(upgradeCatalogueStrategy({ key: 'duo', version: 2, targetOverrides: {} }, registry)).toEqual({ kind: 'current' });
    expect(upgradeCatalogueStrategy({ key: 'nope', version: 1, targetOverrides: {} }, registry).kind).toBe('invalid');
    expect(upgradeCatalogueStrategy({ key: 'duo', version: 1, targetOverrides: { 99: 1 } }, registry).kind).toBe('invalid');
  });

  it('rewrites only the strategy member, in either catalogue layout', () => {
    const strategy = { key: 'tycoon', version: 2, targetOverrides: { 21: 3 } };
    const pretty = `${JSON.stringify({ schemaVersion: 1, catalogueKey: 'x', strategy: { key: 'tycoon', version: 1, targetOverrides: { 20: 3 } }, eventOrder: ['koth'] }, null, 2)}\n`;
    expect(rewriteCatalogueStrategy(pretty, strategy)).toBe(pretty.replace('"version": 1', '"version": 2').replace('"20": 3', '"21": 3'));
    const compact = '{\n  "catalogueKey": "x",\n  "strategy": { "key": "tycoon", "version": 1, "targetOverrides": { "20": 3 } },\n  "eventOrder": ["koth"]\n}\n';
    expect(rewriteCatalogueStrategy(compact, strategy))
      .toBe('{\n  "catalogueKey": "x",\n  "strategy": { "key": "tycoon", "version": 2, "targetOverrides": { "21": 3 } },\n  "eventOrder": ["koth"]\n}\n');
    expect(() => rewriteCatalogueStrategy('{"strategy":{"key":"tycoon","version":1,"targetOverrides":{}}}', strategy)).toThrow(/layout/);
  });

  it('writes nothing when any file is invalid', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'catalogue-upgrade-'));
    try {
      const good = `${JSON.stringify({ catalogueKey: 'good', strategy: { key: 'duo', version: 1, targetOverrides: {} } }, null, 2)}\n`;
      const bad = `${JSON.stringify({ catalogueKey: 'bad', strategy: { key: 'duo', version: 1, targetOverrides: { 99: 1 } } }, null, 2)}\n`;
      fs.writeFileSync(path.join(directory, 'good.json'), good);
      fs.writeFileSync(path.join(directory, 'bad.json'), bad);
      const results = upgradeCatalogueDirectory({ directory, registry });
      expect(results.map((r) => [r.file, r.outcome])).toEqual([['bad.json', 'invalid'], ['good.json', 'upgraded']]);
      expect(fs.readFileSync(path.join(directory, 'good.json'), 'utf8')).toBe(good);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('every repository Catalogue_Entry pins the latest version of its strategy (run `pnpm run automaton:catalogue-upgrade`)', () => {
    const outdated = upgradeCatalogueDirectory({ directory: CATALOGUE_DIRECTORY, registry, dryRun: true })
      .filter((r) => r.outcome !== 'current')
      .map((r) => r.file);
    expect(outdated).toEqual([]);
  });
});
