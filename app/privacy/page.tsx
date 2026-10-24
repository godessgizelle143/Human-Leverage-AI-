import type { Metadata } from 'next'
import LegalPage, { ContactLink, Section } from '@/components/legal/LegalPage'

export const metadata: Metadata = {
  title: 'Privacy Policy — The Human Knowledge Engine',
  description: 'What The Human Knowledge Engine keeps about you, why, and who helps us run it.',
}

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={<p>This page explains what The Human Knowledge Engine (HKE) keeps about you, why we keep it, and who helps us run HKE. HKE is run by Christina Beck, doing business as The Human Knowledge Engine, in Sacramento, California.</p>}
    >
      <Section title="What we keep">
        <ul>
          <li><strong className="text-brand-text">Your account.</strong> Your name, email address, and password. Your password is stored scrambled, so no one at HKE can read it. If you sign in with Google, Google shares your name and email address with us.</li>
          <li><strong className="text-brand-text">Your interview answers.</strong> They save as you type, so your work is never lost.</li>
          <li><strong className="text-brand-text">What HKE builds for you.</strong> Your blueprint, your launch plan answers, and the assets you create, including earlier versions.</li>
          <li><strong className="text-brand-text">Your plan.</strong> Which plan you are on, your trial and billing dates, how many credits you have used, and the ID numbers Stripe gives your customer account and subscription.</li>
          <li><strong className="text-brand-text">Not your card.</strong> We never see or keep your full card number. Stripe handles all payments.</li>
        </ul>
      </Section>

      <Section title="What stays on your device">
        <ul>
          <li>Small cookies that keep you signed in.</li>
          <li>A backup copy of interview answers that have not reached our servers yet, so a lost connection does not lose your words.</li>
          <li>A note of which &ldquo;you moved up&rdquo; messages you have already seen.</li>
        </ul>
        <p>We do not use advertising cookies or tracking tools.</p>
      </Section>

      <Section title="Why we use it">
        <p>We use your information to run your account, save your work, build your blueprint and assets, handle billing, answer your emails, and keep HKE safe. That is all.</p>
      </Section>

      <Section title="Who helps us run HKE">
        <p>These companies process your information for us. Each one gets only what it needs to do its job.</p>
        <ul>
          <li><strong className="text-brand-text">Supabase</strong> stores your account and your saved work, and handles sign-in.</li>
          <li><strong className="text-brand-text">Stripe</strong> handles payments and billing.</li>
          <li><strong className="text-brand-text">OpenAI</strong> reads your answers to write your blueprint and assets. Under OpenAI&apos;s API terms, this data is not used to train its models.</li>
          <li><strong className="text-brand-text">Vercel</strong> hosts the HKE website and keeps short-term server logs.</li>
          <li><strong className="text-brand-text">Resend</strong> sends our emails, like sign-up confirmations and password resets.</li>
          <li><strong className="text-brand-text">Google</strong>, only if you choose to sign in with Google.</li>
        </ul>
      </Section>

      <Section title="We never sell your data">
        <p>We never sell or rent your personal information. We do not share it with advertisers.</p>
      </Section>

      <Section title="How long we keep it">
        <p>We keep your information while your account is open. Archiving a project hides it from your lists. It does not delete it.</p>
        <p>When you ask us to delete your account, we delete your account and your saved work within 30 days. Stripe keeps its own payment records, as the law requires.</p>
      </Section>

      <Section title="Your choices">
        <ul>
          <li>Read all of your answers any time in your Knowledge Vault.</li>
          <li>Ask us for a copy of your information.</li>
          <li>Ask us to fix something that is wrong.</li>
          <li>Ask us to delete your account and your saved work.</li>
        </ul>
        <p>To ask, email <ContactLink /> from the email address on your account. We will reply within 30 days.</p>
        <p>If you live in California, you have the right to know what we keep, to have it deleted or corrected, and to be treated the same if you use these rights. We do not sell or share your personal information.</p>
      </Section>

      <Section title="Keeping it safe">
        <p>Your information travels over encrypted connections. Each account can only see its own work. No system is perfect, but if a problem ever affects your information, we will tell you as the law requires.</p>
      </Section>

      <Section title="Children">
        <p>HKE is made for adults. It is not for anyone under 18.</p>
      </Section>

      <Section title="Changes and the law">
        <p>If we change this policy, we will update the date at the top. If the change is big, we will email you first. This policy is governed by the laws of California.</p>
      </Section>
    </LegalPage>
  )
}
