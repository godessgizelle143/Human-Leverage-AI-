import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as vault from '@/lib/hke/vault'
import { groupVaultAnswers, VAULT_CATEGORIES } from '@/lib/hke/vault'
import { INTERVIEW_QUESTIONS } from '@/types/interview'

describe('groupVaultAnswers', () => {
  it('places every interview question in exactly one section, in interview order', () => {
    const sections = groupVaultAnswers({})
    expect(sections.map((section) => section.key)).toEqual(VAULT_CATEGORIES.map((category) => category.key))
    const ids = sections.flatMap((section) => section.entries.map((entry) => entry.id))
    expect([...ids].sort((a, b) => a - b)).toEqual(INTERVIEW_QUESTIONS.map((question) => question.id))
    for (const section of sections) {
      const sectionIds = section.entries.map((entry) => entry.id)
      expect(sectionIds).toEqual([...sectionIds].sort((a, b) => a - b))
    }
  })

  it('files answers under their category and counts only non-blank ones', () => {
    const sections = groupVaultAnswers({ '1': '  Glow Co  ', '3': 'Busy founders', '7': '   ' })
    const basics = sections.find((section) => section.key === 'basics')!
    const audience = sections.find((section) => section.key === 'audience')!
    const brand = sections.find((section) => section.key === 'brand')!
    expect(basics.entries.find((entry) => entry.id === 1)?.answer).toBe('Glow Co')
    expect(basics.answered).toBe(1)
    expect(audience.entries.find((entry) => entry.id === 3)?.answer).toBe('Busy founders')
    expect(brand.entries.find((entry) => entry.id === 7)?.answer).toBeNull()
    expect(brand.answered).toBe(0)
  })
})

describe('vault access', () => {
  // Your own answers are always yours: an ended trial or plan, or no plan at
  // all, must never lock anyone out of reading their own vault.
  it('has no plan gate', () => {
    expect('canOpenVault' in vault).toBe(false)
    const page = readFileSync(join(process.cwd(), 'app/vault/[interviewId]/page.tsx'), 'utf8')
    expect(page).not.toMatch(/getUserUsage|usage\??\.active|#plans/)
  })

  it('reads only the signed-in user\'s own interview and project', () => {
    const page = readFileSync(join(process.cwd(), 'app/vault/[interviewId]/page.tsx'), 'utf8')
    expect(page.match(/\.eq\('user_id', user\.id\)/g)?.length).toBe(2)
  })
})
