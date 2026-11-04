import { NextResponse, type NextRequest } from "next/server";
import { localeFromCookie } from "@/lib/i18n";

/**
 * Switches the language and returns to the same page. A plain link, so the
 * language tabs work on any phone, with or without JavaScript.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const next = request.nextUrl.searchParams.get("next") ?? "/";
  // Only same-site paths, so this can never be used to send someone elsewhere.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const response = NextResponse.redirect(new URL(safeNext, request.url), 303);
  response.cookies.set("lang", localeFromCookie(code), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return response;
}
