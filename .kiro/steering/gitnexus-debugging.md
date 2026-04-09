---
inclusion: manual
---

# Debugging with GitNexus

## When to Use

- "Why is this function failing?"
- "Trace where this error comes from"
- "Who calls this method?"
- "This endpoint returns 500"
- Investigating bugs, errors, or unexpected behavior

## Workflow

```
1. mcp_gitnexus_query({query: "<error or symptom>"})         → Find related execution flows
2. mcp_gitnexus_context({name: "<suspect>"})                  → See callers/callees/processes
3. mcp_gitnexus_cypher({query: "MATCH path..."})              → Custom traces if needed
4. mcp_gitnexus_detect_changes({scope: "compare", base_ref: "main"}) → For regressions
```

> If the index is stale, run `npx gitnexus analyze` in the terminal first.

## Checklist

```
- [ ] Understand the symptom (error message, unexpected behavior)
- [ ] mcp_gitnexus_query for error text or related code
- [ ] Identify the suspect function from returned processes
- [ ] mcp_gitnexus_context to see callers and callees
- [ ] mcp_gitnexus_cypher for custom call chain traces if needed
- [ ] Read source files to confirm root cause
```

## Debugging Patterns

| Symptom | GitNexus Approach |
|---------|-------------------|
| Error message | `mcp_gitnexus_query` for error text → `context` on throw sites |
| Wrong return value | `context` on the function → trace callees for data flow |
| Intermittent failure | `context` → look for external calls, async deps |
| Performance issue | `context` → find symbols with many callers (hot paths) |
| Recent regression | `mcp_gitnexus_detect_changes` to see what changes affect |

## Tools

mcp_gitnexus_query — find code related to error:

```
mcp_gitnexus_query({query: "payment validation error", repo: "MyApp"})
→ Processes: CheckoutFlow, ErrorHandling
→ Symbols: validatePayment, handlePaymentError, PaymentException
```

mcp_gitnexus_context — full context for a suspect:

```
mcp_gitnexus_context({name: "validatePayment", repo: "MyApp"})
→ Incoming calls: processCheckout, webhookHandler
→ Outgoing calls: verifyCard, fetchRates (external API!)
→ Processes: CheckoutFlow (step 3/7)
```

mcp_gitnexus_cypher — custom call chain traces:

```cypher
MATCH path = (a)-[:CodeRelation {type: 'CALLS'}*1..2]->(b:Function {name: "validatePayment"})
RETURN [n IN nodes(path) | n.name] AS chain
```

## Example: "Battle endpoint returns 500 intermittently"

```
1. mcp_gitnexus_query({query: "battle error handling", repo: "ArmouredSouls"})
   → Processes: BattleExecution, ErrorHandling
   → Symbols: executeBattle, handleBattleError

2. mcp_gitnexus_context({name: "executeBattle", repo: "ArmouredSouls"})
   → Outgoing calls: combatSimulator, saveBattleResult

3. Root cause: identify the failing dependency in the call chain
```
