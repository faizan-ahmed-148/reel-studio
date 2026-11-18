import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  serverExternalPackages: ["@napi-rs/canvas", "msedge-tts", "node-cron", "groq-sdk"],
};

export default nextConfig;
