import type { SupabaseClient } from '@supabase/supabase-js'
import { INTERVIEW_QUESTIONS } from '@/types/interview'
import { blueprintEntries, blueprintValueToText, stepEntries } from './blueprint'
import { ASSET_SUMMARY_COLUMNS, PROJECT_COLUMNS, type ProjectRow } from './db'
import type { AssetSummary } from './assets'
import { HkeError } from './errors'
import { parseInterviewMessages, type InterviewAnswers } from './interview'
import { STEP_SECTIONS } from './steps'

/**
 * A read that failed is not the same as a row that does not exist: reporting
 * it as "not found" or as an empty list tells the customer their work is gone,
 * and a generator would build from incomplete knowledge.
 */
function loadFailed(what: string, message: string): HkeError {
  console.error(`${what} load failed:`, message)
  return new HkeError('database_error', 'We could not load your saved work right now. Nothing was changed; please try again.')
}

/** Loads a project the user owns (RLS applies on a session client), or null if there is none. Throws if the read fails. */
export async function loadOwnedProject(supabase: SupabaseClient, userId: string, projectId: string): Promise<ProjectRow | null> {
  const { data, error } = await supabase
    .from('projects')
    .select(PROJECT_COLUMNS)
    .eq('id', projectId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw loadFailed('Project', error.message)
  if (!data) return null
  const row = data as ProjectRow
  return { ...row, content: row.content && typeof row.content === 'object' ? row.content : {} }
}

/** Throws if the read fails, so nothing is generated or exported without the founder's answers. */
export async function loadInterviewAnswers(supabase: SupabaseClient, userId: string, interviewId: string): Promise<InterviewAnswers> {
  const { data, error } = await supabase.from('interviews').select('messages').eq('id', interviewId).eq('user_id', userId).maybeSingle()
  if (error) throw loadFailed('Interview', error.message)
  return parseInterviewMessages(data?.messages).answers
}

/** Throws if the read fails, rather than showing a project with no assets. */
export async function listProjectAssets(supabase: SupabaseClient, userId: string, projectId: string): Promise<AssetSummary[]> {
  const { data, error } = await supabase
    .from('project_assets')
    .select(ASSET_SUMMARY_COLUMNS)
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw loadFailed('Asset list', error.message)
  return (data ?? []) as AssetSummary[]
}

/** Blueprint, plan steps, and interview answers as one Markdown document. */
export function projectToMarkdown(title: string, content: Record<string, unknown>, answers: InterviewAnswers) {
  const lines: string[] = []
  for (const entry of blueprintEntries(content)) lines.push(`## ${entry.label}`, blueprintValueToText(entry.value), '')
  for (const step of STEP_SECTIONS) {
    const entries = stepEntries(content, step.key)
    if (entries?.length) lines.push(`## ${step.label}`, ...entries.map((entry) => `- **${entry.label}:** ${entry.value}`), '')
  }
  const answered = INTERVIEW_QUESTIONS.filter((question) => answers[String(question.id)]?.trim())
  if (answered.length) {
    lines.push('## Interview Answers', '')
    for (const question of answered) lines.push(`### ${question.question}`, answers[String(question.id)].trim(), '')
  }
  return lines.join('\n').trim() || `No blueprint content has been saved for ${title} yet.`
}
