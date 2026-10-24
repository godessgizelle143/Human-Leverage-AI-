import type { Metadata } from 'next'
import LegalPage, { Check, ContactLink, Section } from '@/components/legal/LegalPage'

export const metadata: Metadata = {
  title: 'Refund & Cancellation Policy — The Human Knowledge Engine',
  description: 'How the free trial, billing, cancelling, and refunds work at The Human Knowledge Engine.',
}

export default function RefundPage() {
  return (
    <LegalPage
      title="Refund & Cancellation Policy"
      intro={<p>We want paying for HKE to feel simple and fair. Here is exactly how the free trial, billing, cancelling, and refunds work.</p>}
    >
      <Section title="Your free trial">
        <p>Every new account gets 3 days free. No card is needed. When the trial ends, building pauses until you choose a plan. Your saved answers stay in your Knowledge Vault, and you can still read them.</p>
      </Section>

      <Section title="When you are charged">
        <ul>
          <li>Paid plans are monthly. They renew automatically until you cancel.</li>
          <li>If you choose a plan during your free trial with at least 2 days left, your first charge happens when the trial ends.</li>
          <li>Otherwise, your first charge happens when you choose a plan.</li>
          <li>After that, you are charged once a month on the same date.</li>
        </ul>
      </Section>

      <Section title="Cancel any time">
        <p>You can cancel whenever you like. You keep access until the end of the month you have already paid for. After that, you will not be charged again.</p>
        <p>To cancel, email <ContactLink /> from the email address on your account and say &ldquo;Please cancel my plan.&rdquo; We will confirm by email. <Check>Replace with the &ldquo;Manage billing&rdquo; button once it is built.</Check></p>
      </Section>

      <Section title="Refunds">
        <p>We do not give refunds for part of a month.</p>
        <p>If something went wrong, like a double charge, a charge after you cancelled, or HKE not working for you, email <ContactLink /> within 7 days of the charge. We will make it right.</p>
      </Section>

      <Section title="Credits">
        <p>If a generation fails, its credit comes back to you automatically. Unused credits reset at the start of each billing month. Credits cannot be exchanged for money.</p>
      </Section>
    </LegalPage>
  )
}
