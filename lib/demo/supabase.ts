import { DEMO_WRITE_MESSAGE } from './mode'
import { DEMO_TABLES, DEMO_USER } from './data'

type Row = Record<string, unknown>
const refused = () => ({ data: null, error: { message: DEMO_WRITE_MESSAGE, code: 'demo_read_only' } })

/**
 * A read-only stand-in for the Supabase client, used only in demo mode. Reads
 * filter the sample rows; inserts, updates, deletes, database functions, and
 * every auth call except getUser are refused, so nothing appears to be saved.
 */
function query(table: string) {
  let rows: Row[] = [...(DEMO_TABLES[table] ?? [])]
  let write = false
  let one = false
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: (column: string, value: unknown) => { rows = rows.filter((row) => row[column] === value); return builder },
    neq: (column: string, value: unknown) => { rows = rows.filter((row) => row[column] !== value); return builder },
    is: (column: string, value: unknown) => { rows = rows.filter((row) => (row[column] ?? null) === value); return builder },
    in: (column: string, values: unknown[]) => { rows = rows.filter((row) => values.includes(row[column])); return builder },
    order: (column: string, options?: { ascending?: boolean }) => {
      const direction = options?.ascending === false ? -1 : 1
      rows.sort((a, b) => String(a[column] ?? '').localeCompare(String(b[column] ?? '')) * direction)
      return builder
    },
    limit: (count: number) => { rows = rows.slice(0, count); return builder },
    maybeSingle: () => { one = true; return builder },
    single: () => { one = true; return builder },
    insert: () => { write = true; return builder },
    update: () => { write = true; return builder },
    upsert: () => { write = true; return builder },
    delete: () => { write = true; return builder },
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(write ? refused() : { data: one ? rows[0] ?? null : rows, error: null }).then(resolve, reject),
  }
  return builder
}

export function createDemoSupabaseClient() {
  const auth = new Proxy({ getUser: async () => ({ data: { user: DEMO_USER }, error: null }) } as Record<string, unknown>, {
    get: (target, property: string) => target[property] ?? (async () => refused()),
  })
  // The real client's type is far wider than what the app uses; this covers the calls the app makes.
  return { auth, from: query, rpc: async () => refused() } as any
}
