'use client'

import Link from 'next/link'
import { ArrowRight, Check, Mic2, Package, Sparkles } from 'lucide-react'
import Footer from '@/components/layout/Footer'

const outputs = [
  'Ebook', 'Workbook', 'Course Outline', 'Sales Page',
  'Landing Page', 'Website Copy', 'Marketing Copy', 'Lead Magnet',
  'Email Sequence', 'Social Media Posts', 'Blog Articles', 'FAQ',
  'Mission Statement', 'Brand Story', 'Product Descriptions', 'Calls to Action',
]

const pressCycle = [
  {
    number: '01',
    title: 'Interview',
    label: 'Listen',
    description: 'Answer guided questions about what you know, what you do, who you serve, and where you want to go.',
  },
  {
    number: '02',
    title: 'Generate',
    label: 'Shape',
    description: 'Human Leverage turns your answers into structured ideas, products, messaging, and reusable business assets.',
  },
  {
    number: '03',
    title: 'Ship',
    label: 'Release',
    description: 'Take the finished assets into the world. Customize them, publish them, sell them, and keep building.',
  },
]

const plans = [
  { name: 'Creator', price: '$47', detail: '5 interviews + builds', popular: false },
  { name: 'Professional', price: '$97', detail: '25 interviews + builds', popular: true },
  { name: 'Business Pro', price: '$197', detail: 'Unlimited interviews + builds', popular: false },
]

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-paper text-ink">
      <nav className="site-nav">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="Human Leverage AI home">
            <span className="brand-mark">HL</span>
            <span className="font-serif text-lg font-semibold tracking-tight sm:text-xl">Human Leverage AI™</span>
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            <a href="#process" className="nav-link">The Process</a>
            <a href="#outputs" className="nav-link">What You Can Build</a>
            <a href="#pricing" className="nav-link">Pricing</a>
          </div>
          <div className="flex items-center gap-3 sm:gap-5">
            <Link href="/login" className="nav-link">Sign In</Link>
            <Link href="/register" className="brass-button hidden sm:inline-flex">Get Started</Link>
          </div>
        </div>
      </nav>

      <section className="relative px-5 pb-20 pt-28 sm:px-8 sm:pt-36 lg:pb-28">
        <div className="editorial-grid" aria-hidden="true" />
        <div className="mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-[1.05fr_.95fr] lg:gap-10">
          <div className="relative z-10 max-w-3xl">
            <p className="eyebrow">A studio for turning knowledge into leverage</p>
            <h1 className="mt-5 font-serif text-5xl leading-[.94] tracking-[-0.045em] sm:text-6xl lg:text-[5.7rem]">
              Speak once.<br />
              <span className="brass-text">Build forever.</span>
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-ink-muted sm:text-xl">
              One guided conversation can become the raw material for a whole library of digital products, marketing assets, and business resources.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className="brass-button inline-flex items-center justify-center gap-2">
                Start Free 3-Day Trial <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#process" className="paper-button inline-flex items-center justify-center">See how it works</a>
            </div>
            <p className="mt-4 text-xs uppercase tracking-[.16em] text-ink-faint">No commitment during the trial</p>
          </div>

          <div className="relative mx-auto w-full max-w-xl lg:ml-auto">
            <div className="hero-art" aria-label="A waveform becoming stacked business artifacts">
              <div className="wave-label">YOUR VOICE</div>
              <div className="waveform" aria-hidden="true">
                {[22, 42, 68, 35, 84, 48, 30, 72, 54, 92, 40, 66, 28, 76, 44, 58, 82, 36, 62, 26].map((height, index) => (
                  <span key={index} style={{ height: `${height}px` }} />
                ))}
              </div>
              <div className="artifact-stack" aria-hidden="true">
                <div className="artifact-card artifact-back"><span>01</span><strong>Brand Story</strong></div>
                <div className="artifact-card artifact-mid"><span>02</span><strong>Course Outline</strong></div>
                <div className="artifact-card artifact-front"><span>03</span><strong>Sales Page</strong><small>ready to shape + ship</small></div>
              </div>
              <div className="artifact-caption"><span>KNOWLEDGE</span><span>→</span><span>ASSETS</span></div>
            </div>
          </div>
        </div>
      </section>

      <section id="process" className="border-y border-brass/20 bg-paper-deep px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="mb-14 max-w-2xl">
            <p className="eyebrow">The press cycle</p>
            <h2 className="section-title mt-4">From conversation<br /><span className="brass-text">to a body of work.</span></h2>
          </div>
          <div className="grid gap-px overflow-hidden border border-brass/25 bg-brass/25 md:grid-cols-3">
            {pressCycle.map((item) => (
              <article key={item.number} className="press-panel">
                <div className="flex items-start justify-between">
                  <span className="font-serif text-4xl text-brass/70">{item.number}</span>
                  <span className="eyebrow">{item.label}</span>
                </div>
                <h3 className="mt-16 font-serif text-4xl tracking-tight">{item.title}</h3>
                <p className="mt-4 max-w-sm leading-7 text-ink-muted">{item.description}</p>
                {item.number !== '03' && <div className="mt-10 h-px w-16 bg-brass" />}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="outputs" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 lg:grid-cols-[.7fr_1.3fr]">
            <div>
              <p className="eyebrow">The catalog</p>
              <h2 className="section-title mt-4">Sixteen ways<br /><span className="brass-text">to multiply what you know.</span></h2>
              <p className="mt-6 max-w-md leading-7 text-ink-muted">Your knowledge stays yours. Human Leverage gives it structure so one conversation can travel further.</p>
            </div>
            <div className="catalog-grid">
              {outputs.map((output, index) => (
                <div key={output} className="catalog-item">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{output}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-ink px-5 py-20 text-paper sm:px-8 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
          <div>
            <p className="eyebrow text-brass">Why Human Leverage</p>
            <h2 className="section-title mt-4 text-paper">The goal isn't<br /><span className="text-brass">more content.</span></h2>
          </div>
          <div className="grid gap-8 sm:grid-cols-2">
            {[
              ['Capture', 'Get your experience out of your head and into a reusable system.'],
              ['Clarify', 'Turn scattered ideas into language, offers, and assets that make sense.'],
              ['Multiply', 'Build once, then adapt the same core knowledge across many formats.'],
              ['Ship', 'Move from thinking about your business to putting finished work into the world.'],
            ].map(([title, description]) => (
              <div key={title} className="border-t border-paper/20 pt-5">
                <h3 className="font-serif text-2xl">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-paper/65">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <p className="eyebrow">Choose your press run</p>
            <h2 className="section-title mt-4">Start small.<br /><span className="brass-text">Build what lasts.</span></h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {plans.map((plan) => (
              <article key={plan.name} className={`price-card ${plan.popular ? 'price-card-popular' : ''}`}>
                {plan.popular && <span className="popular-ribbon">Most popular</span>}
                <p className="eyebrow">{plan.name}</p>
                <div className="mt-5 flex items-end gap-2"><span className="font-serif text-5xl">{plan.price}</span><span className="pb-2 text-sm text-ink-faint">/month</span></div>
                <p className="mt-3 text-sm text-ink-muted">{plan.detail}</p>
                <div className="my-8 h-px bg-ink/10" />
                <ul className="space-y-3 text-sm text-ink-muted">
                  <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 text-brass" /> Guided AI interviews</li>
                  <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 text-brass" /> Digital asset generation</li>
                  <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 text-brass" /> Export-ready content</li>
                </ul>
                <Link href="/register" className={`mt-8 inline-flex w-full items-center justify-center ${plan.popular ? 'brass-button' : 'paper-button'}`}>Start Free Trial</Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-brass/20 bg-paper-deep px-5 py-24 text-center sm:px-8">
        <Sparkles className="mx-auto h-6 w-6 text-brass" />
        <p className="eyebrow mt-5">Your knowledge is already the raw material</p>
        <h2 className="mx-auto mt-4 max-w-3xl font-serif text-5xl leading-none tracking-tight sm:text-6xl">What could you build if you only had to <span className="brass-text">say it once?</span></h2>
        <Link href="/register" className="brass-button mt-9 inline-flex items-center gap-2">Begin your first build <ArrowRight className="h-4 w-4" /></Link>
      </section>

      <Footer />
    </main>
  )
}
