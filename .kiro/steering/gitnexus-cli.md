---
inclusion: manual
---

# GitNexus CLI Commands

All commands work via `npx` — no global install required.

## Commands

### analyze — Build or refresh the index

```bash
npx gitnexus analyze
```

Run from the project root. Parses all source files, builds the knowledge graph, writes to `.gitnexus/`, and generates AGENTS.md context files.

| Flag | Effect |
|------|--------|
| `--force` | Force full re-index even if up to date |
| `--embeddings` | Enable embedding generation for semantic search (off by default) |

When to run: First time in a project, after major code changes, or when the index is stale.

### serve — Start local HTTP server for web UI

```bash
npx gitnexus serve
```

Starts a local server on port 4747 for the web visualization at `https://gitnexus.vercel.app`.

| Flag | Effect |
|------|--------|
| `-p, --port <port>` | Port number (default: 4747) |
| `--host <host>` | Bind address (default: 127.0.0.1) |

> Important: `serve` holds an exclusive database lock. Stop it (Ctrl+C) before using MCP tools in Kiro.

### status — Check index freshness

```bash
npx gitnexus status
```

Shows whether the current repo has a GitNexus index, when it was last updated, and symbol/relationship counts.

### clean — Delete the index

```bash
npx gitnexus clean
```

Deletes `.gitnexus/` and unregisters the repo from the global registry.

| Flag | Effect |
|------|--------|
| `--force` | Skip confirmation prompt |
| `--all` | Clean all indexed repos |

### wiki — Generate documentation from the graph

```bash
npx gitnexus wiki
```

Generates repository documentation using an LLM. Requires an API key.

| Flag | Effect |
|------|--------|
| `--force` | Force full regeneration |
| `--model <model>` | LLM model (default: minimax/minimax-m2.5) |
| `--base-url <url>` | LLM API base URL |
| `--api-key <key>` | LLM API key |
| `--concurrency <n>` | Parallel LLM calls (default: 3) |
| `--gist` | Publish wiki as a public GitHub Gist |

### list — Show all indexed repos

```bash
npx gitnexus list
```

Lists all repositories registered in `~/.gitnexus/registry.json`.

## After Indexing

1. Use `mcp_gitnexus_list_repos` to verify the index loaded
2. Use the other GitNexus steering files for your task

## Troubleshooting

- "Not inside a git repository": Run from a directory inside a git repo
- Index stale after re-analyzing: The MCP server may need reconnecting — check MCP Servers panel in Kiro
- Database lock errors: Stop `npx gitnexus serve` before using MCP tools
