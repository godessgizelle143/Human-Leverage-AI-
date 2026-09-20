'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LaunchTargetPage() {
  const router = useRouter()
  const [audience, setAudience] = useState('')
  const [location, setLocation] = useState('')
  const [offer, setOffer] = useState('')
  const [milestone, setMilestone] = useState('')
  const [saving, setSaving] = useState(false)

  async function saveLaunchTarget(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)

    try {
      const response = await fetch(`/api/projects/${window.location.pathname.split('/')[2]}/launch-target`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audience, location, offer, milestone }),
      })

      if (!response.ok) {
        throw new Error('Unable to save launch target.')
      }

      router.push(window.location.pathname.replace('/launch-target', ''))
      router.refresh()
    } catch {
      setSaving(false)
      alert('Unable to save your launch target. Please try again.')
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
          Step 01
        </p>

        <h1 className="text-3xl md:text-4xl font-bold mt-2">
          Define your launch target
        </h1>

        <p className="text-white/60 leading-7 mt-3 mb-8">
          Turn your blueprint into a specific launch target. Human Leverage AI
          will use this information to guide the next steps without making you
          repeat your original interview.
        </p>

        <form onSubmit={saveLaunchTarget} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold mb-2">
              Who are you serving?
            </label>
            <textarea
              value={audience}
              onChange={(event) => setAudience(event.target.value)}
              required
              rows={4}
              className="w-full rounded-xl bg-white/5 border border-white/10 p-4 text-white placeholder:text-white/30 outline-none focus:border-brand-gold"
              placeholder="Describe the specific customer you want to reach first."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">
              Where are you launching?
            </label>
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              required
              className="w-full rounded-xl bg-white/5 border border-white/10 p-4 text-white placeholder:text-white/30 outline-none focus:border-brand-gold"
              placeholder="City, region, or service area"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">
              What are you offering first?
            </label>
            <textarea
              value={offer}
              onChange={(event) => setOffer(event.target.value)}
              required
              rows={4}
              className="w-full rounded-xl bg-white/5 border border-white/10 p-4 text-white placeholder:text-white/30 outline-none focus:border-brand-gold"
              placeholder="Describe the first service or product customers can actually buy."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">
              What is your first milestone?
            </label>
            <input
              value={milestone}
              onChange={(event) => setMilestone(event.target.value)}
              required
              className="w-full rounded-xl bg-white/5 border border-white/10 p-4 text-white placeholder:text-white/30 outline-none focus:border-brand-gold"
              placeholder="For example: complete the first 10 paid orders"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="btn-primary disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save Launch Target →'}
          </button>
        </form>
      </div>
    </main>
  )
}
