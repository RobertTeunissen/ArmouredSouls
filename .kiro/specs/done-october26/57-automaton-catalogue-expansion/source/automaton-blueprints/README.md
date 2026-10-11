# Armoured Souls — Expansion blueprint review data

Updated 9 October 2026.

The collection covers all 89 expansion stables, with 326 main/reserve robot blueprints and seven complete replacement alternatives: 333 robot designs in total.

- [Readable blueprints](../AUTOMATON_ROBOT_BLUEPRINTS.md) include every robot's combat setup, weapon path, prices, refinements, and art brief, plus each stable's backstory, target roster, fixed teams, and event order.
- [Updated expansion plan](../AUTOMATON_STABLE_EXPANSION.md) links every stable to its blueprints.
- [blueprints.json](blueprints.json) contains the full collection. The other stable-key JSON files contain identical individual records.
- [validation-report.json](validation-report.json) records the checks completed and their limits.

This is an expanded review format, not a verified backend importer format. `review` contains explanatory fields such as derived range, image convention, artwork description, and price subtotals. `alternativeBlueprints` contains full options that replace existing slots before catalogue approval; they do not create extra simultaneous roster slots or a new runtime selection feature.

Before importing, map the approved values to the repository's actual catalogue schema and check STRATEGIES.md, the live weapons, starting budgets, profanity validation, and runtime name availability. The design records themselves have no missing robot fields.

Image paths are conventions for future portraits. This update creates blueprint descriptions and review data; it does not generate or modify portrait files.
