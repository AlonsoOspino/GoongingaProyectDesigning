import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
  async redirects() {
    return [
      { source: "/social-media-dashboard", destination: "/casting-dashboard", permanent: false },
    ];
  },
};

export default nextConfig;
