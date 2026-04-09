---
inclusion: manual
---

# GitNexus Guide

Quick reference for all GitNexus MCP tools, resources, and the knowledge graph schema.

## Always Start Here

For any task involving code understanding, debugging, impact analysis, or refactoring:

1. Run `mcp_gitnexus_list_repos` to discover indexed repos
2. Match your task to a steering file below and include it via `#`
3. Follow the workflow and checklist in that file

> If the index is stale, run `npx gitnexus analyze` in the terminal first.
> Stop `npx gitnexus serve` before using MCP tools — they share a database lock.

## Steering Files

| Task | Steering file |
|------|---------------|
| Understand architecture / "How does X work?" | `gitnexus-exploring` |
| Blast radius / "What breaks if I change X?" | `gitnexus-impact-analysis` |
| Trace bugs / "Why is X failing?" | `gitnexus-debugging` |
| Rename / extract / split / refactor | `gitnexus-refactoring` |
| Tools, resources, schema reference | `gitnexus-guide` (this file) |
| Index, status, clean, wiki CLI commands | `gitnexus-cli` |

## Tools Reference

| Tool | What it gives you |
|------|-------------------|
| `mcp_gitnexus_query` | Process-grouped code intelligence — execution flows related to a concept |
| `mcp_gitnexus_context` | 360-degree symbol view — categorized refs, processes it participates in |
| `mcp_gitnexus_impact` | Symbol blast radius — what breaks at depth 1/2/3 with confidence |
| `mcp_gitnexus_detect_changes` | Git-diff impact — what do your current changes affect |
| `mcp_gitnexus_rename` | Multi-file coordinated rename with confidence-tagged edits |
| `mcp_gitnexus_cypher` | Raw graph queries |
| `mcp_gitnexus_list_repos` | Discover indexed repos |
| `mcp_gitnexus_route_map` | API route mappings with handlers and consumers |
| `mcp_gitnexus_shape_check` | API response shape validation against consumers |
| `mcp_gitnexus_api_impact` | Pre-change impact report for API route handlers |
| `mcp_gitnexus_tool_map` | MCP/RPC tool definitions and handlers |

## Graph Schema

Nodes: File, Folder, Function, Class, Interface, Method, CodeElement, Community, Process, Route, Tool
Edges (via CodeRelation.type): CALLS, IMPORTS, EXTENDS, IMPLEMENTS, DEFINES, CONTAINS, HAS_METHOD, HAS_PROPERTY, ACCESSES, OVERRIDES, MEMBER_OF, STEP_IN_PROCESS, HANDLES_ROUTE, FETCHES, HANDLES_TOOL, ENTRY_POINT_OF

```cypher
MATCH (caller)-[:CodeRelation {type: 'CALLS'}]->(f:Function {name: "myFunc"})
RETURN caller.name, caller.filePath
```
