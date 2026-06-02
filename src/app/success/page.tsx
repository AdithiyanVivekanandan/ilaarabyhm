'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import gsap from 'gsap'

function SuccessContent() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get('order')
  const [validOrder, setValidOrder] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    gsap.from('.success-fade', {
      opacity: 0,
      y: 20,
      duration: 1.2,
      stagger: 0.3,
      ease: 'power3.out',
    })
  }, [])

  useEffect(() => {
    if (!orderId) {
      setChecked(true)
      return
    }

    fetch(`/api/order/validate?order=${encodeURIComponent(orderId)}`)
      .then((res) => {
        setValidOrder(res.ok)
      })
      .catch(() => {
        setValidOrder(false)
      })
      .finally(() => {
        setChecked(true)
      })
  }, [orderId])

  return (
    <div className="max-w-xl mx-auto text-center space-y-12">
      <div className="space-y-4">
        <h1 className="success-fade text-5xl md:text-7xl font-light text-brand-red italic font-serif">
          It is finished.
        </h1>
        <p className="success-fade text-[10px] uppercase tracking-[0.4em] text-gray-400">
          Your order has been captured
        </p>
      </div>

      <div className="success-fade bg-white p-12 rounded-sm shadow-sm space-y-6">
        <p className="text-gray-600 leading-relaxed">
          The makers have been notified. You will receive a confirmation email shortly with the details of your selection.
        </p>
        {checked && validOrder && orderId && (
          <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold border-t border-gray-50 pt-6">
            Order Reference: <span className="text-brand-dark">{orderId}</span>
          </p>
        )}
        {checked && !validOrder && orderId && (
          <p className="text-[10px] uppercase tracking-widest text-red-600 font-bold border-t border-gray-50 pt-6">
            This order reference could not be verified.
          </p>
        )}
      </div>

      <div className="success-fade pt-8">
        <Link
          href="/shop"
          className="inline-block px-12 py-5 bg-brand-red text-brand-cream text-xs uppercase tracking-[0.3em] font-bold rounded-full hover:bg-brand-dark transition-all shadow-lg"
        >
          Return to Collection
        </Link>
      </div>

      <p className="success-fade text-[10px] text-gray-300 uppercase tracking-widest leading-loose">
        Thank you for supporting slow craft.
      </p>
    </div>
  )
}

export default function SuccessPage() {
  return (
    <main className="min-h-screen bg-brand-cream pt-48 px-8 md:px-16 pb-24">
      <Navbar />
      <Suspense fallback={<div className="text-center animate-pulse italic font-serif">Awaiting confirmation...</div>}>
        <SuccessContent />
      </Suspense>
    </main>
  )
}
