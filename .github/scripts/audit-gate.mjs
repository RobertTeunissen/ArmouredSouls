#!/usr/bin/env node
/**
 * pnpm audit gate shared by the backend and frontend CI steps.
 *
 * Fails when a production dependency has a high or critical advisory that is
 * not listed in `.security-audit-allowlist.json`. Replaces the inline Node
 * one-liners in ci.yml, which read `audit.vulnerabilities` (npm v7+ shape)
 * while `pnpm audit --json` emits the npm v6 envelope, so the gate could never
 * fail. See docs/architecture/PRD_SECURITY.md, section 10 "Dependency Scanning".
 *
 * Fail-closed rules:
 * - Empty, unparseable or unrecognised audit output fails the gate.
 * - Parsed high/critical count must match the report's own metadata tally, so
 *   a future envelope change cannot silently turn the gate into a pass.
 * - A malformed allowlist fails the gate.
 *
 * Usage (from the repository root):
 *   node .github/scripts/audit-gate.mjs --cwd app/backend --label backend \
 *     --report app/backend/audit-report-backend.json \
 *     --full-report app/backend/audit-report-backend-full.json
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const BLOCKING_SEVERITIES = new Set(['high', 'critical']);
const GHSA_ID = /^GHSA(-[23456789cfghjmpqrvwx]{4}){3}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const REQUIRED_ALLOWLIST_FIELDS = ['id', 'package', 'justification', 'reviewDate', 'nextReviewDate'];

export class AuditGateError extends Error {}

/**
 * Parse raw `pnpm audit --json` stdout into a normalised advisory list.
 * Supports the npm v6 envelope (`advisories`, what pnpm emits today) and the
 * npm v7+ envelope (`vulnerabilities`) so a tooling change cannot bypass the gate.
 *
 * @param {string} raw
 * @returns {{ format: 'v6' | 'v7', advisories: Array<{ id: string, module: string, severity: string, title: string, url: string }>, tally: Record<string, number> }}
 */
export function parseAuditReport(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new AuditGateError('pnpm audit produced no output');
  }
  let report;
  try {
    report = JSON.parse(raw);
  } catch {
    throw new AuditGateError('pnpm audit output is not valid JSON');
  }
  if (report === null || typeof report !== 'object') {
    throw new AuditGateError('pnpm audit output is not a JSON object');
  }
  if (report.error) {
    const detail = typeof report.error === 'object' ? report.error.summary ?? report.error.code : report.error;
    throw new AuditGateError(`pnpm audit reported an error: ${detail ?? 'unknown'}`);
  }

  const tally = report.metadata?.vulnerabilities;
  if (!tally || typeof tally !== 'object') {
    throw new AuditGateError('pnpm audit output has no metadata.vulnerabilities tally');
  }

  if (report.advisories && typeof report.advisories === 'object') {
    const advisories = Object.values(report.advisories).map((advisory) => ({
      id: advisory.github_advisory_id ?? '',
      module: advisory.module_name ?? 'unknown',
      severity: advisory.severity ?? 'unknown',
      title: advisory.title ?? '',
      url: advisory.url ?? '',
    }));
    return { format: 'v6', advisories, tally };
  }

  if (report.vulnerabilities && typeof report.vulnerabilities === 'object') {
    // v7+: one entry per affected package; `via` holds advisory objects or the
    // names of packages it inherits from. Only advisory objects carry an ID.
    const seen = new Map();
    for (const [name, info] of Object.entries(report.vulnerabilities)) {
      for (const via of info?.via ?? []) {
        if (via && typeof via === 'object') {
          const id = String(via.url ?? '').split('/').pop() ?? '';
          const key = `${id}|${via.name ?? name}`;
          if (!seen.has(key)) {
            seen.set(key, {
              id,
              module: via.name ?? name,
              severity: via.severity ?? info.severity ?? 'unknown',
              title: via.title ?? '',
              url: via.url ?? '',
            });
          }
        }
      }
    }
    return { format: 'v7', advisories: [...seen.values()], tally, packages: report.vulnerabilities };
  }

  throw new AuditGateError('pnpm audit output has neither `advisories` nor `vulnerabilities`');
}

/**
 * Validate and normalise the allowlist file contents.
 *
 * @param {unknown} data
 * @returns {Array<{ id: string, package: string, justification: string, reviewDate: string, nextReviewDate: string }>}
 */
export function parseAllowlist(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.allowlist)) {
    throw new AuditGateError('allowlist must be an object with an `allowlist` array');
  }
  return data.allowlist.map((entry, index) => {
    for (const field of REQUIRED_ALLOWLIST_FIELDS) {
      if (typeof entry?.[field] !== 'string' || entry[field].trim() === '') {
        throw new AuditGateError(`allowlist entry ${index} is missing \`${field}\``);
      }
    }
    if (!GHSA_ID.test(entry.id)) {
      throw new AuditGateError(`allowlist entry ${index} has an invalid GHSA id: ${entry.id}`);
    }
    for (const field of ['reviewDate', 'nextReviewDate']) {
      if (!ISO_DATE.test(entry[field])) {
        throw new AuditGateError(`allowlist entry ${index} has an invalid ${field}: ${entry[field]}`);
      }
    }
    return entry;
  });
}

/**
 * Decide the gate outcome. Pure, so it can be unit tested without pnpm.
 *
 * @param {ReturnType<typeof parseAuditReport>} parsed
 * @param {ReturnType<typeof parseAllowlist>} allowlist
 * @param {{ today: string }} options ISO date used for review-date warnings
 */
export function evaluateAudit(parsed, allowlist, { today }) {
  const allowedIds = new Set(allowlist.map((entry) => entry.id));
  const blocking = parsed.advisories.filter((advisory) => BLOCKING_SEVERITIES.has(advisory.severity));

  // Cross-check the parser against the report's own tally. v6 counts one per
  // advisory entry; v7 counts one per affected package.
  const expected = Number(parsed.tally.high ?? 0) + Number(parsed.tally.critical ?? 0);
  const observed =
    parsed.format === 'v6'
      ? blocking.length
      : Object.values(parsed.packages ?? {}).filter((info) => BLOCKING_SEVERITIES.has(info?.severity)).length;
  if (observed < expected) {
    throw new AuditGateError(
      `parser found ${observed} high/critical entries but the report tallies ${expected}; refusing to pass`,
    );
  }

  const unallowed = blocking.filter((advisory) => !advisory.id || !allowedIds.has(advisory.id));
  const allowed = blocking.filter((advisory) => advisory.id && allowedIds.has(advisory.id));
  const presentIds = new Set(parsed.advisories.map((advisory) => advisory.id));
  const expiredEntries = allowlist.filter((entry) => entry.nextReviewDate < today);
  const unusedEntries = allowlist.filter((entry) => !presentIds.has(entry.id));

  return { passed: unallowed.length === 0, blocking, unallowed, allowed, expiredEntries, unusedEntries };
}

function runAudit(cwd, prodOnly) {
  const args = ['audit', '--json', ...(prodOnly ? ['--prod'] : [])];
  // pnpm exits 1 whenever advisories exist, so the exit code is not a failure
  // signal on its own; the parsed report decides. Spawn errors are fatal.
  const result = spawnSync('pnpm', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.error) {
    throw new AuditGateError(`could not run pnpm audit: ${result.error.message}`);
  }
  return result.stdout;
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) throw new AuditGateError(`unexpected argument: ${key}`);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) throw new AuditGateError(`missing value for ${key}`);
    options[key.slice(2)] = value;
    i += 1;
  }
  if (!options.cwd) throw new AuditGateError('--cwd is required');
  return options;
}

function describe(advisory) {
  return `${advisory.severity} ${advisory.module} ${advisory.id || '(no GHSA id)'} ${advisory.title}`.trim();
}

function main() {
  const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
  const options = parseArgs(process.argv.slice(2));
  const cwd = resolve(repoRoot, options.cwd);
  const label = options.label ?? options.cwd;
  const allowlistPath = resolve(repoRoot, options.allowlist ?? '.security-audit-allowlist.json');

  if (!existsSync(allowlistPath)) throw new AuditGateError(`allowlist not found: ${allowlistPath}`);
  const allowlist = parseAllowlist(JSON.parse(readFileSync(allowlistPath, 'utf8')));

  if (options['full-report']) {
    // Informational artifact covering dev dependencies too; not gated.
    writeFileSync(resolve(repoRoot, options['full-report']), runAudit(cwd, false));
  }

  const raw = runAudit(cwd, true);
  if (options.report) writeFileSync(resolve(repoRoot, options.report), raw);

  const parsed = parseAuditReport(raw);
  const today = new Date().toISOString().slice(0, 10);
  const outcome = evaluateAudit(parsed, allowlist, { today });

  console.log(`[${label}] production advisories: ${parsed.advisories.length} (format ${parsed.format})`);
  for (const advisory of parsed.advisories) console.log(`  - ${describe(advisory)}`);
  for (const advisory of outcome.allowed) console.log(`[${label}] allowlisted: ${describe(advisory)}`);
  for (const entry of outcome.expiredEntries) {
    console.log(`::warning title=Audit allowlist review overdue::${entry.id} (${entry.package}) was due for review on ${entry.nextReviewDate}`);
  }
  for (const entry of outcome.unusedEntries) {
    console.log(`[${label}] allowlist entry not present in this report: ${entry.id} (${entry.package})`);
  }

  if (!outcome.passed) {
    for (const advisory of outcome.unallowed) {
      console.log(`::error title=Unallowed ${advisory.severity} advisory (${label})::${describe(advisory)} ${advisory.url}`);
    }
    console.error(`[${label}] security audit failed: ${outcome.unallowed.length} high/critical advisories are not allowlisted`);
    process.exitCode = 1;
    return;
  }
  console.log(`[${label}] security audit passed: no unallowed high/critical production advisories`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`::error title=Security audit gate error::${message}`);
    console.error(`security audit gate error: ${message}`);
    process.exitCode = 1;
  }
}
