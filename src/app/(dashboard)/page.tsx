import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageSquare, Users, TrendingUp, Clock, Calendar } from 'lucide-react'
import Link from 'next/link'
import { getPeriodDates, getPeriodLabel } from '@/lib/period-utils'
import { DateRangePicker } from '@/components/date-range-picker'

interface PageProps {
  searchParams: { from?: string; to?: string }
}

async function getStats(tenantId: string, startISO: string, endISO: string, agentId?: string | null) {
  const supabase = await createClient()
  
  // Conversas do mês
  let conversationsQuery = supabase
    .from('conversations')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('created_at', startISO)
    .lte('created_at', endISO)
  
  if (agentId) {
    conversationsQuery = conversationsQuery.eq('agent_id', agentId)
  }
  
  const { count: conversationsCount } = await conversationsQuery

  // Mensagens do mês (filtrar por conversas do agent se necessário)
  let messagesQuery = supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('sent_at', startISO)
    .lte('sent_at', endISO)
  
  if (agentId) {
    // Buscar IDs das conversas do agent
    const { data: conversations } = await supabase
      .from('conversations')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('agent_id', agentId)
    
    const conversationIds = conversations?.map(c => c.id) || []
    if (conversationIds.length > 0) {
      messagesQuery = messagesQuery.in('conversation_id', conversationIds)
    } else {
      // Se não há conversas, não há mensagens
      messagesQuery = messagesQuery.eq('id', '00000000-0000-0000-0000-000000000000') // Força zero resultados
    }
  }
  
  const { count: messagesCount } = await messagesQuery

  // Atendentes ativos (total, não muda por mês)
  const { count: agentsCount } = await supabase
    .from('agents')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('active', true)

  // Novas conversas (últimas 24h)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  let newConversationsQuery = supabase
    .from('conversations')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('created_at', yesterday)
  
  if (agentId) {
    newConversationsQuery = newConversationsQuery.eq('agent_id', agentId)
  }
  
  const { count: newConversations } = await newConversationsQuery

  // Status das conversas (do mês)
  let statusQuery = supabase
    .from('conversations')
    .select('status')
    .eq('tenant_id', tenantId)
    .gte('created_at', startISO)
    .lte('created_at', endISO)
  
  if (agentId) {
    statusQuery = statusQuery.eq('agent_id', agentId)
  }
  
  const { data: statusData } = await statusQuery

  const statusCount = statusData?.reduce((acc: any, curr) => {
    acc[curr.status] = (acc[curr.status] || 0) + 1
    return acc
  }, {}) || {}
  
  return {
    conversations: conversationsCount || 0,
    agents: agentsCount || 0,
    messages: messagesCount || 0,
    statusCount,
    recentConversations: newConversations || 0
  }
}

async function getRecentConversations(tenantId: string, agentId?: string | null) {
  const supabase = await createClient()
  
  let query = supabase
    .from('conversations')
    .select(`
      id, status, last_message, last_message_at,
      contacts (name, phone)
    `)
    .eq('tenant_id', tenantId)
  
  if (agentId) {
    query = query.eq('agent_id', agentId)
  }
  
  const { data } = await query
    .order('last_message_at', { ascending: false })
    .limit(5)
  
  return data || []
}

async function getTopAgents(tenantId: string, startISO: string, endISO: string, agentId?: string | null) {
  const supabase = await createClient()
  
  // Se for pré-vendedor, mostrar apenas ele mesmo
  if (agentId) {
    const { data: agent } = await supabase
      .from('agents')
      .select('id, name, email')
      .eq('id', agentId)
      .single()
    
    if (!agent) return []
    
    const { count } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agent.id)
      .gte('created_at', startISO)
      .lte('created_at', endISO)
    
    return [{ ...agent, conversationsCount: count || 0 }]
  }
  
  // Buscar atendentes (admin/consultor vê todos)
  const { data: agents } = await supabase
    .from('agents')
    .select('id, name, email')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .limit(10)

  if (!agents) return []

  // Contar conversas por atendente no mês
  const agentsWithCount = await Promise.all(
    agents.map(async (agent) => {
      const { count } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', agent.id)
        .gte('created_at', startISO)
        .lte('created_at', endISO)
      return { ...agent, conversationsCount: count || 0 }
    })
  )
  
  return agentsWithCount
    .sort((a, b) => b.conversationsCount - a.conversationsCount)
    .slice(0, 5)
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  
  // Obter usuário e tenant
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
        <p className="text-zinc-500 text-sm mt-2">user.id: {user.id}</p>
      </div>
    )
  }
  
  const tenantId = profile.tenant_id
  const userRole = profile.role
  const agentId = profile.agent_id
  const isPreVendedor = userRole === 'pre_vendedor'

  // Calcular período baseado nos params
  const { startISO, endISO } = getPeriodDates(searchParams.from, searchParams.to)
  const periodLabel = getPeriodLabel(searchParams.from, searchParams.to)

  // Buscar dados (filtrar por agent_id se for pré-vendedor)
  const stats = await getStats(tenantId, startISO, endISO, isPreVendedor ? agentId : null)
  const recentConversations = await getRecentConversations(tenantId, isPreVendedor ? agentId : null)
  const topAgents = await getTopAgents(tenantId, startISO, endISO, isPreVendedor ? agentId : null)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-serif font-semibold text-zinc-900">Dashboard</h1>
        <p className="text-zinc-500 flex items-center gap-2 mt-1">
          <Calendar className="w-4 h-4" />
          Dados de <span className="font-medium capitalize">{periodLabel}</span>
        </p>
      </div>

      {/* Date Range Picker */}
      <Card>
        <CardContent className="pt-4">
          <DateRangePicker basePath="/" />
        </CardContent>
      </Card>

      {/* Cards de métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600">Conversas</CardTitle>
            <MessageSquare className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.conversations.toLocaleString('pt-BR')}</div>
            <p className="text-xs text-zinc-500">No período</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600">Atendentes</CardTitle>
            <Users className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.agents}</div>
            <p className="text-xs text-zinc-500">Ativos no sistema</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600">Mensagens</CardTitle>
            <TrendingUp className="w-4 h-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.messages.toLocaleString('pt-BR')}</div>
            <p className="text-xs text-zinc-500">No período</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600">Novas (24h)</CardTitle>
            <Clock className="w-4 h-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.recentConversations}</div>
            <p className="text-xs text-zinc-500">Últimas 24 horas</p>
          </CardContent>
        </Card>
      </div>

      {/* Status das conversas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-serif">Status das Conversas</CardTitle>
        </CardHeader>
          <CardContent>
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <span className="text-sm text-zinc-600">Pending ({stats.statusCount.pending || 0})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-zinc-400"></div>
                <span className="text-sm text-zinc-600">Closed ({stats.statusCount.closed || 0})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-sm text-zinc-600">Open ({stats.statusCount.open || 0})</span>
              </div>
            </div>
          </CardContent>
      </Card>

      {/* Grid: Conversas recentes + Top atendentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversas recentes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-serif">Conversas Recentes</CardTitle>
            <Link href="/conversations" className="text-sm text-primary-600 hover:underline">
              Ver todas
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentConversations?.map((conv: any) => (
                <Link 
                  key={conv.id} 
                  href={`/conversations/${conv.id}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-zinc-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-zinc-900 truncate">
                      {conv.contacts?.name || 'Cliente sem nome'}
                    </p>
                    <p className="text-sm text-zinc-500 truncate">
                      {conv.last_message?.replace(/^\*[^*]+\*:\s*\n?/, '').slice(0, 50)}...
                    </p>
                  </div>
                  <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                    conv.status === 'open' ? 'bg-green-100 text-green-700' :
                    conv.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-zinc-100 text-zinc-700'
                  }`}>
                    {conv.status}
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top atendentes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-serif">Top Atendentes</CardTitle>
            <Link href="/agents" className="text-sm text-primary-600 hover:underline">
              Ver todos
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topAgents.map((agent, index) => (
                <div key={agent.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-zinc-50">
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0 ? 'bg-yellow-100 text-yellow-700' :
                      index === 1 ? 'bg-zinc-200 text-zinc-700' :
                      index === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-zinc-100 text-zinc-600'
                    }`}>
                      {index + 1}
                    </span>
                    <span className="font-medium text-zinc-900">{agent.name}</span>
                  </div>
                  <span className="text-sm text-zinc-500">
                    {agent.conversationsCount} conversas
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
