---
inclusion: manual
---

# GitNexus CLI Commands

This project uses a **pinned local install** of GitNexus (via `pnpm run gitnexus`).
Commands below use the local binary so the MCP server and the CLI agree on results.

## How to run gitnexus

Pick one. They're equivalent.

```bash
# Option A — pnpm script (run from app/backend/)
cd app/backend
pnpm run gitnexus -- analyze --embeddings
pnpm run gitnexus -- status
pnpm run gitnexus -- clean --force
```

```bash
# Option B — direct binary (run from anywhere in the repo)
node app/backend/node_modules/.bin/gitnexus analyze --embeddings
node app/backend/node_modules/.bin/gitnexus status
```

## Avoid

```bash
pnpm dlx gitnexus analyze   # ❌ downloads a fresh copy, ignores project-local version
gitnexus analyze             # ❌ depends on PATH; usually finds the wrong copy
```

## Commands

### analyze — Build or refresh the index

```bash
pnpm run gitnexus -- analyze
```

Run from `app/backend/`. Parses all source files, builds the knowledge graph,
writes to `.gitnexus/` at the repo root, and updates the GitNexus block in
`AGENTS.md` and `CLAUDE.md`.

| Flag | Effect |
|------|--------|
| `--force` | Force full re-index even if up to date |
| `--embeddings` | Generate embeddings for semantic search (default: off; we keep it on) |
| `--drop-embeddings` | Wipe existing embeddings on rebuild |
| `--skip-agents-md` | Don't touch `AGENTS.md` / `CLAUDE.md` |
| `--no-stats` | Omit volatile node/edge counts from `AGENTS.md` |
| `--skip-git` | Treat the cwd as the index root (skip parent git-root discovery) |

When to run: after pulling new code, after major refactors, or when any
GitNexus tool warns the index is stale.

This project's expected stats: ~18k nodes, ~29k edges, ~735 communities,
~300 processes, ~16.5k embeddings, on ~930 indexed files.

### status — Check index freshness

```bash
pnpm run gitnexus -- status
```

Shows last index time, last commit, and node/edge counts.

### clean — Delete the index

```bash
pnpm run gitnexus -- clean --force
```

Deletes `.gitnexus/` and unregisters the repo from `~/.gitnexus/registry.json`.

### list — Show all indexed repos

```bash
pnpm run gitnexus -- list
```

### doctor — Show runtime capabilities

```bash
pnpm run gitnexus -- doctor
```

Reports OS, Node version, ONNX runtime, vector index availability, and
embedding backend config. Useful for debugging "embeddings = 0" or vector
search problems.

### serve — Start local HTTP server for web UI

```bash
pnpm run gitnexus -- serve
```

Starts a local server (default port 4747) for the web visualization at
https://gitnexus.vercel.app.

> Important: `serve` holds an exclusive database lock. Stop it (Ctrl+C)
> before using GitNexus MCP tools in Kiro, otherwise queries will fail
> with a lock error.

### wiki — Generate documentation from the graph

```bash
pnpm run gitnexus -- wiki
```

Requires an LLM API key (see `--help`).

## What's in `.gitnexusignore`

Repo-level ignore patterns live in `.gitnexusignore` at the repo root. Current
exclusions (so the index stays focused on code, not docs):

- `docs/` — PRDs, design specs, balance changes
- `app/backend/cycle_logs/` — runtime artifacts
- `.kiro/` and `.claude/` — tooling metadata

Edit that file to change what's indexed. Re-run `analyze --force` after
changing it.

## After Indexing

1. In Kiro, reconnect the GitNexus MCP server from the MCP Servers panel if it
   was already connected (so it picks up the fresh index).
2. Verify with `mcp_gitnexus_list_repos` — the `indexedAt` timestamp should
   be recent.
3. For task-specific workflows, see the other `gitnexus-*` steering files.

## Troubleshooting

- **"Not inside a git repository"** — run from a directory inside the repo,
  or pass `--skip-git`.
- **Index stale after re-analyzing** — the MCP server cached the old graph.
  Reconnect it from the MCP Servers panel.
- **Database lock errors** — stop `gitnexus serve` first.
- **Routes look wrong / `responseKeys` bleeding across handlers** — confirm
  the patch is applied: `grep -A 8 'EXPRESS_ROUTE_METHODS = new Set'
  app/backend/node_modules/gitnexus/dist/core/ingestion/workers/parse-worker.js`
  should NOT show `'use'` or `'route'` in the set.
