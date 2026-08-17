import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { getOpenAIClient, GENERATION_SYSTEM_PROMPT } from '@/lib/openai/client'
import { HLAI_CAPABILITIES } from '@/lib/ai/capabilities'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'AI generation is not configured in this production deployment.' }, { status: 503 })

    const authorization = request.headers.get('authorization')
    let user = null
    let authError = null
    if (authorization?.startsWith('Bearer ')) {
      const token = authorization.slice(7).trim()
      const client = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: `Bearer ${token}` } } })
      const result = await client.auth.getUser(token)
      user = result.data.user
      authError = result.error
    } else {
      const supabase = await createServerSupabaseClient()
      const result = await supabase.auth.getUser()
      user = result.data.user
      authError = result.error
    }
    if (authError || !user) return NextResponse.json({ error: 'Authentication required. Please sign in again. Your saved interview answers are still on this device.' }, { status: 401 })

    const body = await request.json()
    const answers = body?.answers as Record<string, string> | undefined
    if (!answers || Object.keys(answers).length === 0) return NextResponse.json({ error: 'Interview answers are required.' }, { status: 400 })
    const cleanAnswers = Object.fromEntries(Object.entries(answers).map(([key, value]) => [key, String(value).trim()]))

    const serviceSupabase = createServiceRoleClient()
    const { data: gate, error: gateError } = await serviceSupabase
      .rpc('try_consume_build', { p_user_id: user.id })
      .single()

    if (gateError) {
      console.error('Entitlement check failed:', gateError.message)
      return NextResponse.json({ error: 'Unable to verify your subscription. Please try again.' }, { status: 500 })
    }

    if (!gate.allowed) {
      const message = gate.plan
        ? `You've reached your ${gate.plan} plan's build limit for this period.`
        : 'An active subscription is required to generate projects.'
      return NextResponse.json({ error: message }, { status: 403 })
    }

    let buildReserved = true

    try {
      const title = cleanAnswers['1'] || 'My New Business'
      const interviewId = crypto.randomUUID()
      const projectId = crypto.randomUUID()
      const now = new Date().toISOString()
      const capabilityCatalog = HLAI_CAPABILITIES.map(({ id, name, category, description, stage }) => ({ id, name, category, description, stage }))

      const openai = getOpenAIClient()
      let completion
      try {
        completion = await openai.chat.completions.create({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          temperature: 0.7,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: `${GENERATION_SYSTEM_PROMPT}\nReturn valid JSON only with these keys: business_summary, ideal_customer, problem_solved, differentiation, products_services, brand_voice, origin_story, mission_values, customer_transformation, goals_6_12_months, marketing_strategy, launch_roadmap, elevator_pitch, next_steps, recommended_modules. recommended_modules must be an array containing only capability IDs from the supplied catalog.` },
            { role: 'user', content: `Build a practical starter asset package from this completed Human Leverage AI business interview. Preserve the founder's actual ideas and do not invent testimonials, traction, customers, revenue, partnerships, or accomplishments. Recommend only the HLai capabilities that would materially help this business next.\n\nCAPABILITY CATALOG:\n${JSON.stringify(capabilityCatalog, null, 2)}\n\nINTERVIEW ANSWERS:\n${JSON.stringify(cleanAnswers, null, 2)}` }
          ]
        })
      } catch (error) {
        const status = typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 0
        if (status === 429) throw Object.assign(new Error('AI generation is temporarily unavailable because the AI service has reached its usage limit. Please try again later.'), { status: 429 })
        console.error('OpenAI generation request failed:', error instanceof Error ? error.message : 'Unknown provider error')
        throw Object.assign(new Error('AI generation is temporarily unavailable. Please try again later.'), { status: 502 })
      }

      const raw = completion.choices[0]?.message?.content
      if (!raw) throw new Error('AI returned no content.')
      const generated = JSON.parse(raw) as Record<string, unknown>
      const allowedIds = new Set(HLAI_CAPABILITIES.map((capability) => capability.id))
      const recommendedModules = Array.isArray(generated.recommended_modules) ? generated.recommended_modules.filter((id): id is string => typeof id === 'string' && allowedIds.has(id)) : []
      const content = { ...generated, recommended_modules: recommendedModules, capability_catalog_version: 1 }

      const { error: interviewError } = await serviceSupabase.from('interviews').upsert({ id: interviewId, user_id: user.id, title, status: 'completed', progress: 100, messages: cleanAnswers, created_at: now, updated_at: now })
      if (interviewError) throw new Error(`Could not save interview: ${interviewError.message}`)
      const { data: project, error: projectError } = await serviceSupabase.from('projects').insert({ id: projectId, user_id: user.id, interview_id: interviewId, title, content, status: 'completed', created_at: now, updated_at: now }).select().single()
      if (projectError) throw new Error(`Could not save project: ${projectError.message}`)

      buildReserved = false
      return NextResponse.json({ success: true, project, capabilities: recommendedModules.map((id) => HLAI_CAPABILITIES.find((capability) => capability.id === id)).filter(Boolean) })
    } catch (error) {
      if (buildReserved) {
        await serviceSupabase.rpc('release_build', { p_user_id: user.id })
        buildReserved = false
      }

      const status = typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 0
      if (status === 429) return NextResponse.json({ error: 'AI generation is temporarily unavailable because the AI service has reached its usage limit. Please try again later.' }, { status: 429 })
      if (status === 502) return NextResponse.json({ error: error instanceof Error ? error.message : 'AI generation is temporarily unavailable. Please try again later.' }, { status: 502 })
      console.error('Project generation failed:', error instanceof Error ? error.message : 'Unknown server error')
      return NextResponse.json({ error: 'Project generation failed. Please try again. Your interview draft remains saved on this device.' }, { status: 500 })
    }
  } catch (error) {
    console.error('Project generation failed:', error instanceof Error ? error.message : 'Unknown server error')
    return NextResponse.json({ error: 'Project generation failed. Please try again. Your interview draft remains saved on this device.' }, { status: 500 })
  }
}
