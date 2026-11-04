import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { requestCode, verifyCode } from "@/lib/auth/otp-service";
import { findSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { hashPhone } from "@/lib/domain/phone";
import { importLisCsv } from "@/lib/import/service";
import { MockSmsProvider } from "@/lib/sms/provider";
import { upsertCatalog } from "@/prisma/catalog";

const HEADER =
  "Order ID,Patient,Phone,Age,Sex,Relation,Test Code,Parameter,Result,Reference Range,Status,Referring Doctor,Signed At";
const KNOWN = "+91 91111 00001";
const KNOWN_E164 = "+919111100001";

let clock = new Date("2026-11-04T10:00:00.000Z");
const now = () => clock;
const later = (seconds: number) => {
  clock = new Date(clock.getTime() + seconds * 1000);
};
const sms = new MockSmsProvider();
const lastCode = () => sms.outbox.at(-1)?.body.match(/\b(\d{6})\b/)?.[1];

beforeAll(async () => {
  await upsertCatalog(db);
  await importLisCsv(
    {
      fileName: "otp.csv",
      content: `${HEADER}\nORD-OTP-1,Otp Person,${KNOWN},50,F,Self,CBC,Haemoglobin,13,12.0-15.5,Ready,,`,
    },
    { sms: new MockSmsProvider() },
  );
});
afterAll(() => db.$disconnect());

describe("requestCode", () => {
  it("refuses a number that is not a mobile, in words", async () => {
    expect(await requestCode({ phone: "12345" }, { sms, now })).toEqual({
      ok: false,
      reason: "BAD_PHONE",
    });
  });

  it("sends a six digit code to a known number and stores only its hash", async () => {
    const result = await requestCode({ phone: KNOWN }, { sms, now });
    expect(result.ok).toBe(true);
    const code = lastCode();
    expect(code).toMatch(/^\d{6}$/);
    expect(sms.outbox.at(-1)?.to).toBe(KNOWN_E164);
    const challenge = await db.otpChallenge.findFirstOrThrow({
      where: { phoneHash: hashPhone(KNOWN_E164, process.env.PHONE_HASH_KEY!) },
      orderBy: { createdAt: "desc" },
    });
    expect(challenge.codeHash).not.toContain(code!);
  });

  it("writes OTP_SENT to the access log", async () => {
    expect(await db.accessLog.count({ where: { action: "OTP_SENT" } })).toBeGreaterThan(0);
  });

  it("answers an unknown number exactly like a known one, but sends nothing", async () => {
    const before = sms.outbox.length;
    const result = await requestCode({ phone: "+91 98888 77777" }, { sms, now });
    expect(result).toEqual({ ok: true, resendAt: new Date(clock.getTime() + 60_000) });
    expect(sms.outbox.length).toBe(before);
  });

  it("refuses a resend inside 60 seconds", async () => {
    later(30);
    const result = await requestCode({ phone: KNOWN }, { sms, now });
    expect(result).toMatchObject({ ok: false, reason: "COOLDOWN" });
  });
});

describe("verifyCode", () => {
  it("counts wrong codes and says how many tries are left", async () => {
    later(60);
    await requestCode({ phone: KNOWN }, { sms, now });
    const right = lastCode()!;
    const wrong = right === "000000" ? "111111" : "000000";
    expect(await verifyCode({ phone: KNOWN, code: wrong }, { now })).toEqual({
      ok: false,
      reason: "WRONG",
      attemptsLeft: 4,
    });
  });

  it("signs in with the right code, consumes it and opens a patient session", async () => {
    const result = await verifyCode({ phone: KNOWN, code: lastCode()! }, { now });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const session = await findSession(result.token, now());
    expect(session?.kind).toBe("PATIENT");
    expect(await db.accessLog.count({ where: { action: "OTP_VERIFIED" } })).toBe(1);
  });

  it("refuses the same code a second time", async () => {
    const result = await verifyCode({ phone: KNOWN, code: lastCode()! }, { now });
    expect(result).toMatchObject({ ok: false, reason: "USED" });
  });

  it("refuses an expired code", async () => {
    later(60);
    await requestCode({ phone: KNOWN }, { sms, now });
    const code = lastCode()!;
    later(10 * 60);
    expect(await verifyCode({ phone: KNOWN, code }, { now })).toMatchObject({
      ok: false,
      reason: "EXPIRED",
    });
  });

  it("pauses the number after five wrong codes, even for the right code and new codes", async () => {
    later(60);
    await requestCode({ phone: KNOWN }, { sms, now });
    const right = lastCode()!;
    const wrong = right === "000000" ? "111111" : "000000";
    for (let i = 0; i < 4; i++) await verifyCode({ phone: KNOWN, code: wrong }, { now });
    const fifth = await verifyCode({ phone: KNOWN, code: wrong }, { now });
    expect(fifth).toMatchObject({ ok: false, reason: "LOCKED" });
    expect(await verifyCode({ phone: KNOWN, code: right }, { now })).toMatchObject({
      ok: false,
      reason: "LOCKED",
    });
    later(120);
    expect(await requestCode({ phone: KNOWN }, { sms, now })).toMatchObject({
      ok: false,
      reason: "LOCKED",
    });
    expect(await db.accessLog.count({ where: { action: "OTP_LOCKED" } })).toBe(1);
  });

  it("lets the number try again after 15 minutes", async () => {
    later(15 * 60);
    expect((await requestCode({ phone: KNOWN }, { sms, now })).ok).toBe(true);
  });
});
