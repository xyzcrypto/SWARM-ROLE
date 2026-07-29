# Pre-Merge Cost & Performance Checks — xyzcrypto.io

**This procedure now lives as a project skill.** It moved out of `docs/` on
2026-07-29 so it loads automatically instead of depending on someone remembering to
name this file in a prompt.

| What | Where |
|---|---|
| The procedure — six steps, scaling table, standing rules | `.claude/skills/pre-merge/SKILL.md` |
| The numbers — route baseline, ISR windows, cost traps, bundle-size blind spot | `.claude/skills/cost-check/SKILL.md` |

Both are committed to the repo, so any Claude session from any account picks them up
without being told.

## Why this file is a pointer and not a copy

Keeping a second full copy of the procedure is how the two versions drift apart, and
drift is the exact failure this check exists to catch. One fact, one home.

This stub remains so the GitBook handbook keeps a working entry under **Operations &
Security**, and so a human reading the docs finds the trail.

## For a human reading the docs, in short

CI (`typecheck → lint → test → build`) proves nothing broke. It cannot see a page
that stopped being cached, a new polling loop, or a bundle that grew — those surface
as a Vercel usage overage days later, not as a red check.

So before merging anything that touches routes, caching, data fetching or realtime:
build `main` and the branch, diff the route tables, scan the diff for cost patterns,
and read the diff yourself. **Green CI is not permission to merge.**

Ask Claude to *"run the pre-merge checks"* on the branch and the skill will do it.
