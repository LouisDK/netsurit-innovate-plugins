# Deep Inquiry: Worktree Isolation Design

**Date:** 2026-03-02
**Status:** Approved
**Approach:** Agent-managed worktrees (Approach A)

## Problem

Deep inquiry investigations create artifacts (inquiry/ directories, code experiments,
profiling scripts, instrumented source files) that mutate the working tree. Since
investigations are exploratory — not commitments — these mutations should be isolated
from the main branch.

## Core Principle

Only create a worktree if the user isn't already in one. If the user is working in a
worktree, they've already solved the isolation problem — just work in-place.

## Design

### Context Detection (Phase 1, before domain scoping)

Detect whether the agent is running in a worktree:

```bash
GIT_DIR=$(git rev-parse --git-dir)
GIT_COMMON=$(git rev-parse --git-common-dir)
# If they differ → already in a worktree
```

Discover the main tree path (needed for report copy):

```bash
MAIN_TREE=$(git worktree list --porcelain | head -1 | sed 's/^worktree //')
```

Store as session variables: `isolation_mode` (worktree / in-place), `main_tree_path`.

### Stale Worktree Detection (Phase 1, before domain scoping)

Only when in the main tree. Check for existing inquiry worktrees:

```bash
git worktree list | grep '.claude/worktrees/inquiry-'
```

If found, ask the user:

1. **Continue** — build on the previous investigation (reuse worktree)
2. **Start fresh** — remove old worktree, begin new inquiry
3. **Keep both** — leave old one, create new alongside it

### Isolation Decision (Phase 1.6, after budget negotiation)

**Already in a worktree → work in-place.** No offer, no question.

**In main tree → offer worktree** with mode-dependent framing:

| Mode | Framing |
|---|---|
| Code / Mixed | Recommend worktree (source files may be modified) |
| Reasoning / Evidence | Offer but don't push (only creates markdown) |

If accepted:

```bash
MAIN_TREE=$(git worktree list --porcelain | head -1 | sed 's/^worktree //')
git worktree add "$MAIN_TREE/.claude/worktrees/inquiry-<topic>" -b "inquiry/<topic>"
cd "$MAIN_TREE/.claude/worktrees/inquiry-<topic>"
```

If declined, work in-place as today.

### Report Copy (end of Phase 6, after summary report)

Always copy `report.html` to `$MAIN_TREE/inquiry/<topic>/report.html`:

- Create `inquiry/<topic>/` in main tree if needed
- Not git-added — user decides whether to commit
- Applies regardless of whether a worktree was used

### Cleanup (user-initiated only)

Only relevant when an inquiry worktree was created. The agent never auto-cleans.

On conclusion, print instructions:

```
@deep-inquiry clean up the <topic> worktree
```

Or manually:

```bash
git worktree remove .claude/worktrees/inquiry-<topic>
git branch -D inquiry/<topic>
```

On cleanup request:

1. Verify path matches `.claude/worktrees/inquiry-*` (refuse otherwise)
2. `cd` to main tree
3. `git worktree remove .claude/worktrees/inquiry-<topic>`
4. `git branch -D inquiry/<topic>`
5. Confirm what was removed

### Safety Invariant

The agent ONLY manages worktrees matching `.claude/worktrees/inquiry-*`. It never
inspects, lists for cleanup, or removes anything outside that prefix. This is the
ownership boundary that prevents accidentally deleting user worktrees.

## Technical Notes

- `git worktree add` with relative paths resolves from CWD — always use absolute
  paths derived from `MAIN_TREE` to avoid nesting worktrees inside user worktrees
- Branch cleanup requires `git branch -D` (force), not `-d`, since inquiry branches
  are never merged
- `.claude/` being gitignored does not affect worktree functionality (metadata lives
  in `.git/worktrees/`)
- `inquiry/<topic>` as a branch name is valid; no conflicts as long as no plain
  `inquiry` branch exists
- Cannot `git worktree remove` the worktree you're standing in — agent must `cd`
  to main tree first

## Files to Modify

- `plugins/deep-inquiry/agents/deep-inquiry.md` — add worktree management sections
- `plugins/deep-inquiry/skills/deep-inquiry-methodology/SKILL.md` — add Phase 1.6,
  update Phase 6 with report copy and cleanup instructions
- `plugins/deep-inquiry/README.md` — document worktree isolation feature
