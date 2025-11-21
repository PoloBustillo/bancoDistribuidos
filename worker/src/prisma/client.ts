import { PrismaClient } from "@prisma/client";

declare global {
  // allow global `var` across module reloads in dev
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Prisma 6: Cliente simple
const prisma = globalThis.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV === "development") {
  // @ts-ignore
  globalThis.__prisma = prisma;
}

export default prisma;
