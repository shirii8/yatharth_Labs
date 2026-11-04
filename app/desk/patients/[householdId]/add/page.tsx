import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DeskShell } from "@/components/staff/DeskShell";
import { requireStaff } from "@/lib/auth/staff-guard";
import { db } from "@/lib/db/client";
import { AddFamilyForm } from "./form";

export const metadata: Metadata = { title: "Add a family member" };

/** Adds a person to an existing number, for example a parent whose tests are booked on it. */
export default async function AddFamilyPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { staff } = await requireStaff("addFamily");
  const { householdId } = await params;
  const household = await db.household.findUnique({
    where: { id: householdId },
    include: { patients: true },
  });
  if (!household) notFound();

  return (
    <DeskShell staff={staff} current="/desk/patients">
      <AddFamilyForm
        householdId={householdId}
        phone={household.phoneMasked}
        family={household.patients.map((p) => `${p.name} (${p.age})`).join(", ")}
      />
    </DeskShell>
  );
}
