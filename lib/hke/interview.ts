import { INTERVIEW_QUESTIONS } from '@/types/interview'

export const TOTAL_QUESTIONS = INTERVIEW_QUESTIONS.length
export const MAX_ANSWER_LENGTH = 10000

export type InterviewAnswers = Record<string, string>

export type InterviewState = {
  answers: InterviewAnswers
  current: number
  archived: boolean
}

const QUESTION_IDS = new Set(INTERVIEW_QUESTIONS.map((question) => String(question.id)))

function pickAnswers(source: unknown): InterviewAnswers {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {}
  const answers: InterviewAnswers = {}
  for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
    if (QUESTION_IDS.has(key) && typeof value === 'string') answers[key] = value
  }
  return answers
}

/**
 * interviews.messages holds either the legacy flat answer map written by the
 * original generate route ({ "1": "...", "2": "..." }) or the versioned draft
 * shape ({ version: 2, answers, current, archived }). Both are read here.
 */
export function parseInterviewMessages(messages: unknown): InterviewState {
  if (messages && typeof messages === 'object' && !Array.isArray(messages) && (messages as { version?: unknown }).version === 2) {
    const draft = messages as { answers?: unknown; current?: unknown; archived?: unknown }
    return {
      answers: pickAnswers(draft.answers),
      current: clampQuestionIndex(Number(draft.current) || 0),
      archived: draft.archived === true,
    }
  }
  return { answers: pickAnswers(messages), current: 0, archived: false }
}

export function serializeInterviewMessages(state: InterviewState) {
  return { version: 2, answers: state.answers, current: state.current, archived: state.archived }
}

/** Keeps only known question ids with string values, trimmed to a safe length. */
export function sanitizeAnswers(input: unknown): InterviewAnswers {
  const answers = pickAnswers(input)
  for (const key of Object.keys(answers)) answers[key] = answers[key].slice(0, MAX_ANSWER_LENGTH)
  return answers
}

export function clampQuestionIndex(index: number) {
  return Math.max(0, Math.min(Math.floor(index), TOTAL_QUESTIONS - 1))
}

export function answeredCount(answers: InterviewAnswers) {
  return Object.values(answers).filter((value) => value.trim().length > 0).length
}

export function progressFor(answers: InterviewAnswers) {
  return Math.round((answeredCount(answers) / TOTAL_QUESTIONS) * 100)
}

export function titleFromAnswers(answers: InterviewAnswers) {
  return answers['1']?.trim().slice(0, 120) || 'Untitled project'
}
