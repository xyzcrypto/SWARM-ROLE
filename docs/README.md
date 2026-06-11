# XYZ Crypto — Project Handbook

The complete documentation book for **XYZ Crypto** — a premium Web3 ecosystem
site (research hub, live market data, user accounts & profiles, premium content)
built with Next.js 14, Prisma/Supabase, NextAuth and Tailwind, deployed on Vercel.

This book is **GitBook-compatible**: connect a GitBook space to this GitHub repo
(root: `docs/`) and it renders as a site. It is also the source of truth for any
developer — human or AI — joining the project.

## Start here
- **New session / new account?** → [Handoff & Continuity Guide](HANDOFF.md)
- **What's built and how it looks** → [Project State](project-state.md)
- **Backend & API** → [Backend State](backend-state.md) · [API Reference](api-reference.md)
- **Security posture** → [Security](SECURITY.md)
- **Operations / incidents** → [Runbook](RUNBOOK.md)

## Ground rules
1. `main` is production. Feature branch → PR → CI green → squash-merge.
2. Secrets are **never** committed or documented — env var *names* only; values
   live in the Vercel / Supabase / Upstash / Resend dashboards.
3. Every change keeps `typecheck · lint · test · build` green.
4. Update the [Changelog](changelog.md) after every meaningful change.
