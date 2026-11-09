import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { reportForSession } from "@/lib/auth/access";
import { currentSession, ipHash } from "@/lib/auth/cookies";
import { db } from "@/lib/db/client";
import { dateTime } from "@/lib/patient-format";
import { signedReportPdf } from "@/lib/report-pdf";
import { ruleSummary } from "@/lib/summary/service";

/**
 * The full signed report as a PDF. The real one comes from the LIS, which is
 * out of scope, so this builds a clearly marked stand-in from the same data
 * (assumption A7). Downloading it is written to the access log.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ patientId: string; reportId: string }> },
) {
  const session = await currentSession();
  if (!session || session.kind === "STAFF") {
    return NextResponse.redirect(new URL("/", _request.url), 303);
  }
  const { patientId, reportId } = await params;
  const report = await reportForSession(session, reportId);
  if (!report || report.patientId !== patientId) {
    return new NextResponse("This page is not in your file.", { status: 404 });
  }

  await db.accessLog.create({
    data: {
      actorType: "PATIENT",
      actorId: session.id,
      action: "REPORT_PDF_DOWNLOADED",
      householdId: session.householdId,
      patientId,
      reportId,
      ipHash: await ipHash(),
    },
  });

  // "Save as PDF" on the printable copy: the same simple copy as a file.
  if (new URL(_request.url).searchParams.get("copy") === "simple") {
    const bytes = await simpleCopyPdf(report);
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${report.orderId}-simple-copy.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  const bytes = await signedReportPdf(report);
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${report.orderId}-${report.test.code}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

type PdfReport = NonNullable<Awaited<ReturnType<typeof reportForSession>>>;

/**
 * The simple copy as a PDF: name, each result with its value, usual range and
 * rule word, then what to do next. English template words, because the PDF's
 * built-in font cannot draw Telugu or Hindi. A critical report holds no values.
 */
async function simpleCopyPdf(report: PdfReport): Promise<Uint8Array> {
  const summary = await ruleSummary(report, "en");
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.086, 0.082, 0.075);
  const soft = rgb(0.23, 0.21, 0.19);
  const lab = process.env.NEXT_PUBLIC_LAB_NAME || "The lab";
  let y = 790;
  const text = (s: string, size = 11, font = regular, x = 50, color = ink) =>
    page.drawText(s, { x, y, size, font, color });
  const wrap = (s: string, size: number, width: number) => {
    const words = s.split(" ");
    const lines: string[] = [];
    let current = "";
    for (const w of words) {
      const next = current ? `${current} ${w}` : w;
      if (regular.widthOfTextAtSize(next, size) > width) {
        lines.push(current);
        current = w;
      } else current = next;
    }
    if (current) lines.push(current);
    return lines;
  };

  text(lab, 16, bold);
  text("Simple copy for you", 10, regular, 430, soft);
  y -= 12;
  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 1.5, color: ink });
  y -= 34;
  text(report.patient.name, 24, bold);
  y -= 18;
  text(
    `${report.test.name} · Order ${report.orderId} · signed ${report.signedAt ? dateTime(report.signedAt) : ""}`,
    10,
    regular,
    50,
    soft,
  );
  y -= 32;

  if (summary.kind === "CRITICAL") {
    for (const l of wrap(
      "Please call us about this report. We kept the explanation for a phone call with a doctor.",
      14,
      495,
    )) {
      text(l, 14, bold);
      y -= 20;
    }
  } else {
    for (const l of wrap(summary.intro, 14, 495)) {
      text(l, 14);
      y -= 20;
    }
    y -= 12;
    ["Result", "Your value", "Usual range", "What it means"].forEach((h, i) =>
      text(h.toUpperCase(), 8, bold, [50, 210, 320, 430][i]),
    );
    y -= 8;
    page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 1, color: ink });
    y -= 20;
    for (const item of summary.items) {
      const mark = item.tone === "USUAL" ? "OK" : item.flag === "LOW" ? "LOW" : "HIGH";
      text(item.name, 11, bold, 50);
      text(`${item.valueText} ${item.unit}`, 11, regular, 210);
      text(item.refText, 11, regular, 320);
      text(`${item.word.replace(/\.$/, "")} (${mark})`, 11, regular, 430);
      y -= 24;
    }
    y -= 16;
    text("WHAT TO DO NEXT", 9, bold);
    y -= 18;
    summary.nextSteps.forEach((step, i) => {
      for (const [j, l] of wrap(step, 11, 470).entries()) {
        text(j === 0 ? `${i + 1}.` : "", 11, bold, 50);
        text(l, 11, regular, 70);
        y -= 16;
      }
      y -= 4;
    });
    y -= 12;
    for (const l of wrap(summary.footer, 9, 495)) {
      text(l, 9, regular, 50, soft);
      y -= 12;
    }
  }
  y -= 8;
  text(
    `This is a simple copy. The signed report from ${lab} is the medical record.`,
    9,
    regular,
    50,
    soft,
  );
  y -= 12;
  text(`Questions? ${process.env.NEXT_PUBLIC_LAB_PHONE ?? ""}`, 9, bold);
  return pdf.save();
}
