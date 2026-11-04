import bcrypt from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { findSession } from "@/lib/auth/session";
import { signInStaff } from "@/lib/auth/staff-service";
import { db } from "@/lib/db/client";

const PASSWORD = "correct horse battery";

beforeAll(async () => {
  const passwordHash = await bcrypt.hash(PASSWORD, 4);
  await db.staffUser.createMany({
    data: [
      { email: "desk@test.lab", name: "Desk", passwordHash, role: "FRONT_DESK" },
      { email: "lock@test.lab", name: "Lock", passwordHash, role: "FRONT_DESK" },
      { email: "off@test.lab", name: "Off", passwordHash, role: "FRONT_DESK", active: false },
    ],
    skipDuplicates: true,
  });
});
afterAll(() => db.$disconnect());

describe("staff sign-in", () => {
  it("opens a staff session with the right password and logs it", async () => {
    const result = await signInStaff({ email: "Desk@Test.lab ", password: PASSWORD });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((await findSession(result.token))?.kind).toBe("STAFF");
    expect(await db.accessLog.count({ where: { action: "STAFF_SIGNED_IN" } })).toBe(1);
  });

  it("gives the same answer for an unknown email and a wrong password", async () => {
    const unknown = await signInStaff({ email: "nobody@test.lab", password: PASSWORD });
    const wrong = await signInStaff({ email: "desk@test.lab", password: "nope" });
    expect(unknown).toEqual({ ok: false, reason: "WRONG" });
    expect(wrong).toEqual({ ok: false, reason: "WRONG" });
  });

  it("refuses a disabled account", async () => {
    expect(await signInStaff({ email: "off@test.lab", password: PASSWORD })).toEqual({
      ok: false,
      reason: "WRONG",
    });
  });

  it("locks the account for 15 minutes after 5 wrong passwords, even for the right one", async () => {
    for (let i = 0; i < 5; i++) await signInStaff({ email: "lock@test.lab", password: "nope" });
    const result = await signInStaff({ email: "lock@test.lab", password: PASSWORD });
    expect(result).toMatchObject({ ok: false, reason: "LOCKED" });
    const user = await db.staffUser.findUniqueOrThrow({ where: { email: "lock@test.lab" } });
    const minutes = (user.lockedUntil!.getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(14);
    expect(minutes).toBeLessThanOrEqual(15);
  });
});
