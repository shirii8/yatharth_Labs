import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

// Fixed, obviously fake keys for tests only. Real keys live in .env and never in git.
const testEnv = {
  NODE_ENV: "test" as const,
  DATABASE_URL:
    process.env.TEST_DATABASE_URL ??
    "postgresql://yatharth:yatharth_local_only@localhost:5433/yatharth_test",
  SESSION_SECRET: "test-session-secret-0123456789abcdef",
  PHONE_HASH_KEY: "test-phone-hash-key-0123456789abcdef",
  PHONE_ENC_KEY: Buffer.alloc(32, 7).toString("base64"),
  TOKEN_HASH_KEY: "test-token-hash-key-0123456789abcdef",
  APP_BASE_URL: "http://localhost:3000",
  AI_PROVIDER: "none",
  DEMO_MODE: "false",
};

export default defineConfig({
  resolve: { alias: { "@": root } },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          // Domain logic is pure and runs in Node, no browser or database needed.
          environment: "node",
          include: ["lib/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "db",
          environment: "node",
          include: ["tests/db/**/*.test.ts"],
          globalSetup: ["tests/db/global-setup.ts"],
          env: testEnv,
          // One database, so files run one after another.
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
