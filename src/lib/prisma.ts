import { PrismaClient } from "@/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

// Reuse a single PrismaClient across hot-reloads in development.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Prisma 7 connects through a driver adapter. We use Neon (serverless Postgres);
// the connection string comes from DATABASE_URL.
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
