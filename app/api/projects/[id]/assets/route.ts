import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { getOpenAIClient } from '@/lib/openai/client'
import { isHumanLeverageOwner } from '@/lib/owner-access'
import {
  buildHKEAssetContext,
  buildHKEAssetMessages,
  getHKEAssetLabel,
  getHKEAssetMaxTokens,
  isHKEAssetType,
} from '@/lib/hke/assets'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const ASSET_COLUMNS = 'id, project_id, asset_type, title, content, status, version, created_at, updated_at'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'AI generation is not configured in this deployment.' }, { status: 503 })

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Your session expired. Please sign in again.' }, { status: 401 })

  let body: { asset_type?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  const assetType = body?.asset_type
  if (!isHKEAssetType(assetType)) return NextResponse.json({ error: 'Unsupported asset type.' }, { status: 400 })

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, title, content, interview_id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()
  if (projectError || !project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const { data: interview } = await supabase
    .from('interviews')
    .select('messages')
    .eq('id', project.interview_id)
    .eq('user_id', user.id)
    .maybeSingle()

  const { context, hasBlueprint } = buildHKEAssetContext(assetType, project, interview?.messages)
  if (!hasBlueprint) return NextResponse.json({ error: 'This project has no saved blueprint to build from yet.' }, { status: 400 })

  const serviceSupabase = createServiceRoleClient()
  const isOwner = isHumanLeverageOwner(user.email)

  if (!isOwner) {
    // try_consume_build does not check current_period_end, so an expired
    // trial is rejected here before a build is reserved.
    const { data: subscription, error: subscriptionError } = await serviceSupabase
      .from('subscriptions')
      .select('current_period_end')
      .eq('user_id', user.id)
      .maybeSingle()
    if (subscriptionError) {
      console.error('Asset subscription lookup failed:', subscriptionError.message)
      return NextResponse.json({ error: 'Unable to verify your subscription. Please try again.' }, { status: 500 })
    }
    if (subscription?.current_period_end && new Date(subscription.current_period_end) <= new Date()) {
      return NextResponse.json({ error: 'Your plan period has ended. Choose a plan to keep building.' }, { status: 403 })
    }

    const { data: gate, error: gateError } = await serviceSupabase.rpc('try_consume_build', { p_user_id: user.id }).single()
    if (gateError) {
      console.error('Asset entitlement check failed:', gateError.message)
      return NextResponse.json({ error: 'Unable to verify your subscription. Please try again.' }, { status: 500 })
    }
    if (!gate.allowed) {
      const message = gate.plan
        ? `You've reached your ${gate.plan} plan's build limit for this period.`
        : 'An active subscription is required to build assets.'
      return NextResponse.json({ error: message }, { status: 403 })
    }
  }

  let buildReserved = !isOwner

  try {
    let completion
    try {
      completion = await getOpenAIClient().chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: getHKEAssetMaxTokens(assetType),
        response_format: { type: 'json_object' },
        messages: buildHKEAssetMessages(assetType, context),
      })
    } catch (error) {
      const status = typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 0
      if (status === 429) throw Object.assign(new Error('AI generation is temporarily unavailable because the AI service has reached its usage limit. Please try again later.'), { status: 429 })
      console.error('OpenAI asset request failed:', error instanceof Error ? error.message : 'Unknown provider error')
      throw Object.assign(new Error('AI generation is temporarily unavailable. Please try again later.'), { status: 502 })
    }

    const label = getHKEAssetLabel(assetType)
    if (completion.choices[0]?.finish_reason === 'length') {
      console.error('OpenAI asset response hit the output length limit.')
      throw Object.assign(new Error(`The generated ${label.toLowerCase()} was too long to finish. No build was used. Please try again.`), { status: 502 })
    }
    const raw = completion.choices[0]?.message?.content
    if (!raw) throw new Error('AI returned no content.')
    const generated = JSON.parse(raw) as { title?: unknown; content?: unknown }
    const assetContent = typeof generated.content === 'string' ? generated.content.trim() : ''
    if (!assetContent) throw new Error('AI returned an empty asset.')
    const generatedTitle = typeof generated.title === 'string' ? generated.title.trim().slice(0, 200) : ''
    const title = generatedTitle || `${project.title} ${label}`.slice(0, 200)

    const { data: latest } = await serviceSupabase
      .from('project_assets')
      .select('version')
      .eq('project_id', project.id)
      .eq('asset_type', assetType)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()

    const now = new Date().toISOString()
    const { data: asset, error: insertError } = await serviceSupabase
      .from('project_assets')
      .insert({
        project_id: project.id,
        user_id: user.id,
        asset_type: assetType,
        title,
        content: assetContent,
        status: 'completed',
        version: (latest?.version ?? 0) + 1,
        created_at: now,
        updated_at: now,
      })
      .select(ASSET_COLUMNS)
      .single()
    if (insertError) {
      if (insertError.code === '23505') throw Object.assign(new Error(`Another ${label.toLowerCase()} was saved at the same time. Refresh the page to see it.`), { status: 409 })
      throw new Error(`Could not save asset: ${insertError.message}`)
    }

    buildReserved = false
    return NextResponse.json({ asset })
  } catch (error) {
    if (buildReserved) {
      await serviceSupabase.rpc('release_build', { p_user_id: user.id })
      buildReserved = false
    }

    const status = typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 0
    if (status === 409 || status === 429 || status === 502) return NextResponse.json({ error: (error as Error).message }, { status })
    console.error('Asset generation failed:', error instanceof Error ? error.message : 'Unknown server error')
    return NextResponse.json({ error: 'Asset generation failed. Please try again.' }, { status: 500 })
  }
}
