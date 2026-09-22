'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CustomerOfferPage() {
  const router = useRouter()
  const [serviceName, setServiceName] = useState('')
  const [customerGets, setCustomerGets] = useState('')
  const [pricing, setPricing] = useState('')
  const [booking, setBooking] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const projectId = window.location.pathname.split('/')[2]

    async function loadSavedCustomerOffer() {
      try {
        const response = await fetch(`/api/projects/${projectId}/customer-offer`)
        if (!response.ok) throw new Error('Unable to load customer offer.')
        const data = await response.json()
        const saved = data.customerOffer
        if (saved) {
          setServiceName(typeof saved.service_name === 'string' ? saved.service_name : '')
          setCustomerGets(typeof saved.customer_gets === 'string' ? saved.customer_gets : '')
          setPricing(typeof saved.pricing === 'string' ? saved.pricing : '')
          setBooking(typeof saved.booking === 'string' ? saved.booking : '')
          setNextAction(typeof saved.next_action === 'string' ? saved.next_action : '')
        }
      } catch {
        alert('Unable to load your saved customer offer. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    loadSavedCustomerOffer()
  }, [])

  async function saveCustomerOffer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      const response = await fetch(`/api/projects/${window.location.pathname.split('/')[2]}/customer-offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceName, customerGets, pricing, booking, nextAction }),
      })
      if (!response.ok) throw new Error('Unable to save customer offer.')
      router.push(window.location.pathname.replace('/customer-offer', ''))
      router.refresh()
    } catch {
      setSaving(false)
      alert('Unable to save your customer offer. Please try again.')
    }
  }

  return (
    <main className="min-h-screen bg-brand-black text-white px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <button type="button" onClick={() => router.back()} className="text-white/60 hover:text-white mb-8">
          ← Back to blueprint
        </button>
        <p className="text-brand-gold text-sm font-semibold uppercase">Step 02</p>
        <h1 className="text-3xl md:text-4xl font-bold mt-2">Build your customer offer</h1>
        <p className="text-white/60 leading-7 mt-3 mb-8">
          Turn your launch target into a clear offer customers can understand,
          request, and pay for.
        </p>
        <form onSubmit={saveCustomerOffer} className="space-y-6">
          <fieldset disabled={loading || saving} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold mb-2">What is the service called?</label>
              <input value={serviceName} onChange={(event) => setServiceName(event.target.value)} required
                className="w-full rounded-xl bg-white/5 border border-white/10 p-4 text-white placeholder:text-white/30 outline-none focus:border-brand-gold"
                placeholder="For example: Marketplace Pickup & Delivery" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">What does the customer get?</label>
              <textarea value={customerGets} onChange={(event) => setCustomerGets(event.target.value)} required rows={4}
                className="w-full rounded-xl bg-white/5 border border-white/10 p-4 text-white placeholder:text-white/30 outline-none focus:border-brand-gold"
                placeholder="Describe exactly what is included from request to delivery." />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">How will you charge?</label>
              <textarea value={pricing} onChange={(event) => setPricing(event.target.value)} required rows={3}
                className="w-full rounded-xl bg-white/5 border border-white/10 p-4 text-white placeholder:text-white/30 outline-none focus:border-brand-gold"
                placeholder="Describe your starting price, delivery fee, mileage, size, or other pricing rules." />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">How will customers request or book it?</label>
              <textarea value={booking} onChange={(event) => setBooking(event.target.value)} required rows={3}
                className="w-full rounded-xl bg-white/5 border border-white/10 p-4 text-white placeholder:text-white/30 outline-none focus:border-brand-gold"
                placeholder="For example: submit the item link, seller location, pickup time, and delivery address." />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">What should the customer do next?</label>
              <input value={nextAction} onChange={(event) => setNextAction(event.target.value)} required
                className="w-full rounded-xl bg-white/5 border border-white/10 p-4 text-white placeholder:text-white/30 outline-none focus:border-brand-gold"
                placeholder="For example: Request a Pickup" />
            </div>
            <button type="submit" className="btn-primary disabled:opacity-60">
              {loading ? 'Loading saved answers…' : saving ? 'Saving…' : 'Save Customer Offer →'}
            </button>
          </fieldset>
        </form>
      </div>
    </main>
  )
}
