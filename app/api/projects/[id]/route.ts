import { NextResponse } from 'next/server'
import { z } from 'zod'
import { errorResponse, HkeError, notFound } from '@/lib/hke/errors'
import { authenticate, isUuid, readJson } from '@/lib/hke/server'

const BodySchema = z
  .object({
    archived: z.boolean().optional(),
    title: z.string().trim().min(1).max(120).optional(),
  })
  .refine((value) => value.archived !== undefined || value.title !== undefined)

/**
 * Archive/restore and rename. These are the only project columns a client may
 * write (column grants in 20261004120000), and one UPDATE touches only them,
 * so it can never clobber blueprint, step, or asset data.
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { supabase, user } = await authenticate(request)
    if (!isUuid(params.id)) throw notFound()

    const body = BodySchema.safeParse(await readJson(request))
    if (!body.success) throw new HkeError('invalid_input', 'Nothing to update.')

    const changes: { archived_at?: string | null; title?: string } = {}
    if (body.data.archived !== undefined) changes.archived_at = body.data.archived ? new Date().toISOString() : null
    if (body.data.title !== undefined) changes.title = body.data.title

    const { data, error } = await supabase.from('projects').update(changes).eq('id', params.id).eq('user_id', user.id).select('id, archived_at, title').maybeSingle()
    if (error) throw new HkeError('database_error', 'Unable to update this project.')
    if (!data) throw notFound()
    return NextResponse.json({ success: true, project: data })
  } catch (error) {
    return errorResponse(error, 'Project update')
  }
}
