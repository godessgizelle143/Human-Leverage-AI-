'use client'

import StepShell, { StepFormAlert } from '@/components/hke/StepShell'
import { useStepForm } from '@/components/hke/useStepForm'

export default function CustomerOfferPage() {
  const { values, set, status, error, retry, submit, locked } = useStepForm('customer_offer')

  return (
    <StepShell step={2} title="Build your customer offer" description={<>Turn your launch target into a clear offer customers can understand, request, and pay for.</>}>
        <form onSubmit={submit} className="space-y-6">
          <StepFormAlert status={status} error={error} onRetry={retry} />
          <fieldset disabled={locked} className="space-y-6">
            <div>
              <label className="field-label">What is the service called?</label>
              <input value={values.serviceName} onChange={(event) => set('serviceName', event.target.value)} required
                className="field"
                placeholder="For example: Starter Consultation Package" />
            </div>
            <div>
              <label className="field-label">What does the customer get?</label>
              <textarea value={values.customerGets} onChange={(event) => set('customerGets', event.target.value)} required rows={4}
                className="field"
                placeholder="Describe exactly what is included, from the first request to the finished result." />
            </div>
            <div>
              <label className="field-label">How will you charge?</label>
              <textarea value={values.pricing} onChange={(event) => set('pricing', event.target.value)} required rows={3}
                className="field"
                placeholder="Describe your starting price, packages, add-ons, or other pricing rules." />
            </div>
            <div>
              <label className="field-label">How will customers request or book it?</label>
              <textarea value={values.booking} onChange={(event) => set('booking', event.target.value)} required rows={3}
                className="field"
                placeholder="For example: fill in a short request form with their goals, preferred time, and contact details." />
            </div>
            <div>
              <label className="field-label">What should the customer do next?</label>
              <input value={values.nextAction} onChange={(event) => set('nextAction', event.target.value)} required
                className="field"
                placeholder="For example: Book a Consultation" />
            </div>
            <button type="submit" className="btn-primary disabled:opacity-60">
              {status === 'loading' ? 'Loading saved answers…' : status === 'load-error' ? 'Saved answers not loaded' : status === 'saving' ? 'Saving…' : 'Save Customer Offer →'}
            </button>
          </fieldset>
        </form>
    </StepShell>
  )
}
