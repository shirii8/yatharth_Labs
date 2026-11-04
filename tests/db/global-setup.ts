import { execSync } from "node:child_process";
import { Client } from "pg";

/**
 * Before database tests: create a fresh, empty database and apply the real
 * migrations, including the append-only trigger. Nothing touches the dev data.
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://yatharth:yatharth_local_only@localhost:5433/yatharth_test";

export default async function setup() {
  const url = new URL(TEST_DATABASE_URL);
  const dbName = url.pathname.slice(1);
  if (!dbName.endsWith("_test")) {
    throw new Error(`Refusing to reset "${dbName}": test database names must end in _test.`);
  }

  const admin = new Client({
    connectionString: TEST_DATABASE_URL.replace(/\/[^/]+$/, "/postgres"),
  });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
  await admin.query(`CREATE DATABASE "${dbName}"`);
  await admin.end();

  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DIRECT_URL: TEST_DATABASE_URL, PRISMA_HIDE_UPDATE_MESSAGE: "1" },
    stdio: "ignore",
  });
}
