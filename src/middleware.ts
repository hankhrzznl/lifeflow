import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const redirects: Record<string, { destination: string; permanent: boolean }> = {
    '/planner': { destination: '/today', permanent: true },
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

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/planner', '/focus', '/goals/long-term', '/goals/short-term', '/goals/daily-trivial', '/goals/habits'],
};
