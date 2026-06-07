// Prisma client singleton. Supports Prisma Postgres URLs and direct Postgres URLs.
import { Prisma, PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}
const connectionString: string = process.env.DATABASE_URL;

function createPrisma(): PrismaClient {
  if (connectionString.startsWith("prisma+postgres://")) {
    // Prisma Postgres / Accelerate connection string.
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

export const prisma = getPrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaSchemaSignature = clientSchemaSignature;
}
