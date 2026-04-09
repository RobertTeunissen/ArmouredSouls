---
inclusion: manual
---

# Exploring Codebases with GitNexus

## When to Use

- "How does authentication work?"
- "What's the project structure?"
- "Show me the main components"
- "Where is the database logic?"
- Understanding code you haven't seen before

## Workflow

```
1. mcp_gitnexus_list_repos                                    → Discover indexed repos
2. mcp_gitnexus_query({query: "<concept>"})                    → Find related execution flows
3. mcp_gitnexus_context({name: "<symbol>"})                    → Deep dive on specific symbol
4. mcp_gitnexus_cypher({query: "MATCH ..."})                   → Custom graph queries
```

> If the index is stale, run `npx gitnexus analyze` in the terminal first.

## Checklist

```
- [ ] mcp_gitnexus_list_repos to verify index is loaded
- [ ] mcp_gitnexus_query for the concept you want to understand
- [ ] Review returned processes (execution flows)
- [ ] mcp_gitnexus_context on key symbols for callers/callees
- [ ] Read source files for implementation details
```

## Tools

mcp_gitnexus_query — find execution flows related to a concept:

```
mcp_gitnexus_query({query: "payment processing", repo: "MyApp"})
→ Processes: CheckoutFlow, RefundFlow, WebhookHandler
→ Symbols grouped by flow with file locations
```

mcp_gitnexus_context — 360-degree view of a symbol:

```
mcp_gitnexus_context({name: "validateUser", repo: "MyApp"})
→ Incoming calls: loginHandler, apiMiddleware
→ Outgoing calls: checkToken, getUserById
→ Processes: LoginFlow (step 2/5), TokenRefresh (step 1/3)
```

mcp_gitnexus_route_map — API route overview:

```
mcp_gitnexus_route_map({repo: "MyApp"})
→ All routes with handlers, middleware, and frontend consumers
```

## Example: "How does battle simulation work?"

```
1. mcp_gitnexus_query({query: "battle simulation combat", repo: "ArmouredSouls"})
   → Processes: CombatFlow, DamageCalculation
   → Symbols: combatSimulator, calculateDamage, executeTurn

2. mcp_gitnexus_context({name: "combatSimulator", repo: "ArmouredSouls"})
   → Incoming: battleService, practiceArena
   → Outgoing: calculateDamage, applyWeaponEffects, resolveRound

3. Read source files for implementation details
```
