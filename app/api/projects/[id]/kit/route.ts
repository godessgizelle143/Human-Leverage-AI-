import { NextResponse } from 'next/server'
import { errorResponse, HkeError, notFound } from '@/lib/hke/errors'
import { buildKit, kitToHtml, kitToMarkdown, type KitAsset } from '@/lib/hke/kit'
import { safeFilename } from '@/lib/hke/markdown'
import { loadInterviewAnswers, loadOwnedProject } from '@/lib/hke/projects'
import { authenticate, isUuid } from '@/lib/hke/server'

export const dynamic = 'force-dynamic'

/**
 * Downloads the project's Knowledge Kit: blueprint, launch plan, the latest
 * completed version of each asset, and the interview answers. Everything is
 * read through the user's session, so RLS limits it to their own rows.
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { supabase, user } = await authenticate(request)
    if (!isUuid(params.id)) throw notFound()

    const project = await loadOwnedProject(supabase, user.id, params.id)
    if (!project) throw notFound()
    if (project.status !== 'completed') throw new HkeError('conflict', 'This project is still being built. Download the kit once its blueprint is ready.')

    const [{ data: assets, error }, answers] = await Promise.all([
      supabase
        .from('project_assets')
        .select('id, asset_type, title, content, version, updated_at')
        .eq('project_id', project.id)
        .eq('user_id', user.id)
        .eq('status', 'completed'),
      loadInterviewAnswers(supabase, user.id, project.interview_id),
    ])
    if (error) throw new HkeError('database_error', 'Unable to load your assets.')

    const kit = buildKit({ title: project.title, content: project.content, answers, assets: (assets ?? []) as KitAsset[] })
    const format = new URL(request.url).searchParams.get('format') === 'html' ? 'html' : 'md'

    return new NextResponse(format === 'html' ? kitToHtml(kit) : kitToMarkdown(kit), {
      headers: {
        'Content-Type': format === 'html' ? 'text/html; charset=utf-8' : 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safeFilename(`${project.title}-knowledge-kit`)}.${format}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    return errorResponse(error, 'Knowledge kit export')
  }
}
