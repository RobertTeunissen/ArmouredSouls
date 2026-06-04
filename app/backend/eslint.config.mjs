import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import security from 'eslint-plugin-security';
import requireValidateRequest from './eslint-rules/require-validate-request.js';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', '*.js'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Rules added in @eslint/js v10 — promoted to error after fixing all findings.
    rules: {
      'no-useless-assignment': 'error',
      'preserve-caught-error': 'error',
    },
  },
  {
    files: ['**/*.ts'],
    plugins: {
      security,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2022,
        ...globals.jest,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      'no-console': 'off',

      // Security rules — flag common vulnerability patterns (Req 8.5)
      'security/detect-eval-with-expression': 'error',
      'security/detect-non-literal-require': 'warn',
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-unsafe-regex': 'warn',
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'warn',
      'security/detect-new-buffer': 'error',
      'security/detect-pseudoRandomBytes': 'warn',
    },
  },
  {
    // Forbid console.* in services and middleware — use the structured logger
    // (`src/config/logger.ts`) instead so messages flow through Winston
    // transports (file + cycle log + production JSON formatting).
    // CLI scripts (`src/scripts/`) and the env loader (`src/config/env.ts`)
    // can keep using console because they run before the logger is wired or
    // are intentionally human-readable terminal output.
    files: ['src/services/**/*.ts', 'src/middleware/**/*.ts', 'src/routes/**/*.ts'],
    rules: {
      'no-console': 'error',
    },
  },
  {
    files: ['src/routes/**/*.ts'],
    plugins: {
      'custom-routes': {
        rules: {
          'require-validate-request': requireValidateRequest,
        },
      },
    },
    rules: {
      'custom-routes/require-validate-request': 'error',
    },
  },
);
