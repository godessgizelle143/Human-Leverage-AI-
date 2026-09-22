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
    customerFoundation:
      content.customer_foundation && typeof content.customer_foundation === 'object'
        ? content.customer_foundation
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
  const { foundationType, customerExperience, customerInfo, firstAction } = body

  if (!foundationType || !customerExperience || !customerInfo || !firstAction) {
    return NextResponse.json(
      { error: 'All customer foundation fields are required.' },
      { status: 400 }
    )
  }

  const content =
    project.content && typeof project.content === 'object'
      ? project.content
      : {}

  const updatedContent = {
    ...content,
    customer_foundation: {
      foundation_type: foundationType,
      customer_experience: customerExperience,
      customer_information: customerInfo,
      after_submission: firstAction,
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
    console.error('Customer foundation save failed:', updateError.message)
    return NextResponse.json(
      { error: 'Unable to save customer foundation.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
