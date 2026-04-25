import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decrypt } from '@/lib/auth'

export async function middleware(request: NextRequest) {
  const isAuthPage = request.nextUrl.pathname.startsWith('/login') ||
                     request.nextUrl.pathname.startsWith('/register') ||
                     request.nextUrl.pathname.startsWith('/forgot-password')
  
  if (isAuthPage) {
    return NextResponse.next()
  }

  const sessionCookie = request.cookies.get('session')?.value
  
  if (!sessionCookie) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const session = await decrypt(sessionCookie)

  if (!session?.userId) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Block deactivated accounts — isActive is stored in JWT at login time
  if (session.isActive === false) {
    const response = NextResponse.redirect(new URL('/login?deactivated=1', request.url))
    response.cookies.delete('session')
    return response
  }

  // Redirect ROOT to Dashboard
  if (request.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  // Exclude: API routes, Next.js internals, static files, PWA assets
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons|.well-known).*)'],
}
