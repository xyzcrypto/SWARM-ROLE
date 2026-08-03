import { PrismaClient } from "@prisma/client";
import { withPoolDefaults } from "@shared/utils/db-url";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * The datasource URL is rewritten with serverless-safe pool defaults - see
 * `withPoolDefaults`. Without a `connection_limit`, Prisma opens up to
 * `num_cpus * 2 + 1` pooler connections *per warm function instance*, which is
 * how a Supabase free-tier pooler runs out and DB-backed features start failing
 * intermittently rather than cleanly.
 */
const url = withPoolDefaults(process.env.DATABASE_URL);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    // Only override the datasource when there is a URL to override it WITH.
    // `{ url: undefined }` is a constructor error, not a fallback - the unit
    // suite caught exactly that, because several tests import modules that
    // touch this client with no DATABASE_URL set. Omitting the key leaves
    // schema.prisma's `env("DATABASE_URL")` in charge, as before.
    ...(url ? { datasources: { db: { url } } } : {}),
  });

// Cached on globalThis in every environment, not just development. The dev
// reason (hot reload creating a client per reload) is real, but so is the
// serverless one: anything that re-evaluates this module in a warm instance
// would otherwise build a SECOND client with its own pool, doubling that
// instance's connection footprint against the very limit above.
globalForPrisma.prisma = prisma;
