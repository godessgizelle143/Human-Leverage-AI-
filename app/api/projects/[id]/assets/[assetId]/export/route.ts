import { NextResponse } from 'next/server'
import { errorResponse, notFound } from '@/lib/hke/errors'
import { printableHtmlDocument, safeFilename } from '@/lib/hke/markdown'
import { loadOwnedProject } from '@/lib/hke/projects'
import { authenticate, isUuid } from '@/lib/hke/server'

export async function GET(request: Request, { params }: { params: { id: string; assetId: string } }) {
  try {
    const { supabase, user } = await authenticate(request)
    if (!isUuid(params.id) || !isUuid(params.assetId)) throw notFound('Asset')

    const project = await loadOwnedProject(supabase, user.id, params.id)
    if (!project) throw notFound('Asset')
    const { data: asset } = await supabase
      .from('project_assets')
      .select('title, content')
      .eq('id', params.assetId)
      .eq('project_id', project.id)
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .maybeSingle()
    if (!asset) throw notFound('Asset')

    const format = new URL(request.url).searchParams.get('format') === 'html' ? 'html' : 'md'
    const body = format === 'html' ? printableHtmlDocument(asset.title, asset.content) : `# ${asset.title}\n\n${asset.content}\n`
    return new NextResponse(body, {
      headers: {
        'Content-Type': format === 'html' ? 'text/html; charset=utf-8' : 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safeFilename(`${project.title}-${asset.title}`)}.${format}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    return errorResponse(error, 'Asset export')
  }
}
