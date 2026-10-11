import { STALE_GENERATION_MS } from '../assets'

type BuildState = { status: string; updated_at: string }

/**
 * A blueprint build that was cut off (route time limit, restart, crash) never
 * settles, so its project stays in `generating`. The database clears such a
 * project the next time a build is requested, once it is older than five
 * minutes (hke_begin_blueprint_generation). This mirrors that window so the
 * application lets the customer back to the interview to request that build.
 */
export function isStaleBlueprintBuild(project: BuildState, now = Date.now()) {
  if (project.status !== 'generating') return false
  const updated = new Date(project.updated_at).getTime()
  return Number.isFinite(updated) && now - updated > STALE_GENERATION_MS
}

/**
 * The project that locks its interview: a completed one, or a build that may
 * still be running. A stale build locks nothing. Deciding that the build may
 * start again is still left to the database, which checks with its own clock.
 */
export function lockingProject<T extends BuildState>(project: T | null | undefined, now = Date.now()): T | null {
  if (!project || isStaleBlueprintBuild(project, now)) return null
  return project
}
