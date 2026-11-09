import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import { dateTime } from "@/lib/patient-format";

/**
 * The full signed report as a PDF. The real one comes from the LIS, which is
 * out of scope, so this builds a clearly marked stand-in from the same data
 * (assumption A7). Used by the patient's download and the doctor's view.
 */
export type SignedPdfReport = {
  orderId: string;
  signedAt: Date | null;
  patient: { name: string; age: number; sex: string };
  test: { name: string; code: string };
  referringDoctor?: { name: string } | null;
  results: {
    valueText: string;
    refText: string;
    flag: string;
    analyte: { name: string; unit: string };
  }[];
};

export async function signedReportPdf(report: SignedPdfReport): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4 in points
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.086, 0.082, 0.075);
  const lab = process.env.NEXT_PUBLIC_LAB_NAME || "The lab";
  let y = 790;
  const line = (text: string, size = 11, font = regular, x = 50) => {
    page.drawText(text, { x, y, size, font, color: ink });
  };

  page.drawText("SAMPLE: stand-in for the LIS signed PDF", {
    x: 90,
    y: 300,
    size: 30,
    font: bold,
    color: rgb(0.85, 0.82, 0.76),
    rotate: degrees(35),
  });

  line(lab, 18, bold);
  y -= 22;
  line("Laboratory report", 12);
  y -= 30;
  line(`Patient: ${report.patient.name}`, 12, bold);
  y -= 16;
  line(`Age / Sex: ${report.patient.age} / ${report.patient.sex.toLowerCase()}`);
  y -= 16;
  line(`Order: ${report.orderId}    Test: ${report.test.name}`);
  y -= 16;
  if (report.referringDoctor) {
    line(`Referred by: ${report.referringDoctor.name}`);
    y -= 16;
  }
  line(`Signed: ${report.signedAt ? dateTime(report.signedAt) : "not signed"}`);
  y -= 30;

  const cols = [50, 230, 330, 470];
  ["Parameter", "Result", "Reference range", "Flag"].forEach((h, i) => line(h, 10, bold, cols[i]));
  y -= 6;
  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 1, color: ink });
  y -= 16;
  for (const r of report.results) {
    line(r.analyte.name, 11, regular, cols[0]);
    line(`${r.valueText} ${r.analyte.unit}`, 11, bold, cols[1]);
    line(r.refText, 11, regular, cols[2]);
    line(r.flag === "LOW" ? "L" : r.flag === "HIGH" ? "H" : "", 11, bold, cols[3]);
    y -= 20;
  }
  y -= 20;
  line(
    "H high, L low: set by the laboratory's rules against the reference range printed above.",
    9,
  );
  y -= 40;
  line("Signed by: Lab doctor (placeholder name until go-live)", 11, bold);

  return pdf.save();
}
