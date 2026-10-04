import { NextResponse } from 'next/server'
import { z } from 'zod'
import { MAX_ASSET_LENGTH } from '@/lib/hke/assets'
import { errorResponse, HkeError, notFound } from '@/lib/hke/errors'
import { authenticate, isUuid, readJson } from '@/lib/hke/server'

type Params = { params: { id: string; assetId: string } }

const EditSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    content: z.string().max(MAX_ASSET_LENGTH).optional(),
  })
  .refine((value) => value.title !== undefined || value.content !== undefined)

/**
 * Reads the asset first so the response can say why an edit is refused. The
 * write itself is enforced by RLS + column grants: only the owner, only title
 * and content, and only while the asset is completed.
 */
async function loadAsset(request: Request, params: Params['params']) {
  const { supabase, user } = await authenticate(request)
  if (!isUuid(params.id) || !isUuid(params.assetId)) throw notFound('Asset')
  const { data: asset } = await supabase
    .from('project_assets')
    .select('id, status')
    .eq('id', params.assetId)
    .eq('project_id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!asset) throw notFound('Asset')
  if (asset.status === 'generating') throw new HkeError('generation_in_progress', 'This asset is still generating.')
  return { supabase, user, asset }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { supabase, user, asset } = await loadAsset(request, params)
    if (asset.status !== 'completed') throw new HkeError('conflict', 'Only completed assets can be edited.')

    const body = EditSchema.safeParse(await readJson(request))
    if (!body.success) throw new HkeError('invalid_input', `Provide a title (up to 200 characters) or content (up to ${MAX_ASSET_LENGTH.toLocaleString()} characters).`)

    const { data, error } = await supabase
      .from('project_assets')
      .update(body.data)
      .eq('id', asset.id)
      .eq('user_id', user.id)
      .select('updated_at')
      .maybeSingle()
    if (error) throw new HkeError('database_error', 'Unable to save this asset.')
    if (!data) throw notFound('Asset')
    return NextResponse.json({ success: true, savedAt: data.updated_at })
  } catch (error) {
    return errorResponse(error, 'Asset edit')
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { supabase, user, asset } = await loadAsset(request, params)
    const { data, error } = await supabase.from('project_assets').delete().eq('id', asset.id).eq('user_id', user.id).select('id')
    if (error) throw new HkeError('database_error', 'Unable to delete this asset.')
    if (!data?.length) throw notFound('Asset')
    return NextResponse.json({ success: true })
  } catch (error) {
    return errorResponse(error, 'Asset delete')
  }
}
