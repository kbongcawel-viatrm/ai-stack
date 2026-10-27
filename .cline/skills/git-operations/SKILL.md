---
name: git-operations
description: Safely manage Git repositories, branches, diffs, commits, fetches, pulls, pushes, and GitHub collaboration with explicit preflight and validation.
---

# Git operations skill

Use this skill for source-control work, especially syncing with `origin/main`, preparing commits, pushing changes, and reviewing repository state.

## Required operating policy

1. **Before any local workstation or host change**, first inspect the repository and current branch, then run the required synchronization sequence:
   ```bash
   git status --short --branch
   git reset --hard HEAD
   git fetch origin
   git pull --ff-only origin main
   ```
   The reset is destructive and discards tracked, uncommitted changes. Preserve any user work only when explicitly instructed to do so; do not run this sequence in a repository containing work that must be retained. If the working tree has changes and their disposal has not been clearly authorized, stop and ask before resetting. Never use `git clean -fdx` as a substitute.
2. **Before host-related changes or tests that mutate the host**, finish the source change, review it, stage it, commit it, and push it to the intended remote branch first. Confirm the push succeeded and record the commit SHA. Do not claim tests passed before actually running them. If a test itself must run before a safe commit (for example, a formatter or static check), run only that non-host-mutating check, document it, then commit/push before host operations.
3. Set the requested global identity only when working on the user's workstation:
   ```bash
   git config --global user.name "kbongcawel-viatrm"
   git config --global user.email "dummykevin08@gmail.com"
   git config --global --get user.name
   git config --global --get user.email
   ```
   Do not set global config from a remote automation environment or a container unless explicitly asked to configure that environment.
4. Remove editor swap files from the repository/worktree using a reviewed, scoped search for `*.swp` and `*.swo`. List matches first; delete only those swap files, never arbitrary files. Keep `*.swp` and `*.swo` in `.gitignore`.
5. Never force-push, rewrite shared history, delete branches, or discard untracked files without explicit authorization.
6. Never commit secrets, tokens, private keys, local credentials, machine-specific state, or sensitive logs. Inspect staged changes before committing.

## Standard workflow

### 1. Inspect and synchronize

```bash
pwd
git status --short --branch
git remote -v
git branch --show-current
git log -5 --oneline --decorate
```

Before applying the required reset, verify whether any tracked changes would be lost and resolve that explicitly. Then run the required reset/fetch/pull sequence above. If `main` is not the intended integration branch or the repository has no `origin`, stop and confirm rather than guessing.

### 2. Review changes

```bash
git diff --check
git diff
git status --short
```

For new files, inspect their contents separately because ordinary `git diff` does not show untracked files. Search for secrets and accidental local artifacts. Confirm `.swp`/`.swo` files are not staged.

### 3. Stage and commit

Stage explicit paths when possible:

```bash
git add path/to/file another/path
git diff --cached --check
git diff --cached
git status --short
git commit -m "type(scope): concise change"
git rev-parse HEAD
```

Do not stage everything blindly if the worktree contains unrelated files. If using `git add -A`, first verify every change is intended.

### 4. Push and verify

```bash
git push -u origin "$(git branch --show-current)"
git status --short --branch
git log -1 --format='%H%n%s'
```

Verify the push exit status and remote branch/commit. If rejected, fetch and inspect divergence; do not force-push. If `main` is protected, push a topic branch and open a pull request rather than bypassing protection.

### 5. Pull and merge safely

- Prefer `git pull --ff-only origin main` for updating a local main branch.
- For feature work, fetch first, inspect divergence, and rebase/merge only according to the repository's policy.
- Never run `git reset --hard` on a branch with work that must be preserved.
- Use `git diff <base>...HEAD` and `git log --oneline <base>..HEAD` to review a proposed change set.

## Swap-file cleanup

List candidates before removal:

```bash
find . -type f \( -name '*.swp' -o -name '*.swo' \) -not -path './.git/*' -print
```

After reviewing the list, remove only the listed swap files, then check:

```bash
git status --short
git diff --check
```

For a tracked swap file, use `git rm -- path/to/file` so the deletion is committed. For an untracked swap file, remove only the exact reviewed path.

## Troubleshooting

- **Non-fast-forward push:** `git fetch origin`, inspect `git log --left-right --graph --oneline HEAD...origin/<branch>`, then integrate deliberately.
- **Authentication failure:** use the approved Git credential manager or SSH agent; never paste a token into a remote URL or commit it.
- **Wrong author:** verify `git config --show-origin --get user.name` and `git config --show-origin --get user.email`. Global settings are user-wide and can affect other repositories.
- **Dirty worktree:** determine whether changes are user work, generated artifacts, or intended edits before resetting or cleaning.

## Completion report

Report the branch, files changed, commit SHA, push result, validation commands/results, and any host operations not performed. Clearly distinguish repository changes from workstation configuration changes.
