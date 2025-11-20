// Prisma configuration for runtime connection string
// See: https://pris.ly/d/config-datasource

import { env } from "process";

export const databaseUrl =
  env.DATABASE_URL || "postgresql://user:password@localhost:5432/banco";

export default {
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
};
