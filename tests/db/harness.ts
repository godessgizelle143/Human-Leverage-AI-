import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const ROOT = join(HERE, '..', '..')
// Everything after the last production migration is applied on top of the baseline fixture.
const PRODUCTION_HEAD = '20261003053021'

export function newMigrations() {
  const dir = join(ROOT, 'supabase', 'migrations')
  return readdirSync(dir)
    .filter((file) => file.endsWith('.sql') && file.slice(0, 14) > PRODUCTION_HEAD)
    .sort()
    .map((file) => ({ file, sql: readFileSync(join(dir, file), 'utf8') }))
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>

export async function createTestDb() {
  const db = new PGlite()
  await db.exec(readFileSync(join(HERE, 'supabase-baseline.sql'), 'utf8'))
  for (const migration of newMigrations()) await db.exec(migration.sql)

  async function asSuperuser() {
    await db.exec('reset role')
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`)
  }

  return {
    db,
    asSuperuser,
    async asService() {
      await asSuperuser()
      await db.exec('set role service_role')
    },
    async asUser(userId: string) {
      await asSuperuser()
      await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId])
      await db.exec('set role authenticated')
    },
    async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
      return (await db.query<T>(sql, params)).rows
    },
    async one<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
      const rows = (await db.query<T>(sql, params)).rows
      return rows[0]
    },
  }
}

let counter = 0
/** Deterministic, valid v4-shaped UUIDs for readable tests. */
export function uuid() {
  counter += 1
  return `00000000-0000-4000-8000-${counter.toString(16).padStart(12, '0')}`
}

/** Seeds a user with an optional subscription and a completed interview. */
export async function seedUser(t: TestDb, options: { plan?: string; status?: string; interviewsUsed?: number; buildsUsed?: number; periodEnd?: string | null; subscription?: boolean } = {}) {
  await t.asSuperuser()
  const userId = uuid()
  await t.query('insert into auth.users (id, email) values ($1, $2)', [userId, `${userId}@example.test`])
  if (options.subscription !== false) {
    await t.query(
      `insert into public.subscriptions (user_id, plan, status, interviews_used, builds_used, current_period_end)
       values ($1, $2, $3, $4, $5, $6)`,
      [userId, options.plan ?? 'professional', options.status ?? 'trialing', options.interviewsUsed ?? 0, options.buildsUsed ?? 0, options.periodEnd === undefined ? new Date(Date.now() + 86400000).toISOString() : options.periodEnd],
    )
  }
  const interviewId = uuid()
  await t.query(`insert into public.interviews (id, user_id, title, status) values ($1, $2, 'Test interview', 'completed')`, [interviewId, userId])
  return { userId, interviewId }
}

export async function usage(t: TestDb, userId: string) {
  await t.asSuperuser()
  return t.one<{ interviews_used: number; builds_used: number }>('select interviews_used, builds_used from public.subscriptions where user_id = $1', [userId])
}

/** Creates a completed project directly (as the server would after a blueprint). */
export async function seedProject(t: TestDb, userId: string, interviewId: string, content: Record<string, unknown> = { business_summary: 'Test' }) {
  await t.asSuperuser()
  const projectId = uuid()
  await t.query(`insert into public.projects (id, user_id, interview_id, title, content, status) values ($1, $2, $3, 'Test project', $4, 'completed')`, [projectId, userId, interviewId, JSON.stringify(content)])
  return projectId
}

/** Moves a row's updated_at into the past without the touch trigger resetting it. */
export async function age(t: TestDb, table: 'projects' | 'project_assets', id: string, minutes: number) {
  await t.asSuperuser()
  await t.db.exec(`alter table public.${table} disable trigger ${table}_touch_updated_at`)
  await t.query(`update public.${table} set updated_at = now() - ($2 || ' minutes')::interval where id = $1`, [id, String(minutes)])
  await t.db.exec(`alter table public.${table} enable trigger ${table}_touch_updated_at`)
}
