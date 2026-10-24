import type { Metadata } from 'next'
import Link from 'next/link'
import LegalPage, { ContactLink, Section } from '@/components/legal/LegalPage'

export const metadata: Metadata = {
  title: 'Terms of Service — The Human Knowledge Engine',
  description: 'The simple rules for using The Human Knowledge Engine.',
}

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro={<p>These terms are the agreement between you and Christina Beck, doing business as The Human Knowledge Engine (HKE), in Sacramento, California. By using HKE, you agree to them.</p>}
    >
      <Section title="What HKE does">
        <p>You answer a guided interview about your business in your own words. HKE uses AI to turn your answers into a blueprint, a launch plan, and assets you can edit and export.</p>
      </Section>

      <Section title="Your account">
        <ul>
          <li>Give us true information when you sign up.</li>
          <li>Keep your password private. You are responsible for what happens in your account.</li>
          <li>You must be 18 or older to use HKE.</li>
        </ul>
      </Section>

      <Section title="Free trial and plans">
        <ul>
          <li>New accounts get a 3-day free trial. No card is needed.</li>
          <li>Paid plans are billed monthly and renew automatically until you cancel.</li>
          <li>Each plan includes a set number of credits each month for blueprints and builds. Unused credits reset at the start of each billing month. They do not carry over.</li>
          <li>If a generation fails, its credit is given back automatically.</li>
          <li>If we change our prices, we will email you at least 30 days before the new price applies to you.</li>
        </ul>
      </Section>

      <Section title="Cancelling and refunds">
        <p>You can cancel any time. Our <Link href="/refund" className="link-gold">Refund &amp; Cancellation Policy</Link> explains how cancelling and refunds work.</p>
      </Section>

      <Section title="Your work belongs to you">
        <p>Your answers, and the blueprints and assets HKE builds from them, belong to you. You give us permission to store and process them only so we can run HKE for you. We do not claim them as ours.</p>
      </Section>

      <Section title="AI can make mistakes">
        <p>HKE writes from your answers, but AI can still get things wrong or leave things out. Read everything before you publish it, sell it, or rely on it. Nothing HKE writes is legal, financial, tax, or medical advice.</p>
      </Section>

      <Section title="Please use HKE fairly">
        <p>Do not use HKE to:</p>
        <ul>
          <li>break the law or harm anyone,</li>
          <li>upload material you do not have the right to use,</li>
          <li>get into someone else&apos;s account,</li>
          <li>try to break, overload, or copy the service, or</li>
          <li>resell access to HKE.</li>
        </ul>
        <p>We may pause or close an account that does these things.</p>
      </Section>

      <Section title="Our part">
        <p>We work hard to keep HKE running and your work safe. Still, HKE is provided &ldquo;as is.&rdquo; It may sometimes be down or have bugs. Keep your own copies of important work. You can export it any time.</p>
      </Section>

      <Section title="Limits on our responsibility">
        <p>As far as the law allows, we are not responsible for indirect losses, like lost profits or lost business. As far as the law allows, our total responsibility for any claim is limited to what you paid us in the 3 months before the claim.</p>
      </Section>

      <Section title="Ending your use">
        <p>You can stop using HKE any time. We may close an account that breaks these terms. When we can, we will tell you first.</p>
      </Section>

      <Section title="Governing law">
        <p>These terms are governed by the laws of California. Any dispute will be handled in the courts of Sacramento County, California.</p>
      </Section>

      <Section title="Changes">
        <p>If we change these terms, we will update the date at the top. If the change is big, we will email you first. Using HKE after a change means you accept the new terms.</p>
      </Section>

      <Section title="Contact">
        <p>Email <ContactLink />.</p>
      </Section>
    </LegalPage>
  )
}
