---
inclusion: manual
---

# Git Workflow

## Branches
- `main` is protected, deployable, and triggers ACC deployment; do not force-push or bypass required checks.
- Normal work uses short-lived `feature/<description>` or `fix/<description>` branches. Use `hotfix/<description>` only for urgent production remediation.
- Use pull requests as the normal merge path. Direct pushes or merges to `main` require explicit authorization.

## Commits
Use `<type>(<scope>): <imperative subject>` with a specific subject of about 50 characters or fewer and no trailing period. Common types: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `chore`, and `revert`. Explain why in the body when the change is non-obvious; reference issues or breaking changes when applicable.

Keep commits logical, self-contained, and buildable. Stage named files rather than `git add .` or `git add -A`. Preserve hooks; never use `--no-verify`. Do not commit secrets, `.env` files, generated artifacts, coverage, or unrelated changes.

## Normal workflow
1. Inspect status and the current branch; update from `main` before starting work when appropriate.
2. Create or switch to a feature/fix branch.
3. Make focused changes, run the applicable validation gates, and inspect the diff.
4. Commit only when requested, push the branch with `git push -u origin <branch>`, and open/review the pull request.
5. Merge only after required CI and review; delete the merged branch when safe.

Testing gates are owned by `testing-strategy.md`; deployment behavior is owned by `environments-and-deployment.md` and the workflow files.

## Safety
- Do not force-push, reset destructively, amend pushed commits, or delete branches without explicit authorization.
- For published mistakes, prefer `git revert`. Ask before using `reset --hard`, history rewriting, or broad deletion.
- If a secret was committed, stop, revoke/rotate it immediately, notify the appropriate owner, then remove it from history using an approved procedure; a local reset is not sufficient after push.
- Resolve conflicts by preserving intended behavior, removing markers, running relevant tests, and reviewing the final diff.

## CI and PR inspection
```bash
git status
git diff --check
gh pr checks <pr-number>
gh run view <run-id> --log-failed
gh api repos/RobertTeunissen/ArmouredSouls/pulls/<pr-number>/reviews
gh api repos/RobertTeunissen/ArmouredSouls/pulls/<pr-number>/comments
```

Use `gh` for CI/PR inspection and follow the repository’s noninteractive command and Git safety rules.
