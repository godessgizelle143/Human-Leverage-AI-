import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { getOpenAIClient, GENERATION_SYSTEM_PROMPT } from '@/lib/openai/client'
import { HLAI_CAPABILITIES } from '@/lib/ai/capabilities'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'AI generation is not configured in this production deployment.' }, { status: 503 })
    }

    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Authentication required. Please sign in again.' }, { status: 401 })

    const body = await request.json()
    const answers = body?.answers as Record<string, string> | undefined
    if (!answers || Object.keys(answers).length === 0) return NextResponse.json({ error: 'Interview answers are required.' }, { status: 400 })

    const cleanAnswers = Object.fromEntries(Object.entries(answers).map(([key, value]) => [key, String(value).trim()]))
    const title = cleanAnswers['1'] || 'My New Business'
    const interviewId = crypto.randomUUID()
    const projectId = crypto.randomUUID()
    const now = new Date().toISOString()
    const capabilityCatalog = HLAI_CAPABILITIES.map(({ id, name, category, description, stage }) => ({ id, name, category, description, stage }))

    const openai = getOpenAIClient()
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `${GENERATION_SYSTEM_PROMPT}\nReturn valid JSON only with these keys: business_summary, ideal_customer, problem_solved, differentiation, products_services, brand_voice, origin_story, mission_values, customer_transformation, goals_6_12_months, marketing_strategy, launch_roadmap, elevator_pitch, next_steps, recommended_modules. recommended_modules must be an array containing only capability IDs from the supplied catalog.` },
        { role: 'user', content: `Build a practical starter asset package from this completed Human Leverage AI business interview. Preserve the founder's actual ideas and do not invent testimonials, traction, customers, revenue, partnerships, or accomplishments. Recommend only the HLai capabilities that would materially help this business next.\n\nCAPABILITY CATALOG:\n${JSON.stringify(capabilityCatalog, null, 2)}\n\nINTERVIEW ANSWERS:\n${JSON.stringify(cleanAnswers, null, 2)}` }
      ]
    })

    const raw = completion.choices[0]?.message?.content
    if (!raw) throw new Error('AI returned no content.')
    const generated = JSON.parse(raw) as Record<string, unknown>
    const allowedIds = new Set(HLAI_CAPABILITIES.map((capability) => capability.id))
    const recommendedModules = Array.isArray(generated.recommended_modules) ? generated.recommended_modules.filter((id): id is string => typeof id === 'string' && allowedIds.has(id)) : []
    const content = { ...generated, recommended_modules: recommendedModules, capability_catalog_version: 1 }

    const serviceSupabase = createServiceRoleClient()
    const { error: interviewError } = await serviceSupabase.from('interviews').upsert({ id: interviewId, user_id: user.id, title, status: 'completed', progress: 100, messages: cleanAnswers, created_at: now, updated_at: now })
    if (interviewError) throw new Error(`Could not save interview: ${interviewError.message}`)

    const { data: project, error: projectError } = await serviceSupabase.from('projects').insert({ id: projectId, user_id: user.id, interview_id: interviewId, title, content, status: 'completed', created_at: now, updated_at: now }).select().single()
    if (projectError) throw new Error(`Could not save project: ${projectError.message}`)

    return NextResponse.json({ success: true, project, capabilities: recommendedModules.map((id) => HLAI_CAPABILITIES.find((capability) => capability.id === id)).filter(Boolean) })
  } catch (error) {
    console.error('Project generation failed:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Project generation failed.' }, { status: 500 })
  }
}
