---
inclusion: fileMatch
fileMatchPattern: "**/.kiro/specs/**"
---

# Spec Quality Standards

Every spec is a delivery or technical-debt vehicle. Requirements, design, and tasks must remain traceable, measurable, executable, and consistent with the repository.

## Requirements contract
- Put `Expected Contribution` before `Requirements`. List 3–6 concrete before/after outcomes, quantified where possible, and identify the debt or gap addressed.
- Include a `Verification Criteria` subsection with runnable aggregate checks: tests, grep/search checks, file counts, or other commands that prove the contribution after the final task.
- Put a `Glossary` before the Introduction. Define every domain concept introduced by the spec.

Use two naming registers consistently:
- **Domain concept:** `Pascal_Snake`, unbackticked (`Season_Rollover`, `Booking_Office`). Every such term must be in the Glossary; use plain prose when a term is not worth defining.
- **Code artefact:** backticked and cased exactly as implemented (`competitiveCyclesCompleted`, `standings`, `battle_log`, `SEASON_LENGTH_CYCLES`, `cycleScheduler.ts`). Never recase a code artefact or use SCREAMING_SNAKE for a domain concept.

Reuse established terms across requirements, design, and tasks. Do not coin synonyms that break searchable traceability.

## Design contract
- Map every acceptance criterion to a design component, interface, decision, or explicitly documented out-of-scope note.
- Name documentation impact precisely: affected steering files, guides, PRDs, implementation notes, and project overview where applicable. Follow `documentation-workflow.md` for ownership.

## Task contract
- Every task group has a `_Requirements:` trace. Every acceptance criterion must appear in at least one task trace.
- Include explicit documentation tasks naming the files and content to update; “update docs” is insufficient.
- The final task group runs the requirements’ Verification Criteria. All written tasks are mandatory; remove work rather than marking it optional.

## Spec lifecycle
- New specs start in `.kiro/specs/to-do/` and use `{number}-{kebab-case-name}`.
- Numbers are global and never reused. Determine the next number by scanning `.kiro/specs/to-do/` and every `.kiro/specs/done-*` directory; never rely on a fixed month registry.
- Move a completed spec to `.kiro/specs/done-{month}{year}/` using the completion month. Never leave completed specs in `to-do/`.

## UI and mobile contract
Specs that add or change UI must define behavior from 320px through below 1024px and at ≥1024px, including layout, overflow, keyboard/focus behavior, and touch targets of at least 44px. Reference the `TabLayout` pattern in `frontend-standards.md` where applicable, and include mobile viewport assertions in tasks. This section does not apply to specs with no UI.

## Quality checks
Before approving a spec, verify measurable contribution, glossary/register consistency, requirement-to-design-to-task coverage, named documentation impact, runnable final verification, sequential numbering, lifecycle placement, and absence of optional tasks. Do not accept vague “all tests pass” as the only verification criterion.
