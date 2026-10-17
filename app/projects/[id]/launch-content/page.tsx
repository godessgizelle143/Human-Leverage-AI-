'use client'

import StepShell, { StepFormAlert } from '@/components/hke/StepShell'
import { useStepForm } from '@/components/hke/useStepForm'

export default function LaunchContentPage() {
  const { values, set, status, error, retry, submit, locked } = useStepForm('launch_content')

  return (
    <StepShell step={4} title="Create your launch content" description={<>Turn your positioning into a practical 30/60/90-day content plan. Start with the audience, goal, channels, and action you want your launch content to drive.</>}>
        <form onSubmit={submit} className="space-y-6">
          <StepFormAlert status={status} error={error} onRetry={retry} />
          <fieldset disabled={locked} className="space-y-6">
            <div>
              <label className="field-label">What is the main goal of your launch?</label>
              <textarea value={values.launchGoal} onChange={(event) => set('launchGoal', event.target.value)} required rows={3}
                className="field"
                placeholder="For example: Get the first 10 local customers and validate the service." />
            </div>
            <div>
              <label className="field-label">Who are you trying to reach first?</label>
              <textarea value={values.audience} onChange={(event) => set('audience', event.target.value)} required rows={3}
                className="field"
                placeholder="Describe the specific customer or community you want to reach first." />
            </div>
            <div>
              <label className="field-label">Where will you publish or promote your launch?</label>
              <textarea value={values.channels} onChange={(event) => set('channels', event.target.value)} required rows={3}
                className="field"
                placeholder="For example: website, Facebook groups, Instagram, email, local partnerships, or community events." />
            </div>
            <div>
              <label className="field-label">What action should your content drive?</label>
              <input value={values.callToAction} onChange={(event) => set('callToAction', event.target.value)} required
                className="field"
                placeholder="For example: Book a Consultation" />
            </div>
            <button type="submit" className="btn-primary disabled:opacity-60">
              {status === 'loading' ? 'Loading saved answers…' : status === 'load-error' ? 'Saved answers not loaded' : status === 'saving' ? 'Saving…' : 'Save Launch Content Plan →'}
            </button>
          </fieldset>
        </form>
    </StepShell>
  )
}
