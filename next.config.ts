import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Serve the static platform guide (public/guide.html) at a clean /guide URL.
  async rewrites() {
    return [{ source: "/guide", destination: "/guide.html" }];
  },
};

export default nextConfig;
