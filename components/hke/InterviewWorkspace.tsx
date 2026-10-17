'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import clsx from 'clsx'
import { INTERVIEW_QUESTIONS, type InterviewQuestion } from '@/types/interview'
import { createClient } from '@/lib/supabase/client'
import { answeredCount, progressFor, TOTAL_QUESTIONS, type InterviewAnswers } from '@/lib/hke/interview'
import { buildJourney } from '@/lib/hke/journey'
import JourneyRail from './JourneyRail'
import { ProgressMeter } from './LifecycleBadge'

type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error'
type Backup = { answers: InterviewAnswers; current: number; savedAt: number }

const LEGACY_DRAFT_KEY = 'human-leverage-builder-draft-v1'
const AUTOSAVE_DELAY_MS = 1200
const CATEGORY_LABELS: Record<InterviewQuestion['category'], string> = { basics: 'The basics', audience: 'Your customer', brand: 'Your brand', content: 'Proof & results', goals: 'Goals & channels' }
const backupKey = (id: string | null) => `hke-interview-backup:${id ?? 'new'}`

function readBackup(key: string): Backup | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Backup>
    return parsed && parsed.answers && typeof parsed.answers === 'object' ? { answers: parsed.answers, current: Number(parsed.current) || 0, savedAt: Number(parsed.savedAt) || 0 } : null
  } catch {
    return null
  }
}

function writeBackup(key: string, backup: Backup) {
  try { localStorage.setItem(key, JSON.stringify(backup)) } catch { /* best-effort */ }
}

function removeStorage(key: string) {
  try { localStorage.removeItem(key) } catch { /* best-effort */ }
}

function sameAnswers(a: InterviewAnswers, b: InterviewAnswers) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  return Array.from(keys).every((key) => (a[key] ?? '') === (b[key] ?? ''))
}

export type InterviewWorkspaceProps = {
  interviewId: string | null
  initialAnswers: InterviewAnswers
  initialCurrent: number
  serverUpdatedAt: string | null
  archived: boolean
}

export default function InterviewWorkspace(props: InterviewWorkspaceProps) {
  const router = useRouter()
  const [interviewId, setInterviewId] = useState(props.interviewId)
  const [answers, setAnswers] = useState<InterviewAnswers>(props.initialAnswers)
  const [current, setCurrent] = useState(props.initialCurrent)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [savedAt, setSavedAt] = useState<Date | null>(props.serverUpdatedAt ? new Date(props.serverUpdatedAt) : null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [building, setBuilding] = useState(false)

  // Refs mirror state so timers and unload handlers always see the latest values.
  const stateRef = useRef({ answers, current, interviewId })
  stateRef.current = { answers, current, interviewId }
  const dirtyRef = useRef(false)
  const inFlightRef = useRef<Promise<boolean> | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const question = INTERVIEW_QUESTIONS[current]
  const answered = answeredCount(answers)
  const progress = progressFor(answers)
  const isLast = current === TOTAL_QUESTIONS - 1

  const persist = useCallback(async (extra: { complete?: boolean } = {}): Promise<boolean> => {
    if (inFlightRef.current) await inFlightRef.current
    const { answers: snapshot, current: snapshotCurrent, interviewId: id } = stateRef.current
    if (!dirtyRef.current && !extra.complete) return true
    dirtyRef.current = false
    setSaveState('saving')

    const run = (async () => {
      try {
        let targetId = id
        if (!targetId) {
          const response = await fetch('/api/interviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers: snapshot, current: snapshotCurrent }) })
          const data = await response.json().catch(() => ({}))
          if (!response.ok || !data.id) throw new Error(data.error || 'Unable to save your project.')
          targetId = data.id as string
          setInterviewId(targetId)
          removeStorage(backupKey(null))
          removeStorage(LEGACY_DRAFT_KEY)
          // Update the URL without a server round-trip so in-progress typing is kept.
          window.history.replaceState(null, '', `/builder?interview=${targetId}`)
          if (!extra.complete) {
            writeBackup(backupKey(targetId), { answers: snapshot, current: snapshotCurrent, savedAt: Date.now() })
            setSavedAt(new Date())
            setSaveState(dirtyRef.current ? 'pending' : 'saved')
            return true
          }
        }

        const response = await fetch(`/api/interviews/${targetId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers: snapshot, current: snapshotCurrent, ...extra }),
        })
        const data = await response.json().catch(() => ({}))
        if (response.status === 409 && data.projectId) {
          router.push(`/projects/${data.projectId}`)
          return false
        }
        if (!response.ok) throw new Error(data.error || 'Unable to save your answers right now.')
        writeBackup(backupKey(targetId), { answers: snapshot, current: snapshotCurrent, savedAt: Date.now() })
        setSavedAt(new Date(data.savedAt ?? Date.now()))
        setSaveState(dirtyRef.current ? 'pending' : 'saved')
        return true
      } catch (err) {
        dirtyRef.current = true
        setSaveState('error')
        setError(err instanceof Error ? `${err.message} Your answers are kept on this device and will retry.` : 'Unable to save. Your answers are kept on this device.')
        return false
      }
    })()

    inFlightRef.current = run
    const ok = await run
    inFlightRef.current = null
    return ok
  }, [router])

  const scheduleSave = useCallback((delay = AUTOSAVE_DELAY_MS) => {
    dirtyRef.current = true
    setSaveState('pending')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => { void persist() }, delay)
  }, [persist])

  // Restore unsaved local edits (newer than the server copy) or migrate a
  // browser-only draft from before server-side autosave.
  useEffect(() => {
    const local = readBackup(backupKey(props.interviewId))
    const serverTime = props.serverUpdatedAt ? new Date(props.serverUpdatedAt).getTime() : 0
    if (local && local.savedAt > serverTime && !sameAnswers(local.answers, props.initialAnswers)) {
      setAnswers(local.answers)
      setCurrent(Math.max(0, Math.min(local.current, TOTAL_QUESTIONS - 1)))
      setNotice('Recovered answers from this device that had not reached the server yet. Saving them now.')
      scheduleSave(300)
      return
    }
    if (!props.interviewId) {
      try {
        const legacy = localStorage.getItem(LEGACY_DRAFT_KEY)
        const parsed = legacy ? JSON.parse(legacy) as { answers?: Record<string, string>; current?: number } : null
        if (parsed?.answers && Object.keys(parsed.answers).length) {
          setAnswers(Object.fromEntries(Object.entries(parsed.answers).map(([key, value]) => [key, String(value)])))
          setCurrent(Math.max(0, Math.min(Number(parsed.current) || 0, TOTAL_QUESTIONS - 1)))
          setNotice('We found an interview saved only on this device and are moving it into your account.')
          scheduleSave(300)
        }
      } catch { /* ignore malformed legacy drafts */ }
    }
    // Only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep a local copy on every change so nothing is lost before the debounce fires.
  useEffect(() => {
    if (!dirtyRef.current) return
    writeBackup(backupKey(interviewId), { answers, current, savedAt: Date.now() })
  }, [answers, current, interviewId])

  // Flush when the tab is hidden or closed.
  useEffect(() => {
    const flushOnExit = () => {
      const { answers: snapshot, current: snapshotCurrent, interviewId: id } = stateRef.current
      if (!dirtyRef.current || !id) return
      fetch(`/api/interviews/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: snapshot, current: snapshotCurrent }),
        keepalive: true,
      }).catch(() => { /* local backup remains */ })
    }
    const onVisibility = () => { if (document.visibilityState === 'hidden') flushOnExit() }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current && !stateRef.current.interviewId) event.preventDefault()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', flushOnExit)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', flushOnExit)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [])

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  const updateAnswer = (value: string) => {
    setAnswers((previous) => ({ ...previous, [String(question.id)]: value }))
    setError('')
    scheduleSave()
  }

  const goTo = (index: number) => {
    setCurrent(Math.max(0, Math.min(index, TOTAL_QUESTIONS - 1)))
    scheduleSave(400)
  }

  const saveAndExit = async () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (await persist()) router.push('/dashboard')
  }

  const buildBlueprint = async () => {
    if (building) return
    if (answered === 0) { setError('Answer at least one question before building your blueprint.'); return }
    setBuilding(true)
    setError('')
    if (timerRef.current) clearTimeout(timerRef.current)
    try {
      dirtyRef.current = true
      if (!(await persist({ complete: true }))) throw new Error('Your answers could not be saved, so the blueprint was not started. Please try again.')

      const supabase = createClient()
      const { data: refreshed } = await supabase.auth.refreshSession()
      let session = refreshed.session
      if (!session?.access_token) session = (await supabase.auth.getSession()).data.session
      if (!session?.access_token) throw new Error('Your sign-in session expired. Please sign in again. Your answers are saved.')

      const response = await fetch('/api/projects/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${session.access_token}` },
        credentials: 'include',
        body: JSON.stringify({ answers: stateRef.current.answers, interviewId: stateRef.current.interviewId }),
      })
      const data = await response.json().catch(() => ({})) as { project?: { id: string }; projectId?: string; error?: string }
      if (response.status === 409 && data.projectId) { router.push(`/projects/${data.projectId}`); return }
      if (!response.ok) throw new Error(data.error || `The blueprint builder returned HTTP ${response.status}.`)
      if (!data.project) throw new Error('The blueprint builder returned no project.')
      removeStorage(backupKey(stateRef.current.interviewId))
      removeStorage(LEGACY_DRAFT_KEY)
      router.push(`/projects/${data.project.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to build your blueprint. Your answers are saved.')
      setBuilding(false)
    }
  }

  const saveLabel = {
    idle: savedAt ? `Saved ${savedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Autosave on',
    pending: 'Unsaved changes…',
    saving: 'Saving…',
    saved: `Saved ${savedAt ? savedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}`,
    error: 'Not saved — retrying',
  }[saveState]

  const journey = buildJourney({ answered, interviewId, blueprint: 'none' })
  const remaining = TOTAL_QUESTIONS - answered

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="eyebrow mb-1">Stage 1 of 5 · Capture</p>
          <h1 className="text-3xl font-black tracking-tight truncate sm:text-4xl">{answers['1']?.trim() || 'New HKE AI Project'}</h1>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className={clsx('inline-flex items-center gap-2', saveState === 'error' ? 'text-red-300' : 'text-white/50')} aria-live="polite">{saveState === 'saved' && <span className="status-dot" aria-hidden />}{saveLabel}</span>
          <button type="button" onClick={saveAndExit} className="link-quiet">Save &amp; exit</button>
        </div>
      </div>

      {props.archived && <div className="notice mb-4">This project is archived. You can still edit it, or restore it from your dashboard.</div>}
      {notice && <div role="status" className="notice notice-gold mb-4">{notice}</div>}

      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="glass sticky top-24 rounded-2xl p-4">
            <div className="px-1"><ProgressMeter value={progress} label={`${answered} of ${TOTAL_QUESTIONS} answered`} /></div>
            <nav className="mt-4" aria-label="Interview questions">
              <ol className="space-y-0.5">
                {INTERVIEW_QUESTIONS.map((item, index) => {
                  const filled = !!answers[String(item.id)]?.trim()
                  const active = index === current
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => goTo(index)}
                        aria-current={active ? 'step' : undefined}
                        aria-label={`Question ${index + 1}${filled ? ', answered' : ''}: ${item.question}`}
                        className={clsx('flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition', active ? 'bg-brand-pink/10 text-white' : 'text-white/55 hover:bg-white/5 hover:text-white')}
                      >
                        <span className={clsx('grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold', active ? 'bg-brand-pink text-brand-black' : filled ? 'bg-brand-gold text-brand-black' : 'border border-white/20 text-white/45')}>{filled && !active ? '✓' : index + 1}</span>
                        <span className="min-w-0 truncate text-[13px]">{item.question}</span>
                      </button>
                    </li>
                  )
                })}
              </ol>
            </nav>
          </div>
        </aside>

        <div className="min-w-0">
          <div className="glass rounded-2xl p-5 sm:p-8">
            <div className="lg:hidden">
              <ProgressMeter value={progress} label={`${answered} of ${TOTAL_QUESTIONS} questions answered`} />
              <nav className="mt-5 flex flex-wrap gap-1.5" aria-label="Interview questions">
                {INTERVIEW_QUESTIONS.map((item, index) => {
                  const filled = !!answers[String(item.id)]?.trim()
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => goTo(index)}
                      aria-current={index === current ? 'step' : undefined}
                      aria-label={`Question ${index + 1}${filled ? ', answered' : ''}`}
                      className={clsx(
                        'h-8 w-8 rounded-lg text-xs font-semibold transition',
                        index === current ? 'bg-brand-pink text-brand-black' : filled ? 'bg-brand-gold/15 text-brand-gold border border-brand-gold/30' : 'border border-white/10 text-white/40 hover:text-white',
                      )}
                    >
                      {index + 1}
                    </button>
                  )
                })}
              </nav>
            </div>

            <div className="mt-8 lg:mt-0">
              <p className="eyebrow eyebrow-pink mb-3">Question {current + 1} of {TOTAL_QUESTIONS} · {CATEGORY_LABELS[question.category]}</p>
              <label htmlFor="interview-answer" className="mb-6 block text-2xl font-bold leading-snug sm:text-3xl">{question.question}</label>
              <textarea
                id="interview-answer"
                key={question.id}
                value={answers[String(question.id)] ?? ''}
                onChange={(event) => updateAnswer(event.target.value)}
                onBlur={() => { if (dirtyRef.current) void persist() }}
                rows={9}
                maxLength={10000}
                className="field text-base leading-7"
                placeholder="Tell HKE AI in your own words… You can skip a question and come back later."
                autoFocus
              />
            </div>

            {error && <div role="alert" className="notice notice-error mt-4">{error}</div>}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <button type="button" onClick={() => goTo(current - 1)} disabled={current === 0 || building} className="btn-secondary justify-center disabled:opacity-40">Back</button>
              {isLast ? (
                <button type="button" onClick={buildBlueprint} disabled={building} className="btn-primary justify-center disabled:opacity-60">
                  {building ? 'Extracting knowledge & building…' : 'Build My Blueprint →'}
                </button>
              ) : (
                <button type="button" onClick={() => goTo(current + 1)} className="btn-primary justify-center">Next Question →</button>
              )}
            </div>
            {isLast && answered < TOTAL_QUESTIONS && (
              <p className="mt-4 text-sm text-white/50">{remaining} question{remaining === 1 ? '' : 's'} still unanswered. HKE AI works best with all {TOTAL_QUESTIONS}, but you can build now.</p>
            )}
          </div>

          <section className="surface-inset mt-6 rounded-2xl p-5 sm:p-6" aria-label="What happens after the interview">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/45">Where this goes next</p>
            <JourneyRail stages={journey} compact className="mt-4" />
            <p className="mt-4 text-sm leading-6 text-white/55">Your answers are the only source HKE AI builds from. When you build your blueprint, they are structured into a plan, then into assets you can edit and export.</p>
          </section>

          <p className="mt-6 text-center text-sm text-white/40">Your answers save to your account automatically. Leave any time and continue from <Link href="/dashboard" className="link-action">your dashboard</Link>.</p>
        </div>
      </div>
    </div>
  )
}
