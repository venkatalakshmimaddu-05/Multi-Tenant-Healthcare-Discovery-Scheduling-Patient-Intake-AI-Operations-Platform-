import { PrismaClient } from "@prisma/client";
import path from "node:path";
import fs from "node:fs";

function getDatabaseUrl(): string {
  // On Vercel / AWS Lambda, copy bundled SQLite db to writable /tmp
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const tmpPath = "/tmp/dev.db";
    const bundledPath = path.join(process.cwd(), "prisma", "dev.db");
    try {
      if (!fs.existsSync(tmpPath) && fs.existsSync(bundledPath)) {
        fs.copyFileSync(bundledPath, tmpPath);
        console.log(`[Prisma] Initialized /tmp/dev.db from ${bundledPath}`);
      }
      if (fs.existsSync(tmpPath)) {
        return `file:${tmpPath}`;
      }
    } catch (e) {
      console.error("[Prisma] Failed to copy SQLite db to /tmp:", e);
    }
  }

  return process.env.DATABASE_URL || "file:./dev.db";
}

const dbUrl = getDatabaseUrl();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: dbUrl,
      },
    },
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
