import { NextResponse } from 'next/server'
import { errorResponse, HkeError, notFound } from './errors'
import { loadOwnedProject } from './projects'
import { authenticate, isUuid, readJson } from './server'
import { getStep, parseStepInput, type StepKey } from './steps'

type Context = { params: { id: string } }

/**
 * GET/POST handlers for one launch-plan step. POST writes only its own
 * section, in one statement (hke_save_project_section), so concurrent saves of
 * different steps, asset generation, and archiving cannot overwrite it.
 */
export function stepRouteHandlers(key: StepKey) {
  const step = getStep(key)

  async function GET(request: Request, { params }: Context) {
    try {
      const { supabase, user } = await authenticate(request)
      if (!isUuid(params.id)) throw notFound()
      const project = await loadOwnedProject(supabase, user.id, params.id)
      if (!project) throw notFound()
      const saved = project.content[step.key]
      return NextResponse.json({ [step.responseKey]: saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : null })
    } catch (error) {
      return errorResponse(error, `${step.label} load`)
    }
  }

  async function POST(request: Request, { params }: Context) {
    try {
      const { supabase } = await authenticate(request)
      if (!isUuid(params.id)) throw notFound()

      const parsed = parseStepInput(step, await readJson(request))
      if (!parsed.ok) throw new HkeError('invalid_input', parsed.message)

      // Ownership comes from auth.uid() inside the function.
      const { data, error } = await supabase.rpc('hke_save_project_section', { p_project_id: params.id, p_section: step.key, p_value: parsed.value })
      if (error) {
        if (error.code === 'P0002') throw notFound()
        if (error.code === 'HKA01') throw new HkeError('archived', 'Restore this project before editing it.')
        if (error.code === '22023') throw new HkeError('invalid_input', `These ${step.label.toLowerCase()} answers could not be saved.`)
        throw new HkeError('database_error', `Unable to save ${step.label.toLowerCase()}.`)
      }
      return NextResponse.json({ success: true, savedAt: data })
    } catch (error) {
      return errorResponse(error, `${step.label} save`)
    }
  }

  return { GET, POST }
}
