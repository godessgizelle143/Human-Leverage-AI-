import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('content')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (projectError || !project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const content =
    project.content && typeof project.content === 'object'
      ? project.content
      : {}

  return NextResponse.json({
    launchContent:
      content.launch_content && typeof content.launch_content === 'object'
        ? content.launch_content
        : null,
  })
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('content')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (projectError || !project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const body = await request.json()
  const { launchGoal, audience, channels, callToAction } = body

  if (!launchGoal || !audience || !channels || !callToAction) {
    return NextResponse.json(
      { error: 'All launch content fields are required.' },
      { status: 400 }
    )
  }

  const content =
    project.content && typeof project.content === 'object'
      ? project.content
      : {}

  const updatedContent = {
    ...content,
    launch_content: {
      launch_goal: launchGoal,
      audience,
      channels,
      call_to_action: callToAction,
      plan: {
        days_1_30: 'Build awareness, explain the problem you solve, and introduce your offer consistently.',
        days_31_60: 'Publish proof, answer customer questions, and strengthen the content that earns engagement.',
        days_61_90: 'Double down on the strongest channels, refine the message, and turn attention into repeatable customer action.',
      },
    },
  }

  const { error: updateError } = await supabase
    .from('projects')
    .update({
      content: updatedContent,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (updateError) {
    console.error('Launch content save failed:', updateError.message)
    return NextResponse.json(
      { error: 'Unable to save launch content.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
