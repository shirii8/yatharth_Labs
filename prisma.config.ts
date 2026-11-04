import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  // One file per group of tables, so each group can be read on its own.
  schema: "prisma/schema",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations need a session connection; the transaction pooler does not support them.
    // Read without failing when unset, because `prisma generate` (run on every install)
    // never connects. Commands that do connect fail with a clear message instead.
    url: process.env.DIRECT_URL ?? "",
  },
});
