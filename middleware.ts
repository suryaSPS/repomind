import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Lightweight middleware that checks for the NextAuth session cookie
 * without importing auth() — which pulls in Node.js-only deps
 * (pg, bcryptjs) that crash in Vercel's Edge Runtime.
 */
export function middleware(request: NextRequest) {
  const sessionToken =
    request.cookies.get('authjs.session-token')?.value ||
    request.cookies.get('__Secure-authjs.session-token')?.value

  const isLoginPage = request.nextUrl.pathname === '/login'

  if (!sessionToken && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (sessionToken && isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
}
