import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ── 旧路由重定向到新子站架构 ──
  async redirects() {
    return [
      { source: "/today", destination: "/efficiency/schedule", permanent: true },
      { source: "/planner", destination: "/efficiency", permanent: true },
      { source: "/goals", destination: "/efficiency", permanent: true },
      { source: "/goals/:path*", destination: "/efficiency", permanent: true },
      { source: "/review", destination: "/efficiency/review", permanent: true },
      { source: "/stats", destination: "/efficiency", permanent: true },
      { source: "/assistant", destination: "/", permanent: true },
      { source: "/assistant/:path*", destination: "/", permanent: true },
    ];
  },

  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    minimumCacheTTL: 86400,
  },
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
  },
  experimental: {
    optimizePackageImports: [
      "framer-motion",
      "lucide-react",
      "recharts",
      "date-fns",
    ],
  },
};

export default nextConfig;
