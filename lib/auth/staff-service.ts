import bcrypt from "bcryptjs";
import { db } from "@/lib/db/client";
import type { StaffRole } from "./roles";
import { createSession } from "./session";

/**
 * Staff sign-in by email and password (bcrypt). Five wrong passwords in a row
 * lock the account for 15 minutes. An unknown or disabled email gets the same
 * answer as a wrong password, after the same amount of work.
 */

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
// A real bcrypt hash, made once, so an unknown email costs the same time as a wrong password.
let dummyHash: string | undefined;
const dummy = () => (dummyHash ??= bcrypt.hashSync("not-a-real-password", 12));
export type StaffSignIn =
  | { ok: true; token: string; expiresAt: Date; staffUserId: string; role: StaffRole }
  | { ok: false; reason: "WRONG" }
  | { ok: false; reason: "LOCKED"; until: Date };

export async function signInStaff(input: {
  email: string;
  password: string;
  ipHash?: string;
}): Promise<StaffSignIn> {
  const now = new Date();
  const email = input.email.trim().toLowerCase();
  const user = await db.staffUser.findUnique({ where: { email } });

  if (!user || !user.active) {
    await bcrypt.compare(input.password, dummy());
    return { ok: false, reason: "WRONG" };
  }
  if (user.lockedUntil && user.lockedUntil > now) {
    return { ok: false, reason: "LOCKED", until: user.lockedUntil };
  }

  const right = await bcrypt.compare(input.password, user.passwordHash);
  if (!right) {
    const failed = user.failedLogins + 1;
    const lock = failed >= MAX_FAILED;
    await db.staffUser.update({
      where: { id: user.id },
      data: {
        failedLogins: lock ? 0 : failed,
        lockedUntil: lock ? new Date(now.getTime() + LOCK_MINUTES * 60_000) : null,
      },
    });
    return { ok: false, reason: "WRONG" };
  }

  return db.$transaction(async (tx) => {
    await tx.staffUser.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null },
    });
    await tx.accessLog.create({
      data: {
        actorType: "STAFF",
        actorId: user.id,
        action: "STAFF_SIGNED_IN",
        ipHash: input.ipHash,
      },
    });
    const session = await createSession({ kind: "STAFF", staffUserId: user.id, now }, tx);
    return { ok: true as const, ...session, staffUserId: user.id, role: user.role };
  });
}
