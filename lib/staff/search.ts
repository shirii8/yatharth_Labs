import { db } from "@/lib/db/client";
import { hashPhone, normalisePhone } from "@/lib/domain/phone";
import { env } from "@/lib/env";

/**
 * Patient search for the desk: a full mobile number (matched by its keyed
 * hash, never by reading numbers), the last four digits, or part of a name.
 */
export async function searchHouseholds(query: string) {
  const q = query.trim();
  if (q.length < 2) return [];
  const include = { patients: { orderBy: { createdAt: "asc" as const } } };

  const phone = normalisePhone(q);
  if (phone) {
    const household = await db.household.findUnique({
      where: { phoneHash: hashPhone(phone, env().PHONE_HASH_KEY) },
      include,
    });
    return household ? [household] : [];
  }
  if (/^\d{4}$/.test(q)) {
    return db.household.findMany({ where: { phoneMasked: { endsWith: q } }, include, take: 20 });
  }
  return db.household.findMany({
    where: { patients: { some: { name: { contains: q, mode: "insensitive" } } } },
    include,
    take: 20,
  });
}
