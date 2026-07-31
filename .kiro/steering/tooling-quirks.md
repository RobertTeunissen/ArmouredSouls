# Tooling Quirks

## `execute_bash` — use sparingly, don't retry on failure

`execute_bash` is unreliable in this workspace. It often hangs, reports
`Exit Code: -1`, or returns mangled output (duplicated leading characters,
`cmdand cmdand dquote>` continuation markers). However, short one-shot commands
(like `gh issue comment`, `git commit`) usually succeed on the first attempt.

**Rules:**

1. **Prefer dedicated tools** when one exists for the job (see table below).
2. **`execute_bash` is acceptable** for commands that have no dedicated-tool
   equivalent — primarily `git`, `gh`, and other CLI one-liners.
3. **Do not retry.** If a call hangs or returns garbled output, stop trying that
   command. Do not attempt it a second time — re-running on a misread failure can
   do real damage (a second `git stash`, a repeated migration, a duplicate insert).
   After one failure, fall back to handing the command to the user.

| Instead of | Use |
|---|---|
| `grep` / `rg` | `grep_search` |
| `find` / `ls` | `file_search`, `list_directory` |
| `cat` / `head` / `tail` | `read_file`, `read_files`, `read_code` |
| `sed -i` / `perl -pi` / `echo >` | `str_replace`, `fs_write`, `fs_append` |
| `mv` on source files | `smart_relocate` (updates imports) |
| `tsc --noEmit` | `get_diagnostics` on the changed files |

### Verifying work

- **Type and lint errors:** `get_diagnostics` on every file touched. It reports
  the same errors the user sees, including in test files.
- **Builds and test suites:** use `control_bash_process` with `action: "start"`,
  then poll with `get_process_output`. It returns immediately instead of blocking,
  so it sidesteps the hang, and the command's own stdout (`Tests: 204 passed`) is
  the signal to read — not an exit code. Stop the process when finished.
  - Backend: `cd app/backend && pnpm run test:unit`
  - Frontend: `cd app/frontend && pnpm test -- --run`
  - Redirect noisy runs to a log and grep it, so a huge stdout doesn't bury the
    useful line.
- **Long-running processes** (dev servers, watchers): same tool, but leave them
  running and tell the user, or ask them to start it themselves.

### Git and `gh`

Use `execute_bash` for `git` and `gh` commands. If the call hangs or fails,
do not retry — hand the command to the user instead.

## Writing files outside the workspace is blocked

`fs_write` refuses absolute paths outside the workspace root, including `/tmp`.
Keep temporary artefacts out of the repo: prefer handing long text to the user in
the reply over writing a scratch file. If a temporary file in the repo is
genuinely unavoidable, delete it in the same turn.
