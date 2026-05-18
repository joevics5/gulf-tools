import createMiddleware from 'next-intl/middleware'
import { routing } from './lib/i18n/routing'
import { NextRequest, NextResponse } from 'next/server'

const intlMiddleware = createMiddleware(routing)

export default function middleware(request: NextRequest) {
  // Redirect bare root to /en instantly — no flash
  if (request.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/en', request.url))
  }
  return intlMiddleware(request)
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\..*).*)'],
}