# XYZ Sentinel — AI Security & Monitoring

A layered "watch the site + alert me" system. **Honest scope:** no AI guarantees
zero-hack — real protection is layered defense + monitoring + fast alerts. Sentinel
gives you all three. It is **detect + alert only** (it never changes your code or
data). Three layers:

## 1. Proactive scanning (in CI) — catch issues before they ship
- **CodeQL** (`.github/workflows/security.yml`) — GitHub's static analyser scans
  every push/PR to `main` (and weekly) for security bugs in the JS/TS. Findings
  show in the repo **Security → Code scanning** tab.
- **npm audit** — reports vulnerable dependencies (high/critical) in CI logs.
- **Dependency updates** — done **manually** by the owner/engineer, deliberately.
  (Dependabot's automated version-bump PRs were removed — the grouped bumps kept
  proposing risky major upgrades, e.g. Tailwind 3→4 / Next 14→16, that would break
  the UI/build, plus each PR spun up a Vercel preview deploy.) You can still enable
  **Dependabot *alerts*** in repo settings — those are notification-only (they flag
  vulnerable deps without opening any PR), which is the safe half.

## 2. Live AI Watchdog — reads signals, judges, alerts you
- `.github/workflows/watchdog.yml` runs every ~30 min and pings
  `/api/watchdog` (`src/app/api/watchdog/route.ts`, secured by `CRON_SECRET`).
- It reads live signals (`src/lib/security-signals.ts`): locked accounts /
  brute-force, OTP attempt spikes (credential-stuffing), AI error-rate + daily
  cost spikes, sensitive admin actions, and config health (is rate-limiting live?
  is Sentry on?).
- Deterministic rules score a **severity** (ok / info / warn / critical); the AI
  (`completeText`) adds a short plain-English analysis + recommended action.
- On a **new** warn/critical (deduped against the previous run), it alerts you via
  **email + Telegram** (`src/lib/notify-owner.ts`). Every run is saved to
  `WatchdogRun` for history.

## 3. Real-time crash alerts (Sentry)
- Already wired in code (`sentry.*.config.ts`). Set the DSN to turn it on; Sentinel
  reports "Sentry not configured" as a health flag until you do.

---

## Owner setup (one-time)

### A. Vercel env (Production)
| Var | What | Where to get it |
|---|---|---|
| `CRON_SECRET` | shared secret the cron uses to call the watchdog | make up a long random string (same as push-dispatch uses) |
| `TELEGRAM_BOT_TOKEN` | your alert bot | Telegram → **@BotFather** → `/newbot` → copy token |
| `TELEGRAM_CHAT_ID` | where alerts go | message your bot once, then open `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy `chat.id` |
| `RESEND_API_KEY` | email alerts | Resend dashboard (already used for OTP email) |
| `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` | crash alerts | Sentry project settings |

### B. GitHub repo
1. **Settings → Secrets and variables → Actions:** add `PROD_URL` (e.g.
   `https://xyzcrypto.io`, no trailing slash) and `CRON_SECRET` (same value as Vercel).
2. **Settings → Code security:** enable **Secret scanning** + **Push protection**.
   Optionally enable **Dependabot alerts** (notification-only — flags vulnerable
   deps, does NOT open PRs). Automated Dependabot version-update PRs are off by
   design; update dependencies manually when you choose to.
3. The `security.yml` + `watchdog.yml` workflows run automatically once merged.

### C. Database
Apply migration **21** (`prisma/migrations/21_watchdog_runs`) — `npm run db:push`
or paste the SQL in the Supabase SQL editor. (The watchdog still runs + alerts
before this; it just can't store history/dedupe until applied.)

### Test it
After the envs are set: GitHub → **Actions → XYZ Sentinel → Run workflow**
(`workflow_dispatch`). If any signal trips warn+, you'll get an email + Telegram
within a minute. With everything healthy it silently records `severity: ok`.

## Not included (later)
Autonomous code auto-fix (by design — you/an engineer fix; no automated dependency
PRs). A dashboard "Security" tab reading `WatchdogRun` is an easy follow-up.
