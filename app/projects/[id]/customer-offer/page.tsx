'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CustomerOfferPage() {
  const router = useRouter()
  const [serviceName, setServiceName] = useState('')
  const [customerGets, setCustomerGets] = useState('')
  const [pricing, setPricing] = useState('')
  const [booking, setBooking] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [saving, setSaving] = useState(false)

  async function saveCustomerOffer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)

    try {
      const response = await fetch(
        `/api/projects/${window.location.pathname.split('/')[2]}/customer-offer`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serviceName,
            customerGets,
            pricing,
            booking,
            nextAction,
          }),
        }
      )

      if (!response.ok) {
        throw new Error('Unable to save customer offer.')
      }

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
        <button
          type="button"
          onClick={() => router.back()}
          className="text-white/60 hover:text-white mb-8"
        >
          ← Back to blueprint
        </button>

        <p className="text-brand-gold text-sm font-semibold uppercase">
          Step 02
        </p>

        <h1 className="text-3xl md:text-4xl font-bold mt-2">
          Build your customer offer
        </h1>

        <p className="text-white/60 leading-7 mt-3 mb-8">
          Turn your launch target into a clear offer customers can understand,
          request, and pay for.
        </p>

        <form onSubmit={saveCustomerOffer} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold mb-2">
              What is the service called?
            </label>
            <input
              value={serviceName}
              onChange={(event) => setServiceName(event.target.value)}
              required
              className="w-full rounded-xl bg-white/5 border border-white/10 p-4 text-white placeholder:text-white/30 outline-none focus:border-brand-gold"
              placeholder="For example: Marketplace Pickup & Delivery"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">
              What does the customer get?
            </label>
            <textarea
              value={customerGets}
              onChange={(event) => setCustomerGets(event.target.value)}
              required
              rows={4}
              className="w-full rounded-xl bg-white/5 border border-white/10 p-4 text-white placeholder:text-white/30 outline-none focus:border-brand-gold"
              placeholder="Describe exactly what is included from request to delivery."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">
              How will you charge?
            </label>
            <textarea
              value={pricing}
              onChange={(event) => setPricing(event.target.value)}
              required
              rows={3}
              className="w-full rounded-xl bg-white/5 border border-white/10 p-4 text-white placeholder:text-white/30 outline-none focus:border-brand-gold"
              placeholder="Describe your starting price, delivery fee, mileage, size, or other pricing rules."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">
              How will customers request or book it?
            </label>
            <textarea
              value={booking}
              onChange={(event) => setBooking(event.target.value)}
              required
              rows={3}
              className="w-full rounded-xl bg-white/5 border border-white/10 p-4 text-white placeholder:text-white/30 outline-none focus:border-brand-gold"
              placeholder="For example: submit the item link, seller location, pickup time, and delivery address."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">
              What should the customer do next?
            </label>
            <input
              value={nextAction}
              onChange={(event) => setNextAction(event.target.value)}
              required
              className="w-full rounded-xl bg-white/5 border border-white/10 p-4 text-white placeholder:text-white/30 outline-none focus:border-brand-gold"
              placeholder="For example: Request a Pickup"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="btn-primary disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save Customer Offer →'}
          </button>
        </form>
      </div>
    </main>
  )
}
