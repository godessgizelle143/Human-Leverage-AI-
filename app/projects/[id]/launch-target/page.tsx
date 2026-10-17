'use client'

import StepShell, { StepFormAlert } from '@/components/hke/StepShell'
import { useStepForm } from '@/components/hke/useStepForm'

export default function LaunchTargetPage() {
  const { values, set, status, error, retry, submit, locked } = useStepForm('launch_target')

  return (
    <StepShell step={1} title="Define your launch target" description={<>Turn your blueprint into a specific launch target. HKE AI will use this information to guide the next steps without making you repeat your original interview.</>}>
        <form onSubmit={submit} className="space-y-6">
          <StepFormAlert status={status} error={error} onRetry={retry} />
          <fieldset disabled={locked} className="space-y-6">
            <div>
              <label className="field-label">Who are you serving?</label>
              <textarea value={values.audience} onChange={(event) => set('audience', event.target.value)} required rows={4}
                className="field"
                placeholder="Describe the specific customer you want to reach first." />
            </div>
            <div>
              <label className="field-label">Where are you launching?</label>
              <input value={values.location} onChange={(event) => set('location', event.target.value)} required
                className="field"
                placeholder="City, region, or service area" />
            </div>
            <div>
              <label className="field-label">What are you offering first?</label>
              <textarea value={values.offer} onChange={(event) => set('offer', event.target.value)} required rows={4}
                className="field"
                placeholder="Describe the first service or product customers can actually buy." />
            </div>
            <div>
              <label className="field-label">What is your first milestone?</label>
              <input value={values.milestone} onChange={(event) => set('milestone', event.target.value)} required
                className="field"
                placeholder="For example: sign the first 10 paying customers" />
            </div>
            <button type="submit" className="btn-primary disabled:opacity-60">
              {status === 'loading' ? 'Loading saved answers…' : status === 'load-error' ? 'Saved answers not loaded' : status === 'saving' ? 'Saving…' : 'Save Launch Target →'}
            </button>
          </fieldset>
        </form>
    </StepShell>
  )
}
