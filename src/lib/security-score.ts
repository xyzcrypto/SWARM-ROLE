// XYZ Sentinel — pure scoring. Kept separate from `security-signals.ts` (which is
// server-only + touches Prisma) so it can be unit-tested and imported anywhere.

export type Signals = {
  windowMinutes: number;
  isProd: boolean;
  lockedAccounts: number; // users currently locked out (lockedUntil > now)
  highFailAccounts: number; // users with failedLoginCount >= 3 (attack in progress)
  otpAttemptsMax: number; // max attempts on any active OTP (spike = code-guessing)
  otpActiveCodes: number; // active OTP codes (flood = signup abuse)
  aiCalls: number; // AiUsage rows in the window
  aiErrors: number; // status="error" in the window
  aiErrorRatePct: number;
  aiCostUsdToday: number; // sum of today's estimated AI spend (USD)
  adminActions: number; // AdminAudit rows in the window (sensitive changes)
  config: { rateLimitLive: boolean; sentryConfigured: boolean; aiEnabled: boolean; pushLive: boolean };
};

export type Severity = "ok" | "info" | "warn" | "critical";
const RANK: Record<Severity, number> = { ok: 0, info: 1, warn: 2, critical: 3 };

// Pure, deterministic hard-rules → severity + human-readable flags. The AI
// summary is advisory; THESE decide whether the owner gets alerted, so the
// watchdog still protects even when AI is disabled.
export function scoreSignals(s: Signals): { severity: Severity; flags: string[] } {
  const flags: string[] = [];
  let sev: Severity = "ok";
  const bump = (to: Severity) => { if (RANK[to] > RANK[sev]) sev = to; };

  // Config health.
  if (s.isProd && !s.config.rateLimitLive) { flags.push("Rate-limiting is OFF in production (Upstash not set) — brute-force protection disabled"); bump("warn"); }
  if (s.isProd && !s.config.sentryConfigured) { flags.push("Sentry crash reporting not configured (no DSN)"); bump("info"); }

  // Brute-force / credential stuffing.
  if (s.lockedAccounts >= 5) { flags.push(`${s.lockedAccounts} accounts currently locked — possible brute-force attack`); bump("critical"); }
  else if (s.lockedAccounts >= 1) { flags.push(`${s.lockedAccounts} account(s) currently locked out`); bump("warn"); }
  if (s.highFailAccounts >= 10) { flags.push(`${s.highFailAccounts} accounts with elevated failed-login counts`); bump("warn"); }

  // OTP abuse.
  if (s.otpAttemptsMax >= 5) { flags.push(`An OTP hit max attempts (${s.otpAttemptsMax}) — possible code-guessing`); bump("warn"); }
  if (s.otpActiveCodes >= 50) { flags.push(`${s.otpActiveCodes} active OTP codes — possible signup flood`); bump("warn"); }

  // AI health / cost.
  if (s.aiCalls >= 20 && s.aiErrorRatePct >= 50) { flags.push(`AI error rate ${s.aiErrorRatePct}% over ${s.aiCalls} calls`); bump("warn"); }
  if (s.aiCostUsdToday >= 20) { flags.push(`AI spend today $${s.aiCostUsdToday} — cost spike`); bump("warn"); }

  // Admin activity — informational (may be legitimate, worth noticing).
  if (s.adminActions >= 1) { flags.push(`${s.adminActions} sensitive admin action(s) in the last ${s.windowMinutes}m`); bump("info"); }

  return { severity: sev, flags };
}
