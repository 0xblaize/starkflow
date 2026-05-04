import { PrismaClient } from "@prisma/client";
import { withTimeout } from "@/lib/promise-timeout";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function resolveRuntimeDatabaseUrl() {
  function tuneDevelopmentConnectionUrl(url: string | undefined) {
    if (!url || process.env.NODE_ENV !== "development") {
      return url;
    }

    try {
      const parsed = new URL(url);

      // Keep the dev server conservative so parallel route hits do not exhaust
      // the Prisma pool while Turbopack hot-reloads.
      if (!parsed.searchParams.has("connection_limit")) {
        parsed.searchParams.set("connection_limit", "2");
      }

      if (!parsed.searchParams.has("pool_timeout")) {
        parsed.searchParams.set("pool_timeout", "5");
      }

      if (!parsed.searchParams.has("connect_timeout")) {
        parsed.searchParams.set("connect_timeout", "5");
      }

      return parsed.toString();
    } catch {
      return url;
    }
  }

  const runtimeOverride = process.env.PRISMA_RUNTIME_DATABASE_URL?.trim();

  if (runtimeOverride) {
    return tuneDevelopmentConnectionUrl(runtimeOverride);
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();

  return tuneDevelopmentConnectionUrl(databaseUrl);
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

function isTransientPrismaConnectionError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("server has closed the connection") ||
    message.includes("can't reach database server") ||
    message.includes("connection reset") ||
    message.includes("connection closed") ||
    message.includes("timed out fetching a new connection from the connection pool") ||
    message.includes("p1017")
  );
}

export async function runPrismaWithRecovery<T>(
  operation: () => Promise<T>,
  {
    timeoutMs = 2_500,
    timeoutLabel = "Database request timed out.",
    retries = 1,
  }: {
    retries?: number;
    timeoutLabel?: string;
    timeoutMs?: number;
  } = {},
): Promise<T> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    try {
      return await withTimeout(operation(), timeoutMs, timeoutLabel);
    } catch (error) {
      lastError = error;

      const isTimeout =
        error instanceof Error && error.message === timeoutLabel;

      if (!isTimeout && !isTransientPrismaConnectionError(error)) {
        throw error;
      }

      if (attempt === retries) {
        throw error;
      }

      try {
        await prisma.$disconnect();
      } catch {
        // Best-effort reset before retrying.
      }
    }

    attempt += 1;
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Database request failed.");
}
