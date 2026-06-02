'use client'

import { useState } from 'react'
import Navbar from '@/components/Navbar'

export default function ContactPage() {
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
    isCustomOrder: false,
    website: '' // Honeypot
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        setSubmitted(true)
      } else {
        alert('Something went wrong. Please try again.')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-brand-cream pt-24 md:pt-32 px-6 md:px-16 pb-24">
      <Navbar />
      
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-24 items-start">
        <section className="space-y-10 md:space-y-12">
          <header className="space-y-4">
            <h1 className="text-5xl md:text-7xl font-light text-brand-red italic font-serif">Say Hello.</h1>
            <p className="text-[10px] uppercase tracking-[0.4em] text-gray-400">Collaborations & Inquiries</p>
          </header>

          <div className="space-y-8">
            <p className="text-base md:text-lg text-gray-600 leading-relaxed">
              Whether you're looking for a custom crochet piece, have questions about a polaroid print, or just want to share a story — we're listening.
            </p>
            
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-gray-400">Contact method</p>
              <p className="text-base md:text-lg text-gray-600 leading-relaxed">Please use the form to send your message — our team will reply by email or WhatsApp after submission.</p>
            </div>
          </div>
        </section>

        <section className="bg-white p-12 rounded-sm shadow-sm">
          {submitted ? (
            <div className="py-12 text-center space-y-4">
              <h2 className="text-2xl font-serif italic text-brand-red">Message Sent.</h2>
              <p className="text-xs text-gray-400 uppercase tracking-widest">We'll bridge the thread shortly.</p>
              <button 
                onClick={() => setSubmitted(false)}
                className="pt-8 text-[10px] uppercase tracking-widest text-brand-red font-bold"
              >
                Send another?
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Honeypot */}
              <div className="hidden">
                <input 
                  type="text" 
                  value={formData.website} 
                  onChange={e => setFormData({...formData, website: e.target.value})} 
                />
              </div>

              <div className="space-y-6">
                <input
                  required
                  placeholder="Your Name"
                  className="w-full bg-transparent border-b border-gray-100 py-3 text-sm outline-none focus:border-brand-red transition-colors"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
                <input
                  required
                  type="email"
                  placeholder="Email Address"
                  className="w-full bg-transparent border-b border-gray-100 py-3 text-sm outline-none focus:border-brand-red transition-colors"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
                <textarea
                  required
                  placeholder="How can we help?"
                  rows={4}
                  className="w-full bg-transparent border-b border-gray-100 py-3 text-sm outline-none focus:border-brand-red transition-colors resize-none"
                  value={formData.message}
                  onChange={e => setFormData({...formData, message: e.target.value})}
                />
                
                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    id="custom" 
                    className="accent-brand-red"
                    checked={formData.isCustomOrder}
                    onChange={e => setFormData({...formData, isCustomOrder: e.target.checked})}
                  />
                  <label htmlFor="custom" className="text-[10px] uppercase tracking-widest text-gray-400 cursor-pointer">This is a custom order request</label>
                </div>
              </div>

              <button
                disabled={loading}
                className="w-full py-5 bg-brand-red text-brand-cream text-xs uppercase tracking-[0.3em] font-bold rounded-full hover:bg-brand-dark transition-all shadow-lg"
              >
                {loading ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  )
}
