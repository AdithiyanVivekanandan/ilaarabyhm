import type { NextConfig } from 'next'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
let supabaseOrigin = 'https://*.supabase.co'

try {
  const parsed = new URL(supabaseUrl)
  supabaseOrigin = parsed.origin
} catch {
  // Keep fallback origin if NEXT_PUBLIC_SUPABASE_URL is not present.
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' https://upload-widget.cloudinary.com https://checkout.razorpay.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: https://res.cloudinary.com",
              "font-src 'self' https://fonts.gstatic.com",
              `connect-src 'self' ${supabaseOrigin}`,
              "frame-src https://upload-widget.cloudinary.com https://checkout.razorpay.com",
              "report-uri /api/csp-report",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default nextConfig
