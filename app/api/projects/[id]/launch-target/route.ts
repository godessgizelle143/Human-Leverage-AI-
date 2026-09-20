import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

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
  const { audience, location, offer, milestone } = body

  if (!audience || !location || !offer || !milestone) {
    return NextResponse.json(
      { error: 'All launch target fields are required.' },
      { status: 400 }
    )
  }

  const content =
    project.content && typeof project.content === 'object'
      ? project.content
      : {}

  const updatedContent = {
    ...content,
    launch_target: {
      audience,
      location,
      offer,
      first_milestone: milestone,
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
    console.error('Launch target save failed:', updateError.message)
    return NextResponse.json(
      { error: 'Unable to save launch target.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
