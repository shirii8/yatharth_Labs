import { NextResponse } from "next/server";
import { currentSession, ipHash } from "@/lib/auth/cookies";
import { can } from "@/lib/auth/roles";
import { db } from "@/lib/db/client";
import { doctorReport } from "@/lib/doctor/reports";
import { signedReportPdf } from "@/lib/report-pdf";

/** The signed report as a PDF, for its own referring doctor only. Opening it is logged. */
export async function GET(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  const session = await currentSession();
  const staff =
    session?.kind === "STAFF" && session.staffUserId
      ? await db.staffUser.findUnique({ where: { id: session.staffUserId } })
      : null;
  if (!staff || !staff.active || !can(staff.role, "doctorReports")) {
    return NextResponse.redirect(new URL("/desk/sign-in", request.url), 303);
  }
  const { reportId } = await params;
  const report = await doctorReport(staff, reportId, { ipHash: await ipHash() });
  if (!report || report.status !== "SIGNED") {
    return new NextResponse("This report is not one of your patients'.", { status: 404 });
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
