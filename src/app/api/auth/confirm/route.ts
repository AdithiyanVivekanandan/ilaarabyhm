import { type EmailOtpType } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const code = searchParams.get('code')
  const type = searchParams.get('type') as EmailOtpType | null
  
  const rawNext = searchParams.get('next') || '/admin'
  const allowedPaths = ['/admin', '/dev']
  const next = allowedPaths.includes(rawNext) ? rawNext : '/admin'

  const redirectTo = new URL(next, request.url)
  const response = NextResponse.redirect(redirectTo)

  // Create a supabase client that writes directly to the REDIRECT response
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options))
        },
      },
    }
  )

  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error && data.session) {
      console.log(`[AuthConfirm] Token verified for: ${data.user?.email}`)
      return response
    }
    console.error(`[AuthConfirm] VerifyOtp Error: ${error?.message}`)
  } 
  
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.session) {
      console.log(`[AuthConfirm] Code exchanged for: ${data.user?.email}`)
      return response
    }
    console.error(`[AuthConfirm] Code Exchange Error: ${error?.message}`)
  }

  return NextResponse.redirect(new URL(`/admin/login?error=confirmation-failed`, request.url))
}
