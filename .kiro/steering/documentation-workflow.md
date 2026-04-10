---
inclusion: fileMatch
fileMatchPattern: "docs/**,**/README.md,**/CONTRIBUTING.md"
---

# Documentation Workflow

## When to Update Documentation

### Always Update When:
1. **Adding new features** - Create or update relevant PRD documents
2. **Changing game mechanics** - Update docs/game-systems/ or docs/architecture/ specifications
3. **Modifying UI/UX** - Update docs/prd_pages/ and design_ux/ files
4. **Changing database schema** - Update DATABASE_SCHEMA.md
5. **Adding API endpoints** - Update API documentation
6. **Fixing bugs that reveal design issues** - Document in implementation_notes/

### Documentation File Reference

Use these file patterns when working on specific areas:

#### Core Systems
- Combat mechanics → `docs/architecture/COMBAT_FORMULAS.md`
- Economy → `docs/game-systems/PRD_ECONOMY_SYSTEM.md`
- Leagues → `docs/game-systems/PRD_LEAGUE_SYSTEM.md`
- Cycles → `docs/game-systems/PRD_CYCLE_SYSTEM.md`
- Fame/Prestige → `docs/game-systems/PRD_PRESTIGE_AND_FAME.md`
- Matchmaking → `docs/game-systems/PRD_MATCHMAKING.md`

#### Page Features
- Dashboard → `docs/prd_pages/PRD_DASHBOARD_PAGE.md`
- Robot management → `docs/prd_pages/PRD_ROBOTS_LIST_PAGE.md`, `PRD_ROBOT_DETAIL_PAGE.md`
- Facilities → `docs/prd_pages/PRD_FACILITIES_PAGE.md`
- Battle results → `docs/prd_pages/PRD_BATTLE_RESULTS_PAGE.md`
- Weapon shop → `docs/prd_pages/PRD_WEAPON_SHOP.md`

#### Design & UX
- Design system → `docs/design_ux/DESIGN_SYSTEM_AND_UX_GUIDE.md`
- Quick reference → `docs/design_ux/DESIGN_SYSTEM_QUICK_REFERENCE.md`
- Brand guidelines → `docs/design_ux/1_brand_&_logo_design_foundations.md`

#### Implementation Details
- New features → Create in `docs/implementation_notes/`
- Balance changes → Create in `docs/balance_changes/`
- Analysis → Create in `docs/analysis/`

## Documentation Standards

### File Naming
- Use UPPER_SNAKE_CASE for documentation files
- Prefix with category (PRD_, GUIDE_, etc.)
- Be descriptive but concise

### Content Structure
1. **Overview** - Brief description of feature/system
2. **Requirements** - What needs to be implemented
3. **Technical Details** - How it works
4. **Examples** - Code snippets or usage examples
5. **Edge Cases** - Special scenarios to handle
6. **Related Systems** - Dependencies and interactions

### Markdown Formatting
- Use headers hierarchically (# → ## → ###)
- Include code blocks with language specification
- Use tables for structured data
- Add links to related documentation
- Include diagrams when helpful (ASCII art is fine)

## File References in Documentation

When documentation needs to reference external files (like OpenAPI specs, GraphQL schemas, etc.), use this syntax:

```markdown
#[[file:relative/path/to/file.yaml]]
```

This allows the file content to be included when the documentation is processed.

## Keeping Documentation Current

### Before Committing Code
1. Review affected documentation files
2. Update specifications to match implementation
3. Add implementation notes if design deviated from spec
4. Update README files if module behavior changed

### Documentation Review Checklist
- [ ] PRD documents reflect current behavior
- [ ] Code comments explain complex logic
- [ ] API documentation is accurate
- [ ] Database schema documentation is current
- [ ] Setup/deployment guides work for new developers
- [ ] Troubleshooting guides include recent issues

## Documentation as Source of Truth

When implementing features:
1. **Read the PRD first** - Understand the intended design
2. **Follow the specification** - Implement as documented
3. **Document deviations** - If you must deviate, explain why
4. **Update the PRD** - Keep it as the source of truth

The documentation should always reflect the current state of the system, not an aspirational future state.
