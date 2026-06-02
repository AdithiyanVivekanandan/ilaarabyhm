# 🔐 ILARA — Security Audit Report
**Scope**: Full codebase review for the purpose of hardening.
**Stack**: Next.js 16 · Supabase · Cloudinary · Razorpay · Resend

---

## Summary Table

| # | Severity | Location | Issue |
|---|----------|----------|-------|
| 1 | 🔴 Critical | `middleware.ts` | Admin auth bypass via middleware skip |
| 2 | 🔴 Critical | `upload/delete/route.ts` | Arbitrary Cloudinary asset deletion via path traversal |
| 3 | 🔴 Critical | `checkout/page.tsx` | Payment bypass — Razorpay success not verified server-side |
| 4 | 🟠 High | `middleware.ts` | Email-based role check is bypassable via case/whitespace |
| 5 | 🟠 High | `security.ts` | In-memory rate limiter resets on every serverless cold start |
| 6 | 🟠 High | `upload/route.ts` | MIME type spoofing — `file.type` is client-controlled |
| 7 | 🟠 High | `checkout/route.ts` | Order ID leaked in error path; no item count cap |
| 8 | 🟠 High | `webhook/razorpay/route.ts` | Email HTML injection via `order.buyer_name` |
| 9 | 🟡 Medium | `auth/confirm/route.ts` | Open redirect via `next` parameter (partial mitigation exists) |
| 10 | 🟡 Medium | `next.config.ts` | CSP missing `nonce` / `unsafe-eval` leaks; `connect-src` too broad |
| 11 | 🟡 Medium | `security.ts` | `getClientIP` is trivially spoofable with forged headers |
| 12 | 🟡 Medium | `admin/page.tsx` | Admin dashboard uses anon key — relies purely on RLS |
| 13 | 🟡 Medium | `security.ts` | `logSecurityEvent` exposes raw `data: any` — potential log injection |
| 14 | 🟢 Low | `admin/login/page.tsx` | Magic link OTP sent to any email with no pre-check |
| 15 | 🟢 Low | `checkout/route.ts` | Error message leaks internal product ID |
| 16 | 🟢 Low | `success/page.tsx` | Order ID reflected in URL without validation |

---

## 🔴 Critical Vulnerabilities

---

### 1 — Admin Auth Bypass via Middleware Skip
**File**: [`middleware.ts`](file:///c:/Users/Adithiyan/Documents/collegyear-2/sem%204/projects/ILARA/middleware.ts)

**Lines 50–52** — the `config.matcher` only covers `/admin/:path*` and `/dev/:path*`.

```ts
export const config = {
  matcher: ['/admin/:path*', '/dev/:path*'],
}
```

**Problem**: Next.js middleware is **not guaranteed to run** for:
- API routes (`/api/*`) — they are outside the matcher
- Static files, `_next/` paths
- Any route where middleware is bypassed due to a Next.js bug or misconfiguration

More critically: **API routes like `/api/upload`, `/api/upload/delete`, and `/api/products` (POST/PATCH) all perform their own auth checks**, but if any new API route is added without an auth guard, it is silently unprotected.

**There is no centralized API route protection layer.**

**Fix**: Apply a secondary server-side auth check using Supabase service-role client in a shared helper, not just the anon client session:

```ts
// lib/requireAdmin.ts
import { createClient } from './supabase/server'

export async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const isAdmin = user.email?.toLowerCase() === process.env.ADMIN_EMAIL?.toLowerCase()
  return isAdmin ? user : null
}
```

Every admin API route should call this as the *first* line.

---

### 2 — Arbitrary Asset Deletion via Path Traversal
**File**: [`api/upload/delete/route.ts`](file:///c:/Users/Adithiyan/Documents/collegyear-2/sem%204/projects/ILARA/src/app/api/upload/delete/route.ts) — **Lines 20–31**

```ts
const { imageUrl } = await request.json()
// ...
const parts = imageUrl.split('/')
const fileName = parts[parts.length - 1].split('.')[0]
const folder = parts[parts.length - 2]
const publicId = `ilaara/products/${fileName}`
```

**Problems**:
1. `imageUrl` is attacker-controlled. The code constructs `publicId` using only `fileName` (last path segment). An attacker can pass `imageUrl = "https://res.cloudinary.com/your-cloud/image/upload/v1/ilaara/../../../../other-folder/sensitive-asset.jpg"` — though path traversal is limited by the string split, a crafted URL with `fileName = "../../admin-logo"` **can escape the `ilaara/products/` folder** and delete any Cloudinary asset.
2. `folder` (line 28) is extracted but **never used** in the final `publicId` — dead code giving false safety impression.
3. No validation that `imageUrl` is a Cloudinary URL at all.

**Fix**:
```ts
// Validate the URL belongs to your Cloudinary account
const CLOUDINARY_BASE = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/`
if (!imageUrl.startsWith(CLOUDINARY_BASE)) {
  return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
}

// Strict public_id extraction with allowlist prefix
const url = new URL(imageUrl)
const pathParts = url.pathname.split('/')
// pathname: /cloud/image/upload/vXXXX/ilaara/products/filename.ext
const uploadIdx = pathParts.indexOf('upload')
if (uploadIdx === -1) return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })

const publicIdParts = pathParts.slice(uploadIdx + 2) // skip version segment
const publicId = publicIdParts.join('/').replace(/\.[^/.]+$/, '') // strip extension

// MUST start with ilaara/products/
if (!publicId.startsWith('ilaara/products/')) {
  return NextResponse.json({ error: 'Unauthorized path' }, { status: 403 })
}
```

---

### 3 — Payment Bypass — Razorpay Handler Never Verified Server-Side
**File**: [`checkout/page.tsx`](file:///c:/Users/Adithiyan/Documents/collegyear-2/sem%204/projects/ILARA/src/app/checkout/page.tsx) — **Lines 63–66**

```ts
handler: function (response: any) {
  clearCart()
  router.push(`/success?order=${data.internalOrderId}`)
},
```

**Problem**: The Razorpay `handler` fires on the **client side** when Razorpay says payment succeeded. But:
1. **The order is already inserted with `status: 'sent'`** in the checkout API before payment even starts.
2. The `handler` simply clears the cart and redirects to `/success` — it **never calls any server endpoint to verify the payment**.
3. The webhook at `/api/webhook/razorpay` *does* verify, but **it's async and optional** — a user could bypass it entirely by directly hitting `/success?order=<any-order-id>`.
4. Any attacker can redirect to `/success` with a spoofed order ID.

**Fix**:
- The `handler` must POST `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }` to a new `/api/verify-payment` route that verifies the signature using `crypto.createHmac('sha256', secret).update(order_id + '|' + payment_id)` before redirecting to success.

```ts
// In handler:
handler: async function (response: any) {
  const verifyRes = await fetch('/api/verify-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      razorpay_order_id: response.razorpay_order_id,
      razorpay_payment_id: response.razorpay_payment_id,
      razorpay_signature: response.razorpay_signature,
      internalOrderId: data.internalOrderId
    })
  })
  if (!verifyRes.ok) { alert('Payment verification failed'); return }
  clearCart()
  router.push(`/success?order=${data.internalOrderId}`)
},
```

---

## 🟠 High Severity

---

### 4 — Email Role Check Fragility
**File**: [`middleware.ts`](file:///c:/Users/Adithiyan/Documents/collegyear-2/sem%204/projects/ILARA/middleware.ts) — **Lines 23–25**

```ts
const normalizedEmail = user?.email?.toLowerCase().trim() || ''
const isAdmin = normalizedEmail === process.env.ADMIN_EMAIL?.toLowerCase().trim()
```

- `ADMIN_EMAIL` is compared with `.toLowerCase().trim()` which is correct.
- **BUT**: If `ADMIN_EMAIL` is not set in `.env`, `process.env.ADMIN_EMAIL?.toLowerCase().trim()` returns `undefined`, and `'' === undefined` is `false` — safe, but silent. The admin will be locked out with no error logged.
- More critically: the check happens **in middleware** (Edge Runtime) which only has access to `NEXT_PUBLIC_*` or explicitly exposed env vars. `ADMIN_EMAIL` without `NEXT_PUBLIC_` prefix **may not be available in Edge middleware** depending on deployment.

**Fix**: Add a startup check and use Supabase custom claims/roles instead of email comparison, or add explicit env var logging on startup.

---

### 5 — In-Memory Rate Limiter Resets on Cold Starts
**File**: [`lib/security.ts`](file:///c:/Users/Adithiyan/Documents/collegyear-2/sem%204/projects/ILARA/src/lib/security.ts) — **Lines 3–5**

```ts
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()
```

**Problem**: In serverless (Vercel), each function invocation may start a **new cold-started instance** with a fresh `Map`. An attacker can trigger 5 requests per instance to bypass the rate limiter entirely. With auto-scaling, this effectively **nullifies rate limiting** under load.

**Fix** (as even noted in your own comment): Replace with [Upstash Redis](https://upstash.com/) for a persistent, distributed rate limiter. This is critical for any production deployment.

```ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '60 s'),
})
```

---

### 6 — MIME Type Spoofing in File Upload
**File**: [`api/upload/route.ts`](file:///c:/Users/Adithiyan/Documents/collegyear-2/sem%204/projects/ILARA/src/app/api/upload/route.ts) — **Lines 29–32**

```ts
const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
if (!allowedTypes.includes(file.type)) {
```

**Problem**: `file.type` comes from the **multipart `Content-Type` header** which is **fully attacker-controlled**. An attacker authenticated as admin can upload a `.php` or `.html` file with `Content-Type: image/jpeg`.

**Fix**: Read the actual file magic bytes (file signature) to validate the real type:

```ts
// Check magic bytes
const magicBytes = buffer.slice(0, 4)
const isJpeg = magicBytes[0] === 0xFF && magicBytes[1] === 0xD8
const isPng = magicBytes[0] === 0x89 && magicBytes[1] === 0x50
const isWebp = buffer.slice(0, 4).toString() === 'RIFF' && buffer.slice(8, 12).toString() === 'WEBP'
if (!isJpeg && !isPng && !isWebp) {
  return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
}
```

---

### 7 — Internal Product ID Leaked in Error Response
**File**: [`api/checkout/route.ts`](file:///c:/Users/Adithiyan/Documents/collegyear-2/sem%204/projects/ILARA/src/app/api/checkout/route.ts) — **Line 62**

```ts
return NextResponse.json({ error: `Product not found: ${item.product_id}` }, { status: 400 })
```

**Problem**: This echoes the internal `product_id` (a UUID) back to the client. While not catastrophic, it confirms to an attacker which UUIDs are valid vs. invalid, enabling enumeration attacks.

**Also**: There is no cap on `items.length` at the array level — an attacker can send 10,000 items causing a huge DB query with `.in('id', productIds)` on thousands of IDs.

**Fix**:
```ts
// Cap items
if (items.length > 20) {
  return NextResponse.json({ error: 'Too many items' }, { status: 400 })
}
// Generic error
return NextResponse.json({ error: 'One or more products are unavailable' }, { status: 400 })
```

---

### 8 — HTML Injection in Confirmation Email
**File**: [`api/webhook/razorpay/route.ts`](file:///c:/Users/Adithiyan/Documents/collegyear-2/sem%204/projects/ILARA/src/app/api/webhook/razorpay/route.ts) — **Lines 63–68**

```ts
html: `
  <h2 style="...">Hey ${order.buyer_name}, your order is confirmed!</h2>
  <p><strong>Order ID:</strong> ${order.id}</p>
  <p><strong>Total:</strong> ₹${order.total_amount}</p>
  <p><strong>Shipping to:</strong> ${order.shipping_address.line1}, ${order.shipping_address.city}</p>
`,
```

**Problem**: `order.buyer_name`, `order.shipping_address.line1`, `.city` are interpolated directly into HTML **without escaping**. Even though `sanitizeText()` strips tags at insert time, if a bypass exists or the data was inserted by another path, this becomes a **stored HTML injection** in the confirmation email. Malicious `buyer_name` like `<img src=x onerror=alert(1)>` could execute in some email clients.

**Fix**: Create an HTML escape helper:
```ts
function escHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
// Then use: escHtml(order.buyer_name) in the template
```

---

## 🟡 Medium Severity

---

### 9 — Open Redirect (Partial)
**File**: [`api/auth/confirm/route.ts`](file:///c:/Users/Adithiyan/Documents/collegyear-2/sem%204/projects/ILARA/src/app/api/auth/confirm/route.ts) — **Lines 11–12**

```ts
const rawNext = searchParams.get('next') || '/admin'
const next = rawNext.startsWith('/dev') ? '/dev' : '/admin'
```

This is **almost correct** but has a gap: the allowlist is `starts with /dev` → `/dev`, else → `/admin`. An attacker cannot redirect to an external domain. **However**, `rawNext = '/dev/../../../evil'` — the path normalization by `new URL(next, request.url)` would resolve this to an absolute path on your own domain, so it's safe from open-redirect to external sites but could be used to redirect within your own app unexpectedly.

**Fix**: Use an explicit allowlist:
```ts
const allowedPaths = ['/admin', '/dev']
const next = allowedPaths.includes(rawNext) ? rawNext : '/admin'
```

---

### 10 — Incomplete Content Security Policy
**File**: [`next.config.ts`](file:///c:/Users/Adithiyan/Documents/collegyear-2/sem%204/projects/ILARA/next.config.ts) — **Line 23**

```
script-src 'self' https://upload-widget.cloudinary.com
```

Issues:
- **Missing Razorpay script** — `https://checkout.razorpay.com` is loaded in `checkout/page.tsx` via `<Script>` but is NOT in `script-src`. This means the CSP **blocks Razorpay in strict browsers** — or you're relying on `'unsafe-inline'`/no enforcement.
- **`connect-src 'self' https://*.supabase.co`** — the wildcard `*.supabase.co` is too broad; tighten to your specific project URL.
- **No `report-uri`** — you have no visibility into CSP violations.

**Fix**:
```
script-src 'self' https://checkout.razorpay.com https://upload-widget.cloudinary.com;
connect-src 'self' https://YOUR_PROJECT_ID.supabase.co;
report-uri /api/csp-report;
```

---

### 11 — IP Spoofing via Header Forgery
**File**: [`lib/security.ts`](file:///c:/Users/Adithiyan/Documents/collegyear-2/sem%204/projects/ILARA/src/lib/security.ts) — **Lines 87–92**

```ts
const cfIP = request.headers.get('cf-connecting-ip')
const forwardedFor = request.headers.get('x-forwarded-for')
const realIP = request.headers.get('x-real-ip')
return cfIP || forwardedFor?.split(',')[0].trim() || realIP || 'unknown'
```

**Problem**: `x-forwarded-for` and `x-real-ip` can be **forged by any client** with a simple header. If you're NOT behind Cloudflare (e.g., in dev or staging), `cfIP` is empty, and the fallback to `x-forwarded-for` allows rate limit bypass: an attacker just sets `X-Forwarded-For: 1.2.3.4` to a fresh IP on every request.

**Fix**: Only trust `cf-connecting-ip` in production. If not behind Cloudflare, use the raw socket IP:

```ts
export function getClientIP(request: Request): string {
  // Only trust Cloudflare header in production
  if (process.env.NODE_ENV === 'production') {
    return request.headers.get('cf-connecting-ip') || 'unknown'
  }
  // In dev, fall back to forwarded headers
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
}
```

---

### 12 — Admin Dashboard Uses Anon Key (No Service Role)
**File**: [`app/admin/page.tsx`](file:///c:/Users/Adithiyan/Documents/collegyear-2/sem%204/projects/ILARA/src/app/admin/page.tsx) — **Lines 18, 28–31**

```ts
const supabase = createClient() // uses ANON key
supabase.from('orders').select('*', { count: 'exact' })
supabase.from('enquiries').select('*', { count: 'exact' })
supabase.from('products').select('*', { count: 'exact' })
```

**Problem**: This is a **client component** using the browser Supabase client with the anon key. It relies 100% on **Row Level Security (RLS)** being correctly configured in Supabase to protect the data. If RLS is misconfigured or disabled on any table, **all orders/enquiries data is exposed to unauthenticated users** since the anon key is public.

**This is not a code bug but a critical RLS dependency** — you must verify:
- `orders` table has RLS enabled with policy: authenticated users only (or admin-only)
- `enquiries` table similarly protected
- `products` write operations protected

**Recommended**: Move admin data fetching to Server Components using the server-side Supabase client for an extra layer of assurance.

---

### 13 — Log Injection via `data: any` in Security Events
**File**: [`lib/security.ts`](file:///c:/Users/Adithiyan/Documents/collegyear-2/sem%204/projects/ILARA/src/lib/security.ts) — **Lines 98–113**

```ts
event: 'rate_limit' | 'honeypot_hit' | 'invalid_webhook' | 'unauthorized_admin_access',
details: { ip: string; path: string; data?: any }
```

When a `honeypot_hit` fires, the **entire raw request body** is logged:
```ts
await logSecurityEvent('honeypot_hit', { ip, path: '/api/checkout', data: { body } })
```

A bot could craft a payload designed to cause issues in log viewers (newline injection, JSON injection into `metadata` JSONB column). If logs are ever exported and parsed, injected content could cause issues.

**Fix**: Sanitize/limit what goes into `data`:
```ts
data: { honeypot: true } // instead of full body
```

---

## 🟢 Low Severity

---

### 14 — Magic Link Sent to Any Email (No Pre-check)
**File**: [`app/admin/login/page.tsx`](file:///c:/Users/Adithiyan/Documents/collegyear-2/sem%204/projects/ILARA/src/app/admin/login/page.tsx) — **Lines 29–34**

The OTP magic link is requested for **any email address**. An attacker can trigger magic link emails to arbitrary addresses, using your Supabase account as an email spam vector or for phishing ("you have a magic link from ilaara.com").

**Fix**: Check on the client that the entered email matches `NEXT_PUBLIC_ADMIN_EMAIL_HINT` (masked), or better, add server-side pre-validation in a `/api/request-magic-link` route that checks the email against allowed list before calling Supabase.

---

### 15 — Internal Order ID Leaked in Checkout Response
**File**: [`api/checkout/route.ts`](file:///c:/Users/Adithiyan/Documents/collegyear-2/sem%204/projects/ILARA/src/app/api/checkout/route.ts) — **Line 127**

```ts
return NextResponse.json({ whatsappUrl, internalOrderId: order.id })
```

The internal Supabase UUID of the order is returned to the client. While this is a UUID (hard to guess), it's stored in the URL on the success page and could be used to probe your `/success` page with guessed IDs.

---

### 16 — Order ID Reflected in URL Without Validation
**File**: [`app/success/page.tsx`](file:///c:/Users/Adithiyan/Documents/collegyear-2/sem%204/projects/ILARA/src/app/success/page.tsx) — **Lines 11, 39–41**

```ts
const orderId = searchParams.get('order')
// ...
Order Reference: <span>{orderId}</span>
```

`orderId` from the URL is rendered directly. While React escapes this by default (no XSS risk), any value can be put in the URL and displayed — including misleading text. No server-side validation that the orderId actually exists or belongs to the current session.

---

## ✅ What's Done Well

- ✅ Server-side price verification (never trusting client prices)
- ✅ `timingSafeEqual` for webhook HMAC comparison
- ✅ EXIF stripping on image upload
- ✅ HSTS, X-Frame-Options, X-Content-Type-Options headers set
- ✅ Honeypot field implementation
- ✅ Supabase server client with `httpOnly`, `secure`, `sameSite: lax` cookies
- ✅ Input sanitization on all user-facing fields
- ✅ Category allowlist on products query (prevents injection)
- ✅ Quantity clamped to 1–10 range

---

## Priority Fix Order

1. **[Critical]** Add server-side Razorpay payment verification (Issue #3)
2. **[Critical]** Fix path traversal in Cloudinary delete (Issue #2)
3. **[High]** Replace in-memory rate limiter with Upstash Redis (Issue #5)
4. **[High]** Validate file magic bytes in upload (Issue #6)
5. **[High]** Escape HTML in confirmation email template (Issue #8)
6. **[Medium]** Add Razorpay to CSP script-src (Issue #10)
7. **[Medium]** Verify RLS is enabled on all Supabase tables (Issue #12)
8. **[Medium]** Fix IP spoofing in rate limiter (Issue #11)
