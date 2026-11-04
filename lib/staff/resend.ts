import { db } from "@/lib/db/client";
import { decryptPhone } from "@/lib/domain/phone";
import { generateToken, hashSecret, linkExpiresAt } from "@/lib/domain/tokens";
import { env } from "@/lib/env";
import { linkMessage } from "@/lib/import/message";
import { smsProvider, type SmsProvider } from "@/lib/sms/provider";

/**
 * "Resend link" on the patient desk. The old link stops working at once, a new
 * 72 hour link is created and logged with the staff member's id in one
 * transaction, then the SMS is sent and its delivery recorded.
 */
export async function resendLink(
  reportId: string,
  staffUserId: string,
  deps: { sms?: SmsProvider; now?: Date } = {},
): Promise<{ ok: true } | { ok: false; reason: "NOT_FOUND" | "NOT_SIGNED" | "NO_CONSENT" }> {
  const keys = env();
  const now = deps.now ?? new Date();
  const report = await db.report.findUnique({
    where: { id: reportId },
    include: { patient: { include: { household: true } }, test: true },
  });
  if (!report) return { ok: false, reason: "NOT_FOUND" };
  if (report.status !== "SIGNED") return { ok: false, reason: "NOT_SIGNED" };
  if (report.patient.household.consentWithdrawnAt) return { ok: false, reason: "NO_CONSENT" };

  const token = generateToken();
  const link = await db.$transaction(async (tx) => {
    await tx.reportLink.updateMany({
      where: { reportId, revokedAt: null },
      data: { revokedAt: now },
    });
    const created = await tx.reportLink.create({
      data: {
        reportId,
        tokenHash: hashSecret(token, keys.TOKEN_HASH_KEY),
        expiresAt: linkExpiresAt(now),
        createdById: staffUserId,
        createdAt: now,
      },
    });
    await tx.accessLog.create({
      data: {
        actorType: "STAFF",
        actorId: staffUserId,
        action: "LINK_RESENT",
        householdId: report.patient.householdId,
        patientId: report.patientId,
        reportId,
        detail: { linkId: created.id },
      },
    });
    return created;
  });

  const phone = decryptPhone(report.patient.household.phoneCipher, keys.PHONE_ENC_KEY);
  let status: "SENT" | "DELIVERED" | "FAILED" = "FAILED";
  let messageId: string | null = null;
  try {
    const sent = await (deps.sms ?? smsProvider()).send(
      phone,
      linkMessage({
        patientName: report.patient.name,
        testName: report.test.name,
        url: `${keys.APP_BASE_URL}/r/${token}`,
      }),
    );
    status = sent.status;
    messageId = sent.messageId;
  } catch {
    status = "FAILED";
  }
  await db.reportLink.update({
    where: { id: link.id },
    data: {
      deliveryStatus: status,
      providerMessageId: messageId,
      sentAt: status === "FAILED" ? null : new Date(),
      deliveredAt: status === "DELIVERED" ? new Date() : null,
    },
  });
  return { ok: true };
}
