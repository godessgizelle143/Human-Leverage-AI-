'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Remembers every page render this browser has shown. Seeing one again means
 * Next.js redisplayed its client-side copy (a Link, router.push, or Back
 * navigation) instead of asking the server. Back can restore an older copy
 * than the last one shown, so every render is remembered, not just the last.
 */
export function createRenderTracker() {
  const seen = new Set<string>()
  return (renderId: string) => {
    const repeat = seen.has(renderId)
    seen.add(renderId)
    return repeat
  }
}

const seenBefore = createRenderTracker()

/**
 * Next.js 14 keeps a copy of each visited page in the browser and can show it
 * again without a server round-trip, so a user returning from the interview
 * saw answers from before their latest edits. When the render on screen is
 * one already shown, fetch the page fresh once. Each server render passes a
 * new renderId, so a fresh load never triggers a second one.
 */
export default function RefreshOnReturn({ renderId }: { renderId: string }) {
  const router = useRouter()
  // React runs effects twice in development; handle each render only once.
  const handled = useRef<string | null>(null)

  useEffect(() => {
    if (handled.current === renderId) return
    handled.current = renderId
    if (seenBefore(renderId)) router.refresh()
  }, [renderId, router])

  // A page restored from the browser's back/forward cache runs no effects.
  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => { if (event.persisted) router.refresh() }
    window.addEventListener('pageshow', onShow)
    return () => window.removeEventListener('pageshow', onShow)
  }, [router])

  return null
}
