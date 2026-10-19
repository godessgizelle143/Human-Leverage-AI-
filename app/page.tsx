import Link from 'next/link'
import { ArrowRight, Check, Clock, Heart, Leaf, MessageCircle } from 'lucide-react'
import { PRICING_PLANS, type PlanKey } from '@/lib/stripe/client'
import { assetCategoryLabel, ASSET_TYPES } from '@/lib/hke/assets'
import { TOTAL_QUESTIONS } from '@/lib/hke/interview'
import { JOURNEY_KEYS, JOURNEY_LABELS, type JourneyKey } from '@/lib/hke/journey'
import { STEP_SECTIONS } from '@/lib/hke/steps'
import Footer from '@/components/layout/Footer'
import BrandMark from '@/components/hke/BrandMark'

const CATEGORIES = Array.from(new Set(ASSET_TYPES.map((type) => type.category)))

const STAGE_COPY: Record<JourneyKey, string> = {
  capture: `Answer ${TOTAL_QUESTIONS} guided questions about your business, your customer, and your voice. Skip any, come back any time; every answer saves as you type.`,
  blueprint: 'HKE AI structures your answers into a blueprint: your pitch, ideal customer, differentiation, voice, and roadmap, all in one place.',
  plan: `Make ${STEP_SECTIONS.length} decisions — ${STEP_SECTIONS.map((step) => step.label.toLowerCase()).join(', ')} — so what gets built is aimed at a real launch.`,
  assets: `Generate any of ${ASSET_TYPES.length} asset types from your own knowledge. Edit them, regenerate new versions, and export each one.`,
  kit: 'Download everything as one print-ready document: blueprint, plan, and the latest version of every asset.',
}

// "Made for you" promises. Each one must stay true to what the product does today:
// finished writing from plain answers, skip/return with autosave, more projects and
// asset types, and the no-invented-facts grounding rule in lib/hke/intelligence/prompts.ts.
const MADE_FOR_YOU = [
  { icon: MessageCircle, title: 'Your words are enough', body: 'Answer in everyday language. No need to sound polished — HKE AI turns your answers into finished writing in your voice.' },
  { icon: Clock, title: 'Your pace, your way', body: 'Skip any question and come back any time. Every answer saves as you type.' },
  { icon: Leaf, title: 'Grows with you', body: `Start with one project. When you’re ready, add more projects and build any of the ${ASSET_TYPES.length} asset types.` },
  { icon: Heart, title: 'Honest by design', body: 'HKE AI only uses what you tell it. It never makes up testimonials, numbers, or results.' },
]

// Illustration only: a generic example of the three steps. It describes no real project.
const EXAMPLE = {
  question: 'What do you help your customers accomplish?',
  answer: 'I help people understand a complicated process and turn it into clear, practical steps they can follow.',
  insights: ['The challenge your audience faces', 'The guidance and expertise you provide', 'The steps that help customers move forward'],
  asset: { title: 'Your Expertise, Organized and Ready to Use', outputs: ['A structured knowledge blueprint', 'A practical customer guide', 'Clear website and marketing content'] },
}

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-brand-black text-white">
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-brand-black/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center">
            <BrandMark tagline />
          </Link>
          <div className="hidden items-center gap-7 md:flex">
            <a href="#how-it-works" className="link-quiet nav-accent text-sm">How it works</a>
            <a href="#features" className="link-quiet nav-accent text-sm">What you can build</a>
            <a href="#kit" className="link-quiet nav-accent text-sm">Knowledge Kit</a>
            <a href="#pricing" className="link-quiet nav-accent text-sm">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-white/80 transition hover:text-brand-pink">Sign In</Link>
            <Link href="/register" className="btn-primary hidden sm:inline-flex">Get Started</Link>
          </div>
        </div>
      </nav>

      <section className="relative px-5 pb-20 pt-16 sm:px-8 lg:pb-28 lg:pt-24">
        <div className="backdrop-hero absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1fr_1fr]">
          <div className="max-w-2xl">
            <p className="eyebrow mb-5 flex items-center gap-2.5"><span className="status-dot" aria-hidden />Human Knowledge Engine AI</p>
            <h1 className="leading-[1.05]"><span className="gold-text block font-display text-5xl font-bold tracking-[.02em] sm:text-6xl lg:text-7xl">Speak Once<span className="accent-dot">.</span></span><span className="neon-pink mt-1 block font-script text-6xl font-normal sm:text-7xl lg:text-8xl">Build Forever.</span></h1>
            <p className="mt-7 text-lg leading-8 text-white/65 sm:text-xl">Tell HKE AI what you know in one guided interview. It structures your expertise into a <span className="accent-underline">blueprint</span>, then builds the products and marketing assets your business needs — all from your own words.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className="btn-primary cta-edge gap-2 text-base">Start Free 3-Day Trial <ArrowRight className="h-4 w-4" /></Link>
              <a href="#how-it-works" className="btn-secondary text-base">See how it works</a>
            </div>
            <p className="mt-4 text-xs text-white/40">No credit card required for the trial.</p>
            <ul className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t rule-accent pt-6">
              {[
                [TOTAL_QUESTIONS, 'guided questions'],
                [ASSET_TYPES.length, 'asset types'],
                [1, 'Knowledge Kit'],
              ].map(([value, label]) => (
                <li key={label}>
                  <span className="block text-3xl font-black tracking-tight">{value}</span>
                  <span className="mt-1 block text-xs text-white/50">{label}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto w-full max-w-xl" aria-label="Illustrative example of the three steps">
            <div className="absolute -inset-8 rounded-full bg-gradient-brand opacity-10 blur-3xl" aria-hidden />
            <ol className="relative space-y-3">
              <li className="glass flow-step rounded-2xl p-5 sm:mr-16">
                <p className="eyebrow eyebrow-pink">1 · You share your expertise</p>
                <p className="mt-2 text-sm font-semibold">“{EXAMPLE.question}”</p>
                <p className="surface-inset mt-3 rounded-xl p-3 text-sm leading-6 text-white/70">“{EXAMPLE.answer}”</p>
              </li>
              <li className="glass flow-step flow-card rounded-2xl p-5 sm:ml-8 sm:mr-8">
                <p className="eyebrow eyebrow-flow">2 · HKE AI organizes your knowledge</p>
                <p className="accent-word mt-2 text-sm font-semibold">Key insights identified</p>
                <ul className="mt-2 space-y-1.5 text-sm text-white/75">
                  {EXAMPLE.insights.map((item) => <li key={item} className="flex gap-2"><span className="text-brand-turquoise" aria-hidden>•</span>{item}</li>)}
                </ul>
              </li>
              <li className="paper p-5 sm:ml-16">
                <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand-pink">3 · Build useful business materials</p>
                <p className="mt-2 border-b-2 border-brand-gold pb-2 font-serif text-lg font-bold leading-snug">{EXAMPLE.asset.title}</p>
                <ul className="mt-3 space-y-2 text-sm">
                  {EXAMPLE.asset.outputs.map((output) => <li key={output} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-pink" aria-hidden />{output}</li>)}
                </ul>
              </li>
            </ol>
            <p className="relative mt-5 text-center text-base font-semibold sm:text-lg">From what you know to <span className="gradient-text">what you can use.</span></p>
            <p className="relative mt-2 text-center text-[11px] leading-5 text-white/40">Illustrative example. Your results are based on your own expertise and project inputs.</p>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-20 border-y border-white/10 bg-white/[.02] px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="eyebrow flex items-center gap-2.5"><span className="status-dot" aria-hidden />How it works</p>
            <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl"><span className="accent-word">One path</span>, from what you know to <span className="gradient-text">what&apos;s yours to build, share, and sell.</span></h2>
            <p className="mt-5 text-lg leading-8 text-white/55">Every project follows the same five stages. You always know where you are and what comes next.</p>
          </div>
          <ol className="mt-14 grid gap-x-6 gap-y-10 md:grid-cols-5">
            {JOURNEY_KEYS.map((key, index) => (
              <li key={key} className="relative">
                <div className="flex items-center">
                  <span className={index === 0 ? 'grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-pink text-sm font-bold text-brand-black shadow-glow-pink' : 'grid h-10 w-10 shrink-0 place-items-center rounded-full border border-brand-gold/50 text-sm font-bold text-brand-gold'}>{index + 1}</span>
                  {index < JOURNEY_KEYS.length - 1 && <span className="journey-link journey-link-knowledge ml-3 hidden md:block" aria-hidden />}
                </div>
                <h3 className="mt-5 text-xl font-bold">{JOURNEY_LABELS[key].label}</h3>
                <p className={index === 1 ? 'accent-word mt-1 text-sm font-medium' : 'mt-1 text-sm font-medium text-brand-gold'}>{JOURNEY_LABELS[key].summary}</p>
                <p className="mt-3 text-sm leading-6 text-white/55">{STAGE_COPY[key]}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="made-for-you" className="relative scroll-mt-20 px-5 py-20 sm:px-8 lg:py-28">
        <div className="backdrop-spot absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="eyebrow eyebrow-pink">Made for you</p>
            <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">There&apos;s potential in every one of us. <span className="gradient-text">HKE meets you right where you stand.</span></h2>
            <p className="mt-5 text-lg leading-8 text-white/60">Everyone learns, thinks, and builds differently — what works for one person may not work for the next. So HKE AI doesn&apos;t ask you to fit a mold. It starts where you are and walks with you, one step at a time, until you&apos;re moving on your own.</p>
          </div>
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MADE_FOR_YOU.map(({ icon: Icon, title, body }) => (
              <li key={title} className="glass glass-hover rounded-2xl p-6">
                <Icon className="h-6 w-6 text-brand-gold" aria-hidden />
                <h3 className="mt-4 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/60">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="features" className="scroll-mt-20 px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="max-w-2xl">
              <p className="eyebrow eyebrow-pink">What you can build</p>
              <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">One voice<span className="accent-dot">.</span> <span className="gradient-text">{ASSET_TYPES.length} kinds of asset.</span></h2>
            </div>
            <p className="max-w-md text-white/50">Each one is written from your blueprint and interview answers, so it sounds like you — and you can edit every word.</p>
          </div>
          <div className="mt-12 grid gap-x-10 gap-y-10 lg:grid-cols-2">
            {CATEGORIES.map((category) => (
              <div key={category}>
                <h3 className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[.16em] text-white/45">{assetCategoryLabel(category)}<span className="hairline-accent flex-1" aria-hidden /></h3>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {ASSET_TYPES.filter((type) => type.category === category).map((type) => (
                    <li key={type.id} className="glass glass-hover card-accent rounded-xl p-4">
                      <p className="text-sm font-semibold">{type.label}</p>
                      <p className="mt-1 text-xs leading-5 text-white/50">{type.description}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="kit" className="scroll-mt-20 px-5 pb-20 sm:px-8 lg:pb-28">
        <div className="panel-feature mx-auto grid max-w-7xl items-center gap-10 rounded-3xl p-8 sm:p-12 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-16 lg:p-16">
          <div className="paper mx-auto w-full max-w-xs p-5 font-serif lg:max-w-none" role="img" aria-label="Illustration of a Knowledge Kit cover and contents page">
            <div className="rounded-sm border-l-4 border-brand-pink bg-brand-black px-5 py-6 text-white">
              <p className="font-sans text-[10px] font-semibold uppercase tracking-[.2em] text-brand-pink">Knowledge Kit</p>
              <p className="mt-2 border-b-2 border-brand-gold pb-2 text-2xl font-bold leading-tight">Your Business</p>
              <p className="mt-2 text-[11px] italic text-white/70">Speak Once. Build Forever. · Built with HKE AI</p>
            </div>
            <p className="mt-5 text-sm font-bold text-brand-pink">Contents</p>
            <ol className="mt-2 space-y-1.5 text-xs leading-5">
              {['Knowledge Blueprint', 'Launch Plan', 'Your assets, latest versions', 'Source: Your Interview'].map((part, index) => (
                <li key={part} className="flex gap-2"><span className="w-4 shrink-0 font-bold text-brand-gold">{index + 1}.</span>{part}</li>
              ))}
            </ol>
          </div>
          <div>
            <p className="eyebrow eyebrow-flow">The Knowledge Kit</p>
            <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl"><span className="accent-glow">Everything you built,</span> <span className="gradient-text">in one document.</span></h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-white/60">When you are ready to share, print, or simply keep your work, download the whole project as a single kit.</p>
            <ul className="mt-7 space-y-3 text-white/75">
              {[
                'Your blueprint and launch plan, in full',
                'The latest version of every asset you generated',
                'Your own interview answers, included as the source',
                'Print-ready (save as PDF) or Markdown',
              ].map((item) => <li key={item} className="flex gap-3"><Check className="mt-1 h-4 w-4 shrink-0 text-brand-gold" />{item}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <section id="pricing" className="scroll-mt-20 border-t border-white/10 bg-white/[.02] px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow">Pricing</p>
            <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Build more<span className="accent-dot">.</span> <span className="gradient-text">Leverage more.</span></h2>
            <p className="mt-4 text-white/55">Every plan starts with a 3-day free trial. No credit card required.</p>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {(Object.entries(PRICING_PLANS) as [PlanKey, (typeof PRICING_PLANS)[PlanKey]][]).map(([key, plan]) => {
              const popular = key === 'professional'
              return (
                <article key={key} className={`relative flex flex-col rounded-2xl p-7 ${popular ? 'gradient-border bg-brand-surface shadow-glow-pink' : 'glass'}`}>
                  {popular && <p className="eyebrow mb-3">Most popular</p>}
                  <h3 className="text-2xl font-bold">{plan.name}</h3>
                  <div className="mt-4"><span className="text-5xl font-black tracking-tight">${plan.price / 100}</span><span className="text-white/40">/month</span></div>
                  <ul className="mb-8 mt-7 space-y-3 text-sm text-white/65">{plan.features.map((feature) => <li key={feature} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" />{feature}</li>)}</ul>
                  <Link href="/register" className={`${popular ? 'btn-primary' : 'btn-secondary'} mt-auto w-full`}>Start Free Trial</Link>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden px-5 py-24 text-center sm:px-8 lg:py-32">
        <div className="backdrop-spot absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-3xl">
          <p className="eyebrow eyebrow-pink">Start with what you already know</p>
          <h2 className="mt-4 text-5xl font-black leading-none tracking-tight sm:text-6xl"><span className="accent-glow">Speak once<span className="accent-dot">.</span></span><br /><span className="gradient-text">Build forever.</span></h2>
          <p className="mx-auto mt-6 max-w-xl text-white/55">Your first interview takes one sitting. Your blueprint is ready about a minute after you finish.</p>
          <Link href="/register" className="btn-primary cta-edge mt-9 gap-2 text-base">Start Free 3-Day Trial <ArrowRight className="h-4 w-4" /></Link>
          <p className="mt-4 text-xs text-white/35">No credit card required for the trial.</p>
        </div>
      </section>
      <Footer />
    </main>
  )
}
