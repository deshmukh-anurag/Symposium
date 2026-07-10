import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let Next read our shared TS package's source directly (no build step needed).
  transpilePackages: ["@symposium/protocol"],
};

export default nextConfig;
