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
  };

  const redirect = redirects[pathname];
  if (redirect) {
    const url = request.nextUrl.clone();
    url.pathname = redirect.destination;
    return NextResponse.redirect(url, redirect.permanent ? 308 : 307);
  }

  // 旧版 board/section 路由重定向 → 新版项目页
  const boardMatch = pathname.match(/^\/projects\/(\d+)\/boards\/(\d+)\/sections\/(\d+)$/);
  if (boardMatch) {
    const url = request.nextUrl.clone();
    url.pathname = `/projects/${boardMatch[1]}`;
    return NextResponse.redirect(url, 308);
  }

  const boardOnlyMatch = pathname.match(/^\/projects\/(\d+)\/boards\/(\d+)$/);
  if (boardOnlyMatch) {
    const url = request.nextUrl.clone();
    url.pathname = `/projects/${boardOnlyMatch[1]}`;
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
    '/projects/:projectId/boards/:boardId',
    '/projects/:projectId/boards/:boardId/sections/:sectionId',
  ],
};
