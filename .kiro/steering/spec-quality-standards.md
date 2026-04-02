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

## Anti-Patterns to Avoid

- Requirements with no Expected Contribution section (why does this spec exist?)
- Tasks that say "update documentation" without naming specific files
- Design documents that don't mention documentation impact
- Specs where some acceptance criteria have no corresponding task
- Verification criteria that just say "all tests pass" without spec-specific checks
- Tasks marked as optional — if it's in the spec, it gets done
