import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Emits .next/standalone — a self-contained server bundle with only the
  // dependencies actually used, so the Docker runtime image doesn't need the
  // full node_modules tree or the Next CLI. See frontend/Dockerfile.
  output: "standalone",
};

export default nextConfig;
