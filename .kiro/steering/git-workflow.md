---
inclusion: always
---

# Git Workflow and Commit Standards

## Branch Strategy

### Main Branch
**Branch**: `main`
- Always deployable
- Protected branch (requires passing tests)
- Pushing to main triggers automatic ACC deployment
- Never force push to main

### Feature Branches
**Naming Convention**: `feature/description-of-feature`
- Created from `main`
- Short-lived (merge within 1-2 days)
- Deleted after merge

**Examples**:
- `feature/add-weapon-crafting`
- `feature/league-rebalancing`
- `feature/tournament-brackets`

### Bug Fix Branches
**Naming Convention**: `fix/description-of-bug`
- Created from `main`
- Merged back to `main` after fix verified

**Examples**:
- `fix/battle-calculation-overflow`
- `fix/login-token-expiration`
- `fix/database-connection-leak`

### Hotfix Branches
**Naming Convention**: `hotfix/critical-issue`
- Created from `main` for production emergencies
- Highest priority
- Merged immediately after verification

**Examples**:
- `hotfix/payment-processing-failure`
- `hotfix/data-corruption-in-battles`

## Commit Message Standards

### Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, no logic change)
- **refactor**: Code refactoring (no feature change)
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Build process, dependencies, tooling
- **revert**: Reverting a previous commit

### Scope (Optional)
- **auth**: Authentication/authorization
- **battle**: Combat system
- **economy**: Credits, facilities, investments
- **league**: League system
- **matchmaking**: Matchmaking algorithm
- **api**: API endpoints
- **db**: Database changes
- **ui**: Frontend components

### Subject Line Rules
- Use imperative mood ("add" not "added" or "adds")
- Don't capitalize first letter
- No period at the end
- Maximum 50 characters
- Be specific and descriptive

### Body (Optional but Recommended)
- Explain what and why, not how
- Wrap at 72 characters
- Separate from subject with blank line
- Use bullet points for multiple changes

### Footer (Optional)
- Reference issues: `Closes #123`
- Breaking changes: `BREAKING CHANGE: description`
- Related commits: `Related to #456`

### Examples

**Good Commits**:
```
feat(battle): add critical hit mechanic

Implements critical hit system with 10% base chance.
Critical hits deal 1.5x damage and ignore 50% armor.

- Add criticalHitChance to weapon stats
- Update damage calculation formula
- Add tests for critical hit scenarios

Closes #234
```

```
fix(auth): prevent token expiration during active session

Users were being logged out mid-battle due to token expiration.
Now refresh token automatically when user is active.

Fixes #456
```

```
refactor(economy): simplify facility income calculation

Consolidate income calculation logic into single function.
No behavior change, improves maintainability.
```

**Bad Commits**:
```
// Too vague
fix: bug fix

// Not imperative
feat: added new feature

// Too long subject
feat(battle): add new critical hit mechanic that deals extra damage based on weapon type and robot attributes

// Missing context
update code
```

## Workflow Process

### Starting New Work

1. **Ensure main is up to date**:
```bash
git checkout main
git pull origin main
```

2. **Create feature branch**:
```bash
git checkout -b feature/weapon-crafting
```

3. **Make changes and commit frequently**:
```bash
git add .
git commit -m "feat(economy): add weapon crafting UI"
```

### Before Committing

**Pre-commit Checklist**:
- [ ] All tests pass: `npm test`
- [ ] No console.log statements
- [ ] Code follows style guide
- [ ] Documentation updated
- [ ] No secrets in code

### Committing Changes

**Commit Frequently**:
- Commit logical units of work
- Each commit should be self-contained
- Commit messages should be meaningful

**Atomic Commits**:
- One logical change per commit
- Commit should not break the build
- Easy to revert if needed

### Pushing Changes

**Push to remote**:
```bash
git push origin feature/weapon-crafting
```

**If branch doesn't exist remotely**:
```bash
git push -u origin feature/weapon-crafting
```

### Merging to Main

**Option 1: Direct Push (Small Changes)**
```bash
git checkout main
git pull origin main
git merge feature/weapon-crafting
git push origin main
```

**Option 2: Pull Request (Recommended for Large Changes)**
1. Push feature branch to remote
2. Create pull request on GitHub
3. Request review if needed
4. Merge after approval and passing tests

### After Merge

**Delete feature branch**:
```bash
git branch -d feature/weapon-crafting
git push origin --delete feature/weapon-crafting
```

## Handling Merge Conflicts

### When Conflicts Occur

1. **Update main branch**:
```bash
git checkout main
git pull origin main
```

2. **Merge main into feature branch**:
```bash
git checkout feature/weapon-crafting
git merge main
```

3. **Resolve conflicts**:
- Open conflicted files
- Look for conflict markers: `<<<<<<<`, `=======`, `>>>>>>>`
- Choose correct version or combine changes
- Remove conflict markers
- Test that code still works

4. **Complete merge**:
```bash
git add .
git commit -m "merge: resolve conflicts with main"
git push origin feature/weapon-crafting
```

### Conflict Prevention

- Pull from main frequently
- Keep feature branches short-lived
- Communicate with team about overlapping work
- Merge main into feature branch regularly

## Advanced Git Operations

### Amending Last Commit

**Fix commit message**:
```bash
git commit --amend -m "feat(battle): add critical hit mechanic"
```

**Add forgotten files**:
```bash
git add forgotten-file.ts
git commit --amend --no-edit
```

**Warning**: Never amend commits that have been pushed to shared branches

### Reverting Changes

**Undo last commit (keep changes)**:
```bash
git reset --soft HEAD~1
```

**Undo last commit (discard changes)**:
```bash
git reset --hard HEAD~1
```

**Revert a pushed commit**:
```bash
git revert <commit-hash>
```

### Stashing Changes

**Save work in progress**:
```bash
git stash save "WIP: weapon crafting UI"
```

**List stashes**:
```bash
git stash list
```

**Apply stash**:
```bash
git stash apply stash@{0}
```

**Apply and remove stash**:
```bash
git stash pop
```

### Cherry-picking Commits

**Apply specific commit to current branch**:
```bash
git cherry-pick <commit-hash>
```

## Git Best Practices

### Do's
- Commit frequently with meaningful messages
- Pull from main before starting work
- Keep commits atomic and focused
- Write descriptive commit messages
- Test before committing
- Delete merged branches

### Don'ts
- Don't commit secrets or credentials
- Don't commit node_modules or build artifacts
- Don't force push to main
- Don't commit commented-out code
- Don't commit console.log statements
- Don't make commits with "WIP" or "temp" messages on main

## .gitignore Configuration

**Essential Entries**:
```
# Dependencies
node_modules/
package-lock.json

# Environment variables
.env
.env.local
.env.*.local

# Build outputs
dist/
build/
*.log

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Test coverage
coverage/

# Temporary files
*.tmp
*.temp
```

## Troubleshooting

### Accidentally Committed to Wrong Branch

```bash
# Save commit
git log  # Copy commit hash

# Undo commit on current branch
git reset --hard HEAD~1

# Switch to correct branch
git checkout correct-branch

# Apply commit
git cherry-pick <commit-hash>
```

### Accidentally Committed Secrets

```bash
# Remove from last commit
git reset --soft HEAD~1
# Remove secret from file
git add .
git commit -m "feat: add feature (without secrets)"

# If already pushed - contact team lead immediately
# May need to rotate secrets
```

### Lost Commits

```bash
# View reflog
git reflog

# Recover lost commit
git checkout <commit-hash>
git checkout -b recovery-branch
```

## Deployment Considerations

### Before Pushing to Main

**Remember**: Pushing to main triggers ACC deployment

**Verify**:
1. All tests pass locally
2. No console.log statements
3. Environment variables documented
4. Database migrations tested
5. Documentation updated

**If deployment fails**:
- Check GitHub Actions logs
- Fix issues locally
- Push fix to main
- Monitor deployment

## Quick Reference

### Common Commands
```bash
# Status
git status

# Stage changes
git add .
git add <file>

# Commit
git commit -m "type(scope): message"

# Push
git push origin <branch>

# Pull
git pull origin main

# Create branch
git checkout -b feature/name

# Switch branch
git checkout <branch>

# Delete branch
git branch -d <branch>

# View log
git log --oneline

# View diff
git diff
```
