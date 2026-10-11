import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { createTestDb, type TestDb } from './harness'

/**
 * Guards types/database.ts (the canonical database types) against drifting
 * from the migrated schema: every table's Row columns and every HKE
 * function's arguments must match the database exactly.
 */
const TYPES = readFileSync(fileURLToPath(new URL('../../types/database.ts', import.meta.url)), 'utf8')

function block(source: string, start: string) {
  const from = source.indexOf(start)
  if (from < 0) return ''
  let depth = 0
  for (let i = source.indexOf('{', from); i < source.length; i++) {
    if (source[i] === '{') depth++
    if (source[i] === '}' && --depth === 0) return source.slice(from, i + 1)
  }
  return ''
}

function keysOf(objectBlock: string) {
  const inner = objectBlock.slice(objectBlock.indexOf('{') + 1, objectBlock.lastIndexOf('}'))
  return Array.from(inner.matchAll(/(?:^|[\s;{])([a-z_]+)\??:/g), (match) => match[1]).sort()
}

function typedColumns(table: string) {
  return keysOf(block(block(TYPES, `      ${table}: {`), 'Row: {'))
}

function typedArgs(fn: string) {
  return keysOf(block(block(TYPES, `      ${fn}: {`), 'Args: {'))
}

let t: TestDb

beforeAll(async () => {
  t = await createTestDb()
})

describe('types/database.ts matches the migrated schema', () => {
  it.each(['checkout_locks', 'interviews', 'projects', 'project_assets', 'subscriptions'])('%s columns', async (table) => {
    await t.asSuperuser()
    const rows = await t.query<{ column_name: string }>(`select column_name from information_schema.columns where table_schema = 'public' and table_name = $1`, [table])
    expect(typedColumns(table)).toEqual(rows.map((row) => row.column_name).sort())
  })

  it.each([
    'acquire_checkout_lock',
    'checkout_lock_lease',
    'claim_stripe_customer',
    'renew_checkout_lock',
    'release_checkout_lock',
    'hke_begin_asset_generation',
    'hke_begin_blueprint_generation',
    'hke_expire_stale_asset_generations',
    'hke_finish_asset_generation',
    'hke_finish_blueprint_generation',
    'hke_save_project_section',
  ])('%s arguments', async (fn) => {
    await t.asSuperuser()
    const row = await t.one<{ args: string[] }>(
      `select array(select unnest(p.proargnames[1:p.pronargs])) as args from pg_proc p where p.proname = $1 and p.pronamespace = 'public'::regnamespace`,
      [fn],
    )
    expect(row, `${fn} exists in the database`).toBeDefined()
    expect(typedArgs(fn)).toEqual([...row.args].sort())
  })
})
