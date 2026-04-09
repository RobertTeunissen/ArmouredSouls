---
inclusion: manual
---

# Refactoring with GitNexus

## When to Use

- "Rename this function safely"
- "Extract this into a module"
- "Split this service"
- "Move this to a new file"
- Any task involving renaming, extracting, splitting, or restructuring code

## Workflow

```
1. mcp_gitnexus_impact({target: "X", direction: "upstream"})  → Map all dependents
2. mcp_gitnexus_query({query: "X"})                            → Find execution flows involving X
3. mcp_gitnexus_context({name: "X"})                           → See all incoming/outgoing refs
4. Plan update order: interfaces → implementations → callers → tests
```

> If the index is stale, run `npx gitnexus analyze` in the terminal first.

## Checklists

### Rename Symbol

```
- [ ] mcp_gitnexus_rename({symbol_name: "oldName", new_name: "newName", dry_run: true}) — preview all edits
- [ ] Review graph edits (high confidence) and text_search edits (review carefully)
- [ ] If satisfied: mcp_gitnexus_rename({..., dry_run: false}) — apply edits
- [ ] mcp_gitnexus_detect_changes() — verify only expected files changed
- [ ] Run tests for affected processes
```

### Extract Module

```
- [ ] mcp_gitnexus_context({name: target}) — see all incoming/outgoing refs
- [ ] mcp_gitnexus_impact({target, direction: "upstream"}) — find all external callers
- [ ] Define new module interface
- [ ] Extract code, update imports
- [ ] mcp_gitnexus_detect_changes() — verify affected scope
- [ ] Run tests for affected processes
```

### Split Function/Service

```
- [ ] mcp_gitnexus_context({name: target}) — understand all callees
- [ ] Group callees by responsibility
- [ ] mcp_gitnexus_impact({target, direction: "upstream"}) — map callers to update
- [ ] Create new functions/services
- [ ] Update callers
- [ ] mcp_gitnexus_detect_changes() — verify affected scope
- [ ] Run tests for affected processes
```

## Tools

mcp_gitnexus_rename — automated multi-file rename:

```
mcp_gitnexus_rename({symbol_name: "validateUser", new_name: "authenticateUser", dry_run: true, repo: "MyApp"})
→ 12 edits across 8 files
→ 10 graph edits (high confidence), 2 text_search edits (review)
```

mcp_gitnexus_impact — map all dependents first:

```
mcp_gitnexus_impact({target: "validateUser", direction: "upstream", repo: "MyApp"})
→ d=1: loginHandler, apiMiddleware, testUtils
→ Affected Processes: LoginFlow, TokenRefresh
```

mcp_gitnexus_detect_changes — verify your changes after refactoring:

```
mcp_gitnexus_detect_changes({scope: "all", repo: "MyApp"})
→ Changed: 8 files, 12 symbols
→ Affected processes: LoginFlow, TokenRefresh
→ Risk: MEDIUM
```

## Risk Rules

| Risk Factor | Mitigation |
|-------------|------------|
| Many callers (>5) | Use mcp_gitnexus_rename for automated updates |
| Cross-area refs | Use detect_changes after to verify scope |
| String/dynamic refs | mcp_gitnexus_query to find them |
| External/public API | Version and deprecate properly |
