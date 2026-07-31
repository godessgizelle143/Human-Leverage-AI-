'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Bell, Search, User, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function Navbar() {
  const [showDropdown, setShowDropdown] = useState(false)
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-brand-black/80 backdrop-blur-xl">
      <div className="flex items-center justify-between px-8 py-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              placeholder="Search..."
              className="pl-10 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-brand-gold/50 transition-colors w-64"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button className="relative p-2 rounded-lg hover:bg-white/5 transition-colors">
            <Bell className="w-5 h-5 text-white/60" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-brand-pink rounded-full" />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-brand flex items-center justify-center">
                <User className="w-4 h-4 text-black" />
              </div>
            </button>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-48 glass rounded-lg py-2 shadow-xl">
                <Link href="/settings" className="flex items-center gap-2 px-4 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors">
                  <User className="w-4 h-4" />
                  Settings
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors w-full text-left"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
