import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// T12：proxy 约定（Next.js 16 起 middleware 已废弃，改用 proxy）
// T15c：清理断链规则（/goals/*、/projects/* → 目标路由不存在），仅保留有效重定向

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const redirects: Record<string, { destination: string; permanent: boolean }> = {
    // 旧 /focus 直达 → 专注计时（/more/focus，T15c 已删除 /focus 空壳页）
    '/focus': { destination: '/more/focus', permanent: true },
    // T12：旧版 plugins 页面正式下线 → 新版对应页
    '/plugins': { destination: '/more', permanent: true },
    '/plugins/finance': { destination: '/more/accounting', permanent: true },
    '/plugins/focus-timer': { destination: '/more/focus', permanent: true },
    '/plugins/habit': { destination: '/more/habits', permanent: true },
    '/plugins/habit/detail': { destination: '/more/habits', permanent: true },
    '/plugins/task-inbox': { destination: '/pending', permanent: true },
    '/plugins/timeline': { destination: '/efficiency/schedule', permanent: true },
  };

  const redirect = redirects[pathname];
  if (redirect) {
    const url = request.nextUrl.clone();
    url.pathname = redirect.destination;
    return NextResponse.redirect(url, redirect.permanent ? 308 : 307);
  }

  // T12：其余 plugins 子路径兜底 → 全部功能目录
  if (pathname.startsWith('/plugins/')) {
    const url = request.nextUrl.clone();
    url.pathname = '/more';
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/focus',
    '/plugins',
    '/plugins/:path*',
  ],
};
