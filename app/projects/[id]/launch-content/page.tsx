'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LaunchContentPage() {
  const router = useRouter()
  const [launchGoal, setLaunchGoal] = useState('')
  const [audience, setAudience] = useState('')
  const [channels, setChannels] = useState('')
  const [callToAction, setCallToAction] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const projectId = window.location.pathname.split('/')[2]

    async function loadSavedLaunchContent() {
      try {
        const response = await fetch(`/api/projects/${projectId}/launch-content`)
        if (!response.ok) throw new Error('Unable to load launch content.')
        const data = await response.json()
        const saved = data.launchContent
        if (saved) {
          setLaunchGoal(typeof saved.launch_goal === 'string' ? saved.launch_goal : '')
          setAudience(typeof saved.audience === 'string' ? saved.audience : '')
          setChannels(typeof saved.channels === 'string' ? saved.channels : '')
          setCallToAction(typeof saved.call_to_action === 'string' ? saved.call_to_action : '')
        }
      } catch {
        alert('Unable to load your saved launch content. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    loadSavedLaunchContent()
  }, [])

  async function saveLaunchContent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      const projectId = window.location.pathname.split('/')[2]
      const response = await fetch(`/api/projects/${projectId}/launch-content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ launchGoal, audience, channels, callToAction }),
      })
      if (!response.ok) throw new Error('Unable to save launch content.')
      router.push(window.location.pathname.replace('/launch-content', ''))
      router.refresh()
    } catch {
      setSaving(false)
      alert('Unable to save your launch content plan. Please try again.')
    }
  }

  return (
    <main className="min-h-screen bg-brand-black text-white px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <button type="button" onClick={() => router.back()} className="text-white/60 hover:text-white mb-8">
          ← Back to blueprint
        </button>
        <p className="text-brand-gold text-sm font-semibold uppercase">Step 04</p>
        <h1 className="text-3xl md:text-4xl font-bold mt-2">Create your launch content</h1>
        <p className="text-white/60 leading-7 mt-3 mb-8">
          Turn your positioning into a practical 30/60/90-day content plan.
          Start with the audience, goal, channels, and action you want your
          launch content to drive.
        </p>
        <form onSubmit={saveLaunchContent} className="space-y-6">
          <fieldset disabled={loading || saving} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold mb-2">What is the main goal of your launch?</label>
              <textarea value={launchGoal} onChange={(event) => setLaunchGoal(event.target.value)} required rows={3}
                className="w-full rounded-xl bg-white/5 border border-white/10 p-4 text-white placeholder:text-white/30 outline-none focus:border-brand-gold"
                placeholder="For example: Get the first 10 local customers and validate the service." />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Who are you trying to reach first?</label>
              <textarea value={audience} onChange={(event) => setAudience(event.target.value)} required rows={3}
                className="w-full rounded-xl bg-white/5 border border-white/10 p-4 text-white placeholder:text-white/30 outline-none focus:border-brand-gold"
                placeholder="Describe the specific customer or community you want to reach first." />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Where will you publish or promote your launch?</label>
              <textarea value={channels} onChange={(event) => setChannels(event.target.value)} required rows={3}
                className="w-full rounded-xl bg-white/5 border border-white/10 p-4 text-white placeholder:text-white/30 outline-none focus:border-brand-gold"
                placeholder="For example: website, Facebook groups, Instagram, email, local partnerships, or community events." />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">What action should your content drive?</label>
              <input value={callToAction} onChange={(event) => setCallToAction(event.target.value)} required
                className="w-full rounded-xl bg-white/5 border border-white/10 p-4 text-white placeholder:text-white/30 outline-none focus:border-brand-gold"
                placeholder="For example: Request a Pickup" />
            </div>
            <button type="submit" className="btn-primary disabled:opacity-60">
              {loading ? 'Loading saved answers…' : saving ? 'Saving…' : 'Save Launch Content Plan →'}
            </button>
          </fieldset>
        </form>
      </div>
    </main>
  )
}
