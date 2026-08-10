import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError } from "@/lib/api";
import { env, aiEnabled } from "@/lib/env";
import { checkCronAuth, cronAuthFailure, type CronAuth } from "@/core/auth/cron-auth";
import { collectSignals, scoreSignals, type Severity } from "@/lib/security-signals";
import { completeText } from "@/lib/ai";
import { notifyOwner } from "@/lib/notify-owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/watchdog — XYZ Sentinel cron entrypoint (runs every ~30 min via
// .github/workflows/watchdog.yml). Reads live security signals, has the AI judge
// severity, and alerts the owner (email + Telegram) on new warn/critical issues.
// Secured by CRON_SECRET (same pattern as /api/push/dispatch). Detect + alert
// only — it never changes anything.
// See `cron-auth.ts` for why an unset secret and a wrong token no longer answer
// the same thing: they are different problems, and blurring them is what left
// XYZ Sentinel dark for two weeks with no way to tell which one it was.
function authorized(req: Request): CronAuth {
  return checkCronAuth(
    env.CRON_SECRET,
    req.headers.get("authorization"),
    new URL(req.url).searchParams.get("secret")
  );
}

const RANK: Record<Severity, number> = { ok: 0, info: 1, warn: 2, critical: 3 };

export async function GET(req: Request) {
  try {
    const auth = authorized(req);
    if (!auth.ok) {
      const { message, status } = cronAuthFailure(auth.reason);
      return fail(message, status);
    }

    const now = new Date();
    const signals = await collectSignals(now, 60);
    const { severity, flags } = scoreSignals(signals);

    // AI advisory summary (best-effort). Hard-flags decide alerting even if AI is
    // off, so the watchdog still protects without any AI provider configured.
    let summary: string | null = null;
    if (aiEnabled && flags.length > 0) {
      summary = await completeText({
        task: "summary",
        system:
          "You are a concise security operations analyst for a web app. Given tripped rules + metrics, write 1-3 short sentences: what is likely happening and the single most useful action. No preamble, no markdown.",
        prompt: `Severity: ${severity}\nFlags:\n- ${flags.join("\n- ")}\n\nMetrics: ${JSON.stringify(signals)}`,
        maxTokens: 180,
      }).catch(() => null);
    }

    // Dedupe: only alert on warn/critical AND when the flag set changed since the
    // last run, so a persistent condition doesn't re-notify every 30 minutes.
    let prevFlags: string[] = [];
    try {
      const prev = await prisma.watchdogRun.findFirst({ orderBy: { ranAt: "desc" }, select: { flags: true } });
      prevFlags = prev?.flags ?? [];
    } catch {
      /* WatchdogRun table not migrated yet — treat as no history */
    }
    const changed = JSON.stringify([...flags].sort()) !== JSON.stringify([...prevFlags].sort());
    const alerted = RANK[severity] >= RANK.warn && changed;

    if (alerted) {
      const subject = `🛡️ XYZ Sentinel: ${severity.toUpperCase()} — ${flags.length} issue(s)`;
      const text = [
        `Severity: ${severity.toUpperCase()}`,
        "",
        "Issues:",
        ...flags.map((f) => `• ${f}`),
        ...(summary ? ["", `Analysis: ${summary}`] : []),
        "",
        `Window: last ${signals.windowMinutes} min · ${now.toISOString()}`,
      ].join("\n");
      await notifyOwner({ subject, text }).catch(() => null);
    }

    // Persist history (best-effort; no-op until migration 21 is applied).
    try {
      await prisma.watchdogRun.create({
        data: {
          ranAt: now,
          severity,
          flags,
          summary: summary ?? undefined,
          metrics: signals as unknown as Prisma.InputJsonValue,
          alerted,
        },
      });
    } catch {
      /* not migrated — history is optional */
    }

    return ok({ severity, flags, alerted, summary, ranAt: now.toISOString() });
  } catch (err) {
    return handleError(err, "watchdog");
  }
}
