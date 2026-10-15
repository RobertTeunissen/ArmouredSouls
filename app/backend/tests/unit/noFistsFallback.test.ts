/**
 * T6 scan — the weaponless fallback (a named bare-hands weapon) is gone everywhere
 * (rule 8, design §8).
 *
 * Robots without a main weapon never enter combat (they forfeit at battle time,
 * and the simulator throws ROBOT_NOT_BATTLE_READY as a backstop), so no code,
 * test, guide article or architecture doc may name or rely on that fallback.
 * Walks the trees like `checkDirectWriterCoverage` walks source files.
 *
 * Lower-case "unarmed" describing the state stays legitimate. The frontend
 * `assets/` folder is excluded (its image prompts describe "reinforced fists").
 */
import fs from 'fs';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../../../..');

/** Built from parts so this file never matches its own pattern. */
const FALLBACK_WORD = new RegExp(`\\b${'Fi' + 'sts'}(_Fallback)?\\b`);

const SCANNED_TREES = [
  'app/backend/src',
  'app/backend/tests',
  'app/shared',
  'app/frontend/src',
  'docs/architecture',
  'app/backend/src/content/guide',
];

/** Directory names never scanned: generated output, dependencies, the shared symlink. */
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', 'generated', 'coverage']);
const EXCLUDED_PATHS = ['app/frontend/src/assets'];
const TEXT_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.md', '.css', '.html', '.sql']);

function collectTextFiles(relativeRoot: string): string[] {
  const files: string[] = [];
  const visit = (absoluteDirectory: string): void => {
    for (const entry of fs.readdirSync(absoluteDirectory, { withFileTypes: true })) {
      const absolutePath = path.join(absoluteDirectory, entry.name);
      const relativePath = path.relative(REPO_ROOT, absolutePath).split(path.sep).join('/');
      // Symlinks are skipped: app/backend/src/shared points at app/shared, scanned on its own.
      if (entry.isSymbolicLink() || SKIPPED_DIRECTORIES.has(entry.name)) continue;
      if (EXCLUDED_PATHS.some((excluded) => relativePath === excluded || relativePath.startsWith(`${excluded}/`))) continue;
      if (entry.isDirectory()) {
        visit(absolutePath);
      } else if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name))) {
        files.push(relativePath);
      }
    }
  };
  visit(path.join(REPO_ROOT, relativeRoot));
  return files;
}

describe('no weaponless fallback remains', () => {
  it.each(SCANNED_TREES)('%s does not name it', (tree) => {
    const files = collectTextFiles(tree);
    expect(files.length).toBeGreaterThan(0);
    const offenders: string[] = [];
    for (const file of files) {
      const lines = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8').split('\n');
      lines.forEach((line, index) => {
        if (FALLBACK_WORD.test(line)) offenders.push(`${file}:${index + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it("the 'Unarmed' weapon summary literal is gone from combatFormulas.ts", () => {
    const source = fs.readFileSync(
      path.join(REPO_ROOT, 'app/backend/src/services/battle/combat-simulator/combatFormulas.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/['"`]Unarmed['"`]/);
  });
});
