import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (error || !project) redirect('/dashboard')

  const content = project.content as Record<string, unknown>

  return (
    <main className="min-h-screen bg-brand-black text-white px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <div>
            <p className="text-brand-gold text-sm font-semibold mb-2">HUMAN LEVERAGE AI™</p>
            <h1 className="text-3xl font-bold">{project.title}</h1>
          </div>
          <Link href="/dashboard" className="text-white/60 hover:text-white">← Dashboard</Link>
        </div>

        <div className="glass rounded-2xl p-8">
          <div className="mb-8">
            <p className="text-brand-gold font-semibold">Your assets are ready</p>
            <h2 className="text-2xl font-semibold mt-2">Your business blueprint</h2>
          </div>
          <div className="space-y-7">
            {Object.entries(content).map(([key, value]) => (
              <section key={key}>
                <h3 className="text-lg font-semibold capitalize mb-2">{key.replaceAll('_', ' ')}</h3>
                <p className="text-white/80 leading-7 whitespace-pre-wrap">
                  {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
                </p>
              </section>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
