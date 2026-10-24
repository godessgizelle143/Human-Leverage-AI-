import Link from 'next/link'
import CrownArt from '@/components/hke/CrownArt'
import Footer from '@/components/layout/Footer'

export const LEGAL_UPDATED = 'Oct 24, 2026'
export const CONTACT_EMAIL = 'christinabeck@humanleverageai.com'

/** The contact address as a link. */
export function ContactLink() {
  return <a href={`mailto:${CONTACT_EMAIL}`} className="link-gold">{CONTACT_EMAIL}</a>
}

/** A point still to confirm before launch. Shown in pink so it is easy to find and remove. */
export function Check({ children }: { children?: React.ReactNode }) {
  return <strong className="font-semibold text-brand-pink">[CHECK{children ? <>: {children}</> : null}]</strong>
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="dash-title text-xl sm:text-2xl">{title}</h2>
      <div className="mt-3 space-y-3 leading-7 text-brand-body [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ul]:space-y-2">{children}</div>
    </section>
  )
}

/** Shared frame for the Privacy, Terms, and Refund pages: Crown look, plain reading width. */
export default function LegalPage({ title, intro, children }: { title: string; intro: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-brand-black text-brand-text">
      <header className="border-b border-brand-lineSoft">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="The Human Knowledge Engine home">
            <CrownArt lit={5} current={2} filled className="h-8 w-12" />
            <span className="dash-title text-sm uppercase tracking-[.12em] sm:text-base" aria-hidden>
              <span className="sm:hidden">HKE</span>
              <span className="hidden sm:inline">The Human Knowledge Engine</span>
            </span>
          </Link>
          <Link href="/" className="link-quiet text-sm">← Home</Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="font-script text-2xl text-brand-pink sm:text-3xl">Speak once. Build forever.</p>
        <h1 className="dash-title mt-2 text-3xl sm:text-5xl">{title}</h1>
        <p className="mt-3 text-sm text-brand-muted">Last updated: {LEGAL_UPDATED}</p>
        <div className="mt-6 text-lg leading-8 text-brand-body">{intro}</div>
        {children}
        <p className="mt-12 border-t border-brand-lineSoft pt-6 text-sm text-brand-muted">
          Questions? Email <ContactLink />.
        </p>
      </article>

      <Footer />
    </main>
  )
}
