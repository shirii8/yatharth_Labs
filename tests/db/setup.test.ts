import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";

afterAll(() => db.$disconnect());

describe("test database", () => {
  it("has the append-only trigger on the access log", async () => {
    const entry = await db.accessLog.create({
      data: { actorType: "SYSTEM", action: "IMPORT_RUN" },
    });
    await expect(db.accessLog.delete({ where: { id: entry.id } })).rejects.toThrow(/append only/);
    await expect(
      db.accessLog.update({ where: { id: entry.id }, data: { action: "OTP_SENT" } }),
    ).rejects.toThrow(/append only/);
  });
});
