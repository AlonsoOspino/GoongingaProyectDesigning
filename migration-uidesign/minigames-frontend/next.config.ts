import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  images: { remotePatterns: [{ protocol: "http", hostname: "localhost" }, { protocol: "https", hostname: "**" }] },
};

export default nextConfig;
