import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {
          return
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname
  const normalizedEmail = user?.email?.toLowerCase().trim() || ''
  const adminEmail = (process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL || '').toLowerCase().trim()
  const devEmail = (process.env.DEV_EMAIL || process.env.NEXT_PUBLIC_DEV_EMAIL || '').toLowerCase().trim()
  const isAdmin = normalizedEmail === adminEmail && adminEmail !== ''
  const isDev = normalizedEmail === devEmail && devEmail !== ''

  if (!adminEmail) {
    console.warn('ADMIN_EMAIL is not configured for middleware. Admin access will remain blocked until configured.')
  }

  if (path.startsWith('/admin') && path !== '/admin/login' && path !== '/admin/unauthorized') {
    if (!user) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    if (!isAdmin && !isDev) {
      return NextResponse.redirect(new URL('/admin/unauthorized', request.url))
    }
  }

  if (path.startsWith('/dev')) {
    if (!user) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    if (!isDev) {
      return NextResponse.redirect(new URL('/admin/unauthorized', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/dev/:path*', '/api/:path*'],
}
