import type { NextConfig } from "next";

// 대부분의 화면이 로그인 세션(쿠키)에 의존하므로 cacheComponents는 쓰지 않고
// 요청 시 동적 렌더링한다.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
