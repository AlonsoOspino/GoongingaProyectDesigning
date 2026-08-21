import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
  async redirects() {
    return [
      { source: "/season-9", destination: "/season", permanent: false },
    ];
  },
};

export default nextConfig;
