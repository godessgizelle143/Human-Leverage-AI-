'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { INTERVIEW_QUESTIONS } from '@/types/interview'
import { createClient } from '@/lib/supabase/client'

type ProjectContent = Record<string, unknown>
const DRAFT_KEY = 'human-leverage-builder-draft-v1'
type Draft = { answers: Record<number, string>; current: number }

export default function BuilderPage() {
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [current, setCurrent] = useState(0)
  const [building, setBuilding] = useState(false)
  const [error, setError] = useState('')
  const [project, setProject] = useState<{ id?: string; title: string; content: ProjectContent } | null>(null)
  const [restored, setRestored] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY)
      if (saved) {
        const draft = JSON.parse(saved) as Draft
        if (draft?.answers && Object.keys(draft.answers).length) {
          setAnswers(draft.answers)
          setCurrent(Math.max(0, Math.min(Number(draft.current) || 0, INTERVIEW_QUESTIONS.length - 1)))
          setRestored(true)
        }
      }
    } catch {
      // Ignore malformed local drafts.
    }
  }, [])

  useEffect(() => {
    if (!restored && Object.keys(answers).length === 0 && current === 0) return
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ answers, current }))
    } catch {
      // Local persistence is best-effort.
    }
  }, [answers, current, restored])

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
      const supabase = createClient()
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
      let session = refreshed.session

      if (!session?.access_token) {
        const { data: current } = await supabase.auth.getSession()
        session = current.session
      }

      if (!session?.access_token) {
        console.error('Build My Assets: no usable session.', {
          refreshErrorMessage: refreshError?.message ?? null,
          refreshErrorStatus: refreshError?.status ?? null,
        })
        throw new Error('Your sign-in session expired. Please sign in again. Your interview answers are saved on this device.')
      }

      const response = await fetch('/api/projects/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ answers }),
      })

      const raw = await response.text()
      let data: { project?: { id: string; title: string; content: ProjectContent }; error?: string } = {}
      try { data = JSON.parse(raw) } catch { /* handled below */ }
      if (!response.ok) throw new Error(data.error || `Asset builder returned HTTP ${response.status}.`)
      if (!data.project) throw new Error('The asset builder returned no project.')
      setProject(data.project)
      localStorage.removeItem(DRAFT_KEY)
      router.push(`/projects/${data.project.id}`)
    } catch (err) {
      console.error('Build My Assets failed:', err)
      setError(err instanceof Error ? err.message : 'Unable to build your assets. Your answers remain saved on this device.')
    } finally {
      setBuilding(false)
    }
  }

  if (project) {
    return (
      <main className="min-h-screen bg-brand-black text-white px-6 py-10">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-10"><div><p className="text-brand-gold text-sm font-semibold mb-2">HUMAN LEVERAGE AI™</p><h1 className="text-3xl font-bold">{project.title}</h1></div><Link href="/dashboard" className="text-white/60 hover:text-white">← Dashboard</Link></div>
          <div className="glass rounded-2xl p-8"><div className="mb-8"><p className="text-brand-gold font-semibold">Your assets are ready</p><h2 className="text-2xl font-semibold mt-2">Your business blueprint</h2></div><div className="space-y-7">{Object.entries(project.content).map(([key, value]) => <section key={key}><h3 className="text-lg font-semibold capitalize mb-2">{key.replaceAll('_', ' ')}</h3><p className="text-white/80 leading-7 whitespace-pre-wrap">{typeof value === 'string' ? value : JSON.stringify(value, null, 2)}</p></section>)}</div></div>
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
          {restored && current === 0 && <div className="mt-4 rounded-xl border border-brand-gold/30 bg-brand-gold/10 p-3 text-brand-gold text-sm">Your saved interview progress was restored on this device.</div>}
          {error && <div className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-red-200">{error}</div>}
          <div className="flex justify-between gap-4 mt-6"><button type="button" onClick={() => setCurrent((value) => Math.max(0, value - 1))} disabled={current === 0 || building} className="btn-secondary disabled:opacity-40">Back</button>{isLast ? <button type="button" onClick={buildAssets} disabled={building} className="btn-primary disabled:opacity-60">{building ? 'Building Your Assets…' : 'Build My Assets →'}</button> : <button type="button" onClick={() => setCurrent((value) => Math.min(INTERVIEW_QUESTIONS.length - 1, value + 1))} className="btn-primary">Next Question →</button>}</div>
        </div>
        <p className="text-center text-white/40 text-sm mt-6">Your Professional trial includes up to 25 AI interviews and 25 content builds.</p>
      </div>
    </main>
  )
}
