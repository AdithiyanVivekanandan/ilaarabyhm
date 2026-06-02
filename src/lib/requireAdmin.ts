import { createClient } from '@/lib/supabase/server'

export async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.email) {
    return null
  }

  const normalizedEmail = user.email.toLowerCase().trim()
  const adminEmail = (process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL || '').toLowerCase().trim()
  const devEmail = (process.env.DEV_EMAIL || process.env.NEXT_PUBLIC_DEV_EMAIL || '').toLowerCase().trim()

  if (adminEmail && normalizedEmail === adminEmail) {
    return user
  }

  if (devEmail && normalizedEmail === devEmail) {
    return user
  }

  return null
}
