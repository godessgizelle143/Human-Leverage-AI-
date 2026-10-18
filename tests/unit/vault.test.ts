import { describe, expect, it } from 'vitest'
import type { Usage } from '@/lib/hke/domain'
import { canOpenVault, groupVaultAnswers, VAULT_CATEGORIES } from '@/lib/hke/vault'
import { INTERVIEW_QUESTIONS } from '@/types/interview'

const credit = { used: 0, limit: 15, remaining: 15 }
const usage = (overrides: Partial<Usage>): Usage => ({ plan: 'professional', planLabel: 'Professional', active: true, trialing: false, periodEnd: null, interviews: credit, builds: credit, ...overrides })

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

describe('canOpenVault', () => {
  it('opens for paid plans, trials, and the owner', () => {
    expect(canOpenVault(usage({}))).toBe(true)
    expect(canOpenVault(usage({ trialing: true }))).toBe(true)
    expect(canOpenVault(usage({ plan: 'owner', planLabel: 'Owner' }))).toBe(true)
  })

  it('stays closed after a trial or plan ends, and without a plan', () => {
    expect(canOpenVault(usage({ active: false, trialing: true }))).toBe(false)
    expect(canOpenVault(usage({ active: false }))).toBe(false)
    expect(canOpenVault(null)).toBe(false)
  })
})
