import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { User, Mail, MessageSquare, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'

const ITEMS_PER_PAGE = 10

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: { page?: string }
}) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500">Erro: Usuário não autenticado</p>
        <a href="/login" className="text-blue-500 underline">Fazer login</a>
      </div>
    )
  }
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', user.id)
    .single()
  
  if (!profile) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500">Erro: Perfil não encontrado para o usuário {user.email}</p>
        <p className="text-zinc-500 text-sm mt-2">user.id: {user.id}</p>
      </div>
    )
  }
  const tenantId = profile.tenant_id

  // Paginação
  const page = parseInt(searchParams.page || '1')
  const from = (page - 1) * ITEMS_PER_PAGE
  const to = from + ITEMS_PER_PAGE - 1

  // Buscar total de atendentes
  const { count: totalAgents } = await supabase
    .from('agents')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  // Buscar atendentes com paginação
  const { data: agents } = await supabase
    .from('agents')
    .select('id, external_id, name, email, role, active')
    .eq('tenant_id', tenantId)
    .order('name')
    .range(from, to)

  const totalPages = Math.ceil((totalAgents || 0) / ITEMS_PER_PAGE)

  // Contar conversas por atendente
  const agentsWithStats = await Promise.all(
    (agents || []).map(async (agent) => {
      const { count } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', agent.id)
      return { ...agent, conversationsCount: count || 0 }
    })
  )

  function getInitials(name: string | null) {
    if (!name) return '?'
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-serif font-semibold text-zinc-900">Atendentes</h1>
        <p className="text-zinc-500">{totalAgents} atendentes no sistema</p>
      </div>

      {/* Grid de atendentes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agentsWithStats.map((agent) => (
          <Card key={agent.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
                  <span className="text-primary-700 font-semibold">
                    {getInitials(agent.name)}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-zinc-900">{agent.name || 'Sem nome'}</p>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      agent.active !== false 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-zinc-100 text-zinc-500'
                    }`}>
                      {agent.active !== false ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  {agent.email && (
                    <div className="flex items-center gap-1 text-sm text-zinc-500 mt-1">
                      <Mail className="w-3 h-3" />
                      {agent.email}
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-sm text-zinc-500 mt-1">
                    <MessageSquare className="w-3 h-3" />
                    {agent.conversationsCount} conversas
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-500">
            Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={`?page=${page - 1}`}>
                <Button variant="outline" size="sm">
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Anterior
                </Button>
              </Link>
            )}
            {page < totalPages && (
              <Link href={`?page=${page + 1}`}>
                <Button variant="outline" size="sm">
                  Próxima
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
