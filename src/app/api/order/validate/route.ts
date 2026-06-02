import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get('order')

  if (!orderId) {
    return NextResponse.json({ valid: false }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: order, error } = await supabase
    .from('orders')
    .select('id')
    .eq('id', orderId)
    .single()

  if (error || !order) {
    return NextResponse.json({ valid: false }, { status: 404 })
  }

  return NextResponse.json({ valid: true })
}
