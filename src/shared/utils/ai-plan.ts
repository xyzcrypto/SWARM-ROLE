// Which AI plan a member is on. Pure and client-safe on purpose: `@/lib/ai/gateway`
// pulls in the provider registry and usage recording (and through those, prisma),
// so a "use client" component cannot import it. The widget needs this to label a
// member's plan honestly - reading `session.membership` alone told an admin they
// were on "Premium" when the server was actually giving them the Admin allowance.

export type AiPlan = "Free" | "Premium" | "Admin";

export function aiPlanFor(
  u: { membership?: string | null; role?: string | null; isSuperAdmin?: boolean | null } | null
): AiPlan {
  if (!u) return "Free";
  if (u.isSuperAdmin || u.role === "ADMIN") return "Admin";
  return u.membership === "Premium" ? "Premium" : "Free";
}
