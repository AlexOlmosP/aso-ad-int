import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["playwright-core", "google-play-scraper"],
};

export default nextConfig;
