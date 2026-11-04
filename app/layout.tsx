import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

const brand = process.env.NEXT_PUBLIC_BRAND_NAME ?? "Yatharth";

export const metadata: Metadata = {
  title: brand,
  description: "Your lab reports, kept safe and explained in plain words.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
