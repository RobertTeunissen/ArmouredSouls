# Module Package Structure Template

This template defines the standard structure for all modules in the `modules/` directory.

## Directory Structure

```
modules/{module-name}/
├── package.json              # Module metadata and dependencies
├── tsconfig.json             # TypeScript configuration with project references
├── MODULE_CONTRACT.md        # Public API contract documentation
├── README.md                 # Module overview and quick start
├── src/
│   ├── index.ts              # Public API barrel export (ONLY entry point)
│   ├── services/             # Service implementations
│   │   ├── someService.ts
│   │   └── anotherService.ts
│   ├── middleware/            # Express middleware (api/auth modules only)
│   ├── errors/               # Domain-specific error classes
│   ├── types/                # Shared TypeScript types/interfaces
│   └── lib/                  # Internal utilities
└── tests/
    ├── someService.test.ts   # Unit tests
    └── integration/          # Integration tests (if applicable)
```

## `package.json`

```json
{
  "name": "@armoured-souls/{module-name}",
  "version": "1.0.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "test": "jest --config jest.config.js",
    "lint": "eslint src/",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@armoured-souls/database": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.8.0",
    "jest": "^30.0.0",
    "ts-jest": "^30.0.0",
    "@types/jest": "^30.0.0"
  }
}
```

Notes:
- `"private": true` — modules are not published to npm
- `"workspace:*"` — references sibling modules via npm workspaces
- Only list dependencies that the module actually uses
- The `database` module has no `@armoured-souls/*` dependencies (leaf module)

## `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "composite": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"],
  "references": [
    { "path": "../database" }
  ]
}
```

Notes:
- `"composite": true` — required for TypeScript project references
- `"declaration": true` — generates `.d.ts` files for consumers
- `"references"` — list only direct dependencies (not transitive)
- The `database` module has no `references` (leaf module)

## `src/index.ts` (Barrel Export)

```typescript
// Public API — this is the ONLY entry point for consumers.
// Do not import from internal paths like '@armoured-souls/auth/src/services/jwtService'.

// Services
export { someService } from './services/someService';
export { anotherService } from './services/anotherService';

// Types
export type { SomeInterface, AnotherType } from './types/someTypes';

// Errors
export { SomeError, SomeErrorCode } from './errors/someErrors';
```

Rules:
- Every public function, class, type, and interface must be re-exported from `index.ts`
- Consumers must only import from the package name (`@armoured-souls/auth`), never from internal paths
- Internal helpers that are not part of the public API should NOT be exported

## Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Module directory | kebab-case | `game-engine/` |
| Package name | `@armoured-souls/{module}` | `@armoured-souls/game-engine` |
| Service files | camelCase | `robotCreationService.ts` |
| Error files | camelCase | `battleErrors.ts` |
| Type files | camelCase | `battleTypes.ts` |
| Test files | `{source}.test.ts` | `robotCreationService.test.ts` |

## Testing

Each module has its own test suite:

```bash
# Run tests for a single module
cd modules/auth && npm test

# Run all module tests from root
npm test --workspaces
```

Test files live in `tests/` (not co-located with source) to keep `src/` clean for the barrel export pattern.

## Adding a New Module

1. Create the directory structure following this template
2. Add the module to the root `package.json` workspaces array
3. Run `npm install` from the root to link the workspace
4. Create `MODULE_CONTRACT.md` documenting the public API
5. Update `docs/guides/SERVICE_MODULE_MAPPING.md` with the new module's files
6. Add the module to the root `tsconfig.json` references
