import { INTERVIEW_QUESTIONS } from '@/types/interview'
import { blueprintEntries, blueprintValueToText, stepEntries } from './blueprint'
import type { Knowledge, KnowledgeItem, KnowledgeSource } from './domain'
import type { InterviewAnswers } from './interview'
import { STEP_SECTIONS } from './steps'

/**
 * The knowledge engine today: everything HKE has saved for a project,
 * assembled into typed knowledge items. Each later capability (documents,
 * URLs, embeddings) adds sources and items here instead of building its own
 * context, so every generator sees the same knowledge.
 */
export function assembleKnowledge(project: { id: string; title: string; content: unknown }, answers: InterviewAnswers): Knowledge {
  const sources: KnowledgeSource[] = []
  const items: KnowledgeItem[] = []

  const blueprint = blueprintEntries(project.content)
  if (blueprint.length) {
    sources.push({ id: 'blueprint', kind: 'blueprint', label: 'Knowledge blueprint' })
    for (const entry of blueprint) items.push({ key: entry.key, kind: 'insight', sourceId: 'blueprint', label: entry.label, text: blueprintValueToText(entry.value) })
  }

  for (const step of STEP_SECTIONS) {
    const entries = stepEntries(project.content, step.key)
    if (!entries?.length) continue
    sources.push({ id: step.key, kind: 'plan_step', label: step.label })
    for (const entry of entries) items.push({ key: `${step.key}.${entry.label}`, kind: 'plan', sourceId: step.key, label: `${step.label}: ${entry.label}`, text: entry.value })
  }

  const answered = INTERVIEW_QUESTIONS.filter((question) => answers[String(question.id)]?.trim())
  if (answered.length) {
    sources.push({ id: 'interview', kind: 'interview', label: 'Knowledge interview' })
    for (const question of answered) items.push({ key: `answer.${question.id}`, kind: 'answer', sourceId: 'interview', label: question.question, text: answers[String(question.id)].trim() })
  }

  return { projectId: project.id, title: project.title, sources, items }
}

const SECTION_HEADINGS: Record<KnowledgeItem['kind'], string> = {
  insight: 'BLUEPRINT',
  plan: 'LAUNCH PLAN DECISIONS',
  answer: "INTERVIEW ANSWERS (the founder's own words)",
}

export const MAX_CONTEXT_CHARS = 14000

/** Plain-text context for a prompt, truncated to a fixed budget. */
export function knowledgeToPromptContext(knowledge: Knowledge, maxChars = MAX_CONTEXT_CHARS) {
  const parts = [`PROJECT: ${knowledge.title}`]
  for (const kind of ['insight', 'plan', 'answer'] as const) {
    const items = knowledge.items.filter((item) => item.kind === kind)
    if (!items.length) continue
    parts.push(`${SECTION_HEADINGS[kind]}:`)
    for (const item of items) parts.push(kind === 'answer' ? `Q: ${item.label}\nA: ${item.text}` : `## ${item.label}\n${item.text}`)
  }
  const text = parts.join('\n\n')
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n[context truncated]` : text
}

export function hasBlueprint(knowledge: Knowledge) {
  return knowledge.items.some((item) => item.kind === 'insight')
}
