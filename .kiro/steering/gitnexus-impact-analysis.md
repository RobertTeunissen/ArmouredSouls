---
inclusion: manual
---

# Impact Analysis with GitNexus

## When to Use

- "Is it safe to change this function?"
- "What will break if I modify X?"
- "Show me the blast radius"
- "Who uses this code?"
- Before making non-trivial code changes
- Before committing — to understand what your changes affect

## Workflow

```
1. mcp_gitnexus_impact({target: "X", direction: "upstream"})  → What depends on this
2. mcp_gitnexus_detect_changes()                               → Map current git changes to affected flows
3. Assess risk and report to user
```

> If the index is stale, run `npx gitnexus analyze` in the terminal first.

## Checklist

```
- [ ] mcp_gitnexus_impact({target, direction: "upstream"}) to find dependents
- [ ] Review d=1 items first (these WILL BREAK)
- [ ] Check high-confidence (>0.8) dependencies
- [ ] mcp_gitnexus_detect_changes() for pre-commit check
- [ ] Assess risk level and report to user
```

## Understanding Output

| Depth | Risk Level | Meaning |
|-------|------------|---------|
| d=1 | WILL BREAK | Direct callers/importers |
| d=2 | LIKELY AFFECTED | Indirect dependencies |
| d=3 | MAY NEED TESTING | Transitive effects |

## Risk Assessment

| Affected | Risk |
|----------|------|
| <5 symbols, few processes | LOW |
| 5-15 symbols, 2-5 processes | MEDIUM |
| >15 symbols or many processes | HIGH |
| Critical path (auth, economy, combat) | CRITICAL |

## Tools

mcp_gitnexus_impact — primary tool for symbol blast radius:

```
mcp_gitnexus_impact({
  target: "validateUser",
  direction: "upstream",
  minConfidence: 0.8,
  maxDepth: 3,
  repo: "MyApp"
})

→ d=1 (WILL BREAK):
  - loginHandler (src/auth/login.ts:42) [CALLS, 100%]
  - apiMiddleware (src/api/middleware.ts:15) [CALLS, 100%]

→ d=2 (LIKELY AFFECTED):
  - authRouter (src/routes/auth.ts:22) [CALLS, 95%]
```

mcp_gitnexus_detect_changes — git-diff based impact analysis:

```
mcp_gitnexus_detect_changes({scope: "staged", repo: "MyApp"})

→ Changed: 5 symbols in 3 files
→ Affected: LoginFlow, TokenRefresh, APIMiddlewarePipeline
→ Risk: MEDIUM
```

mcp_gitnexus_api_impact — pre-change report for API routes:

```
mcp_gitnexus_api_impact({route: "/api/robots", repo: "MyApp"})

→ Consumers, response shape, middleware, risk level
```

## Example: "What breaks if I change combatSimulator?"

```
1. mcp_gitnexus_impact({target: "combatSimulator", direction: "upstream", repo: "ArmouredSouls"})
   → d=1: battleService, practiceArena (WILL BREAK)
   → d=2: adminBattleRoutes, matchService (LIKELY AFFECTED)

2. mcp_gitnexus_detect_changes({scope: "all", repo: "ArmouredSouls"})
   → Verify only expected files changed

3. Risk: 2 direct callers, multiple processes = MEDIUM
```
