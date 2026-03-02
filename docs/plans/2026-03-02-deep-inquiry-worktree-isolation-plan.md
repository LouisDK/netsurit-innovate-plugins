# Deep Inquiry Worktree Isolation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add git worktree isolation to deep-inquiry so investigations don't mutate the main working tree, with the summary report copied back to the main tree on conclusion.

**Architecture:** The methodology skill gains Phase 1.6 (isolation decision) and Phase 6 gains report-copy + cleanup instructions. The agent file gains worktree management sections (context detection, stale worktree handling, creation, cleanup). Session variables track isolation state. The README documents the feature for users.

**Tech Stack:** Git worktrees, Bash, markdown

---

### Task 1: Add Phase 1.6 (Isolation Decision) to the methodology skill

**Files:**
- Modify: `plugins/deep-inquiry/skills/deep-inquiry-methodology/SKILL.md:71-76`

**Step 1: Add Phase 1.6 after the existing Phase 1.5 block**

After line 74 (`Get explicit confirmation before proceeding.`), before the `---` on line 76, insert:

```markdown
### 1.6 Isolation Decision

Detect whether you are already inside a git worktree:

```bash
GIT_DIR=$(git rev-parse --git-dir 2>/dev/null)
GIT_COMMON=$(git rev-parse --git-common-dir 2>/dev/null)
```

**If `GIT_DIR` ≠ `GIT_COMMON` → you are in a worktree.** Work in-place. The user already
has isolation. Record `isolation_mode: in-place` in session variables and skip the rest of
this phase.

**If `GIT_DIR` = `GIT_COMMON` → you are in the main tree.** Offer a worktree based on
investigation mode:

| Mode | Framing |
|---|---|
| Code / Mixed | *"This investigation may modify source files. I recommend an isolated worktree so your main tree stays clean. Use a worktree? (yes/no)"* |
| Reasoning / Evidence | *"This investigation only creates markdown files. Want to isolate it in a worktree anyway? (yes/no)"* |

Record the user's choice as `isolation_mode: worktree` or `isolation_mode: in-place`.

Also discover and record the main tree path (needed for report copy):

```bash
MAIN_TREE=$(git worktree list --porcelain | head -1 | sed 's/^worktree //')
```

Record as session variable `main_tree_path`.
```

**Step 2: Add isolation_mode and main_tree_path to the Session Variables list**

In the "Session Variables" section (lines 22-34), add two new entries after the review budget line:

```markdown
- **Isolation mode**: `worktree` or `in-place` — whether the investigation runs in its own worktree
- **Main tree path**: Absolute path to the main working tree (for report copy at conclusion)
```

**Step 3: Add isolation_mode to the Session Variables table in the iteration README template**

In the iteration README template (lines 332-339), add a row to the session variables table:

```markdown
| Isolation mode | worktree / in-place |
| Main tree path | /absolute/path |
```

**Step 4: Run a quick sanity check**

Verify the SKILL.md file is valid markdown by reading it back and checking the Phase 1
section flows 1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → Phase 2.

**Step 5: Commit**

```bash
git add plugins/deep-inquiry/skills/deep-inquiry-methodology/SKILL.md
git commit -m "feat(deep-inquiry): add Phase 1.6 isolation decision to methodology"
```

---

### Task 2: Add worktree management sections to the agent file

**Files:**
- Modify: `plugins/deep-inquiry/agents/deep-inquiry.md:150-168`

**Step 1: Add "Worktree Isolation" section after "File Structure Convention"**

After the existing "File Structure Convention" section (ends at line 168 with `---`), insert
a new section before "Phase 5: Generating the Iteration Report":

```markdown
## Worktree Isolation

The agent manages its own worktrees to isolate investigations from the main tree. It ONLY
manages worktrees matching `.claude/worktrees/inquiry-*` — never touches anything else.

### Stale Worktree Detection (Phase 1, before domain scoping)

Only when `isolation_mode` will be evaluated (i.e., in the main tree). Before asking any
Phase 1 questions, check for leftover inquiry worktrees:

```bash
git worktree list | grep '\.claude/worktrees/inquiry-'
```

If any are found, ask the user:

> Found existing inquiry worktree(s):
> - `.claude/worktrees/inquiry-<topic>` (branch `inquiry/<topic>`)
>
> Options:
> 1. **Continue** — build on the previous investigation (reuse the worktree)
> 2. **Start fresh** — remove the old worktree and begin a new inquiry
> 3. **Keep both** — leave the old one, create a new worktree for this inquiry

If "Start fresh": remove the stale worktree(s) matching `inquiry-*`:

```bash
git worktree remove "$MAIN_TREE/.claude/worktrees/inquiry-<old-topic>"
git branch -D "inquiry/<old-topic>"
```

### Worktree Creation (Phase 2, if isolation_mode = worktree)

At the start of Phase 2 (Setup), before creating the `inquiry/` directory structure:

```bash
MAIN_TREE=$(git worktree list --porcelain | head -1 | sed 's/^worktree //')
git worktree add "$MAIN_TREE/.claude/worktrees/inquiry-<topic>" -b "inquiry/<topic>"
cd "$MAIN_TREE/.claude/worktrees/inquiry-<topic>"
```

Then proceed with the normal Phase 2 directory creation (`inquiry/<topic>/iteration_1/` etc.)
inside the worktree.

### Report Copy (Phase 6, on conclusion)

When the investigation concludes (Done / Pause / Abandon with no further iterations), after
generating the summary report, copy it to the main tree:

```bash
MAIN_TREE=$(git worktree list --porcelain | head -1 | sed 's/^worktree //')
mkdir -p "$MAIN_TREE/inquiry/<topic>"
cp "inquiry/<topic>/report.html" "$MAIN_TREE/inquiry/<topic>/report.html"
```

Tell the user:

> *Summary report copied to `inquiry/<topic>/report.html` in your main working tree.
> It has not been git-added — you can decide whether to commit it.*

This applies regardless of isolation mode. If working in-place, `$MAIN_TREE` is the current
directory and the copy is a no-op (the report is already there).

### Cleanup (user-initiated)

The agent never auto-cleans worktrees. On conclusion (if a worktree was created), print:

> *The investigation worktree is still at `.claude/worktrees/inquiry-<topic>` — you can
> inspect iteration files, code changes, and diffs there.*
>
> *When you're ready to clean up:*
> ```
> @deep-inquiry clean up the <topic> worktree
> ```
> *Or manually:*
> ```
> git worktree remove .claude/worktrees/inquiry-<topic>
> git branch -D inquiry/<topic>
> ```

When the agent receives a cleanup request:

1. Verify the target matches `.claude/worktrees/inquiry-*` — **refuse** if it does not
2. `cd` to `$MAIN_TREE` (cannot remove a worktree you're standing in)
3. `git worktree remove .claude/worktrees/inquiry-<topic>`
4. `git branch -D inquiry/<topic>`
5. Confirm what was removed
```

**Step 2: Read the file back and verify the new section sits between "File Structure Convention" and "Phase 5: Generating the Iteration Report"**

**Step 3: Commit**

```bash
git add plugins/deep-inquiry/agents/deep-inquiry.md
git commit -m "feat(deep-inquiry): add worktree management to agent"
```

---

### Task 3: Update Phase 6 in the methodology skill for report copy

**Files:**
- Modify: `plugins/deep-inquiry/skills/deep-inquiry-methodology/SKILL.md:427-449`

**Step 1: Add report copy step to Phase 6 terminal paths**

After the existing decision paths block (line 442) and before "If creating a new iteration" (line 444), insert:

```markdown
5. **If concluding (Done / Pause / Abandon)**:
   - Generate the summary report (see "Auto-Generating the Summary Report" in the agent file)
   - If `isolation_mode` = `worktree`: copy `inquiry/<topic>/report.html` to `$main_tree_path/inquiry/<topic>/report.html`
   - Tell the user the report location in their main tree (not git-added)
   - If a worktree was created: print inspection and cleanup instructions (see agent file)
```

**Step 2: Read the file back and verify Phase 6 flows logically**

**Step 3: Commit**

```bash
git add plugins/deep-inquiry/skills/deep-inquiry-methodology/SKILL.md
git commit -m "feat(deep-inquiry): add report copy and cleanup to Phase 6"
```

---

### Task 4: Update the README to document worktree isolation

**Files:**
- Modify: `plugins/deep-inquiry/README.md:164-180`

**Step 1: Add a "Worktree Isolation" section after the "OpenRouter Requirement" section**

After the OpenRouter troubleshooting table (line 163), before the `---` on line 164, insert:

```markdown
## Worktree Isolation

Investigations are exploratory — they shouldn't permanently change your working tree. Deep
Inquiry automatically offers to run in a git worktree when you're on the main tree.

### How it works

| You're in... | What happens |
|---|---|
| **Main tree** | Agent offers a worktree (recommends it for Code/Mixed mode) |
| **An existing worktree** | Agent works in-place — you already have isolation |

If you accept, the agent creates `.claude/worktrees/inquiry-<topic>` with a dedicated
branch. All investigation artifacts (code experiments, profiling scripts, modified source
files) stay isolated there.

### What survives

The **summary report** (`inquiry/<topic>/report.html`) is automatically copied to your
main working tree when the investigation concludes. It is not git-added — you decide
whether to commit it.

### Inspecting and cleaning up

After the investigation, the worktree remains available for inspection. You can browse
the iteration files, review code changes, and check diffs.

When you're done inspecting:

```
@deep-inquiry clean up the <topic> worktree
```

Or manually:

```bash
git worktree remove .claude/worktrees/inquiry-<topic>
git branch -D inquiry/<topic>
```

### Resuming previous investigations

If you start a new inquiry and a previous inquiry worktree exists, the agent will ask
whether to continue the old investigation, start fresh (removing the old worktree), or
keep both side by side.
```

**Step 2: Update the "Output Structure" section to mention worktree context**

In the existing "Output Structure" section (line 166-179), update the intro text:

Replace:
```
All investigation work is written to the current working directory:
```

With:
```
All investigation work is written to the working directory (either the main tree or an
inquiry worktree, depending on your isolation choice):
```

**Step 3: Update the "Reports" section to mention auto-generation and report copy**

In the existing "Reports" section (lines 183-204), replace the paragraph about invoking
the reporter:

Replace:
```
For a richer summary across all iterations, invoke the reporter agent:

```
@deep-inquiry-reporter
```

This reads all finished iteration data and produces `inquiry/<topic>/report.html` — a full
arc view with iteration timeline, insight gallery, decision log, and lessons learned.
```

With:
```
A multi-iteration summary report is automatically generated when the investigation concludes.
If a worktree was used, the report is copied to `inquiry/<topic>/report.html` in your main
tree. The `@deep-inquiry-reporter` agent can also be invoked manually at any time for
on-demand reports.
```

**Step 4: Read the file back, verify section order and formatting**

**Step 5: Commit**

```bash
git add plugins/deep-inquiry/README.md
git commit -m "docs(deep-inquiry): document worktree isolation feature"
```

---

### Task 5: Final review

**Step 1: Read all three modified files in full**

- `plugins/deep-inquiry/agents/deep-inquiry.md`
- `plugins/deep-inquiry/skills/deep-inquiry-methodology/SKILL.md`
- `plugins/deep-inquiry/README.md`

**Step 2: Verify consistency**

Check that:
- Phase numbering is consistent (1.1–1.6, 2–6) across skill and agent
- Session variables list in skill matches the template table
- Report copy instructions in agent and skill don't contradict
- README accurately reflects what the agent/skill actually do
- The `.claude/worktrees/inquiry-*` naming convention is used consistently everywhere
- Cleanup instructions reference `git branch -D` (not `-d`)
- The safety invariant ("only manages `inquiry-*` worktrees") is stated in both agent and README

**Step 3: Fix any inconsistencies found, commit if changes made**
