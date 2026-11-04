import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { localeFromCookie } from "@/lib/i18n";
import "./fonts.css";
import "./globals.css";

const brand = process.env.NEXT_PUBLIC_BRAND_NAME ?? "Yatharth";

export const metadata: Metadata = {
  title: { default: brand, template: `%s | ${brand}` },
  description: "Your lab reports, kept safe and explained in plain words.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#dcd2bd",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const jar = await cookies();
  const locale = localeFromCookie(jar.get("lang")?.value);
  const large = jar.get("text")?.value === "large";

  return (
    <html lang={locale} data-text={large ? "large" : undefined}>
      <head>
        {/* Only the two Latin faces every page needs. Telugu and Hindi load on demand by unicode-range. */}
        <link
          rel="preload"
          href="/fonts/files/atkinson-hyperlegible-next-latin-400-normal.woff2"
          as="font"
          type="font/woff2"
          crossOrigin=""
        />
        <link
          rel="preload"
          href="/fonts/files/newsreader-latin-opsz-normal.woff2"
          as="font"
          type="font/woff2"
          crossOrigin=""
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
