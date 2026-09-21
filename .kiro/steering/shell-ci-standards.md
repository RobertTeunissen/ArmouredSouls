---
inclusion: fileMatch
fileMatchPattern: "**/*.sh,**/.github/workflows/**,**/Dockerfile*,**/docker-compose*.yml"
---

# Shell and CI Rules

- New shell scripts start with `set -euo pipefail`.
- Never `source .env`; read values as text with the repository’s `env_get` pattern. See `app/scripts/backup.sh`.
- If a script cleans disk space and checks disk capacity, cleanup runs before the guard.
- In GitHub Actions, use `shell: bash` for piped commands so `pipefail` is enabled. Never hide failure with `|| true` or `continue-on-error`.
- Every required test/lint/build job must be able to fail, and every deploy job must list its required jobs in `needs:`. Verify workflow files rather than trusting historical documentation.
- Use noninteractive commands and preserve hooks. Deployment procedures belong in `environments-and-deployment.md` and `pre-deployment-checklist.md`.
