# Patches

Local `patch-package` patches applied to `app/backend/node_modules/` after
`npm install`. Wired up through the `postinstall` script in `package.json`.

## Active patches

### `gitnexus+1.6.5.patch`

Removes `'use'` and `'route'` from `EXPRESS_ROUTE_METHODS` in
`gitnexus/dist/core/ingestion/workers/parse-worker.js`.

**Why**: GitNexus's tree-sitter capture for Express routes treats every
`app.use('/path', middleware)` and `app.route('/path')` call as a leaf
route. In `app/backend/src/index.ts` that produced 27 phantom routes
(rate-limit mounts, sub-router mounts, the `/uploads` static mount), and
`responseKeys` from the one real handler in the file (`/api/health`) bled
across all of them — making `shape_check` and `api_impact` give wrong
answers.

**Effect**: total indexed routes dropped from 164 → 135, and
`app/backend/src/index.ts` correctly contributes 1 route instead of 27.

**Caveat**: the `responseKeys` extractor still scans the whole file content
rather than per-handler scope, so `/api/health` ends up with keys from the
rate-limiter `.json()` calls in the same file. Acceptable trade-off for now;
a cleaner fix lives upstream.

## Reapply manually

If you ever delete `node_modules/gitnexus/` without re-running `npm install`:

```bash
cd app/backend
npx patch-package
```

## Conventions

- Keep patches minimal — only the change you intend.
- After running `npx patch-package <pkg>`, review the generated diff and
  delete any unrelated noise (e.g., build-tool path changes from
  `tree-sitter-*` native binding rebuilds).
- Document the rationale in this file.
