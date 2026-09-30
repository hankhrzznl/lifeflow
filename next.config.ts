import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // v2-legacy/ 是留档的旧工程（不完整、不参与构建）。
  // 它不在 src/ 下，不会被当成路由；类型检查的排除写在 tsconfig.json 的 exclude 里。
  // （Next 16 已移除 next.config 的 eslint 键，别再写，否则配置校验直接报错。）
};

export default nextConfig;
