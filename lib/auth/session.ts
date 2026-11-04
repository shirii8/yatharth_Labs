import { db } from "@/lib/db/client";
import { generateToken, hashSecret } from "@/lib/domain/tokens";
import { env } from "@/lib/env";
import type { Prisma, SessionKind } from "@/lib/generated/prisma/client";

/**
 * Server-side sessions. The browser holds a random token in an httpOnly cookie;
 * the database holds only its hash. A session can therefore be ended from the
 * server at any time, for example when a patient withdraws consent.
 */

const MINUTE = 60_000;

/** Idle timeout and absolute limit for each kind of session. */
export const SESSION_LIMITS: Record<SessionKind, { idleMinutes: number; maxMinutes: number }> = {
  PATIENT: { idleMinutes: 30, maxMinutes: 12 * 60 },
  LINK: { idleMinutes: 30, maxMinutes: 2 * 60 },
  STAFF: { idleMinutes: 2 * 60, maxMinutes: 10 * 60 },
};

export type Session = Prisma.SessionGetPayload<object>;

type Client = Prisma.TransactionClient | typeof db;

export async function createSession(
  input: {
    kind: SessionKind;
    householdId?: string;
    staffUserId?: string;
    reportId?: string;
    patientId?: string;
    now?: Date;
  },
  client: Client = db,
): Promise<{ token: string; expiresAt: Date }> {
  const now = input.now ?? new Date();
  const token = generateToken();
  const expiresAt = new Date(now.getTime() + SESSION_LIMITS[input.kind].idleMinutes * MINUTE);
  await client.session.create({
    data: {
      tokenHash: hashSecret(token, env().SESSION_SECRET),
      kind: input.kind,
      householdId: input.householdId,
      staffUserId: input.staffUserId,
      reportId: input.reportId,
      patientId: input.patientId,
      createdAt: now,
      lastSeenAt: now,
      expiresAt,
    },
  });
  return { token, expiresAt };
}

/** The live session for a token, or null. Extends the idle timeout on use. */
export async function findSession(token: string, now: Date = new Date()): Promise<Session | null> {
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashSecret(token, env().SESSION_SECRET) },
  });
  if (!session || session.revokedAt || session.expiresAt.getTime() <= now.getTime()) return null;

  // Slide the idle timeout, at most once a minute, never past the absolute limit.
  if (now.getTime() - session.lastSeenAt.getTime() > MINUTE) {
    const limits = SESSION_LIMITS[session.kind];
    const expiresAt = new Date(
      Math.min(
        now.getTime() + limits.idleMinutes * MINUTE,
        session.createdAt.getTime() + limits.maxMinutes * MINUTE,
      ),
    );
    return db.session.update({
      where: { id: session.id },
      data: { lastSeenAt: now, expiresAt },
    });
  }
  return session;
}

export async function revokeSession(token: string): Promise<void> {
  await db.session.updateMany({
    where: { tokenHash: hashSecret(token, env().SESSION_SECRET), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Ends every session of a household, for example when consent is withdrawn. */
export async function revokeHouseholdSessions(householdId: string, client: Client = db) {
  await client.session.updateMany({
    where: { householdId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function choosePatient(sessionId: string, patientId: string): Promise<void> {
  await db.session.update({ where: { id: sessionId }, data: { patientId } });
}
