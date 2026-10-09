import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  outputFileTracingRoot: process.cwd(),
  async redirects() {
    return [
      { source: "/social-media-dashboard", destination: "/casting-dashboard", permanent: false },
    ];
  },
};

export default nextConfig;
