import { createClient } from '@/lib/supabase/server'
import { verifyRazorpayPaymentSignature } from '@/lib/security'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const body = await request.json()
  const razorpayOrderId = typeof body.razorpay_order_id === 'string' ? body.razorpay_order_id : ''
  const razorpayPaymentId = typeof body.razorpay_payment_id === 'string' ? body.razorpay_payment_id : ''
  const razorpaySignature = typeof body.razorpay_signature === 'string' ? body.razorpay_signature : ''
  const internalOrderId = typeof body.internalOrderId === 'string' ? body.internalOrderId : ''

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !internalOrderId) {
    return NextResponse.json({ error: 'Invalid payment payload' }, { status: 400 })
  }

  if (!process.env.RAZORPAY_KEY_SECRET) {
    return NextResponse.json({ error: 'Payment secret not configured' }, { status: 500 })
  }

  const isValidSignature = verifyRazorpayPaymentSignature(
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    process.env.RAZORPAY_KEY_SECRET
  )

  if (!isValidSignature) {
    return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: order, error } = await supabase
    .from('orders')
    .select('id, razorpay_order_id, status')
    .eq('id', internalOrderId)
    .single()

  if (error || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  if (order.razorpay_order_id !== razorpayOrderId) {
    return NextResponse.json({ error: 'Order mismatch' }, { status: 400 })
  }

  if (order.status === 'confirmed') {
    return NextResponse.json({ success: true })
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update({ razorpay_payment_id: razorpayPaymentId, status: 'processing' })
    .eq('id', internalOrderId)

  if (updateError) {
    return NextResponse.json({ error: 'Order verification failed' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
