import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decrypt } from '@/lib/auth'

export async function middleware(request: NextRequest) {
  const isAuthPage = request.nextUrl.pathname.startsWith('/login') ||
                     request.nextUrl.pathname.startsWith('/register')
  
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

  // Redirect ROOT to Dashboard
  if (request.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
