'use client'

import { useState } from 'react'
import Link from 'next/link'
import { INTERVIEW_QUESTIONS } from '@/types/interview'

type ProjectContent = Record<string, unknown>

export default function BuilderPage() {
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [current, setCurrent] = useState(0)
  const [building, setBuilding] = useState(false)
  const [error, setError] = useState('')
  const [project, setProject] = useState<{ title: string; content: ProjectContent } | null>(null)

  const question = INTERVIEW_QUESTIONS[current]
  const progress = Math.round(((current + 1) / INTERVIEW_QUESTIONS.length) * 100)
  const isLast = current === INTERVIEW_QUESTIONS.length - 1

  const saveAnswer = (value: string) => {
    setAnswers((previous) => ({ ...previous, [question.id]: value }))
    setError('')
  }

  const buildAssets = async () => {
    if (building) return
    setBuilding(true)
    setError('')
    try {
      const response = await fetch('/api/projects/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ answers }),
      })

      const raw = await response.text()
      let data: { project?: { title: string; content: ProjectContent }; error?: string } = {}
      try { data = JSON.parse(raw) } catch { /* handled below */ }

      if (!response.ok) {
        throw new Error(data.error || `Asset builder returned HTTP ${response.status}.`)
      }
      if (!data.project) throw new Error('The asset builder returned no project.')
      setProject(data.project)
    } catch (err) {
      console.error('Build My Assets failed:', err)
      setError(err instanceof Error ? err.message : 'Unable to build your assets. Please try again.')
    } finally {
      setBuilding(false)
    }
  }

  if (project) {
    return (
      <main className="min-h-screen bg-brand-black text-white px-6 py-10">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-10">
            <div><p className="text-brand-gold text-sm font-semibold mb-2">HUMAN LEVERAGE AI™</p><h1 className="text-3xl font-bold">{project.title}</h1></div>
            <Link href="/dashboard" className="text-white/60 hover:text-white">← Dashboard</Link>
          </div>
          <div className="glass rounded-2xl p-8">
            <div className="mb-8"><p className="text-brand-gold font-semibold">Your assets are ready</p><h2 className="text-2xl font-semibold mt-2">Your business blueprint</h2></div>
            <div className="space-y-7">
              {Object.entries(project.content).map(([key, value]) => (
                <section key={key}><h3 className="text-lg font-semibold capitalize mb-2">{key.replaceAll('_', ' ')}</h3><p className="text-white/80 leading-7 whitespace-pre-wrap">{typeof value === 'string' ? value : JSON.stringify(value, null, 2)}</p></section>
              ))}
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-brand-black text-white px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-10"><div><p className="text-brand-gold text-sm font-semibold mb-2">HUMAN LEVERAGE AI™</p><h1 className="text-3xl font-bold">Start a New Project</h1></div><Link href="/dashboard" className="text-white/60 hover:text-white">← Dashboard</Link></div>
        <div className="glass rounded-2xl p-8">
          <div className="flex items-center justify-between mb-3 text-sm text-white/50"><span>AI Business Interview</span><span>{current + 1} of {INTERVIEW_QUESTIONS.length}</span></div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden mb-10"><div className="h-full bg-brand-gold transition-all" style={{ width: `${progress}%` }} /></div>
          <p className="text-brand-gold text-sm font-semibold uppercase mb-3">{question.category}</p><h2 className="text-2xl font-semibold mb-6">{question.question}</h2>
          <textarea value={answers[question.id] ?? ''} onChange={(event) => saveAnswer(event.target.value)} rows={7} className="w-full rounded-xl bg-white/5 border border-white/10 p-4 text-white placeholder:text-white/30 outline-none focus:border-brand-gold" placeholder="Tell Human Leverage AI in your own words..." autoFocus />
          {error && <div className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-red-200">{error}</div>}
          <div className="flex justify-between gap-4 mt-6">
            <button type="button" onClick={() => setCurrent((value) => Math.max(0, value - 1))} disabled={current === 0 || building} className="btn-secondary disabled:opacity-40">Back</button>
            {isLast ? <button type="button" onClick={buildAssets} disabled={building} className="btn-primary disabled:opacity-60">{building ? 'Building Your Assets…' : 'Build My Assets →'}</button> : <button type="button" onClick={() => setCurrent((value) => Math.min(INTERVIEW_QUESTIONS.length - 1, value + 1))} className="btn-primary">Next Question →</button>}
          </div>
        </div>
        <p className="text-center text-white/40 text-sm mt-6">Your Professional trial includes up to 25 AI interviews and 25 content builds.</p>
      </div>
    </main>
  )
}
