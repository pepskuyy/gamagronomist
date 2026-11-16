import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decrypt } from '@/lib/auth'

// Origin WebView Capacitor (APK). Tambahan untuk dev lewat FIELD_APP_ORIGINS (dipisah koma).
function fieldOrigins() {
  return ['https://localhost', 'capacitor://localhost', ...(process.env.FIELD_APP_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean) ?? [])]
}

function handleApi(request: NextRequest) {
  const origin = request.headers.get('origin')
  const cors: Record<string, string> = origin && fieldOrigins().includes(origin)
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key',
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin',
      }
    : {}
  if (request.method === 'OPTIONS' && cors['Access-Control-Allow-Origin']) {
    return new NextResponse(null, { status: 204, headers: cors })
  }

  // App Lapangan mengirim JWT login sebagai Bearer. Disalin menjadi cookie `session`
  // agar semua route & server action yang membaca cookie bekerja tanpa diubah.
  // Hanya JWT (eyJ…); kunci Open API (sk_…) dan CRON_SECRET dibiarkan.
  const bearer = request.headers.get('authorization')?.match(/^Bearer (eyJ[\w-]+\.[\w-]+\.[\w-]+)$/)?.[1]
  let response: NextResponse
  if (bearer) {
    const headers = new Headers(request.headers)
    headers.set('cookie', `session=${bearer}`)
    response = NextResponse.next({ request: { headers } })
  } else {
    response = NextResponse.next()
  }
  for (const [k, v] of Object.entries(cors)) response.headers.set(k, v)
  return response
}

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/')) return handleApi(request)

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
  // Exclude: API routes, Next.js internals, static files, images, PWA assets, GeoJSON
  matcher: ['/api/:path*', '/((?!api|_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons|geojson|.well-known|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.svg|.*\\.webp|.*\\.ico|.*\\.css|.*\\.js).*)'],
}
