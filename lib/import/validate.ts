import { parseRange, type Range } from "../domain/flags";
import { normalisePhone } from "../domain/phone";

/**
 * Checks every row of an LIS export. Each problem becomes a plain sentence that
 * names the bad value, so front-desk staff can fix the export themselves.
 * Good rows pass even when other rows are bad.
 */

export const REQUIRED_COLUMNS = [
  "Order ID",
  "Patient",
  "Phone",
  "Age",
  "Sex",
  "Test Code",
  "Parameter",
  "Result",
  "Reference Range",
  "Status",
] as const;

export const OPTIONAL_COLUMNS = ["Relation", "Referring Doctor", "Signed At"] as const;

export type ReportStatus = "SAMPLE_GIVEN" | "TESTED" | "SIGNED";
export type Sex = "FEMALE" | "MALE" | "OTHER";

export interface TestCatalog {
  [testCode: string]: { analytes: { code: string; name: string; unit: string }[] };
}

export interface ValidRow {
  rowNumber: number;
  orderId: string;
  patientName: string;
  phone: string;
  age: number;
  sex: Sex;
  relation: string;
  testCode: string;
  analyteCode: string;
  value: number | null;
  valueText: string;
  range: Range | null;
  refText: string;
  status: ReportStatus;
  lisCritical: boolean;
  referringDoctor: string | null;
  signedAt: Date | null;
}

export interface RowError {
  rowNumber: number;
  orderId: string | null;
  messages: string[];
  raw: Record<string, string>;
}

const STATUSES: Record<string, { status: ReportStatus; lisCritical: boolean }> = {
  ready: { status: "SIGNED", lisCritical: false },
  "ready (critical)": { status: "SIGNED", lisCritical: true },
  processing: { status: "TESTED", lisCritical: false },
  "sample given": { status: "SAMPLE_GIVEN", lisCritical: false },
  "sample collected": { status: "SAMPLE_GIVEN", lisCritical: false },
};

const SEXES: Record<string, Sex> = {
  f: "FEMALE",
  female: "FEMALE",
  m: "MALE",
  male: "MALE",
  o: "OTHER",
  other: "OTHER",
};

const NUMBER = /^-?\d+(\.\d+)?$/;

export function missingColumns(header: readonly string[]): string[] {
  return REQUIRED_COLUMNS.filter((c) => !header.includes(c));
}

function findAnalyte(catalog: TestCatalog, testCode: string, parameter: string) {
  const wanted = parameter.trim().toLowerCase();
  return catalog[testCode]?.analytes.find(
    (a) => a.name.toLowerCase() === wanted || `${a.name} ${a.unit}`.toLowerCase() === wanted,
  );
}

function checkRow(
  raw: Record<string, string>,
  rowNumber: number,
  catalog: TestCatalog,
): ValidRow | string[] {
  const get = (column: string) => (raw[column] ?? "").trim();
  const messages: string[] = [];

  const orderId = get("Order ID");
  if (!orderId) messages.push("Order ID is missing.");

  const patientName = get("Patient");
  if (!patientName) messages.push("Patient name is missing.");

  const phoneText = get("Phone");
  const phone = normalisePhone(phoneText);
  if (!phoneText) messages.push("Phone number is missing.");
  else if (!phone)
    messages.push(`Phone number "${phoneText}" is not a 10-digit Indian mobile number.`);

  const ageText = get("Age");
  const age = Number(ageText);
  if (!/^\d{1,3}$/.test(ageText) || age > 120)
    messages.push(`Age must be a whole number from 0 to 120 (got "${ageText}").`);

  const sexText = get("Sex");
  const sex = SEXES[sexText.toLowerCase()];
  if (!sex) messages.push(`Sex must be F, M or O (got "${sexText}").`);

  const statusText = get("Status");
  const status = STATUSES[statusText.toLowerCase()];
  if (!status)
    messages.push(
      `Status "${statusText}" is not one of Ready, Ready (critical), Processing or Sample given.`,
    );

  const testCode = get("Test Code").toUpperCase();
  const parameter = get("Parameter");
  const analyte = findAnalyte(catalog, testCode, parameter);
  if (!catalog[testCode]) {
    const known = Object.keys(catalog).sort().join(", ");
    messages.push(
      `The test code "${testCode}" is not one this portal knows. Known codes: ${known}.`,
    );
  } else if (!analyte) {
    const names = catalog[testCode].analytes.map((a) => a.name).join(", ");
    messages.push(`Parameter "${parameter}" is not part of ${testCode}. It has: ${names}.`);
  }

  const valueText = get("Result");
  const needsValue = status?.status === "SIGNED";
  let value: number | null = null;
  if (valueText) {
    if (NUMBER.test(valueText)) value = Number(valueText);
    else messages.push(`Result "${valueText}" is not a number.`);
  } else if (needsValue) {
    messages.push("Result is missing, but the report is marked Ready.");
  }

  const refText = get("Reference Range");
  const range = refText ? parseRange(refText) : null;
  if (refText && !range)
    messages.push(
      `Reference range "${refText}" could not be read. Use a form like 12.0-15.5, <100 or >40.`,
    );
  else if (!refText && valueText) messages.push("Reference range is missing.");

  const signedText = get("Signed At");
  const signedAt = signedText ? new Date(signedText) : null;
  if (signedAt && Number.isNaN(signedAt.getTime()))
    messages.push(`Signed At "${signedText}" is not a date and time.`);

  if (messages.length > 0 || !phone || !sex || !status || !analyte) {
    return messages;
  }

  return {
    rowNumber,
    orderId,
    patientName,
    phone,
    age,
    sex,
    relation: get("Relation") || "Self",
    testCode,
    analyteCode: analyte.code,
    value,
    valueText,
    range,
    refText,
    status: status.status,
    lisCritical: status.lisCritical,
    referringDoctor: get("Referring Doctor") || null,
    signedAt,
  };
}

export function validateRows(
  records: Record<string, string>[],
  catalog: TestCatalog,
): { valid: ValidRow[]; errors: RowError[] } {
  const valid: ValidRow[] = [];
  const errors: RowError[] = [];
  // For each order and test: who it belongs to, and which parameters were seen.
  const reports = new Map<string, { patientName: string; phone: string; analytes: Set<string> }>();

  records.forEach((raw, index) => {
    // Row 1 is the header, so the first data row is row 2, as in a spreadsheet.
    const rowNumber = index + 2;
    const checked = checkRow(raw, rowNumber, catalog);
    const fail = (messages: string[]) =>
      errors.push({ rowNumber, orderId: raw["Order ID"]?.trim() || null, messages, raw });

    if (Array.isArray(checked)) return fail(checked);

    const key = `${checked.orderId}|${checked.testCode}`;
    const seen = reports.get(key);
    if (!seen) {
      reports.set(key, {
        patientName: checked.patientName,
        phone: checked.phone,
        analytes: new Set([checked.analyteCode]),
      });
    } else if (seen.patientName !== checked.patientName || seen.phone !== checked.phone) {
      return fail([
        `Order ${checked.orderId} (${checked.testCode}) has a different patient or phone on an earlier row.`,
      ]);
    } else if (seen.analytes.has(checked.analyteCode)) {
      return fail([
        `${raw["Parameter"]} appears twice for order ${checked.orderId} (${checked.testCode}).`,
      ]);
    } else {
      seen.analytes.add(checked.analyteCode);
    }
    valid.push(checked);
  });

  return { valid, errors };
}
