'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Pagination } from '@/components/pagination'
import Link from 'next/link'
import { BarChart3 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { getAtendentesFromAnalysis } from '@/lib/utils'
import { CardSkeleton } from '@/components/skeletons/CardSkeleton'
import { AnalysisFilters } from '@/components/analysis-filters'
import { usePermissions, canSeeAllData } from '@/hooks/use-permissions'

type FiltersType = {
  search: string
  atendente: string
  tipoEvento: string
  faixaScore: string
  agendamento: string
  dataInicio: string | null
  dataFim: string | null
}

const ITEMS_PER_PAGE = 20

const defaultFilters: FiltersType = {
  search: '',
  atendente: 'todos',
  tipoEvento: 'todos',
  faixaScore: 'todos',
  agendamento: 'todos',
  dataInicio: null,
  dataFim: null,
}

export default function AnalisesPage() {
  const [analyses, setAnalyses] = useState<any[]>([])
  const [atendentes, setAtendentes] = useState<string[]>([])
  const [filters, setFilters] = useState<FiltersType>(defaultFilters)
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [agentId, setAgentId] = useState<string | null>(null)

  const supabase = createClient()
  const router = useRouter()
  const { role, agentId: userAgentId } = usePermissions()
  const canSeeAll = canSeeAllData(role)

  // Buscar tenant_id e agent_id do usuário
  useEffect(() => {
    async function fetchTenant() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id, agent_id')
        .eq('id', user.id)
        .single()

      if (profile) {
        setTenantId(profile.tenant_id)
        setAgentId(profile.agent_id)
      }
    }
    fetchTenant()
  }, [supabase, router])

  // Buscar lista de atendentes únicos
  useEffect(() => {
    if (!tenantId) return

    async function fetchAtendentes() {
      const { data } = await supabase
        .from('conversation_analyses')
        .select('raw_analysis')
        .eq('tenant_id', tenantId)
      
      if (data) {
        const names = new Set<string>()
        data.forEach(item => {
          // Usar helper para extrair atendentes (suporta nova e antiga estrutura)
          const { todos, principal } = getAtendentesFromAnalysis({ raw_analysis: item.raw_analysis })
          
          // Adicionar atendente principal
          if (principal && principal !== 'Não identificado') {
            names.add(principal)
          }
          
          // Adicionar todos os atendentes do array
          todos.forEach(t => {
            if (t.nome && t.nome !== 'Não identificado') {
              names.add(t.nome)
            }
          })
        })
        setAtendentes(Array.from(names).sort())
      }
    }
    fetchAtendentes()
  }, [supabase, tenantId])

  // Buscar análises com filtros
  useEffect(() => {
    if (!tenantId) return

    async function fetchAnalyses() {
      setLoading(true)
      
      // Se for pré-vendedor, buscar IDs das conversas do agent primeiro
      let conversationIds: string[] | null = null
      if (!canSeeAll && agentId) {
        const { data: agentConversations } = await supabase
          .from('conversations')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('agent_id', agentId)
        
        conversationIds = agentConversations?.map(c => c.id) || []
        if (conversationIds.length === 0) {
          // Se não há conversas, não há análises
          setAnalyses([])
          setTotalCount(0)
          setLoading(false)
          return
        }
      }
      
      let query = supabase
        .from('conversation_analyses')
        .select(`
          *,
          conversations!inner (
            id,
            status,
            agent_id,
            contacts (
              name,
              phone,
              identifier
            )
          )
        `, { count: 'exact' })
        .eq('tenant_id', tenantId)
      
      // Filtrar por conversation_id se for pré-vendedor
      if (conversationIds && conversationIds.length > 0) {
        query = query.in('conversation_id', conversationIds)
      }
      
      query = query.order('analyzed_at', { ascending: false })

      // Aplicar filtros
      if (filters.tipoEvento !== 'todos') {
        query = query.eq('tipo_evento', filters.tipoEvento)
      }

      if (filters.agendamento !== 'todos') {
        query = query.eq('agendamento_realizado', filters.agendamento === 'agendado')
      }

      if (filters.faixaScore !== 'todos') {
        switch (filters.faixaScore) {
          case 'excelente':
            query = query.gte('overall_score', 80)
            break
          case 'bom':
            query = query.gte('overall_score', 60).lt('overall_score', 80)
            break
          case 'regular':
            query = query.gte('overall_score', 40).lt('overall_score', 60)
            break
          case 'ruim':
            query = query.lt('overall_score', 40)
            break
        }
      }

      // Filtro por data
      if (filters.dataInicio) {
        query = query.gte('analyzed_at', filters.dataInicio + 'T00:00:00')
      }
      if (filters.dataFim) {
        query = query.lte('analyzed_at', filters.dataFim + 'T23:59:59')
      }

      // Paginação
      const from = (currentPage - 1) * ITEMS_PER_PAGE
      const to = from + ITEMS_PER_PAGE - 1
      query = query.range(from, to)

      const { data, count, error } = await query

      if (error) {
        console.error('Erro ao buscar análises:', error)
        setAnalyses([])
        setTotalCount(0)
      } else {
        // Filtrar por atendente (no client, pois é JSON)
        let filtered = data || []
        
        if (filters.atendente !== 'todos') {
          filtered = filtered.filter(a => {
            const { todos, principal } = getAtendentesFromAnalysis(a)
            // Verificar se o atendente filtrado está na lista (principal ou outros)
            return principal === filters.atendente || 
                   todos.some(t => t.nome === filters.atendente)
          })
        }

        // Filtrar por busca
        if (filters.search) {
          const searchLower = filters.search.toLowerCase()
          filtered = filtered.filter(a => {
            const contact = a.conversations?.contacts
            const clientName = contact?.name?.toLowerCase() || ''
            const phone = contact?.phone?.toLowerCase() || contact?.identifier?.toLowerCase() || ''
            const summary = a.summary?.toLowerCase() || ''
            return clientName.includes(searchLower) || 
                   phone.includes(searchLower) || 
                   summary.includes(searchLower)
          })
        }

        setAnalyses(filtered)
        setTotalCount(count || 0)
      }
      
      setLoading(false)
    }

    fetchAnalyses()
  }, [filters, currentPage, tenantId, supabase, canSeeAll, agentId])

  // Reset página quando filtros mudam
  useEffect(() => {
    setCurrentPage(1)
  }, [filters])

  // Calcular estatísticas (baseado em todas as análises, não apenas as filtradas)
  const stats = useMemo(() => {
    // Para estatísticas precisas, precisaríamos buscar todos os dados
    // Por enquanto, calculamos apenas com os dados visíveis
    const total = totalCount
    const scores = analyses.map(a => a.overall_score || 0)
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
    const agendamentos = analyses.filter(a => a.agendamento_realizado).length
    const comErros = analyses.filter(a => {
      const erros = a.errors_detected
      if (!erros) return false
      try {
        const parsed = typeof erros === 'string' ? JSON.parse(erros) : erros
        return Array.isArray(parsed) && parsed.length > 0
      } catch {
        return false
      }
    }).length

    return { total, avgScore, agendamentos, comErros }
  }, [analyses, totalCount])

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)

  if (!tenantId) {
    return (
      <div className="p-8 text-center">
        <p className="text-zinc-500">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-serif font-semibold text-zinc-900 flex items-center gap-2">
          <BarChart3 className="w-6 h-6" />
          Análises de Conversas
        </h1>
        <p className="text-zinc-500 mt-1">{totalCount} análises realizadas</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total Análises" value={stats.total} />
        <MetricCard title="Score Médio" value={`${stats.avgScore}%`} />
        <MetricCard title="Agendamentos" value={stats.agendamentos} />
        <MetricCard title="Com Erros" value={stats.comErros} />
      </div>

      {/* Filtros */}
      <AnalysisFilters
        atendentes={atendentes}
        filters={filters}
        onFilterChange={setFilters}
        onClearFilters={() => setFilters(defaultFilters)}
      />

      {/* Lista */}
      {loading ? (
        <CardSkeleton />
      ) : analyses.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-zinc-400">
            Nenhuma análise encontrada com os filtros selecionados.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {analyses.map(analysis => (
            <AnalysisCard key={analysis.id} analysis={analysis} />
          ))}
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalCount}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  )
}

function MetricCard({ title, value }: { title: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-sm text-zinc-500 mt-1">{title}</p>
      </CardContent>
    </Card>
  )
}

function AnalysisCard({ analysis }: { analysis: any }) {
  const score = analysis.overall_score || 0
  const scoreColor = score >= 70 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500'
  
  let errors: any[] = []
  try {
    const errorsData = analysis.errors_detected
    if (errorsData) {
      errors = typeof errorsData === 'string' ? JSON.parse(errorsData) : errorsData
      if (!Array.isArray(errors)) errors = []
    }
  } catch {
    errors = []
  }
  
  const contact = analysis.conversations?.contacts
  const { principal, todos } = getAtendentesFromAnalysis(analysis)
  
  const analyzedDate = analysis.analyzed_at 
    ? new Date(analysis.analyzed_at).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Data não disponível'

  return (
    <Link href={`/analises/${analysis.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              {/* Score Badge */}
              <div className={`${scoreColor} text-white px-3 py-1 rounded-full font-bold text-sm flex-shrink-0`}>
                {score}/100
              </div>
              
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-zinc-900">
                  {contact?.name || contact?.phone || 'Cliente'}
                </div>
                <div className="text-sm text-zinc-500 flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    {analysis.tipo_evento || 'N/A'}
                  </Badge>
                  <span>{analysis.total_messages || 0} msgs</span>
                  {errors.length > 0 && (
                    <span className="text-red-500">{errors.length} erros</span>
                  )}
                </div>
                <div className="text-sm text-zinc-500 mt-1">
                  Atendente: <span className="font-medium">{principal}</span>
                  {todos.length > 1 && (
                    <span className="ml-1 text-xs text-zinc-400">
                      (+{todos.length - 1} {todos.length === 2 ? 'outro' : 'outros'})
                    </span>
                  )}
                </div>
                {/* Mostrar badges de múltiplos atendentes */}
                {todos.length > 1 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {todos.slice(0, 3).map((a, i) => (
                      <span 
                        key={i}
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          a.nome === principal 
                            ? 'bg-emerald-100 text-emerald-700 font-medium' 
                            : 'bg-zinc-100 text-zinc-600'
                        }`}
                      >
                        {a.nome} ({a.mensagens} msgs)
                      </span>
                    ))}
                    {todos.length > 3 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500">
                        +{todos.length - 3} mais
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {/* Status */}
            <div className="text-right flex-shrink-0">
              {analysis.agendamento_realizado ? (
                <Badge className="bg-green-500 hover:bg-green-600">Agendou ✅</Badge>
              ) : (
                <Badge variant="secondary">Não agendou</Badge>
              )}
              <div className="text-xs text-zinc-400 mt-1">
                {analyzedDate}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
