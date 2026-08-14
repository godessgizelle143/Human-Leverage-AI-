import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { getOpenAIClient, GENERATION_SYSTEM_PROMPT } from '@/lib/openai/client'

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const body = await request.json()
    const answers = body?.answers as Record<string, string> | undefined

    if (!answers || Object.keys(answers).length === 0) {
      return NextResponse.json({ error: 'Interview answers are required.' }, { status: 400 })
    }

    const cleanAnswers = Object.fromEntries(
      Object.entries(answers).map(([key, value]) => [key, String(value).trim()])
    )

    const title = cleanAnswers['1'] || 'My New Business'
    const interviewId = crypto.randomUUID()
    const projectId = crypto.randomUUID()
    const now = new Date().toISOString()

    const openai = getOpenAIClient()
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `${GENERATION_SYSTEM_PROMPT}\nReturn valid JSON only with these keys: business_summary, ideal_customer, problem_solved, differentiation, products_services, brand_voice, origin_story, mission_values, customer_transformation, goals_6_12_months, marketing_strategy, launch_roadmap, elevator_pitch, next_steps. Each value should be useful, specific, and ready for a real business owner to edit and use.` },
        {
          role: 'user',
          content: `Build a practical starter asset package from this completed Human Leverage AI business interview. Preserve the founder's actual ideas and do not invent testimonials, traction, customers, revenue, partnerships, or accomplishments that were not provided.\n\nINTERVIEW ANSWERS:\n${JSON.stringify(cleanAnswers, null, 2)}`
        }
      ]
    })

    const raw = completion.choices[0]?.message?.content
    if (!raw) throw new Error('AI returned no content.')

    const content = JSON.parse(raw)
    const serviceSupabase = createServiceRoleClient()

    const { error: interviewError } = await serviceSupabase.from('interviews').upsert({
      id: interviewId,
      user_id: user.id,
      title,
      status: 'completed',
      progress: 100,
      messages: cleanAnswers,
      created_at: now,
      updated_at: now,
    })

    if (interviewError) throw new Error(`Could not save interview: ${interviewError.message}`)

    const { data: project, error: projectError } = await serviceSupabase.from('projects').insert({
      id: projectId,
      user_id: user.id,
      interview_id: interviewId,
      title,
      content,
      status: 'completed',
      created_at: now,
      updated_at: now,
    }).select().single()

    if (projectError) throw new Error(`Could not save project: ${projectError.message}`)

    return NextResponse.json({ success: true, project })
  } catch (error) {
    console.error('Project generation failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Project generation failed.' },
      { status: 500 }
    )
  }
}
