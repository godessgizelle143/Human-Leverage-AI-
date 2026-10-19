'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { Level } from '@/lib/hke/levels'
import { levelUpMessage } from '@/lib/hke/levels'
import LevelCrown from './LevelCrown'

const BUTTERFLIES = [
  { left: '8%', delay: '0s' },
  { left: '30%', delay: '.6s' },
  { left: '55%', delay: '.2s' },
  { left: '78%', delay: '.9s' },
]

/**
 * A one-time "you moved up" moment. The highest level already celebrated is
 * remembered per project in this browser, so the moment shows once per new
 * level and never on ordinary visits. Nothing is saved to the account.
 */
export default function LevelUpCelebration({ projectId, level }: { projectId: string; level: Level }) {
  const [open, setOpen] = useState(false)
  const message = levelUpMessage(level)

  useEffect(() => {
    if (!message) return
    const key = `hke-level-celebrated:${projectId}`
    let seen = 0
    try { seen = Number(window.localStorage.getItem(key)) || 0 } catch { /* storage blocked: still celebrate once */ }
    if (level.number > seen) {
      setOpen(true)
      try { window.localStorage.setItem(key, String(level.number)) } catch { /* ignore */ }
    }
  }, [projectId, level.number, message])

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => setOpen(false), 9000)
    return () => window.clearTimeout(timer)
  }, [open])

  if (!open || !message) return null

  return (
    <div role="status" aria-live="polite" className="level-up fixed inset-x-4 top-20 z-50 mx-auto max-w-lg">
      <div className="level-up-card relative overflow-hidden rounded-2xl p-5 pr-12">
        {BUTTERFLIES.map((b) => (
          <span key={b.left} className="level-butterfly" style={{ left: b.left, animationDelay: b.delay }} aria-hidden>🦋</span>
        ))}
        <LevelCrown level={level} size="md" />
        <p className="mt-3 text-lg font-bold leading-snug text-white">{message}</p>
        <p className="mt-1 text-sm text-white/60">{level.tagline}</p>
        <button type="button" onClick={() => setOpen(false)} className="absolute right-3 top-3 rounded-full p-1.5 text-white/60 transition hover:text-white" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
