import type { SupabaseClient } from '@supabase/supabase-js'
import { HkeError } from '../errors'
import type { DenialDetails } from '../entitlements'

export type Claim<T> = ({ ok: true } & T) | { ok: false; reason: string; details: DenialDetails }
export type Settlement = 'completed' | 'failed' | null

/**
 * Entitlement-aware persistence for generation. Every method maps to one
 * database function that reserves/settles credits and claims/settles the row
 * in a single transaction (see 20261004120000_hke_foundation.sql).
 */
export interface GenerationStore {
  beginBlueprint(input: { userId: string; interviewId: string; projectId: string; title: string; skipEntitlement: boolean }): Promise<Claim<{ projectId: string }>>
  finishBlueprint(input: { userId: string; projectId: string; succeeded: boolean; content?: Record<string, unknown>; interviewMessages?: Record<string, unknown>; interviewProgress?: number }): Promise<Settlement>
  beginAsset(input: { userId: string; projectId: string; assetType: string; title: string; skipEntitlement: boolean }): Promise<Claim<{ assetId: string; version: number }>>
  finishAsset(input: { userId: string; assetId: string; succeeded: boolean; title?: string; content?: string; metadata?: Record<string, unknown>; error?: string }): Promise<Settlement>
}

type BlueprintClaimRow = {
  claimed_project_id: string | null
  denial_reason: string | null
  plan_name: string | null
  interview_credit_limit: number | null
  build_credit_limit: number | null
}

type AssetClaimRow = {
  claimed_asset_id: string | null
  claimed_version: number | null
  denial_reason: string | null
  plan_name: string | null
  build_credit_limit: number | null
}

function databaseError(operation: string, message: string): HkeError {
  console.error(`${operation} failed:`, message)
  return new HkeError('database_error', 'We could not save your work right now. Please try again.')
}

/** Must be given a service-role client: these functions are not executable by clients. */
export function supabaseGenerationStore(service: SupabaseClient): GenerationStore {
  return {
    async beginBlueprint(input) {
      const { data, error } = await service
        .rpc('hke_begin_blueprint_generation', { p_user_id: input.userId, p_interview_id: input.interviewId, p_project_id: input.projectId, p_title: input.title, p_skip_entitlement: input.skipEntitlement })
        .single<BlueprintClaimRow>()
      if (error || !data) throw databaseError('Blueprint claim', error?.message ?? 'no row')
      if (data.denial_reason || !data.claimed_project_id) {
        return { ok: false, reason: data.denial_reason ?? 'internal', details: { plan: data.plan_name, interviewLimit: data.interview_credit_limit, buildLimit: data.build_credit_limit, projectId: data.claimed_project_id } }
      }
      return { ok: true, projectId: data.claimed_project_id }
    },

    async finishBlueprint(input) {
      const { data, error } = await service.rpc('hke_finish_blueprint_generation', {
        p_user_id: input.userId,
        p_project_id: input.projectId,
        p_succeeded: input.succeeded,
        p_content: input.content ?? null,
        p_interview_messages: input.interviewMessages ?? null,
        p_interview_progress: input.interviewProgress ?? null,
      })
      if (error) throw databaseError('Blueprint settlement', error.message)
      return (data as Settlement) ?? null
    },

    async beginAsset(input) {
      const { data, error } = await service
        .rpc('hke_begin_asset_generation', { p_user_id: input.userId, p_project_id: input.projectId, p_asset_type: input.assetType, p_title: input.title, p_skip_entitlement: input.skipEntitlement })
        .single<AssetClaimRow>()
      if (error || !data) throw databaseError('Asset claim', error?.message ?? 'no row')
      if (data.denial_reason || !data.claimed_asset_id) {
        return { ok: false, reason: data.denial_reason ?? 'internal', details: { plan: data.plan_name, buildLimit: data.build_credit_limit } }
      }
      return { ok: true, assetId: data.claimed_asset_id, version: data.claimed_version ?? 1 }
    },

    async finishAsset(input) {
      const { data, error } = await service.rpc('hke_finish_asset_generation', {
        p_user_id: input.userId,
        p_asset_id: input.assetId,
        p_succeeded: input.succeeded,
        p_title: input.title ?? null,
        p_content: input.content ?? null,
        p_metadata: input.metadata ?? null,
        p_error: input.error ?? null,
      })
      if (error) throw databaseError('Asset settlement', error.message)
      return (data as Settlement) ?? null
    },
  }
}
