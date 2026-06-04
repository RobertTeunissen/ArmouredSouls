import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', '*.config.js', '*.config.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // New rules added in @eslint/js v10 — downgrade to warn so existing code
    // doesn't block CI. Address findings incrementally.
    rules: {
      'no-useless-assignment': 'warn',
      'preserve-caught-error': 'warn',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2022,
        ...globals.node,
      },
    },
    rules: {
      // Use only the classic hooks rules — the v7 `recommended` preset now
      // bundles React Compiler lint rules which require the compiler to be
      // enabled. We'll adopt those when/if we add the compiler.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      'no-console': 'off',
    },
  },
  {
    // Forbid console.* in production source — route through `utils/logger.ts`
    // so we have a single integration point for browser monitoring (Sentry,
    // OTel, etc.) and consistent log prefixes for grepping.
    // The logger module itself uses `console.*` and is exempted via the
    // `ignores` list below.
    files: ['src/**/*.{ts,tsx}'],
    ignores: [
      'src/__tests__/**',
      'src/**/__tests__/**',
      'src/**/*.test.{ts,tsx}',
      'src/**/*.spec.{ts,tsx}',
      'src/test-utils.tsx',
      'src/setupTests.ts',
      'src/utils/logger.ts',
    ],
    rules: {
      'no-console': 'error',
    },
  },
  {
    // The raw axios instance lives in `utils/apiClient.ts` but is only an
    // implementation detail of the typed `utils/api.ts` wrapper. Production
    // code should never reach for it directly — that bypasses the typed
    // error contract, response subscribers, and `data` unwrapping.
    //
    // Tests still import `apiClient` to mock the underlying axios calls
    // (the `api` wrapper delegates through it), so we exempt them via the
    // `ignores` list below.
    files: ['src/**/*.{ts,tsx}'],
    ignores: [
      'src/utils/api.ts',
      'src/__tests__/**',
      'src/**/__tests__/**',
      'src/**/*.test.{ts,tsx}',
      'src/**/*.spec.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          {
            name: '../utils/apiClient',
            message: 'Use the typed `api` wrapper from utils/api.ts instead of the raw axios instance.',
          },
          {
            name: '../../utils/apiClient',
            message: 'Use the typed `api` wrapper from utils/api.ts instead of the raw axios instance.',
          },
          {
            name: '../../../utils/apiClient',
            message: 'Use the typed `api` wrapper from utils/api.ts instead of the raw axios instance.',
          },
        ],
        patterns: [
          {
            group: ['**/utils/apiClient'],
            message: 'Use the typed `api` wrapper from utils/api.ts instead of the raw axios instance.',
          },
        ],
      }],
    },
  },
);
