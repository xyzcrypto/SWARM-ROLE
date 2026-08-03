import { describe, it, expect } from "vitest";
import { withPoolDefaults } from "@/lib/db-url";

const POOLED =
  "postgresql://postgres.abc:pw@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true";

describe("withPoolDefaults", () => {
  it("bounds the pool on a URL that only has pgbouncer=true (the production shape)", () => {
    // `.env.example` ships exactly this, and schema.prisma's own header
    // recommends adding connection_limit - a recommendation that lived only in
    // a comment and was never applied. Unbounded, Prisma opens num_cpus*2+1
    // connections PER warm serverless instance, which is how a free-tier
    // pooler runs out and DB features start failing intermittently.
    const out = new URL(withPoolDefaults(POOLED)!);
    // 5, deliberately not Prisma's serverless default advice of 1 - the app
    // fans out six parallel queries on a single profile page and a limit of 1
    // serializes them. See the note in db-url.ts.
    expect(out.searchParams.get("connection_limit")).toBe("5");
    expect(out.searchParams.get("pool_timeout")).toBe("20");
    // The flag that must survive: without it, pgbouncer breaks prepared
    // statements with "42P05 prepared statement s0 already exists".
    expect(out.searchParams.get("pgbouncer")).toBe("true");
  });

  it("never overrides a value an operator set deliberately", () => {
    const out = new URL(withPoolDefaults(`${POOLED}&connection_limit=5&pool_timeout=3`)!);
    expect(out.searchParams.get("connection_limit")).toBe("5");
    expect(out.searchParams.get("pool_timeout")).toBe("3");
  });

  it("keeps every other part of the URL intact", () => {
    const out = new URL(withPoolDefaults(POOLED)!);
    expect(out.protocol).toBe("postgresql:");
    expect(out.hostname).toBe("aws-0-ap-south-1.pooler.supabase.com");
    expect(out.port).toBe("6543");
    expect(out.pathname).toBe("/postgres");
    expect(out.username).toBe("postgres.abc");
  });

  it("passes an unparseable value through rather than masking Prisma's own error", () => {
    expect(withPoolDefaults("not a url")).toBe("not a url");
  });

  it("returns undefined for an unset variable, so Prisma falls back to the schema", () => {
    expect(withPoolDefaults(undefined)).toBeUndefined();
    expect(withPoolDefaults(null)).toBeUndefined();
    expect(withPoolDefaults("")).toBeUndefined();
  });
});
