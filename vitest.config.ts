import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    // Domain logic is pure and runs in Node, no browser needed.
    environment: "node",
    include: ["lib/**/*.test.ts", "tests/**/*.test.ts"],
    // Until the first rule test lands in the next commit.
    passWithNoTests: true,
  },
});
