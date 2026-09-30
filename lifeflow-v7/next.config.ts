import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 三档设备布局靠 CSS 媒体查询，不需要额外配置。
  // 输出保持默认（可 dev / build / start）。
};

export default nextConfig;
