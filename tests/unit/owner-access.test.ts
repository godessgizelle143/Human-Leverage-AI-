import { afterEach, describe, expect, it, vi } from 'vitest'
import { isHumanLeverageOwner, isOwnerUser } from '@/lib/owner-access'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('isHumanLeverageOwner', () => {
  it('rejects all users when no owner emails are configured', () => {
    vi.stubEnv('HUMAN_LEVERAGE_OWNER_EMAILS', '')
    expect(isHumanLeverageOwner('owner@example.com')).toBe(false)
  })

  it('accepts an email explicitly listed in the configuration', () => {
    vi.stubEnv('HUMAN_LEVERAGE_OWNER_EMAILS', 'owner@example.com')
    expect(isHumanLeverageOwner('owner@example.com')).toBe(true)
  })

  it('ignores capitalization and surrounding whitespace', () => {
    vi.stubEnv(
      'HUMAN_LEVERAGE_OWNER_EMAILS',
      ' other@example.com , Owner@Example.com '
    )
    expect(isHumanLeverageOwner(' owner@example.com ')).toBe(true)
  })

  it('rejects an email not listed in the configuration', () => {
    vi.stubEnv('HUMAN_LEVERAGE_OWNER_EMAILS', 'owner@example.com')
    expect(isHumanLeverageOwner('someone-else@example.com')).toBe(false)
  })

  it('rejects missing email addresses', () => {
    vi.stubEnv('HUMAN_LEVERAGE_OWNER_EMAILS', 'owner@example.com')
    expect(isHumanLeverageOwner(null)).toBe(false)
    expect(isHumanLeverageOwner(undefined)).toBe(false)
  })
})

describe('isOwnerUser', () => {
  const confirmed = '2026-10-01T00:00:00Z'

  it('accepts a listed owner whose email is confirmed', () => {
    vi.stubEnv('HUMAN_LEVERAGE_OWNER_EMAILS', 'owner@example.com')
    expect(isOwnerUser({ email: 'owner@example.com', email_confirmed_at: confirmed })).toBe(true)
  })

  it('rejects a listed email that has not been confirmed', () => {
    vi.stubEnv('HUMAN_LEVERAGE_OWNER_EMAILS', 'owner@example.com')
    expect(isOwnerUser({ email: 'owner@example.com', email_confirmed_at: undefined })).toBe(false)
  })

  it('rejects confirmed users who are not listed, and missing users', () => {
    vi.stubEnv('HUMAN_LEVERAGE_OWNER_EMAILS', 'owner@example.com')
    expect(isOwnerUser({ email: 'someone@example.com', email_confirmed_at: confirmed })).toBe(false)
    expect(isOwnerUser(null)).toBe(false)
  })
})
