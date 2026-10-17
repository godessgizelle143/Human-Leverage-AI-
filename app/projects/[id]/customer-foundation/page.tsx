'use client'

import StepShell, { StepFormAlert } from '@/components/hke/StepShell'
import { useStepForm } from '@/components/hke/useStepForm'

export default function CustomerFoundationPage() {
  const { values, set, status, error, retry, submit, locked } = useStepForm('customer_foundation')

  return (
    <StepShell step={3} title="Build your customer foundation" description={<>Define the customer-facing experience your business needs first. HKE AI will use your offer and launch target to shape the foundation without making you start over.</>}>
        <form onSubmit={submit} className="space-y-6">
          <StepFormAlert status={status} error={error} onRetry={retry} />
          <fieldset disabled={locked} className="space-y-6">
            <div>
              <label className="field-label">What are you building first?</label>
              <select value={values.foundationType} onChange={(event) => set('foundationType', event.target.value)} required
                className="field">
                <option value="" disabled>Select one</option>
                <option value="website">Website</option>
                <option value="booking-flow">Booking flow</option>
                <option value="application">Application</option>
                <option value="website-and-booking">Website + booking flow</option>
                <option value="custom">Something else</option>
              </select>
            </div>
            <div>
              <label className="field-label">What should the customer be able to do?</label>
              <textarea value={values.customerExperience} onChange={(event) => set('customerExperience', event.target.value)} required rows={4}
                className="field"
                placeholder="Describe the main action the customer needs to complete." />
            </div>
            <div>
              <label className="field-label">What information do you need from the customer?</label>
              <textarea value={values.customerInfo} onChange={(event) => set('customerInfo', event.target.value)} required rows={4}
                className="field"
                placeholder="For example: name, contact information, what they need help with, and preferred time." />
            </div>
            <div>
              <label className="field-label">What should happen after they submit?</label>
              <textarea value={values.firstAction} onChange={(event) => set('firstAction', event.target.value)} required rows={4}
                className="field"
                placeholder="Describe the confirmation, next step, or follow-up the customer should receive." />
            </div>
            <button type="submit" className="btn-primary disabled:opacity-60">
              {status === 'loading' ? 'Loading saved answers…' : status === 'load-error' ? 'Saved answers not loaded' : status === 'saving' ? 'Saving…' : 'Save Customer Foundation →'}
            </button>
          </fieldset>
        </form>
    </StepShell>
  )
}
