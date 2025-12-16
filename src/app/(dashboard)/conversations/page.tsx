import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MessageSquare, Phone, Clock, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { getPeriodDates, getPeriodLabel } from '@/lib/period-utils'
import { DateRangePicker } from '@/components/date-range-picker'

const ITEMS_PER_PAGE = 10

interface PageProps {
  searchParams: { page?: string; from?: string; to?: string }
}

export default async function ConversationsPage({ searchParams }: PageProps) {
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
    .select('tenant_id, role, agent_id')
    .eq('id', user.id)
    .single()
  
  if (!profile) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500">Erro: Perfil não encontrado para o usuário {user.email}</p>
      </div>
    )
  }
  
  const tenantId = profile.tenant_id
  const userRole = profile.role
  const agentId = profile.agent_id

  // Paginação
  const page = parseInt(searchParams.page || '1')
  const from = (page - 1) * ITEMS_PER_PAGE
  const to = from + ITEMS_PER_PAGE - 1

  // Calcular período
  const { startISO, endISO } = getPeriodDates(searchParams.from, searchParams.to)
  const periodLabel = getPeriodLabel(searchParams.from, searchParams.to)

  // Query
  let query = supabase
    .from('conversations')
    .select(`
      id, external_id, status, platform, last_message, last_message_at, created_at,
      contacts (id, name, phone),
      agents (id, name)
    `, { count: 'exact' })
    .eq('tenant_id', tenantId)
    .gte('created_at', startISO)
    .lte('created_at', endISO)
  
  // Filtrar por agent_id se for pré-vendedor
  if (userRole === 'pre_vendedor' && agentId) {
    query = query.eq('agent_id', agentId)
  }
  
  query = query
    .order('last_message_at', { ascending: false })
    .range(from, to)

  const { data: conversations, count } = await query
  const totalPages = Math.ceil((count || 0) / ITEMS_PER_PAGE)

  // Helper para formatar data
  function formatDate(dateStr: string | null) {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Helper para limpar mensagem
  function cleanMessage(msg: string | null) {
    if (!msg) return ''
    return msg.replace(/^\*[^*]+\*:\s*\n?/, '').slice(0, 60)
  }

  function buildUrl(newPage: number) {
    const params = new URLSearchParams()
    params.set('page', newPage.toString())
    if (searchParams.from) params.set('from', searchParams.from)
    if (searchParams.to) params.set('to', searchParams.to)
    return `?${params.toString()}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-serif font-semibold text-zinc-900">Conversas</h1>
        <p className="text-zinc-500">
          {count?.toLocaleString('pt-BR')} conversas em <span className="capitalize">{periodLabel}</span>
        </p>
      </div>

      {/* Date Range Picker */}
      <Card>
        <CardContent className="pt-4">
          <DateRangePicker basePath="/conversations" />
        </CardContent>
      </Card>

      {/* Lista de conversas */}
      <div className="space-y-3">
        {conversations?.map((conv: any) => (
          <Link key={conv.id} href={`/conversations/${conv.id}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="font-medium text-zinc-900">
                        {conv.contacts?.name || 'Cliente sem nome'}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-zinc-500">
                        <Phone className="w-3 h-3" />
                        {conv.contacts?.phone || 'Sem telefone'}
                      </div>
                      <p className="text-sm text-zinc-400 mt-1">
                        {cleanMessage(conv.last_message)}...
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      conv.status === 'open' ? 'bg-green-100 text-green-700' :
                      conv.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-zinc-100 text-zinc-700'
                    }`}>
                      {conv.status}
                    </span>
                    <div className="flex items-center gap-1 text-xs text-zinc-400 mt-2">
                      <Clock className="w-3 h-3" />
                      {formatDate(conv.last_message_at)}
                    </div>
                    {conv.agents?.name && (
                      <p className="text-xs text-zinc-500 mt-1">{conv.agents.name}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
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
              <Link href={buildUrl(page - 1)}>
                <Button variant="outline" size="sm">
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Anterior
                </Button>
              </Link>
            )}
            {page < totalPages && (
              <Link href={buildUrl(page + 1)}>
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
