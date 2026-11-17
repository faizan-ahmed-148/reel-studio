import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  serverExternalPackages: ["@napi-rs/canvas", "msedge-tts", "node-cron", "groq-sdk"],
};

export default nextConfig;
