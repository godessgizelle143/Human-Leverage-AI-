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
  const { serviceName, customerGets, pricing, booking, nextAction } = body

  if (!serviceName || !customerGets || !pricing || !booking || !nextAction) {
    return NextResponse.json(
      { error: 'All customer offer fields are required.' },
      { status: 400 }
    )
  }

  const content =
    project.content && typeof project.content === 'object'
      ? project.content
      : {}

  const updatedContent = {
    ...content,
    customer_offer: {
      service_name: serviceName,
      customer_gets: customerGets,
      pricing,
      booking,
      next_action: nextAction,
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
    console.error('Customer offer save failed:', updateError.message)
    return NextResponse.json(
      { error: 'Unable to save customer offer.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
