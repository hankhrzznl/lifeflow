import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// T12：proxy 约定（Next.js 16 起 middleware 已废弃，改用 proxy）
// T15c：清理断链规则（/goals/*、/projects/* → 目标路由不存在），仅保留有效重定向
// T16：v1 目标系统下线 → /tasks、/efficiency 系列、/more/projects 全部重定向到 v2 / 目录

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
    // T16：v1 分类视图 / 双目录 / v1 目标系统正式下线 → v2
    '/tasks': { destination: '/efficiency-v2', permanent: true },
    '/more/projects': { destination: '/more', permanent: true },
    '/efficiency': { destination: '/efficiency-v2', permanent: true },
    // T22：理想日升级为底导 4-tab 一级页面，旧配置页 308 至新路由（数据不丢）
    '/more/ideal-day': { destination: '/ideal-day', permanent: true },
    // T22.1：一页一段规划路由重构，旧 /ideal-day/plan/[feature] 单段规划页已废弃 → 理想日
    '/ideal-day/plan/study': { destination: '/ideal-day', permanent: true },
    '/ideal-day/plan/workout': { destination: '/ideal-day', permanent: true },
    '/ideal-day/plan/sleep': { destination: '/ideal-day', permanent: true },
    '/ideal-day/plan/diet': { destination: '/ideal-day', permanent: true },
    '/ideal-day/plan/water': { destination: '/ideal-day', permanent: true },
    '/ideal-day/plan/focus': { destination: '/ideal-day', permanent: true },
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

  // T16：v1 目标系统下线（/efficiency、/efficiency/create、/efficiency/goals、/efficiency/review）→ v2 目标页
  // 注意：/efficiency/schedule 是活跃日程模块，需排除
  if (pathname.startsWith('/efficiency/') && !pathname.startsWith('/efficiency/schedule')) {
    const url = request.nextUrl.clone();
    url.pathname = '/efficiency-v2';
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/focus',
    '/tasks',
    '/more/projects',
    '/more/ideal-day',
    '/ideal-day/plan/study',
    '/ideal-day/plan/workout',
    '/ideal-day/plan/sleep',
    '/ideal-day/plan/diet',
    '/ideal-day/plan/water',
    '/ideal-day/plan/focus',
    '/efficiency',
    '/efficiency/:path*',
    '/plugins',
    '/plugins/:path*',
  ],
};
