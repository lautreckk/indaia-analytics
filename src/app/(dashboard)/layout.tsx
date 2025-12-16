import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { RouteGuard } from '@/components/auth/route-guard'
import { Toaster } from 'sonner'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <Sidebar />
      <div className="lg:pl-64">
        <Header user={user} />
        <main className="p-6">
          <RouteGuard>
            {children}
          </RouteGuard>
        </main>
      </div>
      <Toaster 
        position="bottom-right"
        richColors
        closeButton
        duration={4000}
      />
    </div>
  )
}
