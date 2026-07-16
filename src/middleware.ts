import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const redirects: Record<string, { destination: string; permanent: boolean }> = {
    '/focus': { destination: '/today', permanent: true },
    '/goals/long-term': { destination: '/goals?tab=long-term', permanent: true },
    '/goals/short-term': { destination: '/goals?tab=short-term', permanent: true },
    '/goals/daily-trivial': { destination: '/goals?tab=daily-trivial', permanent: true },
    '/goals/habits': { destination: '/goals?tab=habits', permanent: true },
    // 旧版项目列表/未分类 → 规划页
    '/projects': { destination: '/planner', permanent: true },
    '/projects/unclassified': { destination: '/planner', permanent: true },
  };

  const redirect = redirects[pathname];
  if (redirect) {
    const url = request.nextUrl.clone();
    url.pathname = redirect.destination;
    return NextResponse.redirect(url, redirect.permanent ? 308 : 307);
  }

  // 旧版 board/section 路由重定向 → 规划页(带项目过滤)
  const boardMatch = pathname.match(/^\/projects\/(\d+)\/boards\/(\d+)\/sections\/(\d+)$/);
  if (boardMatch) {
    const url = request.nextUrl.clone();
    url.pathname = '/planner';
    url.searchParams.set('project', boardMatch[1]);
    return NextResponse.redirect(url, 308);
  }

  const boardOnlyMatch = pathname.match(/^\/projects\/(\d+)\/boards\/(\d+)$/);
  if (boardOnlyMatch) {
    const url = request.nextUrl.clone();
    url.pathname = '/planner';
    url.searchParams.set('project', boardOnlyMatch[1]);
    return NextResponse.redirect(url, 308);
  }

  // 旧版计划详情 → 新计划详情
  const planMatch = pathname.match(/^\/projects\/(\d+)\/goals\/(\d+)\/plans\/(\d+)$/);
  if (planMatch) {
    const url = request.nextUrl.clone();
    url.pathname = `/plans/${planMatch[3]}`;
    return NextResponse.redirect(url, 308);
  }

  // 旧版目标详情 → 新目标详情
  const goalMatch = pathname.match(/^\/projects\/(\d+)\/goals\/(\d+)$/);
  if (goalMatch) {
    const url = request.nextUrl.clone();
    url.pathname = `/goals/${goalMatch[2]}`;
    return NextResponse.redirect(url, 308);
  }

  // 旧版项目详情 → 规划页(带项目过滤)
  const projectMatch = pathname.match(/^\/projects\/(\d+)$/);
  if (projectMatch) {
    const url = request.nextUrl.clone();
    url.pathname = '/planner';
    url.searchParams.set('project', projectMatch[1]);
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/focus',
    '/goals/long-term',
    '/goals/short-term',
    '/goals/daily-trivial',
    '/goals/habits',
    '/projects',
    '/projects/:path*',
  ],
};
