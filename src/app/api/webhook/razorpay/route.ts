import { createClient } from '@/lib/supabase/server'
import { verifyRazorpayWebhook, escapeHtml } from '@/lib/security'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function POST(request: Request) {
  const resend = new Resend(process.env.RESEND_API_KEY!)
  const signature = request.headers.get('x-razorpay-signature')

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  const rawBody = await request.text()

  const isValid = verifyRazorpayWebhook(
    rawBody,
    signature,
    process.env.RAZORPAY_WEBHOOK_SECRET!
  )

  if (!isValid) {
    console.warn('Invalid webhook signature received')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const event = JSON.parse(rawBody)

  if (event.event !== 'payment.captured') {
    return NextResponse.json({ received: true })
  }

  const payment = event.payload.payment.entity
  const razorpayOrderId = payment.order_id
  const razorpayPaymentId = payment.id

  const supabase = await createClient()

  const { data: order, error } = await supabase
    .from('orders')
    .update({
      razorpay_payment_id: razorpayPaymentId,
      status: 'confirmed',
    })
    .eq('razorpay_order_id', razorpayOrderId)
    .eq('status', 'pending')
    .select()
    .single()

  if (error || !order) {
    console.error('Order update error:', error)
    return NextResponse.json({ error: 'Order update failed' }, { status: 500 })
  }

  try {
    const buyerName = escapeHtml(order.buyer_name || '')
    const totalAmount = escapeHtml(String(order.total_amount || '0'))
    const line1 = escapeHtml(order.shipping_address?.line1 || '')
    const city = escapeHtml(order.shipping_address?.city || '')

    await resend.emails.send({
      from: 'orders@ilaara.com',
      to: order.buyer_email,
      subject: 'Order confirmed! | Ilaara',
      html: `
        <div style="font-family: serif; color: #1A1A1A; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #FAF9F6;">
          <h1 style="color: #8B0000; letter-spacing: 0.2em; text-transform: uppercase; font-weight: 300;">ILAARA</h1>
          <h2 style="font-style: italic;">Hey ${buyerName}, your order is confirmed!</h2>
          <p>The threads are being prepared. Your pieces have been safely recorded in our collection.</p>
          <div style="background: #FAF9F6; padding: 20px; margin: 30px 0;">
            <p><strong>Order ID:</strong> ${escapeHtml(order.id)}</p>
            <p><strong>Total:</strong> ₹${totalAmount}</p>
            <p><strong>Shipping to:</strong> ${line1}, ${city}</p>
          </div>
          <p>Questions? Reach out to us on WhatsApp or reply to this email.</p>
          <p style="font-size: 10px; color: #999; margin-top: 40px; letter-spacing: 0.1em; text-transform: uppercase;">Handmade with care.</p>
        </div>
      `,
    })
  } catch (emailError) {
    console.error('Email send error:', emailError)
  }

  return NextResponse.json({ received: true })
}
