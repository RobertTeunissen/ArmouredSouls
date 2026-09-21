import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const steeringDir = join(repoRoot, '.kiro', 'steering');
const manifestPath = join(steeringDir, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const files = readdirSync(steeringDir).filter((file) => file.endsWith('.md')).sort();
const errors = [];
const warnings = [];
const records = [];

function normalizePath(value) {
  return value.replaceAll('\\', '/');
}

function unquote(value) {
  return value.replace(/^['"]|['"]$/g, '');
}

function parseFrontmatter(text, file) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    errors.push(`${file}: missing YAML front matter`);
    return {};
  }

  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^(inclusion|fileMatchPattern):\s*(.+)$/);
    if (field) fields[field[1]] = field[2].trim();
  }
  return fields;
}

function parsePatterns(rawPattern) {
  if (!rawPattern) return [];
  return unquote(rawPattern)
    .split(',')
    .map((pattern) => normalizePath(pattern.trim()))
    .filter(Boolean);
}

function matchSegment(pattern, value, patternIndex = 0, valueIndex = 0, memo = new Map()) {
  const key = `${patternIndex}:${valueIndex}`;
  if (memo.has(key)) return memo.get(key);

  if (patternIndex === pattern.length) {
    const result = valueIndex === value.length;
    memo.set(key, result);
    return result;
  }

  const token = pattern[patternIndex];
  let result;
  if (token === '*') {
    result = matchSegment(pattern, value, patternIndex + 1, valueIndex, memo)
      || (valueIndex < value.length && matchSegment(pattern, value, patternIndex, valueIndex + 1, memo));
  } else if (token === '?') {
    result = valueIndex < value.length
      && matchSegment(pattern, value, patternIndex + 1, valueIndex + 1, memo);
  } else {
    result = valueIndex < value.length
      && token === value[valueIndex]
      && matchSegment(pattern, value, patternIndex + 1, valueIndex + 1, memo);
  }

  memo.set(key, result);
  return result;
}

function matchesPattern(filePath, pattern) {
  const pathSegments = normalizePath(filePath).split('/').filter(Boolean);
  const patternSegments = normalizePath(pattern).split('/').filter(Boolean);
  const memo = new Map();

  function matchPath(pathIndex, patternIndex) {
    const key = `${pathIndex}:${patternIndex}`;
    if (memo.has(key)) return memo.get(key);

    if (patternIndex === patternSegments.length) {
      const result = pathIndex === pathSegments.length;
      memo.set(key, result);
      return result;
    }

    const segment = patternSegments[patternIndex];
    let result;
    if (segment === '**') {
      result = matchPath(pathIndex, patternIndex + 1)
        || (pathIndex < pathSegments.length && matchPath(pathIndex + 1, patternIndex));
    } else {
      result = pathIndex < pathSegments.length
        && matchSegment(segment, pathSegments[pathIndex])
        && matchPath(pathIndex + 1, patternIndex + 1);
    }

    memo.set(key, result);
    return result;
  }

  return matchPath(0, 0);
}

function validateRepresentativePath(rawPath, name) {
  if (typeof rawPath !== 'string' || rawPath.length === 0) {
    errors.push(`representative ${name}: path must be a non-empty repository-relative string`);
    return null;
  }

  const path = normalizePath(rawPath);
  if (path.startsWith('/') || path.split('/').includes('..')) {
    errors.push(`representative ${name}: path must stay inside the repository`);
    return null;
  }
  return path;
}

for (const file of files) {
  const path = join(steeringDir, file);
  const text = readFileSync(path, 'utf8');
  const relativePath = normalizePath(relative(repoRoot, path));
  const fields = parseFrontmatter(text, relativePath);
  const inclusion = fields.inclusion ? unquote(fields.inclusion) : undefined;
  const lineCount = (text.match(/\n/g) ?? []).length + (text.endsWith('\n') ? 0 : 1);
  const byteCount = Buffer.byteLength(text, 'utf8');
  const patterns = inclusion === 'fileMatch' ? parsePatterns(fields.fileMatchPattern) : [];

  if (!['always', 'fileMatch', 'manual'].includes(inclusion)) {
    errors.push(`${relativePath}: inclusion must be always, fileMatch, or manual`);
    continue;
  }
  if (inclusion === 'fileMatch' && patterns.length === 0) {
    errors.push(`${relativePath}: fileMatch requires fileMatchPattern`);
  }

  const lineLimit = manifest.maxLines[inclusion];
  const byteLimit = manifest.maxBytes[inclusion];
  if (lineCount > lineLimit) {
    errors.push(`${relativePath}: ${lineCount} lines exceeds ${inclusion} limit ${lineLimit}`);
  }
  if (byteCount > byteLimit) {
    errors.push(`${relativePath}: ${byteCount} bytes exceeds ${inclusion} limit ${byteLimit}`);
  }

  const manualBudget = inclusion === 'manual' ? manifest.manualBudgets?.[relativePath] : undefined;
  if (manualBudget) {
    if (typeof manualBudget.maxLines === 'number' && lineCount > manualBudget.maxLines) {
      errors.push(`${relativePath}: ${lineCount} lines exceeds manual file limit ${manualBudget.maxLines}`);
    }
    if (typeof manualBudget.maxBytes === 'number' && byteCount > manualBudget.maxBytes) {
      errors.push(`${relativePath}: ${byteCount} bytes exceeds manual file limit ${manualBudget.maxBytes}`);
    }
  }

  records.push({ relativePath, inclusion, lineCount, byteCount, patterns });
}

const manualBudgets = manifest.manualBudgets ?? {};
for (const [relativePath, budget] of Object.entries(manualBudgets)) {
  const record = records.find((candidate) => candidate.relativePath === relativePath);
  if (!record) {
    errors.push(`manual budget references missing steering file: ${relativePath}`);
    continue;
  }
  if (record.inclusion !== 'manual') {
    errors.push(`manual budget references non-manual file: ${relativePath}`);
  }
  for (const dimension of ['maxLines', 'maxBytes']) {
    if (budget[dimension] !== undefined
      && (!Number.isInteger(budget[dimension]) || budget[dimension] <= 0)) {
      errors.push(`manual budget ${relativePath}.${dimension} must be a positive integer`);
    }
  }
}

const modeBudgets = manifest.modeBudgets ?? {};
for (const [mode, budget] of Object.entries(modeBudgets)) {
  const modeRecords = records.filter((record) => record.inclusion === mode);
  const aggregateLines = modeRecords.reduce((total, record) => total + record.lineCount, 0);
  const aggregateBytes = modeRecords.reduce((total, record) => total + record.byteCount, 0);
  if (typeof budget.maxAggregateLines === 'number' && aggregateLines > budget.maxAggregateLines) {
    errors.push(`${mode} steering totals ${aggregateLines} lines; limit is ${budget.maxAggregateLines}`);
  }
  if (typeof budget.maxAggregateBytes === 'number' && aggregateBytes > budget.maxAggregateBytes) {
    errors.push(`${mode} steering totals ${aggregateBytes} bytes; limit is ${budget.maxAggregateBytes}`);
  }
}

const alwaysLines = records
  .filter((record) => record.inclusion === 'always')
  .reduce((total, record) => total + record.lineCount, 0);
if (alwaysLines > manifest.maxAlwaysLines) {
  errors.push(`always-loaded steering totals ${alwaysLines} lines; limit is ${manifest.maxAlwaysLines}`);
}

function reportRepresentativeLoad(representative) {
  const name = representative?.name ?? '<unnamed>';
  const path = validateRepresentativePath(representative?.path, name);
  if (!path) return;

  if (!existsSync(join(repoRoot, path))) {
    warnings.push(`representative ${name}: ${path} does not exist`);
  }

  const matched = records
    .filter((record) => record.inclusion === 'always'
      || (record.inclusion === 'fileMatch' && record.patterns.some((pattern) => matchesPattern(path, pattern))))
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  const aggregateLines = matched.reduce((total, record) => total + record.lineCount, 0);
  const aggregateBytes = matched.reduce((total, record) => total + record.byteCount, 0);
  const budgets = manifest.overlapBudgets ?? {};

  if (typeof budgets.maxMatchedFiles === 'number' && matched.length > budgets.maxMatchedFiles) {
    errors.push(`overlap budget exceeded for ${name}: ${matched.length} files; limit is ${budgets.maxMatchedFiles}`);
  }
  if (typeof budgets.maxAggregateLines === 'number' && aggregateLines > budgets.maxAggregateLines) {
    errors.push(`overlap budget exceeded for ${name}: ${aggregateLines} lines; limit is ${budgets.maxAggregateLines}`);
  }
  if (typeof budgets.maxAggregateBytes === 'number' && aggregateBytes > budgets.maxAggregateBytes) {
    errors.push(`overlap budget exceeded for ${name}: ${aggregateBytes} bytes; limit is ${budgets.maxAggregateBytes}`);
  }

  const names = matched.map((record) => record.relativePath).join(', ') || '(none)';
  console.log(`[load] ${name} ${path}: ${matched.length} files, ${aggregateLines} lines, ${aggregateBytes} bytes -> ${names}`);
}

for (const representative of manifest.representativePaths ?? []) {
  reportRepresentativeLoad(representative);
}

for (const warning of warnings) console.warn(`Warning: ${warning}`);

const largest = [...records]
  .sort((left, right) => right.byteCount - left.byteCount)
  .slice(0, 5)
  .map((record) => `${record.relativePath}=${record.byteCount}B`)
  .join(', ');

if (errors.length > 0) {
  console.error('Steering validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Steering validation passed: ${records.length} files; always-loaded=${alwaysLines} lines; largest=${largest}`);
}
