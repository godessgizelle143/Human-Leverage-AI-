'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CustomerFoundationPage() {
  const router = useRouter()
  const [foundationType, setFoundationType] = useState('')
  const [customerExperience, setCustomerExperience] = useState('')
  const [customerInfo, setCustomerInfo] = useState('')
  const [firstAction, setFirstAction] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const projectId = window.location.pathname.split('/')[2]

    async function loadSavedCustomerFoundation() {
      try {
        const response = await fetch(`/api/projects/${projectId}/customer-foundation`)
        if (!response.ok) throw new Error('Unable to load customer foundation.')
        const data = await response.json()
        const saved = data.customerFoundation
        if (saved) {
          setFoundationType(typeof saved.foundation_type === 'string' ? saved.foundation_type : '')
          setCustomerExperience(typeof saved.customer_experience === 'string' ? saved.customer_experience : '')
          setCustomerInfo(typeof saved.customer_information === 'string' ? saved.customer_information : '')
          setFirstAction(typeof saved.after_submission === 'string' ? saved.after_submission : '')
        }
      } catch {
        alert('Unable to load your saved customer foundation. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    loadSavedCustomerFoundation()
  }, [])

  async function saveCustomerFoundation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      const response = await fetch(`/api/projects/${window.location.pathname.split('/')[2]}/customer-foundation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foundationType, customerExperience, customerInfo, firstAction }),
      })
      if (!response.ok) throw new Error('Unable to save customer foundation.')
      router.push(window.location.pathname.replace('/customer-foundation', ''))
      router.refresh()
    } catch {
      setSaving(false)
      alert('Unable to save your customer foundation. Please try again.')
    }
  }

  return (
    <main className="min-h-screen bg-brand-black text-white px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <button type="button" onClick={() => router.back()} className="text-white/60 hover:text-white mb-8">
          ← Back to blueprint
        </button>
        <p className="text-brand-gold text-sm font-semibold uppercase">Step 03</p>
        <h1 className="text-3xl md:text-4xl font-bold mt-2">Build your customer foundation</h1>
        <p className="text-white/60 leading-7 mt-3 mb-8">
          Define the customer-facing experience your business needs first.
          Human Leverage AI will use your offer and launch target to shape the
          foundation without making you start over.
        </p>
        <form onSubmit={saveCustomerFoundation} className="space-y-6">
          <fieldset disabled={loading || saving} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold mb-2">What are you building first?</label>
              <select value={foundationType} onChange={(event) => setFoundationType(event.target.value)} required
                className="w-full rounded-xl bg-white/5 border border-white/10 p-4 text-white outline-none focus:border-brand-gold">
                <option value="" disabled>Select one</option>
                <option value="website">Website</option>
                <option value="booking-flow">Booking flow</option>
                <option value="application">Application</option>
                <option value="website-and-booking">Website + booking flow</option>
                <option value="custom">Something else</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">What should the customer be able to do?</label>
              <textarea value={customerExperience} onChange={(event) => setCustomerExperience(event.target.value)} required rows={4}
                className="w-full rounded-xl bg-white/5 border border-white/10 p-4 text-white placeholder:text-white/30 outline-none focus:border-brand-gold"
                placeholder="Describe the main action the customer needs to complete." />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">What information do you need from the customer?</label>
              <textarea value={customerInfo} onChange={(event) => setCustomerInfo(event.target.value)} required rows={4}
                className="w-full rounded-xl bg-white/5 border border-white/10 p-4 text-white placeholder:text-white/30 outline-none focus:border-brand-gold"
                placeholder="For example: item details, pickup location, delivery address, contact information, and preferred time." />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">What should happen after they submit?</label>
              <textarea value={firstAction} onChange={(event) => setFirstAction(event.target.value)} required rows={4}
                className="w-full rounded-xl bg-white/5 border border-white/10 p-4 text-white placeholder:text-white/30 outline-none focus:border-brand-gold"
                placeholder="Describe the confirmation, next step, or follow-up the customer should receive." />
            </div>
            <button type="submit" className="btn-primary disabled:opacity-60">
              {loading ? 'Loading saved answers…' : saving ? 'Saving…' : 'Save Customer Foundation →'}
            </button>
          </fieldset>
        </form>
      </div>
    </main>
  )
}
