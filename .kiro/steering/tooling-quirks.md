# Tooling Quirks

## Do not use `execute_bash` — it always gets stuck

**Never call `execute_bash` in this workspace. It always hangs.** The call does not
return control: the session gets stuck waiting on the terminal, which costs the
user a stalled turn every time. This is not occasional and there is no command
short or simple enough to be safe — do not try it "just once" to check something.

Two related symptoms confirm the integration is broken rather than the command:
every call reports `Exit Code: -1` whether or not the command worked, and the
echoed command comes back mangled (duplicated leading characters,
`cmdand cmdand dquote>` continuation markers, line breaks mid-token). So even when
output does come back, success cannot be judged from the tool's own signals, and
re-running on a misread failure can do real damage — a second `git stash`, a
repeated migration, a duplicate insert.

Use the dedicated tools instead. They are also what the general tool guidance
asks for:

| Instead of | Use |
|---|---|
| `grep` / `rg` | `grep_search` |
| `find` / `ls` | `file_search`, `list_directory` |
| `cat` / `head` / `tail` | `read_file`, `read_files`, `read_code` |
| `sed -i` / `perl -pi` / `echo >` | `str_replace`, `fs_write`, `fs_append` |
| `mv` on source files | `smart_relocate` (updates imports) |
| `tsc --noEmit` | `get_diagnostics` on the changed files |

### Verifying work without `execute_bash`

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

Committing, pushing and issue updates need a shell, so they are the user's to
run unless they explicitly ask for something else. Prepare the content — a commit
message, a PR body — and hand it over rather than executing it.

## Writing files outside the workspace is blocked

`fs_write` refuses absolute paths outside the workspace root, including `/tmp`.
Keep temporary artefacts out of the repo: prefer handing long text to the user in
the reply over writing a scratch file. If a temporary file in the repo is
genuinely unavoidable, delete it in the same turn.
