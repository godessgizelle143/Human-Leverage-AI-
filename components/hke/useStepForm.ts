'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getStep, stepFormValues, type StepKey } from '@/lib/hke/steps'

export type StepFormStatus = 'loading' | 'load-error' | 'ready' | 'saving'

/**
 * Loads and saves one launch-plan step. If the saved answers cannot be loaded,
 * the form stays locked: an empty form submitted then would replace them.
 * Errors show the server's message (for example, an archived project).
 */
export function useStepForm(key: StepKey) {
  const step = getStep(key)
  const router = useRouter()
  const { id: projectId } = useParams<{ id: string }>()
  const endpoint = `/api/projects/${projectId}/${step.path}`
  const [values, setValues] = useState<Record<string, string>>(() => stepFormValues(step, null))
  const [status, setStatus] = useState<StepFormStatus>('loading')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setStatus('loading')
    setError('')
    try {
      const response = await fetch(endpoint, { cache: 'no-store' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || `Unable to load your saved ${step.label.toLowerCase()}.`)
      setValues(stepFormValues(step, data[step.responseKey]))
      setStatus('ready')
    } catch (err) {
      setError(`${err instanceof Error && !(err instanceof TypeError) ? err.message : `Could not reach HKE AI to load your saved ${step.label.toLowerCase()}.`} Nothing was changed.`)
      setStatus('load-error')
    }
  }, [endpoint, step])

  useEffect(() => { void load() }, [load])

  const set = (input: string, value: string) => setValues((previous) => ({ ...previous, [input]: value }))

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (status !== 'ready') return
    setStatus('saving')
    setError('')
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || `Unable to save your ${step.label.toLowerCase()}.`)
      router.push(`/projects/${projectId}#plan`)
      router.refresh()
    } catch (err) {
      // fetch rejects with a TypeError when the request never reached the server.
      setError(err instanceof Error && !(err instanceof TypeError) ? err.message : 'Could not reach HKE AI. Your answers are still here; check your connection and save again.')
      setStatus('ready')
    }
  }

  return { values, set, status, error, retry: load, submit, locked: status !== 'ready' }
}
