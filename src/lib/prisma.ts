import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function resolveRuntimeDatabaseUrl() {
  const runtimeOverride = process.env.PRISMA_RUNTIME_DATABASE_URL?.trim();

  if (runtimeOverride) {
    return runtimeOverride;
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  const directUrl = process.env.DIRECT_URL?.trim();

  if (
    process.env.NODE_ENV === "development" &&
    directUrl &&
    databaseUrl &&
    /pooler\.supabase\.com:6543/i.test(databaseUrl)
  ) {
    return directUrl;
  }

  return databaseUrl;
}

const runtimeDatabaseUrl = resolveRuntimeDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(runtimeDatabaseUrl
      ? {
          datasources: {
            db: {
              url: runtimeDatabaseUrl,
            },
          },
        }
      : {}),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
