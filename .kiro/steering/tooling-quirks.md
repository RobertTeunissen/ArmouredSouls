---
inclusion: always
---

# Tooling Rules

- Prefer dedicated file/search/edit/process tools over shell commands. Use `execute_bash` mainly for one-shot `git`, `gh`, or unavailable CLI operations.
- Do not retry a failed or hung shell command; report it and use the safest fallback.
- For tests or long-running commands, use `control_bash_process` and inspect output with `get_process_output`. Stop completed background processes.
- Use diagnostics on every changed code file. Do not use shell file operations when a dedicated tool exists.
- Never write outside the workspace. Do not create scratch files outside the repository.
- Git safety: do not force-push, reset destructively, skip hooks, or commit unless requested. Stage specific files.
- Shell scripts and GitHub Actions have separate rules in `shell-ci-standards.md`.
