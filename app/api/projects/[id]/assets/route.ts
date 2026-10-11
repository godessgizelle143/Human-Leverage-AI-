import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { isOwnerUser } from '@/lib/owner-access'
import { ASSET_TYPE_IDS, getAssetType } from '@/lib/hke/assets'
import { ASSET_COLUMNS } from '@/lib/hke/db'
import { errorResponse, HkeError, notFound } from '@/lib/hke/errors'
import { generateAsset } from '@/lib/hke/generation/services'
import { supabaseGenerationStore } from '@/lib/hke/generation/store'
import { openAIProvider } from '@/lib/hke/intelligence/provider'
import { assembleKnowledge, hasBlueprint } from '@/lib/hke/knowledge'
import { listProjectAssets, loadInterviewAnswers, loadOwnedProject } from '@/lib/hke/projects'
import { authenticate, isUuid, readJson } from '@/lib/hke/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BodySchema = z.object({ type: z.enum(ASSET_TYPE_IDS) })

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { supabase, user } = await authenticate(request)
    if (!isUuid(params.id)) throw notFound()
    return NextResponse.json({ assets: await listProjectAssets(supabase, user.id, params.id) })
  } catch (error) {
    return errorResponse(error, 'Asset list')
  }
}

/** Generates one asset from the project's knowledge, spending one build credit. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { supabase, user } = await authenticate(request)
    if (!isUuid(params.id)) throw notFound()

    const body = BodySchema.safeParse(await readJson(request))
    if (!body.success) throw new HkeError('invalid_input', 'Choose an asset type to generate.')
    const type = getAssetType(body.data.type)!

    const project = await loadOwnedProject(supabase, user.id, params.id)
    if (!project) throw notFound()
    if (project.status !== 'completed') throw new HkeError('conflict', 'This project is still being built. Try again in a moment.')
    if (project.archived_at) throw new HkeError('archived', 'Restore this project before generating new assets.')

    const knowledge = assembleKnowledge(project, await loadInterviewAnswers(supabase, user.id, project.interview_id))
    if (!hasBlueprint(knowledge)) throw new HkeError('invalid_input', 'This project has no saved blueprint to build from yet.')

    if (!openAIProvider.isConfigured()) throw new HkeError('not_configured', 'AI generation is not configured in this deployment.')

    const { assetId } = await generateAsset(
      { store: supabaseGenerationStore(createServiceRoleClient()), provider: openAIProvider },
      { userId: user.id, projectId: project.id, type, knowledge, skipEntitlement: isOwnerUser(user) },
    )

    const { data: asset } = await supabase.from('project_assets').select(ASSET_COLUMNS).eq('id', assetId).eq('user_id', user.id).maybeSingle()
    return NextResponse.json({ asset })
  } catch (error) {
    return errorResponse(error, 'Asset generation')
  }
}
