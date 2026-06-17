import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Lightweight optimistic auth redirect.
 * Route handlers and pages still verify auth/authorization server-side.
 */
export function proxy(request: NextRequest) {
  const sessionToken =
    request.cookies.get('authjs.session-token')?.value ||
    request.cookies.get('__Secure-authjs.session-token')?.value

  const isLoginPage = request.nextUrl.pathname === '/login'

  if (!sessionToken && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
}
