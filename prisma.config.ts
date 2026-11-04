import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  // One file per group of tables, so each group can be read on its own.
  schema: "prisma/schema",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations need a direct connection; the pooler does not support them.
    url: env("DIRECT_URL"),
  },
});
