'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const workspaceItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { href: '/builder', label: 'New Project', icon: '🚀' },
  { href: '/interview', label: 'AI Interviews', icon: '🎤' },
  { href: '/projects', label: 'My Projects', icon: '📁' },
  { href: '/downloads', label: 'Downloads', icon: '📥' },
]

const accountItems = [
  { href: '/subscription', label: 'Subscription', icon: '💳' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
]

export default function DashboardSidebar({ email }: { email?: string | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  function NavLinks() {
    return (
      <div className="flex flex-col h-full">
        <div className="px-5 pt-6 pb-5 border-b border-white/10">
          <p className="text-brand-gold text-xs font-semibold tracking-widest">HUMAN LEVERAGE AI™</p>
          <p className="text-white/50 text-xs mt-1">Speak Once. Build Forever.</p>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1" aria-label="Workspace">
          <p className="px-3 mb-2 text-[10px] uppercase tracking-widest text-white/35">Workspace</p>
          {workspaceItems.map((item) => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))
            return (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors ${active ? 'bg-brand-pink/10 text-white border border-brand-pink/30' : 'text-white/65 hover:text-white hover:bg-white/5'}`}>
                <span aria-hidden="true">{item.icon}</span><span>{item.label}</span>
              </Link>
            )
          })}

          <p className="px-3 pt-6 mb-2 text-[10px] uppercase tracking-widest text-white/35">Account</p>
          {accountItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors ${active ? 'bg-brand-pink/10 text-white border border-brand-pink/30' : 'text-white/65 hover:text-white hover:bg-white/5'}`}>
                <span aria-hidden="true">{item.icon}</span><span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="px-3 py-2 mb-2 text-xs text-white/45 truncate" title={email ?? undefined}>{email ?? 'Signed in'}</div>
          <button type="button" onClick={handleSignOut} disabled={signingOut} className="w-full flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-white/70 hover:text-white hover:bg-white/5 disabled:opacity-50 transition-colors">
            <span aria-hidden="true">↪</span><span>{signingOut ? 'Signing out…' : 'Sign Out'}</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Open navigation" aria-expanded={open} className="fixed top-4 left-4 z-40 md:hidden rounded-xl border border-white/15 bg-black/90 px-3 py-2 text-xl text-white shadow-lg">☰</button>

      <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:z-30 md:block md:w-64 md:border-r md:border-white/10 md:bg-black/95">
        <NavLinks />
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" onClick={() => setOpen(false)} aria-label="Close navigation" className="absolute inset-0 bg-black/70" />
          <aside className="relative h-full w-72 max-w-[85vw] border-r border-white/10 bg-black shadow-2xl">
            <button type="button" onClick={() => setOpen(false)} aria-label="Close navigation" className="absolute right-3 top-3 rounded-lg px-3 py-2 text-white/60 hover:text-white">✕</button>
            <NavLinks />
          </aside>
        </div>
      )}
    </>
  )
}
