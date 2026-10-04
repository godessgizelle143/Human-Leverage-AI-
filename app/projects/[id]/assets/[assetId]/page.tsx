import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { assetTypeLabel } from '@/lib/hke/assets'
import { loadOwnedProject } from '@/lib/hke/projects'
import { isUuid } from '@/lib/hke/server'
import AppHeader from '@/components/hke/AppHeader'
import AssetEditor from '@/components/hke/AssetEditor'

export const dynamic = 'force-dynamic'

export default async function AssetPage({ params }: { params: { id: string; assetId: string } }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!isUuid(params.id) || !isUuid(params.assetId)) redirect('/dashboard')

  const project = await loadOwnedProject(supabase, user.id, params.id)
  if (!project) redirect('/dashboard')
  const { data: asset } = await supabase
    .from('project_assets')
    .select('id, asset_type, title, content, version, status')
    .eq('id', params.assetId)
    .eq('project_id', project.id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!asset || asset.status !== 'completed') redirect(`/projects/${project.id}#assets`)

  return (
    <main className="min-h-screen bg-brand-black text-white">
      <AppHeader backHref={`/projects/${project.id}`} backLabel={project.title} />
      <AssetEditor projectId={project.id} asset={asset} typeLabel={assetTypeLabel(asset.asset_type)} />
    </main>
  )
}
