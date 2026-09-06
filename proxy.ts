import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Lightweight proxy (Next.js 16 rename of middleware) that checks for the
 * NextAuth session cookie without importing auth() — which pulls in
 * Node.js-only deps (pg, bcryptjs) that crash in Vercel's Edge Runtime.
 *
 * `/` is public: logged-out visitors see the landing page there
 * (app/page.tsx renders it when no session exists). `/results` is public too —
 * it is the evaluation report the landing page links to, and gating it behind
 * a login would defeat the point of publishing it.
 */
export function proxy(request: NextRequest) {
  const sessionToken =
    request.cookies.get('authjs.session-token')?.value ||
    request.cookies.get('__Secure-authjs.session-token')?.value

  const pathname = request.nextUrl.pathname
  const PUBLIC_PAGES = ['/', '/login', '/results']
  const isPublicPage = PUBLIC_PAGES.includes(pathname)

  if (!sessionToken && !isPublicPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (sessionToken && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
}
