# Tooling Quirks

Known environment issues that make a tool *look* broken when it isn't.

## `execute_bash` always reports `Exit Code: -1`

**The exit code is meaningless in this workspace — every call reports `-1`, including
successful ones.** The echoed command also comes back mangled (duplicated leading
characters, `cmdand cmdand dquote>` continuation markers, line breaks mid-token).

Both are artefacts of the terminal integration. **The command runs normally and its
stdout/stderr are accurate.** Use the tool freely — builds, tests, migrations,
`git`, `gh` all work.

### How to judge success

Ignore the reported exit code and read the command's own output:

- Make the command state its result: `echo "tsc=$?"` after a compile,
  `git log --oneline -1` after a commit.
- Look for the real signal in stdout: `Test Suites: 204 passed`,
  `All migrations have been successfully applied.`
- Redirect noisy commands and grep the log, so a huge stdout doesn't bury the
  useful line: `cmd > /tmp/out.log 2>&1; grep -E 'Tests:' /tmp/out.log`.

### Do not treat `-1` as failure

Never retry, revert, or abandon an approach because of the reported exit code.
Re-running a command that already succeeded can do real damage — a second
`git stash`, a repeated migration, a duplicate insert. If unsure what happened,
check state with a cheap read (`git status --short`, `git log -1`, a `SELECT count(*)`).

## Writing files outside the workspace is blocked

`fs_write` refuses absolute paths outside the workspace root, including `/tmp`.
Redirecting *shell* output to `/tmp` is fine — that is bash, not `fs_write`.

For long text a command needs (a commit message, a `gh --body-file` payload),
prefer piping from a heredoc so no file is created:

```bash
git commit -F - <<'EOF'
subject line

body
EOF

gh issue comment 123 --body-file - <<'EOF'
comment body
EOF
```

Only fall back to a temporary file in the repo if a heredoc will not do, and
delete it in the same turn.
