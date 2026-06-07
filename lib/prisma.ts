// Prisma client singleton. Branches by DATABASE_URL:
//   - prisma+postgres:// (Prisma Postgres) → connect through Accelerate,
//     no local driver adapter.
//   - everything else → direct Postgres (pooled TCP) via @prisma/adapter-pg.
// Cached on globalThis in development so hot reload reuses one instance.
import { Prisma, PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function createPrisma(): PrismaClient {

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  if (connectionString.startsWith("prisma+postgres://")) {
    // Prisma Postgres / Accelerate connection string — the generated client
    // connects through Accelerate; no local pg driver adapter is used.
    return new PrismaClient({ accelerateUrl: connectionString });
  }
  // Direct Postgres via the pg driver adapter.
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

const expectedDelegates = Object.values(Prisma.ModelName).map((model) => model.charAt(0).toLowerCase() + model.slice(1));
const clientSchemaSignature = expectedDelegates.join("|");

function hasExpectedDelegates(client: PrismaClient): boolean {
  return expectedDelegates.every((delegate) => delegate in client);
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaSchemaSignature: string | undefined;
};

function getPrisma(): PrismaClient {
  let cached = globalForPrisma.prisma;

  if (
    process.env.NODE_ENV !== "production" &&
    cached &&
    (globalForPrisma.prismaSchemaSignature !== clientSchemaSignature || !hasExpectedDelegates(cached))
  ) {
    void cached.$disconnect().catch(() => undefined);
    cached = undefined;
    globalForPrisma.prisma = undefined;
    globalForPrisma.prismaSchemaSignature = undefined;
  }

  return cached ?? createPrisma();
}

/** Resolve (and cache) the client on first use, persisting in dev for hot reload. */
function resolvePrisma(): PrismaClient {
  const client = getPrisma();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
    globalForPrisma.prismaSchemaSignature = clientSchemaSignature;
  }
  return client;
}

// Lazy proxy: nothing connects (and DATABASE_URL is never required) until a
// property is actually accessed. Keeps Trigger.dev's task-file indexing — which
// imports this module — from constructing a client at import time.
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = resolvePrisma();
    const value = Reflect.get(client, prop);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
