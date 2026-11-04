import type { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * The tests this demo knows. Usual ranges follow the brief's sample data where
 * it gives one. Critical limits are PLACEHOLDERS: the lab doctor must confirm
 * them before go-live (see docs/ASSUMPTIONS.md).
 *
 * "locked" marks tests with doctor-approved wording templates (the brief's top
 * 30). CBC and Electrolytes are locked here; Lipid and Thyroid are not, so the
 * demo shows both the template path and the AI path.
 */

interface AnalyteSeed {
  code: string;
  name: string;
  unit: string;
  refLow: number | null;
  refHigh: number | null;
  criticalLow: number | null;
  criticalHigh: number | null;
  helper: string;
}

export const CATALOG: { code: string; name: string; locked: boolean; analytes: AnalyteSeed[] }[] = [
  {
    code: "CBC",
    name: "Complete Blood Count",
    locked: true,
    analytes: [
      {
        code: "HB",
        name: "Haemoglobin",
        unit: "g/dL",
        refLow: 12.0,
        refHigh: 15.5,
        criticalLow: 7.0,
        criticalHigh: 20.0,
        helper: "Carries oxygen around your body.",
      },
      {
        code: "WBC",
        name: "White blood cells",
        unit: "x10^3/uL",
        refLow: 4.0,
        refHigh: 11.0,
        criticalLow: 2.0,
        criticalHigh: 30.0,
        helper: "Help your body fight infection.",
      },
      {
        code: "PLT",
        name: "Platelets",
        unit: "x10^3/uL",
        refLow: 150,
        refHigh: 410,
        criticalLow: 20,
        criticalHigh: 1000,
        helper: "Help your blood clot when you are cut.",
      },
    ],
  },
  {
    code: "LIPID",
    name: "Lipid Profile",
    locked: false,
    analytes: [
      {
        code: "TC",
        name: "Total cholesterol",
        unit: "mg/dL",
        refLow: null,
        refHigh: 200,
        criticalLow: null,
        criticalHigh: null,
        helper: "All the cholesterol in your blood.",
      },
      {
        code: "LDL",
        name: "LDL cholesterol",
        unit: "mg/dL",
        refLow: 0,
        refHigh: 100,
        criticalLow: null,
        criticalHigh: null,
        helper: "The kind that can build up in blood vessels.",
      },
      {
        code: "HDL",
        name: "HDL cholesterol",
        unit: "mg/dL",
        refLow: 40,
        refHigh: null,
        criticalLow: null,
        criticalHigh: null,
        helper: "The kind that helps clear cholesterol away.",
      },
      {
        code: "TG",
        name: "Triglycerides",
        unit: "mg/dL",
        refLow: null,
        refHigh: 150,
        criticalLow: null,
        criticalHigh: null,
        helper: "A kind of fat carried in your blood.",
      },
    ],
  },
  {
    code: "ELEC",
    name: "Electrolytes",
    locked: true,
    analytes: [
      {
        code: "NA",
        name: "Sodium",
        unit: "mmol/L",
        refLow: 135,
        refHigh: 145,
        criticalLow: 120,
        criticalHigh: 160,
        helper: "Keeps the water in your body in balance.",
      },
      {
        code: "K",
        name: "Potassium",
        unit: "mmol/L",
        refLow: 3.5,
        refHigh: 5.1,
        criticalLow: 2.8,
        criticalHigh: 6.0,
        helper: "Helps your heart and muscles work.",
      },
      {
        code: "CL",
        name: "Chloride",
        unit: "mmol/L",
        refLow: 98,
        refHigh: 107,
        criticalLow: null,
        criticalHigh: null,
        helper: "Works with sodium to balance fluids.",
      },
    ],
  },
  {
    code: "THYROID",
    name: "Thyroid Profile",
    locked: false,
    analytes: [
      {
        code: "TSH",
        name: "TSH",
        unit: "uIU/mL",
        refLow: 0.4,
        refHigh: 4.0,
        criticalLow: null,
        criticalHigh: null,
        helper: "Tells your thyroid gland how hard to work.",
      },
      {
        code: "FT4",
        name: "Free T4",
        unit: "ng/dL",
        refLow: 0.8,
        refHigh: 1.8,
        criticalLow: null,
        criticalHigh: null,
        helper: "The main hormone your thyroid makes.",
      },
    ],
  },
];

/** Creates or updates every test and analyte. Safe to run again. */
export async function upsertCatalog(db: PrismaClient): Promise<void> {
  for (const test of CATALOG) {
    const saved = await db.testDefinition.upsert({
      where: { code: test.code },
      create: { code: test.code, name: test.name, locked: test.locked },
      update: { name: test.name, locked: test.locked },
    });
    for (const [sortOrder, a] of test.analytes.entries()) {
      const data = { ...a, sortOrder };
      await db.analyte.upsert({
        where: { testId_code: { testId: saved.id, code: a.code } },
        create: { ...data, testId: saved.id },
        update: data,
      });
    }
  }
}
