import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export type CurrencyMutationOperation = 'increment' | 'decrement' | 'set';

export interface DiscoveredDirectCurrencyMutation {
  file: string;
  operation: CurrencyMutationOperation;
  occurrence: number;
}

export interface DirectWriterCoverageResult {
  discovered: readonly DiscoveredDirectCurrencyMutation[];
  uncovered: readonly DiscoveredDirectCurrencyMutation[];
}

/**
 * These are the only direct balance assignments permitted after cutover. They
 * establish or clear state at a lifecycle boundary; they never earn or spend
 * current-season credits. The shared mutation service is the only other
 * permitted production assignment.
 */
export const OPENING_BALANCE_BOUNDARY_FILES = [
  'app/backend/src/utils/userGeneration.ts',
  'app/backend/src/services/common/resetService.ts',
  'app/backend/src/services/season/seasonPurgeService.ts',
] as const;

export const SHARED_CREDIT_SERVICE_FILE =
  'app/backend/src/services/financial/creditMutationService.ts';

const USER_WRITE_METHODS = new Set(['create', 'update', 'updateMany', 'upsert']);

type Resolution = CurrencyMutationOperation | null | 'unresolved';

function getPropertyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return undefined;
}

function getAccessName(expression: ts.Expression): string | undefined {
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  if (
    ts.isElementAccessExpression(expression)
    && expression.argumentExpression
    && ts.isStringLiteral(expression.argumentExpression)
  ) {
    return expression.argumentExpression.text;
  }
  return undefined;
}

function isPrismaUserWrite(node: ts.CallExpression): boolean {
  const method = getAccessName(node.expression);
  if (!method || !USER_WRITE_METHODS.has(method)) return false;

  const modelAccess = ts.isPropertyAccessExpression(node.expression)
    || ts.isElementAccessExpression(node.expression)
    ? node.expression.expression
    : undefined;
  return modelAccess !== undefined && getAccessName(modelAccess) === 'user';
}

function getCurrencyOperation(initializer: ts.Expression): CurrencyMutationOperation {
  if (!ts.isObjectLiteralExpression(initializer)) return 'set';

  for (const property of initializer.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const name = getPropertyName(property.name);
    if (name === 'increment') return 'increment';
    if (name === 'decrement') return 'decrement';
  }

  return 'set';
}

interface VariableBinding {
  initializer: ts.Expression;
  isDynamic: boolean;
}

function getRootAccessIdentifier(expression: ts.Expression): ts.Identifier | undefined {
  let current: ts.Expression = expression;
  while (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
    current = current.expression;
  }
  return ts.isIdentifier(current) ? current : undefined;
}

function collectVariableBindings(sourceFile: ts.SourceFile): ReadonlyMap<string, VariableBinding> {
  const bindings = new Map<string, VariableBinding>();
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.initializer
    ) {
      const declarationList = node.parent;
      const isConst = ts.isVariableDeclarationList(declarationList)
        && (declarationList.flags & ts.NodeFlags.Const) !== 0;
      bindings.set(node.name.text, { initializer: node.initializer, isDynamic: !isConst });
    }
    if (
      ts.isBinaryExpression(node)
      && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && (ts.isPropertyAccessExpression(node.left) || ts.isElementAccessExpression(node.left))
      && getAccessName(node.left) === 'currency'
    ) {
      const rootIdentifier = getRootAccessIdentifier(node.left);
      const binding = rootIdentifier ? bindings.get(rootIdentifier.text) : undefined;
      // A statically named non-currency assignment does not make a user update
      // alias a financial writer. Direct, nested, and bracketed writes to
      // currency are all conservative direct-write hits, so the rollout gate
      // cannot miss `args.data.currency` or `args.data['currency']`.
      if (binding) binding.isDynamic = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return bindings;
}

function resolveIdentifier(
  expression: ts.Expression,
  bindings: ReadonlyMap<string, VariableBinding>,
): ts.Expression | undefined {
  if (!ts.isIdentifier(expression)) return expression;
  const binding = bindings.get(expression.text);
  return binding && !binding.isDynamic ? binding.initializer : undefined;
}

function resolveCurrencyValue(
  expression: ts.Expression,
  bindings: ReadonlyMap<string, VariableBinding>,
  visitedIdentifiers: ReadonlySet<string> = new Set(),
): CurrencyMutationOperation {
  if (!ts.isIdentifier(expression)) return getCurrencyOperation(expression);
  if (visitedIdentifiers.has(expression.text)) return 'set';
  const initializer = resolveIdentifier(expression, bindings);
  return initializer
    ? resolveCurrencyValue(initializer, bindings, new Set([...visitedIdentifiers, expression.text]))
    : 'set';
}

function resolveDataExpression(
  expression: ts.Expression,
  bindings: ReadonlyMap<string, VariableBinding>,
  visitedIdentifiers: ReadonlySet<string> = new Set(),
): Resolution {
  if (ts.isIdentifier(expression)) {
    if (visitedIdentifiers.has(expression.text)) return 'unresolved';
    const initializer = resolveIdentifier(expression, bindings);
    return initializer
      ? resolveDataExpression(initializer, bindings, new Set([...visitedIdentifiers, expression.text]))
      : 'unresolved';
  }
  if (!ts.isObjectLiteralExpression(expression)) return 'unresolved';

  let resolution: Resolution = null;
  for (const property of expression.properties) {
    if (ts.isPropertyAssignment(property) && getPropertyName(property.name) === 'currency') {
      resolution = resolveCurrencyValue(property.initializer, bindings, visitedIdentifiers);
      continue;
    }
    if (ts.isSpreadAssignment(property)) {
      const spreadResolution = resolveDataExpression(property.expression, bindings, visitedIdentifiers);
      if (spreadResolution === 'unresolved') return 'unresolved';
      if (spreadResolution !== null) resolution = spreadResolution;
    }
  }
  return resolution;
}

function resolveArgsExpression(
  expression: ts.Expression,
  bindings: ReadonlyMap<string, VariableBinding>,
  visitedIdentifiers: ReadonlySet<string> = new Set(),
): Resolution {
  if (ts.isIdentifier(expression)) {
    if (visitedIdentifiers.has(expression.text)) return 'unresolved';
    const initializer = resolveIdentifier(expression, bindings);
    return initializer
      ? resolveArgsExpression(initializer, bindings, new Set([...visitedIdentifiers, expression.text]))
      : 'unresolved';
  }
  if (!ts.isObjectLiteralExpression(expression)) return 'unresolved';

  let resolution: Resolution = null;
  for (const property of expression.properties) {
    if (ts.isPropertyAssignment(property) && getPropertyName(property.name) === 'data') {
      const dataResolution = resolveDataExpression(property.initializer, bindings, visitedIdentifiers);
      if (dataResolution === 'unresolved') return 'unresolved';
      resolution = dataResolution;
      continue;
    }
    if (ts.isSpreadAssignment(property)) {
      const spreadResolution = resolveArgsExpression(property.expression, bindings, visitedIdentifiers);
      if (spreadResolution === 'unresolved') return 'unresolved';
      if (spreadResolution !== null) resolution = spreadResolution;
    }
  }
  return resolution;
}

function collectProductionSourceFiles(sourceRoot: string): string[] {
  const files: string[] = [];
  const visitDirectory = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === 'shared' || entry.name === 'generated' || entry.name === 'dist' || entry.name === '__tests__') {
        continue;
      }
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visitDirectory(absolutePath);
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        files.push(absolutePath);
      }
    }
  };

  visitDirectory(sourceRoot);
  return files.sort();
}

function findWorkspaceRoot(startDirectory: string = __dirname): string {
  let current = path.resolve(startDirectory);
  while (true) {
    if (fs.existsSync(path.join(current, '.git'))) return current;
    const parent = path.dirname(current);
    if (parent === current) {
      return process.cwd();
    }
    current = parent;
  }
}

function mutationKey(mutation: DiscoveredDirectCurrencyMutation): string {
  return `${mutation.file}:${mutation.operation}:${mutation.occurrence}`;
}

/**
 * Discover direct Prisma User.currency writes. Statically resolvable data and
 * args aliases (including object spreads) are followed; an unresolved alias
 * is reported as a conservative set operation so the rollout gate fails closed.
 */
export function discoverDirectCurrencyMutations(
  workspaceRoot: string = findWorkspaceRoot(),
): readonly DiscoveredDirectCurrencyMutation[] {
  const sourceRoot = path.join(workspaceRoot, 'app/backend/src');
  if (!fs.existsSync(sourceRoot)) return [];

  const discovered: DiscoveredDirectCurrencyMutation[] = [];
  const occurrences = new Map<string, number>();

  for (const filePath of collectProductionSourceFiles(sourceRoot)) {
    const sourceText = fs.readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(
      filePath,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const bindings = collectVariableBindings(sourceFile);

    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && isPrismaUserWrite(node) && node.arguments[0]) {
        const resolution = resolveArgsExpression(node.arguments[0], bindings);
        if (resolution !== null) {
          const operation: CurrencyMutationOperation = resolution === 'unresolved' ? 'set' : resolution;
          const relativeFile = path.relative(workspaceRoot, filePath).split(path.sep).join('/');
          const occurrenceKey = `${relativeFile}:${operation}`;
          const occurrence = (occurrences.get(occurrenceKey) ?? 0) + 1;
          occurrences.set(occurrenceKey, occurrence);
          discovered.push({ file: relativeFile, operation, occurrence });
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  return discovered.sort((left, right) => mutationKey(left).localeCompare(mutationKey(right)));
}

/**
 * Compare production assignments with the final Coverage_Manifest policy.
 * Current-economy direct writers are intentionally returned as uncovered until
 * their source operation uses Credit_Mutation_Service; this is a diagnostic,
 * not a historical rewrite or a mutation of the source code.
 */
export function checkDirectWriterCoverage(
  workspaceRoot: string = findWorkspaceRoot(),
): DirectWriterCoverageResult {
  const discovered = discoverDirectCurrencyMutations(workspaceRoot);
  const allowedFiles = new Set<string>([
    SHARED_CREDIT_SERVICE_FILE,
    ...OPENING_BALANCE_BOUNDARY_FILES,
  ]);

  return {
    discovered,
    uncovered: discovered.filter((mutation) => !allowedFiles.has(mutation.file)),
  };
}

export { findWorkspaceRoot, mutationKey };
