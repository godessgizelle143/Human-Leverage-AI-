/**
 * Local demo preview. When on, the server reads sample data from
 * `lib/demo/data.ts` instead of Supabase, every write is refused, and a banner
 * says so on every page. It exists so the real routes can be reviewed without
 * a database.
 *
 * It can never be on in a production build: `next build`/`next start` and
 * Vercel set NODE_ENV to "production", which wins over the flag.
 */
export function isDemoMode(env: Record<string, string | undefined> = process.env) {
  return env.NODE_ENV !== 'production' && env.HKE_DEMO_MODE === '1'
}

export const DEMO_WRITE_MESSAGE = 'Demo preview: this is sample data, so saving, generating, sign-in, and checkout are turned off.'
