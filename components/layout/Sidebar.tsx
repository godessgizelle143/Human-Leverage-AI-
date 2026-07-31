'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sparkles, LayoutDashboard, MessageSquare, FolderOpen, Download, CreditCard, Settings } from 'lucide-react'
import { clsx } from 'clsx'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/interview', label: 'AI Interview', icon: MessageSquare },
  { href: '/projects', label: 'Projects', icon: FolderOpen },
  { href: '/downloads', label: 'Downloads', icon: Download },
  { href: '/subscription', label: 'Subscription', icon: CreditCard },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 h-full w-64 border-r border-white/5 bg-brand-black/50 backdrop-blur-xl z-50">
      <div className="p-6">
        <Link href="/dashboard" className="flex items-center gap-2 mb-10">
          <Sparkles className="w-7 h-7 text-brand-gold" />
          <span className="text-lg font-bold gradient-text">Human Leverage AI™</span>
        </Link>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all duration-200',
                  isActive
                    ? 'bg-brand-gold/10 text-brand-gold border border-brand-gold/20'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="absolute bottom-6 left-6 right-6">
        <div className="glass rounded-xl p-4">
          <p className="text-xs text-white/40 mb-2">Need help?</p>
          <a href="mailto:support@humanleverageai.com" className="text-sm text-brand-gold hover:text-brand-pink transition-colors">
            Contact Support
          </a>
        </div>
      </div>
    </aside>
  )
}
