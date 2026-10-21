---
inclusion: always
---

# Tooling Rules

- Prefer dedicated file/search/edit/process tools; use `execute_bash` mainly for one-shot `git`, `gh`, or CLIs without a tool.
- Never retry a failed or hung shell command; report it and take the safest fallback.
- Run tests and long commands via `control_bash_process` + `get_process_output`; stop finished processes.
- Run diagnostics on every changed code file.
- Never write outside the workspace, including scratch files.
- Git: no force-push, destructive reset, skipped hooks, or unrequested commits. Stage specific files.
- Keep tool output small: target exact files, filter logs (`grep`/`tail`), and run single test files before whole tiers.
