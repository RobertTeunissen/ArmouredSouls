---
inclusion: fileMatch
fileMatchPattern: "**/.kiro/specs/**"
---

# Spec Quality Standards

Every spec in this project is a technical debt reduction or feature delivery vehicle. These standards apply to all specs — requirements, design, and tasks documents.

## Required Sections in Requirements

### Expected Contribution

Every `requirements.md` must include an "Expected Contribution" section before the Requirements section. This answers: "What measurable improvement does this spec deliver to the system?"

It must contain:
- 3–6 numbered, concrete outcomes with before/after comparisons (not vague aspirations)
- Quantifiable metrics where possible (line count reduction, error count, file count, etc.)
- A clear statement of which identified debt or gap this spec addresses

### Verification Criteria

Every `requirements.md` must include a "Verification Criteria" subsection within Expected Contribution. These are concrete, runnable checks that confirm the debt reduction was actually achieved after all tasks are complete.

Each criterion should be:
- A grep command, test suite run, file count check, or other automatable verification
- Something that can be run after the last task is marked done to prove the spec delivered what it promised
- Not a restatement of acceptance criteria — these verify the aggregate outcome, not individual requirements

### Glossary and Naming Convention

Every `requirements.md` must include a "Glossary" section before the Introduction, defining every domain concept the spec introduces or relies on.

There are exactly two naming registers in a spec document, and every identifier belongs to one of them:

| Register | Format | Use for | Examples |
|----------|--------|---------|----------|
| Domain concept | `Pascal_Snake`, unbackticked | Anything the spec itself defines: services, phases, operations, tunable values, UI elements, computed values | `Season_Rollover`, `Preparation_Phase`, `Season_Length_Cycles`, `Instance_Rank`, `Max_Events_Per_Robot` |
| Code artefact | Backticked, cased exactly as it appears in code | Prisma model fields, database tables and columns, API response fields, enum values, environment variable keys, file paths, function names | `competitiveCyclesCompleted`, `standings`, `battle_log`, `'league_1v1'`, `SEASON_LENGTH_CYCLES`, `cycleScheduler.ts` |

Rules:

- **Every `Pascal_Snake` term must appear in the Glossary.** If it is not worth defining, it is not a domain concept — write it as plain prose instead.
- **Never invent casing for a code artefact.** Quote it exactly as the code spells it. A Prisma field stays camelCase (`preparationCyclesCompleted`), a table stays snake_case (`scheduled_matches_v2`), an environment variable stays SCREAMING_SNAKE (`SEASON_LENGTH_CYCLES`). This keeps the spec greppable against the codebase.
- **Never use SCREAMING_SNAKE for a domain concept**, even when the concept is a numeric constant. A tunable is a domain concept (`Countdown_Cycles`); the environment variable that configures it is a code artefact (`COUNTDOWN_CYCLES`). Where a concept has a configuration key, the Glossary entry names that key: "Configured by the environment variable `COUNTDOWN_CYCLES`."
- **Both registers may appear in the same sentence.** "THE Season_Service SHALL report Season_Cycle as `competitiveCyclesCompleted + 1`" is correct — a concept defined in terms of a real column.
- **Reuse the term an earlier spec established** rather than coining a synonym. `Cycle_Scheduler`, `Settlement_Job`, `Booking_Office`, and `Standing` are already defined; do not introduce `Scheduler_Service` or `Subscription_Facility` alongside them.
- The same convention applies to `design.md` and `tasks.md`. A concept named in requirements keeps its exact spelling through design and tasks so that requirement traces stay searchable.

## Required Coverage in Design

### Requirements Traceability

The design document must address every requirement. If a requirement has no corresponding design section, it's a gap. Specifically:
- Every acceptance criterion must map to at least one component, interface, or architectural decision in the design
- If a requirement is out of scope for the design (e.g., documentation-only), it must be explicitly noted

### Documentation Impact

The design must identify which existing documentation and steering files will need updating. This includes:
- Steering files in `.kiro/steering/` that reference patterns being changed
- Guide documents in `docs/guides/` that describe affected systems
- The `project-overview.md` steering file if the project structure or tech stack changes

## Required Coverage in Tasks

### Full Requirements Tracing

Every task group must have a `_Requirements:` line listing which requirement acceptance criteria it satisfies. After all tasks are listed, every acceptance criterion from the requirements document must appear in at least one task's requirements trace. If a requirement is not covered by any task, it's a gap that must be fixed.

### Documentation Update Tasks

Every spec must include explicit tasks for:
1. Updating any steering files (`.kiro/steering/`) that describe patterns or conventions being changed by the spec
2. Updating any guide documents (`docs/guides/`) that describe affected systems
3. Creating new documentation if the spec introduces new patterns, conventions, or architectural decisions

These must not be vague ("update docs") — they must name the specific files and what needs changing.

### Verification Task

The final task group in every spec must include a verification step that runs the Verification Criteria defined in the requirements. This is the "did we actually achieve what we set out to do" gate. It should reference the specific checks from the requirements document.

## Spec Naming and Organization

### Sequential Numbering

Every spec directory must be prefixed with a sequential number. The number is assigned when the spec is created and never changes, even if earlier specs are completed or removed.

- Format: `{number}-{kebab-case-name}` (e.g., `11-security-audit-guardrails`)
- To find the next number: look at the highest number across `to-do/`, `done-march26/`, and `done-april26/` (or any future done directories), then increment by 1
- Numbers are global across all directories — no reuse, no gaps to fill

### Directory Placement

- New specs always start in `.kiro/specs/to-do/`
- When all tasks in a spec are completed, move the spec directory to `.kiro/specs/done-{month}{year}/` (e.g., `done-april26/`)
- Never leave completed specs in `to-do/`
- The `done-*` directory name uses the month the spec was finished, not started

### Current Number Registry

Check these directories to determine the next available number:
- `.kiro/specs/to-do/`
- `.kiro/specs/done-april26/`
- `.kiro/specs/done-march26/`

### No Optional Tasks

All tasks in a spec are mandatory. Do not mark tasks as optional with `*` or `\*`. Every task that is written must be executed. If a task isn't worth doing, remove it from the spec entirely — don't mark it optional.

## Mobile Responsiveness Requirement

Every spec that introduces or modifies UI components must include explicit mobile responsiveness requirements. This is not optional — the game is played on mobile devices.

Specifically:
- Every new page or surface must specify its mobile layout (stacked cards, vertical lists, collapsible sections — whatever fits the content)
- Every new component must specify how it behaves on viewports < 1024px and ≥ 320px
- The design document must reference the responsive tab layout pattern from `.kiro/steering/frontend-standards.md` where applicable
- Tasks must include mobile-specific test assertions (viewport rendering, no horizontal overflow, touch targets ≥ 44px)

If a spec has zero UI components, this section does not apply.

## Anti-Patterns to Avoid

- Requirements with no Expected Contribution section (why does this spec exist?)
- Tasks that say "update documentation" without naming specific files
- Design documents that don't mention documentation impact
- Specs where some acceptance criteria have no corresponding task
- Verification criteria that just say "all tests pass" without spec-specific checks
- Tasks marked as optional — if it's in the spec, it gets done
- A `Pascal_Snake` term used in a requirement but missing from the Glossary
- SCREAMING_SNAKE used for a domain concept instead of the environment variable that configures it
- A code artefact re-cased to look like a domain concept (`Competitive_Cycles_Completed` for the `competitiveCyclesCompleted` column), which breaks grep against the codebase
- A concept renamed between `requirements.md`, `design.md`, and `tasks.md`, which breaks requirement traceability
