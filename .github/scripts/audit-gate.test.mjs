// Tests for audit-gate.mjs. Run with: node --test .github/scripts/audit-gate.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  AuditGateError,
  evaluateAudit,
  parseAllowlist,
  parseAuditReport,
} from './audit-gate.mjs';

// Real `pnpm audit --json --prod` output for the backend lockfile before the
// October 2026 dependency fixes (trimmed to the fields the gate reads).
const V6_FIXTURE = readFileSync(new URL('./fixtures/pnpm-audit-v6-backend-prod.json', import.meta.url), 'utf8');
const V6_BLOCKING_IDS = [
  'GHSA-qw65-cvwx-89v3',
  'GHSA-58mr-gqgx-xq4g',
  'GHSA-qhr7-859c-m2p7',
  'GHSA-6j4f-fj2g-mc7p',
  'GHSA-jqcg-44mw-7w3h',
  'GHSA-wq5f-xc86-pv6w',
];
const TODAY = '2026-10-07';

function entry(id, overrides = {}) {
  return {
    id,
    package: 'pkg',
    justification: 'reviewed',
    reviewDate: '2026-10-07',
    nextReviewDate: '2027-01-07',
    ...overrides,
  };
}

function gate(raw, entries = []) {
  return evaluateAudit(parseAuditReport(raw), parseAllowlist({ allowlist: entries }), { today: TODAY });
}

test('real v6 report with an empty allowlist fails on every high/critical advisory', () => {
  const outcome = gate(V6_FIXTURE);
  assert.equal(outcome.passed, false);
  assert.deepEqual(outcome.unallowed.map((a) => a.id).sort(), [...V6_BLOCKING_IDS].sort());
  assert.ok(outcome.unallowed.some((a) => a.module === 'proxy-addr' && a.severity === 'critical'));
});

test('real v6 report passes when every high/critical advisory is allowlisted', () => {
  const outcome = gate(V6_FIXTURE, V6_BLOCKING_IDS.map((id) => entry(id)));
  assert.equal(outcome.passed, true);
  assert.equal(outcome.allowed.length, V6_BLOCKING_IDS.length);
});

test('a partial allowlist still fails on the remaining advisories', () => {
  const outcome = gate(V6_FIXTURE, V6_BLOCKING_IDS.slice(1).map((id) => entry(id)));
  assert.equal(outcome.passed, false);
  assert.deepEqual(outcome.unallowed.map((a) => a.id), [V6_BLOCKING_IDS[0]]);
});

test('moderate and low advisories never block', () => {
  const raw = JSON.stringify({
    advisories: {
      1: { github_advisory_id: 'GHSA-hp3w-g68c-fv3c', module_name: 'sprintf-js', severity: 'moderate' },
      2: { github_advisory_id: 'GHSA-jggr-w7fw-pc2j', module_name: 'katex', severity: 'low' },
    },
    metadata: { vulnerabilities: { low: 1, moderate: 1, high: 0, critical: 0 } },
  });
  assert.equal(gate(raw).passed, true);
});

test('a clean report passes', () => {
  const raw = JSON.stringify({ actions: [], advisories: {}, muted: [], metadata: { vulnerabilities: { high: 0, critical: 0 } } });
  assert.equal(gate(raw).passed, true);
});

test('fails closed when the parser finds fewer blocking entries than the tally', () => {
  const report = JSON.parse(V6_FIXTURE);
  const [firstKey] = Object.keys(report.advisories).filter((k) => report.advisories[k].severity === 'high');
  delete report.advisories[firstKey];
  assert.throws(() => gate(JSON.stringify(report)), AuditGateError);
});

test('fails closed on empty, invalid or unrecognised output', () => {
  for (const raw of ['', '   ', 'not json', 'null', '[]']) {
    assert.throws(() => parseAuditReport(raw), AuditGateError, `input: ${JSON.stringify(raw)}`);
  }
  assert.throws(
    () => parseAuditReport(JSON.stringify({ metadata: { vulnerabilities: { high: 0, critical: 0 } } })),
    AuditGateError,
  );
  assert.throws(() => parseAuditReport(JSON.stringify({ advisories: {} })), AuditGateError);
});

test('fails closed when pnpm reports an error envelope', () => {
  const raw = JSON.stringify({ error: { code: 'ERR_PNPM_AUDIT_BAD_RESPONSE', summary: 'registry unavailable' } });
  assert.throws(() => parseAuditReport(raw), /registry unavailable/);
});

test('supports the npm v7+ envelope', () => {
  const raw = JSON.stringify({
    vulnerabilities: {
      'proxy-addr': {
        severity: 'critical',
        via: [{ name: 'proxy-addr', severity: 'critical', title: 'x', url: 'https://github.com/advisories/GHSA-jqcg-44mw-7w3h' }],
      },
      express: { severity: 'critical', via: ['proxy-addr'] },
    },
    metadata: { vulnerabilities: { high: 0, critical: 2 } },
  });
  const blocked = gate(raw);
  assert.equal(blocked.passed, false);
  assert.deepEqual(blocked.unallowed.map((a) => a.id), ['GHSA-jqcg-44mw-7w3h']);
  assert.equal(gate(raw, [entry('GHSA-jqcg-44mw-7w3h')]).passed, true);
});

test('rejects malformed allowlists', () => {
  assert.throws(() => parseAllowlist({}), AuditGateError);
  assert.throws(() => parseAllowlist({ allowlist: [entry('GHSA-hp3w-g68c-fv3c', { justification: '' })] }), /justification/);
  assert.throws(() => parseAllowlist({ allowlist: [entry('1234')] }), /invalid GHSA id/);
  assert.throws(() => parseAllowlist({ allowlist: [entry('GHSA-hp3w-g68c-fv3c', { nextReviewDate: 'soon' })] }), /nextReviewDate/);
});

test('the repository allowlist is valid', () => {
  const data = JSON.parse(readFileSync(new URL('../../.security-audit-allowlist.json', import.meta.url), 'utf8'));
  assert.doesNotThrow(() => parseAllowlist(data));
});

test('reports overdue and unused allowlist entries without failing', () => {
  const raw = JSON.stringify({ advisories: {}, metadata: { vulnerabilities: { high: 0, critical: 0 } } });
  const outcome = gate(raw, [entry('GHSA-hp3w-g68c-fv3c', { nextReviewDate: '2026-01-01' })]);
  assert.equal(outcome.passed, true);
  assert.equal(outcome.expiredEntries.length, 1);
  assert.equal(outcome.unusedEntries.length, 1);
});
