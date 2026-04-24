import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    // Temporarily allow build to proceed while Railway cache clears
    // Remove once cache is fully busted
    ignoreBuildErrors: false,
  },
  generateBuildId: async () => {
    // Change this value to bust Railway's Next.js build cache
    return "build-" + new Date().toISOString().slice(0, 10).replace(/-/g, "");
  },
};

export default nextConfig;