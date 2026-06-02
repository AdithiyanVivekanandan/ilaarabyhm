import Razorpay from 'razorpay'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, getClientIP, sanitizeText, validateEmail, validatePhone, validatePincode, isBot, logSecurityEvent } from '@/lib/security'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const ip = getClientIP(request)

  if (!(await rateLimit(ip, 5, 60000))) {
    await logSecurityEvent('rate_limit', { ip, path: '/api/checkout' })
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const body = await request.json()

  if (isBot(body.website || '')) {
    await logSecurityEvent('honeypot_hit', { ip, path: '/api/checkout', data: { honeypot: true } })
    return NextResponse.json({ success: true })
  }

  const { buyerName, buyerEmail, buyerPhone, shippingAddress, items } = body

  if (!buyerName || sanitizeText(buyerName).length < 2) {
    return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
  }
  if (!validateEmail(buyerEmail)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }
  if (!validatePhone(buyerPhone)) {
    return NextResponse.json({ error: 'Invalid phone' }, { status: 400 })
  }
  if (!validatePincode(shippingAddress?.pincode)) {
    return NextResponse.json({ error: 'Invalid pincode' }, { status: 400 })
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'No items in order' }, { status: 400 })
  }
  if (items.length > 20) {
    return NextResponse.json({ error: 'Too many items' }, { status: 400 })
  }

  const productIds = Array.from(new Set(items.map((item: any) => item.product_id)))
  if (productIds.length === 0) {
    return NextResponse.json({ error: 'No valid products' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: products, error: productError } = await supabase
    .from('products')
    .select('id, name, price, is_available')
    .in('id', productIds)

  if (productError || !products) {
    return NextResponse.json({ error: 'Failed to verify products' }, { status: 500 })
  }

  let totalAmount = 0
  const verifiedItems: Array<{ product_id: string; name: string; price: number; quantity: number }> = []

  for (const item of items) {
    const product = products.find(p => p.id === item.product_id)
    if (!product) {
      return NextResponse.json({ error: 'One or more products are unavailable' }, { status: 400 })
    }
    if (!product.is_available) {
      return NextResponse.json({ error: 'One or more products are unavailable' }, { status: 400 })
    }
    const quantity = Math.max(1, Math.min(10, parseInt(item.quantity, 10) || 1))
    totalAmount += product.price * quantity
    verifiedItems.push({
      product_id: product.id,
      name: product.name,
      price: product.price,
      quantity,
    })
  }

  try {
    const whatsappNumber = process.env.CLIENT_WHATSAPP_NUMBER
    if (!whatsappNumber) {
      return NextResponse.json({ error: 'WhatsApp configuration missing' }, { status: 500 })
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        buyer_name: sanitizeText(buyerName),
        buyer_email: buyerEmail.toLowerCase().trim(),
        buyer_phone: buyerPhone.replace(/\s/g, ''),
        shipping_address: {
          line1: sanitizeText(shippingAddress.line1),
          city: sanitizeText(shippingAddress.city),
          state: sanitizeText(shippingAddress.state),
          pincode: shippingAddress.pincode,
          custom_request: sanitizeText(shippingAddress.customRequest || ''),
        },
        items: verifiedItems,
        total_amount: totalAmount,
        status: 'pending',
      })
      .select('id')
      .single()

    if (orderError || !order) {
      throw orderError ?? new Error('Order creation failed')
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    })

    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(totalAmount * 100),
      currency: 'INR',
      receipt: order.id,
      payment_capture: true,
      notes: {
        internal_order_id: order.id,
      },
    })

    await supabase
      .from('orders')
      .update({ razorpay_order_id: razorpayOrder.id })
      .eq('id', order.id)

    const encodedPhone = whatsappNumber.replace(/\D/g, '')
    const messageLines = [
      'New Ilaara order received!',
      `Name: ${sanitizeText(buyerName)}`,
      `Email: ${buyerEmail.toLowerCase().trim()}`,
      `Phone: ${buyerPhone.replace(/\s/g, '')}`,
      `Address: ${sanitizeText(shippingAddress.line1)}, ${sanitizeText(shippingAddress.city)}, ${sanitizeText(shippingAddress.state)} - ${shippingAddress.pincode}`,
      'Items:',
      ...verifiedItems.map(item => `• ${item.name} ×${item.quantity} @ ₹${item.price}`),
      `Total: ₹${totalAmount.toLocaleString('en-IN')}`,
    ]

    if (shippingAddress.customRequest) {
      messageLines.push(`Custom request: ${sanitizeText(shippingAddress.customRequest)}`)
    }

    const whatsappUrl = `https://wa.me/${encodedPhone}?text=${encodeURIComponent(messageLines.join('\n'))}`

    return NextResponse.json({
      whatsappUrl,
      internalOrderId: order.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      orderId: razorpayOrder.id,
    })
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json({ error: 'Checkout failed' }, { status: 500 })
  }
}
