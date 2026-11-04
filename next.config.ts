import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Do not tell visitors which framework serves the site.
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
