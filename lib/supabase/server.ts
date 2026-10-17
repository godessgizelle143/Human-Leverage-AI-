import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { isDemoMode } from '@/lib/demo/mode'
import { createDemoSupabaseClient } from '@/lib/demo/supabase'

export async function createServerSupabaseClient() {
  // Local demo preview only (never in a production build): read-only sample data.
  if (isDemoMode()) return createDemoSupabaseClient() as never

  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },

        setAll(
          cookiesToSet: {
            name: string
            value: string
            options?: CookieOptions
          }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Cookie setting can fail in Server Components
          }
        },
      },
    }
  )
}

export function createServiceRoleClient() {
  if (isDemoMode()) return createDemoSupabaseClient()

  const { createClient } = require('@supabase/supabase-js')

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
