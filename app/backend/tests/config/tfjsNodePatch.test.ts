import { readFileSync } from 'node:fs';
import path from 'node:path';

const backendRoot = path.resolve(__dirname, '../..');
const packageJsonPath = path.join(backendRoot, 'package.json');
const lockfilePath = path.join(backendRoot, 'pnpm-lock.yaml');
const patchPath = path.join(
  backendRoot,
  'patches',
  '@tensorflow__tfjs-node@4.22.0.patch',
);

interface BackendPackageJson {
  pnpm?: {
    patchedDependencies?: Record<string, string>;
  };
}

describe('tfjs-node Node 24 compatibility patch', () => {
  it('should apply the upstream Node 24 utility replacement through pnpm', () => {
    const packageJson = JSON.parse(
      readFileSync(packageJsonPath, 'utf8'),
    ) as BackendPackageJson;
    const patch = readFileSync(patchPath, 'utf8');
    const lockfile = readFileSync(lockfilePath, 'utf8');

    const addedLines = patch
      .split('\n')
      .filter((line) => line.startsWith('+') && !line.startsWith('+++'));

    expect(packageJson.pnpm?.patchedDependencies).toEqual(expect.objectContaining({
      '@tensorflow/tfjs-node@4.22.0': 'patches/@tensorflow__tfjs-node@4.22.0.patch',
    }));
    expect(lockfile).toContain('path: patches/@tensorflow__tfjs-node@4.22.0.patch');
    expect(addedLines).not.toEqual(expect.arrayContaining([
      expect.stringContaining('isNullOrUndefined'),
    ]));
    expect(patch).toContain('tensorsOrDtype === null || tensorsOrDtype === undefined');
  });
});
