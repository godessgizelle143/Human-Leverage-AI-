import { NextResponse } from 'next/server'
import { errorResponse, notFound } from '@/lib/hke/errors'
import { printableHtmlDocument, safeFilename } from '@/lib/hke/markdown'
import { loadInterviewAnswers, loadOwnedProject, projectToMarkdown } from '@/lib/hke/projects'
import { authenticate, isUuid } from '@/lib/hke/server'

// Downloads the project's blueprint, plan steps, and interview answers.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { supabase, user } = await authenticate(request)
    if (!isUuid(params.id)) throw notFound()

    const project = await loadOwnedProject(supabase, user.id, params.id)
    if (!project) throw notFound()

    const markdown = projectToMarkdown(project.title, project.content, await loadInterviewAnswers(supabase, user.id, project.interview_id))
    const title = `${project.title} — Blueprint`
    const format = new URL(request.url).searchParams.get('format') === 'html' ? 'html' : 'md'

    return new NextResponse(format === 'html' ? printableHtmlDocument(title, markdown) : `# ${title}\n\n${markdown}\n`, {
      headers: {
        'Content-Type': format === 'html' ? 'text/html; charset=utf-8' : 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safeFilename(`${project.title}-blueprint`)}.${format}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    return errorResponse(error, 'Blueprint export')
  }
}
