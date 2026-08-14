'use client'

import { useState } from 'react'
import Link from 'next/link'
import { INTERVIEW_QUESTIONS } from '@/types/interview'

export default function BuilderPage() {
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [current, setCurrent] = useState(0)

  const question = INTERVIEW_QUESTIONS[current]
  const progress = Math.round(((current + 1) / INTERVIEW_QUESTIONS.length) * 100)
  const isLast = current === INTERVIEW_QUESTIONS.length - 1

  const saveAnswer = (value: string) => {
    setAnswers((previous) => ({ ...previous, [question.id]: value }))
  }

  return (
    <main className="min-h-screen bg-brand-black text-white px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <div>
            <p className="text-brand-gold text-sm font-semibold mb-2">HUMAN LEVERAGE AI™</p>
            <h1 className="text-3xl font-bold">Start a New Project</h1>
          </div>
          <Link href="/dashboard" className="text-white/60 hover:text-white">← Dashboard</Link>
        </div>

        <div className="glass rounded-2xl p-8">
          <div className="flex items-center justify-between mb-3 text-sm text-white/50">
            <span>AI Business Interview</span>
            <span>{current + 1} of {INTERVIEW_QUESTIONS.length}</span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden mb-10">
            <div className="h-full bg-brand-gold transition-all" style={{ width: `${progress}%` }} />
          </div>

          <p className="text-brand-gold text-sm font-semibold uppercase mb-3">{question.category}</p>
          <h2 className="text-2xl font-semibold mb-6">{question.question}</h2>

          <textarea
            value={answers[question.id] ?? ''}
            onChange={(event) => saveAnswer(event.target.value)}
            rows={7}
            className="w-full rounded-xl bg-white/5 border border-white/10 p-4 text-white placeholder:text-white/30 outline-none focus:border-brand-gold"
            placeholder="Tell Human Leverage AI in your own words..."
            autoFocus
          />

          <div className="flex justify-between gap-4 mt-6">
            <button
              type="button"
              onClick={() => setCurrent((value) => Math.max(0, value - 1))}
              disabled={current === 0}
              className="btn-secondary disabled:opacity-40"
            >
              Back
            </button>
            {isLast ? (
              <button type="button" disabled className="btn-primary opacity-60 cursor-not-allowed">
                Build My Assets — Coming Next
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setCurrent((value) => Math.min(INTERVIEW_QUESTIONS.length - 1, value + 1))}
                className="btn-primary"
              >
                Next Question →
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-white/40 text-sm mt-6">
          Your Professional trial includes up to 25 AI interviews and 25 content builds.
        </p>
      </div>
    </main>
  )
}
