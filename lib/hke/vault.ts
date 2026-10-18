import { INTERVIEW_QUESTIONS, type InterviewQuestion } from '@/types/interview'
import type { Usage } from './domain'
import type { InterviewAnswers } from './interview'

/**
 * The Knowledge Vault: a user's interview answers, organized by topic. The
 * interview is free; reading the vault needs an active plan or trial.
 */
export const VAULT_CATEGORIES: { key: InterviewQuestion['category']; label: string; summary: string }[] = [
  { key: 'basics', label: 'Basics', summary: 'What you do and what you offer.' },
  { key: 'audience', label: 'Audience', summary: 'Who you serve and the problem you solve.' },
  { key: 'brand', label: 'Brand', summary: 'Your story, voice, values, and look.' },
  { key: 'goals', label: 'Goals', summary: 'Where you are headed and where you show up.' },
  { key: 'content', label: 'Content', summary: 'Results, proof, and what your audience should know.' },
]

export type VaultEntry = { id: number; question: string; answer: string | null }
export type VaultSection = (typeof VAULT_CATEGORIES)[number] & { entries: VaultEntry[]; answered: number }

/** Every question, grouped by category in interview order; unanswered ones have a null answer. */
export function groupVaultAnswers(answers: InterviewAnswers): VaultSection[] {
  return VAULT_CATEGORIES.map((category) => {
    const entries = INTERVIEW_QUESTIONS.filter((question) => question.category === category.key).map((question) => ({
      id: question.id,
      question: question.question,
      answer: answers[String(question.id)]?.trim() || null,
    }))
    return { ...category, entries, answered: entries.filter((entry) => entry.answer).length }
  })
}

/** Trial and paid plans both open the vault; an ended trial or plan does not. */
export function canOpenVault(usage: Usage | null) {
  return !!usage?.active
}
