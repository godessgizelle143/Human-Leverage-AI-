'use client'

import Link from 'next/link'
import { ArrowRight, Check, Mic2, Package, Sparkles, Zap } from 'lucide-react'
import Footer from '@/components/layout/Footer'

const outputs = ['Ebook','Workbook','Course Outline','Sales Page','Landing Page','Website Copy','Marketing Copy','Lead Magnet','Email Sequence','Social Media Posts','Blog Articles','FAQ','Mission Statement','Brand Story','Product Descriptions','Calls to Action']

const plans = [
  { name: 'Creator', price: '$47', features: ['5 AI interviews/month','5 content builds/month','PDF exports','Email support'] },
  { name: 'Professional', price: '$97', popular: true, features: ['25 AI interviews/month','25 content builds/month','Priority PDF exports','Priority support','Advanced templates'] },
  { name: 'Business Pro', price: '$197', features: ['Unlimited interviews','Unlimited builds','Premium templates','Dedicated support','API access','White-label options'] },
]

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-brand-black text-white">
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-brand-black/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-brand text-sm font-black text-brand-black shadow-[0_0_20px_rgba(255,215,0,.25)]">HL</span>
            <span className="text-lg font-bold tracking-tight sm:text-xl">HUMAN LEVERAGE <span className="gradient-text">AI™</span></span>
          </Link>
          <div className="hidden items-center gap-7 md:flex">
            <a href="#features" className="text-sm text-white/65 transition hover:text-brand-gold">Features</a>
            <a href="#outputs" className="text-sm text-white/65 transition hover:text-brand-gold">What You Get</a>
            <a href="#pricing" className="text-sm text-white/65 transition hover:text-brand-gold">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-white/80 hover:text-brand-gold">Sign In</Link>
            <Link href="/register" className="btn-primary hidden sm:inline-flex">Get Started</Link>
          </div>
        </div>
      </nav>

      <section className="relative px-5 pb-24 pt-20 sm:px-8 lg:pb-32 lg:pt-28">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,rgba(255,215,0,.12),transparent_30%),radial-gradient(circle_at_80%_20%,rgba(255,0,168,.13),transparent_32%)]" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.05fr_.95fr]">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-gold/30 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[.18em] text-brand-gold"><Sparkles className="h-3.5 w-3.5" /> AI-powered knowledge leverage</div>
            <h1 className="text-5xl font-black leading-[.96] tracking-[-.04em] sm:text-6xl lg:text-7xl">Speak Once.<br /><span className="gradient-text">Build Forever.</span></h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-white/65 sm:text-xl">Transform your knowledge into digital products, marketing assets, and business resources with AI. Perfect for entrepreneurs, creators, coaches, consultants, and freelancers.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className="btn-primary inline-flex items-center justify-center gap-2 text-base">Start Free 3-Day Trial <ArrowRight className="h-4 w-4" /></Link>
              <a href="#pricing" className="btn-secondary inline-flex items-center justify-center text-base">View Pricing Plans</a>
            </div>
            <p className="mt-4 text-xs text-white/40">No commitment required during the trial period.</p>
          </div>

          <div className="relative mx-auto w-full max-w-xl">
            <div className="absolute -inset-8 rounded-full bg-gradient-brand opacity-15 blur-3xl" />
            <div className="glass gradient-border relative rounded-3xl p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between text-xs uppercase tracking-[.18em] text-white/45"><span>Your knowledge</span><span className="text-brand-gold">→ assets</span></div>
              <div className="rounded-2xl border border-brand-gold/20 bg-black/50 p-5">
                <div className="flex h-20 items-center justify-center gap-1">
                  {[18,32,52,27,64,42,22,55,34,70,44,28,58,38,66,25,50,31,60,40].map((height, i) => <span key={i} className="w-1 rounded-full bg-gradient-brand shadow-[0_0_12px_rgba(255,215,0,.35)]" style={{height:`${height}px`}} />)}
                </div>
                <div className="mt-5 grid gap-3">
                  {['Brand Story','Course Outline','Sales Page'].map((item, i) => <div key={item} className={`glass rounded-xl p-4 ${i === 2 ? 'border-brand-pink/40 shadow-[0_0_25px_rgba(255,0,168,.12)]' : ''}`}><div className="flex items-center justify-between"><span className="text-xs text-brand-gold">0{i+1}</span><span className="font-semibold">{item}</span><ArrowRight className="h-4 w-4 text-brand-pink" /></div></div>)}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-white/45"><span>ONE CONVERSATION</span><span className="gradient-text font-bold">MANY ASSETS</span></div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="border-y border-white/10 bg-white/[.02] px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center"><p className="text-xs font-bold uppercase tracking-[.2em] text-brand-gold">Your Knowledge, Automated</p><h2 className="mt-4 text-4xl font-black sm:text-5xl">Turn what you know into <span className="gradient-text">something you can sell.</span></h2></div>
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {[
              [Mic2,'AI Interview','Answer guided questions about your business, expertise, and goals.'],
              [Sparkles,'Content Generation','AI creates ebooks, workbooks, courses, marketing copy, and more.'],
              [Package,'Instant Products','Download, customize, and sell your digital products immediately.'],
            ].map(([Icon,title,description]) => { const C = Icon as typeof Mic2; return <article key={String(title)} className="glass glass-hover rounded-2xl p-7"><div className="mb-6 grid h-12 w-12 place-items-center rounded-xl bg-gradient-brand text-brand-black shadow-[0_0_25px_rgba(255,215,0,.18)]"><C className="h-6 w-6" /></div><h3 className="text-2xl font-bold">{String(title)}</h3><p className="mt-3 leading-7 text-white/55">{String(description)}</p></article> })}
          </div>
        </div>
      </section>

      <section id="outputs" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-brand-pink">What You'll Generate</p><h2 className="mt-3 text-4xl font-black sm:text-5xl">One voice. <span className="gradient-text">16 outputs.</span></h2></div><p className="max-w-md text-white/50">Your expertise becomes a reusable library of products, marketing assets, and business resources.</p></div>
          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{outputs.map((output,i) => <div key={output} className="glass glass-hover rounded-xl p-4"><div className="flex items-center gap-3"><span className="text-xs font-bold text-brand-gold">{String(i+1).padStart(2,'0')}</span><span className="text-sm font-semibold">{output}</span></div></div>)}</div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 lg:py-28"><div className="mx-auto max-w-7xl rounded-3xl border border-brand-gold/20 bg-gradient-to-br from-brand-gold/10 via-white/[.03] to-brand-pink/10 p-8 sm:p-12 lg:p-16"><div className="grid gap-10 lg:grid-cols-3"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-brand-gold">The Human Leverage Loop</p><h2 className="mt-4 text-4xl font-black">Speak.<br /><span className="gradient-text">Build.</span><br />Scale.</h2></div>{[['01','Capture','Answer the guided interview.'],['02','Create','Let AI structure your expertise.'],['03','Launch','Customize, publish, and sell.']].map(([n,t,d]) => <div key={n} className="border-t border-white/15 pt-5"><span className="text-xs font-bold text-brand-pink">{n}</span><h3 className="mt-8 text-2xl font-bold">{t}</h3><p className="mt-2 leading-7 text-white/55">{d}</p></div>)}</div></div></section>

      <section id="pricing" className="bg-white/[.02] px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl"><div className="mx-auto max-w-2xl text-center"><p className="text-xs font-bold uppercase tracking-[.2em] text-brand-gold">Choose the plan that fits your goals</p><h2 className="mt-4 text-4xl font-black sm:text-5xl">Build more. <span className="gradient-text">Leverage more.</span></h2></div><div className="mt-14 grid gap-6 md:grid-cols-3">{plans.map(plan => <article key={plan.name} className={`relative rounded-2xl p-7 ${plan.popular ? 'gradient-border bg-gradient-to-b from-brand-gold/10 to-brand-pink/10 shadow-[0_0_40px_rgba(255,0,168,.12)] scale-[1.02]' : 'glass'}`}>{plan.popular && <div className="mb-4 inline-flex rounded-full bg-gradient-brand px-3 py-1 text-xs font-black uppercase tracking-wider text-brand-black">Most Popular</div>}<h3 className="text-2xl font-bold">{plan.name}</h3><div className="mt-4"><span className="gradient-text text-5xl font-black">{plan.price}</span><span className="text-white/40">/month</span></div><ul className="mt-7 space-y-3 text-sm text-white/65">{plan.features.map(f => <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" />{f}</li>)}</ul><Link href="/register" className={`${plan.popular ? 'btn-primary' : 'btn-secondary'} mt-8 inline-flex w-full justify-center`}>Start Free Trial</Link></article>)}</div></div>
      </section>

      <section className="relative overflow-hidden px-5 py-24 text-center sm:px-8 lg:py-32"><div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,0,168,.12),transparent_38%)]" /><div className="relative mx-auto max-w-3xl"><Zap className="mx-auto h-7 w-7 text-brand-gold" /><p className="mt-5 text-xs font-bold uppercase tracking-[.2em] text-brand-pink">Ready to Scale Your Expertise?</p><h2 className="mt-4 text-5xl font-black leading-none sm:text-6xl">Speak once.<br /><span className="gradient-text">Build forever.</span></h2><p className="mx-auto mt-6 max-w-xl text-white/55">Explore Human Leverage AI and discover how your knowledge can become digital products, marketing assets, and business resources.</p><Link href="/register" className="btn-primary mt-9 inline-flex items-center gap-2 text-base">Start Free 3-Day Trial <ArrowRight className="h-4 w-4" /></Link><p className="mt-4 text-xs text-white/35">No commitment required during the trial period.</p></div></section>
      <Footer />
    </main>
  )
}
