# Patches

This directory holds local patches applied via pnpm's native patching
(`pnpm patch` / `pnpm patch-commit`). If a patch is needed, it will be
referenced in `package.json` under `pnpm.patchedDependencies`.

## Active patches

None. The previous `gitnexus+1.6.5.dev.patch` (removing `'use'` and
`'route'` from `EXPRESS_ROUTE_METHODS`) was merged upstream in gitnexus
1.6.7 and is no longer needed.

## How to create a new patch

```bash
cd app/backend
pnpm patch <package-name>
# Make your edits in the temporary directory pnpm opens
pnpm patch-commit <temporary-directory>
```

This adds a `pnpm.patchedDependencies` entry to `package.json` and stores
the patch file in this directory automatically.

## Conventions

- Keep patches minimal — only the change you intend.
- Document the rationale in this file.
- Review patches on every major version bump of the patched package.
