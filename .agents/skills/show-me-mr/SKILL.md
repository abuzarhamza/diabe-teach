---
name: show-me-mr
description: Help a reviewer understand a merge request (GitHub PR, GitLab MR, or local branch) with STE-style writing, diagrams, a Markdown explainer file, an interactive HTML explainer, and an optional narrated video.
disable-model-invocation: true
argument-hint: "[PR/MR number | URL | branch] [text|diagram|html|video] [--post]"
---

# Show me the merge request

Help the user understand a merge request. Work up this ladder of formats and stop at the lowest level that makes the change clear:

1. **Text**: a short explanation in simplified technical English
2. **Diagram**: code-shape sketches and Mermaid
3. **HTML**: one interactive explainer page
4. **Video**: a narrated, animated explainer (only when the user asks for it)

Skip the preamble. Keep prose brief. Do not review for bugs unless the user asks. The goal is understanding, not judgement.

`{SKILLBASE}` is the directory that contains this SKILL.md.

## Arguments

Parse `$ARGUMENTS`:

- A number, PR/MR URL, or branch name selects the change. With no target, use the current branch.
- `text`, `diagram`, `html`, or `video` sets the highest level. The default is `html`. `video` also produces levels 1 to 3.
- `--post` posts `explainer.md` as a comment on the PR/MR. Without it, publish nothing.

## 1. Find the change

Detect the host from `git remote get-url origin`, then collect the metadata and the full diff:

| Host | Metadata | Diff |
|---|---|---|
| GitHub | `gh pr view {n} --json number,title,body,url,baseRefName,headRefName,files,commits` | `gh pr diff {n}` |
| GitLab | `glab mr view {n} --output json` | `glab mr diff {n}` |
| Local / no CLI | `git log --oneline {base}..HEAD` | `git diff {base}...HEAD` |

- With no target on GitHub/GitLab, look up the PR/MR for the current branch first. If none exists, use the local row.
- For a local diff, set `{base}` from `git symbolic-ref refs/remotes/origin/HEAD`, else `main`, else `master`.
- If the CLI is missing or not authenticated, say so in one line and use the local row.
- Read the linked ticket, the PR/MR body, and enough of the surrounding code to understand behavior and ownership. Do not stop at the diff.
- For a large diff (more than ~1500 changed lines), group files by responsibility first. Read the core files in full and skim generated files, lockfiles, and snapshots.

## 2. Level 1: Text

Read `{SKILLBASE}/references/ste-writing.md` and write in that style. Use this shape:

```markdown
## What this change does
{1 to 3 STE sentences.}

## Why
{1 STE sentence.}

## Read this first
- {1 to 3 warnings: migrations, breaking changes, feature flags, deliberate omissions, surprising decisions. Write "None." if there are none.}

## Review order
1. `{path}`: {what to check in this file, one sentence}
```

The review order is the most useful part for a reviewer. List the files in the order that tells the story, which is usually contract → data → logic → callers → tests. Leave out generated files.

## 3. Level 2: Diagram

Read `{SKILLBASE}/references/views.md`. Choose 1 to 3 views that show the shape of the change. Use `diff` blocks for changes to an existing shape. Place each view next to the sentence it supports.

## 4. Markdown file (always)

Read `{SKILLBASE}/references/markdown-explainer.md`. Write the level 1 text and level 2 views to `.show-me/mr-{number-or-branch}/explainer.md`. Do this at every level, including `text`. Update the footer links after you make the HTML page or the video.

## 5. Level 3: HTML

Read `{SKILLBASE}/references/html-explainer.md`. Write one self-contained file to `.show-me/mr-{number-or-branch}/index.html`, then open it:

```
Bash(open .show-me/mr-{id}/index.html)          # macOS
Bash(xdg-open .show-me/mr-{id}/index.html)      # Linux
```

If `.show-me/` is not in `.gitignore`, tell the user, and do not edit `.gitignore` yourself.

## 6. Level 4: Video (opt-in)

Only when the arguments include `video` or the user asks for one: read `{SKILLBASE}/references/video-explainer.md` and follow it. Before you render, tell the user which tools you will use and whether audio narration will call a paid API.

## 7. Post (only with `--post`)

- Post `explainer.md` without its footer line. Show the user the exact comment body and ask them to confirm before you post it.
- GitHub: `gh pr comment {n} --body-file {file}`. GitLab: `glab mr note {n} --message "$(cat {file})"`.
- Never edit the PR/MR title or description. Never push, merge, or approve.

## Final answer

Keep it short. Give the level 1 text and level 2 views inline, then:

```markdown
- Markdown: `.show-me/mr-{id}/explainer.md`
- Explainer: `.show-me/mr-{id}/index.html`  (only if made)
- Video: `.show-me/mr-{id}/explainer.mp4`   (only if made)
- Posted: {comment URL}                     (only if posted)
```

Use your judgement. Most merge requests need levels 1 and 2 and a small HTML page. Do not overwhelm the reader.
