import crypto from 'crypto'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redisClient =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null

const rateLimiter = redisClient
  ? new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(5, '60 s'),
    })
  : null

const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

export async function rateLimit(
  identifier: string,
  maxRequests: number = 10,
  windowMs: number = 60000
): Promise<boolean> {
  if (rateLimiter) {
    try {
      const { success } = await rateLimiter.limit(identifier)
      return success
    } catch (err) {
      console.warn('Upstash rate limit unavailable, falling back to local store', err)
    }
  }

  const now = Date.now()

  for (const [key, record] of rateLimitStore.entries()) {
    if (record.resetAt < now) {
      rateLimitStore.delete(key)
    }
  }

  const record = rateLimitStore.get(identifier)

  if (!record || now > record.resetAt) {
    rateLimitStore.set(identifier, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (record.count >= maxRequests) {
    return false
  }

  record.count++
  return true
}

export function verifyRazorpayWebhook(
  body: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex')

  const sigBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)

  if (sigBuffer.length !== expectedBuffer.length) return false

  return crypto.timingSafeEqual(sigBuffer, expectedBuffer)
}

export function verifyRazorpayPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string
): boolean {
  const payload = `${orderId}|${paymentId}`
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')

  const sigBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)

  if (sigBuffer.length !== expectedBuffer.length) return false

  return crypto.timingSafeEqual(sigBuffer, expectedBuffer)
}

export function escapeHtml(input: string): string {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function sanitizeText(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/[<>'"]/g, '')
    .trim()
    .slice(0, 2000)
}

export function validatePhone(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(phone.replace(/\s/g, ''))
}

export function validatePincode(pincode: string): boolean {
  return /^[1-9][0-9]{5}$/.test(pincode)
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length < 255
}

export function isBot(honeypotValue: string): boolean {
  return honeypotValue !== ''
}

export function getClientIP(request: Request): string {
  const cfIP = request.headers.get('cf-connecting-ip')
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')

  if (process.env.NODE_ENV === 'production') {
    return cfIP || 'unknown'
  }

  return cfIP || forwardedFor?.split(',')[0].trim() || realIP || 'unknown'
}

type SecurityEventDetail = {
  ip: string
  path: string
  data?: Record<string, unknown>
}

export async function logSecurityEvent(
  event: 'rate_limit' | 'honeypot_hit' | 'invalid_webhook' | 'unauthorized_admin_access',
  details: SecurityEventDetail
) {
  try {
    const { createClient } = await import('./supabase/server')
    const supabase = await createClient()
    await supabase.from('security_logs').insert({
      event_type: event,
      ip_address: details.ip,
      path: details.path,
      metadata: details.data,
    })
    console.warn(`[SECURITY] ${event.toUpperCase()} from ${details.ip} on ${details.path}`)
  } catch (err) {
    console.error('Failed to log security event:', err)
  }
}
