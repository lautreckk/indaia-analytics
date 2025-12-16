'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, Clock, Download, RefreshCw, Zap, Coins, Bot, Calendar, Users, DollarSign } from 'lucide-react'
import { ResumoEstrategico } from '@/components/analysis/ResumoEstrategico'
import { SugestaoFechamento } from '@/components/analysis/SugestaoFechamento'
import { ModulosGrid } from '@/components/analysis/ModulosGrid'
import { ChecklistModulos } from '@/components/analysis/ChecklistModulos'
import { MetricasFechamento } from '@/components/analysis/MetricasFechamento'
import { ComparacaoHistorica } from '@/components/analysis/ComparacaoHistorica'
import { RecommendationsList } from '@/components/analysis/RecommendationsList'
import { MeetingInfoEditor } from '@/components/analysis/MeetingInfoEditor'
import { PDFGenerator } from '@/components/analysis/PDFGenerator'
import { CoordinatorResult } from '@/types/analysis'

export default function MeetingAnalysisPage() {
  const router = useRouter()
  const supabase = createClient()
  const pdfContentRef = useRef<HTMLDivElement>(null)
  
  // Usar useParams ao invés de receber params como prop
  const params = useParams()
  const id = params.id as string
  
  const [meeting, setMeeting] = useState<any>(null)
  const [analysis, setAnalysis] = useState<any>(null)
  const [agentAnalyses, setAgentAnalyses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Carregar dados
  useEffect(() => {
    if (!id) return

    async function loadData() {
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setError('Usuário não autenticado')
          setLoading(false)
          return
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('tenant_id, role')
          .eq('id', user.id)
          .single()

        if (!profile) {
          setError('Perfil não encontrado')
          setLoading(false)
          return
        }

        // Verificar se é admin (admins podem ver todas as reuniões)
        const isAdmin = profile.role === 'admin'
        
        console.log('🔍 Debug - Perfil do usuário:', {
          role: profile.role,
          tenant_id: profile.tenant_id,
          isAdmin: isAdmin,
          meeting_id: id
        })

        // Buscar reunião com coordinator_result
        // Se for admin, não filtrar por tenant_id
        let query = supabase
          .from('meetings')
          .select(`
            *,
            coordinator_result,
            coordinator_metadata,
            consultant:profiles!meetings_consultant_id_fkey(name),
            team:ai_teams(name)
          `)
          .eq('id', id)
        
        // Apenas aplicar filtro de tenant_id se NÃO for admin
        if (!isAdmin) {
          console.log('   🔒 Aplicando filtro de tenant_id (não é admin)')
          query = query.eq('tenant_id', profile.tenant_id)
          
          // Se for consultor, filtrar apenas reuniões onde ele é o consultor
          if (profile.role === 'consultor') {
            console.log('   👤 Consultor: Filtrando apenas reuniões do próprio consultor')
            query = query.eq('consultant_id', user.id)
          }
        } else {
          console.log('   🔓 Admin detectado - SEM filtro de tenant_id')
        }
        
        const { data: meetingData, error: meetingError } = await query.single()
        
        console.log('📊 Resultado da query:', {
          encontrou: !!meetingData,
          erro: meetingError?.message,
          status: meetingData?.status,
          tem_coordinator_result: !!meetingData?.coordinator_result
        })

        if (meetingError) {
          console.error('❌ Erro ao buscar reunião:', meetingError)
          console.error('   Meeting ID:', id)
          console.error('   User tenant_id:', profile.tenant_id)
          console.error('   Is Admin:', isAdmin)
          console.error('   Error code:', meetingError.code)
          console.error('   Error details:', meetingError.details)
          console.error('   Error hint:', meetingError.hint)
          
          // Se for admin e ainda assim deu erro, pode ser RLS bloqueando
          // Tentar buscar sem filtro de tenant_id para debug (se RLS permitir)
          const { data: meetingDataNoTenant, error: errorNoTenant } = await supabase
            .from('meetings')
            .select('id, tenant_id, status, title')
            .eq('id', id)
            .single()
          
          if (meetingDataNoTenant) {
            console.error(`⚠️ Reunião encontrada mas tenant_id não corresponde:`, {
              reunião_tenant_id: meetingDataNoTenant.tenant_id,
              usuário_tenant_id: profile.tenant_id,
              status: meetingDataNoTenant.status,
              title: meetingDataNoTenant.title
            })
            
            // Se for admin, tentar usar a reunião encontrada mesmo com tenant_id diferente
            if (isAdmin) {
              console.log('   🔓 Admin: Tentando buscar reunião completa sem filtro de tenant_id...')
              const { data: meetingDataAdmin, error: errorAdmin } = await supabase
                .from('meetings')
                .select(`
                  *,
                  coordinator_result,
                  coordinator_metadata,
                  consultant:profiles!meetings_consultant_id_fkey(name),
                  team:ai_teams(name)
                `)
                .eq('id', id)
                .single()
              
              if (meetingDataAdmin && !errorAdmin) {
                console.log('   ✅ Admin conseguiu buscar reunião sem filtro de tenant_id')
                setMeeting(meetingDataAdmin)
                // Continuar o fluxo normal abaixo
              } else {
                console.error('   ❌ Admin também não conseguiu buscar:', errorAdmin)
                setError(`Erro de permissão (RLS). Admin não conseguiu acessar reunião. Erro: ${errorAdmin?.message || meetingError.message}`)
                setLoading(false)
                return
              }
            } else {
              setError(`Reunião encontrada mas não pertence ao seu tenant. Verifique as permissões ou contate o administrador.`)
              setLoading(false)
              return
            }
          } else {
            console.error('❌ Reunião não encontrada no banco')
            setError(`Reunião não encontrada. Erro: ${meetingError.message || 'Desconhecido'}`)
            setLoading(false)
            return
          }
        }

        if (!meetingData) {
          console.error('Reunião não encontrada (sem erro, mas sem dados)')
          setError('Reunião não encontrada')
          setLoading(false)
          return
        }

        setMeeting(meetingData)

        // Se não está completa, fazer auto-refresh
        if (meetingData.status !== 'completed' && meetingData.status !== 'failed') {
          // Auto-refresh a cada 5 segundos
          const interval = setInterval(() => {
            loadData()
          }, 5000)
          return () => clearInterval(interval)
        }

        // Buscar análise principal
        const { data: analysisData } = await supabase
          .from('meeting_analyses')
          .select('*')
          .eq('meeting_id', id)
          .single()

        if (analysisData) {
          setAnalysis(analysisData)
        }

        // Buscar análises por agente
        const { data: agentData } = await supabase
          .from('meeting_agent_analyses')
          .select('*')
          .eq('meeting_id', id)
          .order('agent_key')

        if (agentData) {
          setAgentAnalyses(agentData)
        }

        setLoading(false)
      } catch (err: any) {
        console.error('Erro ao carregar:', err)
        setError(err.message || 'Erro ao carregar dados')
        setLoading(false)
      }
    }

    loadData()
  }, [id, supabase])

  if (loading) {
    return (
      <div className="p-8 text-center">
        <RefreshCw className="h-8 w-8 text-zinc-400 animate-spin mx-auto mb-4" />
        <p className="text-zinc-500">Carregando análise...</p>
      </div>
    )
  }

  if (error || !meeting) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500 mb-4">{error || 'Reunião não encontrada'}</p>
        <Link href="/reunioes">
          <Button variant="outline">Voltar</Button>
        </Link>
      </div>
    )
  }

  // Estados: queued, processing, retrying
  if (meeting.status === 'queued' || meeting.status === 'processing' || meeting.status === 'retrying') {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-4">
          <Link href="/reunioes">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-serif font-semibold text-zinc-900">Análise em Andamento</h1>
        </div>

        <Card>
          <CardContent className="p-8 text-center">
            <RefreshCw className="h-12 w-12 text-blue-500 animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">{meeting.title}</h2>
            <p className="text-zinc-500 mb-4">
              {meeting.status === 'queued' && 'Aguardando na fila...'}
              {meeting.status === 'processing' && 'Processando análise...'}
              {meeting.status === 'retrying' && 'Tentando novamente...'}
            </p>
            {meeting.status === 'queued' && (
              <p className="text-sm text-zinc-400">
                Esta página será atualizada automaticamente
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Estado: failed
  if (meeting.status === 'failed') {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-4">
          <Link href="/reunioes">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-serif font-semibold text-zinc-900">Erro na Análise</h1>
        </div>

        <Card className="border-red-500">
          <CardContent className="p-8">
            <div className="flex items-center gap-3 mb-4">
              <XCircle className="h-8 w-8 text-red-500" />
              <div>
                <h2 className="text-xl font-semibold">{meeting.title}</h2>
                <p className="text-sm text-zinc-500">Análise falhou</p>
              </div>
            </div>
            {meeting.last_error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm font-medium text-red-800 mb-2">Erro:</p>
                <p className="text-sm text-red-700">{meeting.last_error}</p>
              </div>
            )}
            <div className="mt-4 flex gap-3">
              <Link href="/reunioes">
                <Button variant="outline">Voltar</Button>
              </Link>
              <Button onClick={() => router.refresh()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar Novamente
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Estado: completed - Mostrar resultado completo
  if (!analysis) {
    return (
      <div className="p-8 text-center">
        <p className="text-zinc-500 mb-4">Análise ainda não disponível</p>
        <Link href="/reunioes">
          <Button variant="outline">Voltar</Button>
        </Link>
      </div>
    )
  }

  // Parse JSONs
  const distribuicao = analysis.distribuicao_agentes || {}
  const recomendacoes = analysis.recomendacoes_prioritizadas || []
  const checklistModulos = analysis.checklist_modulos || {}
  const metricasFechamento = analysis.metricas_fechamento || {}
  const tecnicasAplicadas = analysis.tecnicas_aplicadas || []
  const comparacaoHistorica = analysis.comparacao_historica || null
  const executionLogs = analysis.execution_logs || {}

  // Usar coordinator_result se disponível, senão usar dados antigos
  const coordinatorResult: CoordinatorResult | null = meeting.coordinator_result || null
  const hasCoordinatorResult = coordinatorResult && !coordinatorResult._fallback

  // Score e classificação vêm do coordinator_result ou do analysis antigo
  const score = coordinatorResult?.final_score || parseFloat(analysis.final_score) || 0
  const classification = coordinatorResult?.classification || analysis.classification || 'N/A'

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/reunioes">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-serif font-semibold text-zinc-900">Análise de Reunião</h1>
            <p className="text-zinc-500 mt-1">{meeting.title}</p>
          </div>
        </div>
        <PDFGenerator 
          contentRef={pdfContentRef} 
          fileName={`analise-${meeting.title?.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'reuniao'}-${id.slice(0, 8)}.pdf`}
        />
      </div>

      {/* Metadados da execução */}
      {(meeting.coordinator_metadata || meeting.processing_time || meeting.tokens_used) && (
        <div className="flex flex-wrap gap-4 text-sm text-zinc-500">
          {meeting.processing_time && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {parseFloat(meeting.processing_time).toFixed(1)}s total
            </div>
          )}
          {meeting.tokens_used && (
            <div className="flex items-center gap-1">
              <Coins className="h-4 w-4" />
              {meeting.tokens_used.toLocaleString()} tokens
            </div>
          )}
          {meeting.model_used && (
            <div className="flex items-center gap-1">
              <Bot className="h-4 w-4" />
              {meeting.model_used}
            </div>
          )}
          {coordinatorResult?._fallback && (
            <Badge variant="outline" className="text-amber-600 border-amber-300">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Modo Fallback
            </Badge>
          )}
        </div>
      )}

      {/* Conteúdo para PDF - envolve todo o conteúdo que será exportado */}
      <div ref={pdfContentRef} data-pdf-content className="space-y-6 bg-white -mx-6 px-6 py-6" style={{ backgroundColor: '#ffffff' }}>
        {/* Score Card */}
        <ScoreCard score={score} classification={classification} meeting={meeting} />

        {/* Info da Reunião - Compacto */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-3">
              {/* Primeira linha: Tipo e Consultor */}
              <div className="flex items-center gap-4 flex-wrap">
                <Badge variant="outline">Tipo: {meeting.meeting_type}</Badge>
                {meeting.consultant && (
                  <Badge variant="outline">Consultor: {meeting.consultant.name}</Badge>
                )}
                {meeting.closed && (
                  <Badge className="bg-green-500">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Contrato Fechado
                  </Badge>
                )}
              </div>

              {/* Segunda linha: Informações da Reunião */}
              <div className="flex items-center gap-4 flex-wrap text-sm text-zinc-600">
                {meeting.meeting_date && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span className="font-medium">Data da Reunião:</span>
                    <span>{new Date(meeting.meeting_date).toLocaleDateString('pt-BR')}</span>
                    {meeting.meeting_time && <span> às {meeting.meeting_time}</span>}
                  </div>
                )}
                {meeting.budget_number && (
                  <div className="flex items-center gap-1">
                    <span className="font-medium">Orçamento:</span>
                    <span>{meeting.budget_number}</span>
                  </div>
                )}
              </div>

              {/* Terceira linha: Evento e Clientes */}
              {(meeting.event_date || meeting.client_names || meeting.client_name) && (
                <div className="flex items-center gap-4 flex-wrap text-sm text-zinc-600">
                  {meeting.event_date && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span className="font-medium">Data do Evento:</span>
                      <span>{new Date(meeting.event_date).toLocaleDateString('pt-BR')}</span>
                    </div>
                  )}
                  {(meeting.client_names || meeting.client_name) && (
                    <div className="flex items-center gap-1 flex-wrap">
                      <Users className="h-4 w-4" />
                      <span className="font-medium">Clientes:</span>
                      {meeting.client_names && Array.isArray(meeting.client_names) && meeting.client_names.length > 0 ? (
                        <span>{meeting.client_names.join(', ')}</span>
                      ) : meeting.client_name ? (
                        <span>{meeting.client_name}</span>
                      ) : null}
                    </div>
                  )}
                </div>
              )}

              {/* Quarta linha: Valor do Contrato */}
              {meeting.contract_value && (
                <div className="flex items-center gap-1 text-sm">
                  <DollarSign className="h-4 w-4 text-emerald-600" />
                  <span className="font-medium text-zinc-700">Valor do Contrato:</span>
                  <span className="text-emerald-600 font-semibold">
                    {new Intl.NumberFormat('pt-BR', { 
                      style: 'currency', 
                      currency: 'BRL' 
                    }).format(parseFloat(meeting.contract_value))}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Métricas de Fechamento - abaixo da nota */}
        {(Object.keys(metricasFechamento).length > 0 || coordinatorResult?.contract_analysis || tecnicasAplicadas.length > 0 || coordinatorResult?.sugestao_fechamento) && (
          <MetricasFechamento 
            metricasFechamento={{
              status_contrato: metricasFechamento.status_contrato ?? coordinatorResult?.contract_analysis?.fechou ?? meeting.closed ?? false,
              tentativa_fechamento: metricasFechamento.tentativa_fechamento ?? coordinatorResult?.contract_analysis?.tentativa_fechamento ?? false,
              tecnicas_aplicadas: tecnicasAplicadas.length > 0 ? tecnicasAplicadas : [],
              recomendacoes: coordinatorResult?.sugestao_fechamento 
                ? (typeof coordinatorResult.sugestao_fechamento === 'string' 
                    ? [coordinatorResult.sugestao_fechamento]
                    : coordinatorResult.sugestao_fechamento.scripts 
                      ? coordinatorResult.sugestao_fechamento.scripts.map((s: any) => s.script || '').filter((s: string) => s.length > 0)
                      : [])
                : []
            }}
          />
        )}

        {/* Resumo Estratégico - após Métricas de Fechamento */}
        {coordinatorResult?.resumo_estrategico && (
          <ResumoEstrategico
            resumo={coordinatorResult.resumo_estrategico}
            classification={coordinatorResult.classification}
            finalScore={coordinatorResult.final_score}
            isFallback={coordinatorResult._fallback}
          />
        )}

        {/* Conteúdo principal - usar coordinator_result se disponível */}
        {coordinatorResult ? (
          <div className="space-y-6">
            {/* Checklist por Módulo - NO TOPO (com items detalhados) */}
            {checklistModulos && Object.keys(checklistModulos).length > 0 && (
              <ChecklistModulos 
                checklistModulos={checklistModulos} 
                modulos={coordinatorResult.modulos}
              />
            )}

          {/* Comparação Histórica */}
          {comparacaoHistorica && (
            <ComparacaoHistorica comparacaoHistorica={comparacaoHistorica} />
          )}

          {/* Recomendações Prioritárias - Horizontal abaixo do Resumo */}
          {coordinatorResult.recommendations && coordinatorResult.recommendations.length > 0 && (
            <RecommendationsList recommendations={coordinatorResult.recommendations} />
          )}

          {/* Sugestão de Fechamento */}
          {coordinatorResult.sugestao_fechamento && (
            <SugestaoFechamento sugestao={coordinatorResult.sugestao_fechamento} />
          )}

          {/* Warnings */}
          {coordinatorResult.warnings && coordinatorResult.warnings.length > 0 && (
            <Card className="border-amber-200 bg-amber-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-amber-800">
                  <AlertTriangle className="h-4 w-4" />
                  Alertas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-amber-700 space-y-1">
                  {coordinatorResult.warnings.map((warning, i) => (
                    <li key={i}>• {warning}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            )}
          </div>
        ) : (
          /* Fallback: mostrar dados antigos se não tiver coordinator_result */
          <div className="space-y-6">
          {/* Checklist por Módulo - NO TOPO (com items detalhados) */}
          {checklistModulos && Object.keys(checklistModulos).length > 0 && (
            <ChecklistModulos 
              checklistModulos={checklistModulos} 
              modulos={distribuicao}
            />
          )}
          {/* Distribuição por Agente */}
          <Card>
            <CardHeader>
              <CardTitle>📊 Distribuição por Agente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {agentAnalyses.map((agent) => (
                  <AgentDistributionBar key={agent.id} agent={agent} />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Resumo Estratégico (antigo) */}
          {analysis.resumo_estrategico && (
            <Card>
              <CardHeader>
                <CardTitle>📝 Resumo Estratégico</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-zinc-700 whitespace-pre-wrap leading-relaxed">
                  {analysis.resumo_estrategico}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Recomendações Prioritárias (antigas) */}
          {recomendacoes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>🎯 Recomendações Prioritárias</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recomendacoes.map((rec: any, i: number) => (
                    <RecommendationCard key={i} recommendation={rec} index={i + 1} />
                  ))}
                </div>
              </CardContent>
            </Card>
            )}
          </div>
        )}
      </div>

      {/* Logs de Execução (fora do PDF) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Logs de Execução
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ExecutionLogs logs={executionLogs} agentAnalyses={agentAnalyses} meeting={meeting} />
        </CardContent>
      </Card>
    </div>
  )
}

// Componente: Score Card
function ScoreCard({ score, classification, meeting }: { score: number; classification: string; meeting: any }) {
  const getScoreColor = () => {
    if (score >= 85) return 'text-green-600 bg-green-50 border-green-200'
    if (score >= 70) return 'text-blue-600 bg-blue-50 border-blue-200'
    if (score >= 50) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    return 'text-red-600 bg-red-50 border-red-200'
  }

  return (
    <Card className={`border-2 ${getScoreColor()}`}>
      <CardContent className="p-8 text-center">
        <div className="text-6xl font-bold mb-2">{score.toFixed(1)}</div>
        <div className="text-2xl font-semibold mb-4">{classification}</div>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          {meeting.closed && (
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="font-medium">Contrato Fechado</span>
            </div>
          )}
          {meeting.contract_value && (
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold">
                R$ {parseFloat(meeting.contract_value).toLocaleString('pt-BR')}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Componente: Barra de Distribuição por Agente
function AgentDistributionBar({ agent }: { agent: any }) {
  const score = parseFloat(agent.score) || 0
  const insights = agent.insights || {}
  const done = insights.pontos_fortes?.length || 0
  const warning = insights.pontos_fracos?.length || 0
  const notDone = insights.checklist?.filter((c: any) => c.status === 'not_done').length || 0

  const getColor = () => {
    if (score >= 70) return 'bg-green-500'
    if (score >= 50) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-medium capitalize min-w-[120px]">{agent.agent_name || agent.agent_key}</span>
          <div className="flex-1">
            <div className="h-4 bg-zinc-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${getColor()} transition-all`}
                style={{ width: `${Math.min(score, 100)}%` }}
              />
            </div>
          </div>
          <span className="font-bold min-w-[50px] text-right">{score}%</span>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <span className="text-xs text-green-600">✅{done}</span>
          <span className="text-xs text-yellow-600">⚠️{warning}</span>
          <span className="text-xs text-red-600">❌{notDone}</span>
        </div>
      </div>
    </div>
  )
}

// Componente: Card de Recomendação
function RecommendationCard({ recommendation, index }: { recommendation: any; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const priority = recommendation.prioridade || 'media'
  const priorityColor = priority === 'alta' ? 'bg-red-100 border-red-300' : 
                        priority === 'media' ? 'bg-yellow-100 border-yellow-300' : 
                        'bg-blue-100 border-blue-300'

  return (
    <Card className={`border-2 ${priorityColor}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={priority === 'alta' ? 'destructive' : 'secondary'}>
                {index}. {priority.toUpperCase()}
              </Badge>
              <span className="font-semibold">{recommendation.titulo || recommendation.tipo || 'Recomendação'}</span>
            </div>
            {recommendation.diagnostico && (
              <p className="text-sm text-zinc-700 mb-2">
                <strong>DIAGNÓSTICO:</strong> {recommendation.diagnostico}
              </p>
            )}
            {expanded && (
              <div className="space-y-2 mt-3 pt-3 border-t">
                {recommendation.cura && (
                  <p className="text-sm text-zinc-700">
                    <strong>CURA:</strong> {recommendation.cura}
                  </p>
                )}
                {recommendation.script && (
                  <div className="bg-zinc-50 p-3 rounded-lg">
                    <p className="text-xs font-medium text-zinc-600 mb-1">SCRIPT:</p>
                    <p className="text-sm text-zinc-800 font-mono">{recommendation.script}</p>
                  </div>
                )}
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Recolher ▲' : 'Expandir ▼'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Componente: Logs de Execução
function ExecutionLogs({ logs, agentAnalyses, meeting }: { logs: any; agentAnalyses: any[]; meeting: any }) {
  const totalTokens = agentAnalyses.reduce((sum, a) => sum + (a.tokens_input || 0) + (a.tokens_output || 0), 0)
  const totalCost = agentAnalyses.reduce((sum, a) => sum + (parseFloat(a.cost_usd) || 0), 0)
  const totalTime = agentAnalyses.reduce((sum, a) => sum + (a.execution_time_ms || 0), 0)

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div>
        <p className="text-sm text-zinc-500">Tokens</p>
        <p className="text-lg font-semibold">{totalTokens.toLocaleString('pt-BR')}</p>
      </div>
      <div>
        <p className="text-sm text-zinc-500">Custo</p>
        <p className="text-lg font-semibold">${totalCost.toFixed(4)}</p>
      </div>
      <div>
        <p className="text-sm text-zinc-500">Tempo</p>
        <p className="text-lg font-semibold">{(totalTime / 1000).toFixed(1)}s</p>
      </div>
      <div>
        <p className="text-sm text-zinc-500">Modelo</p>
        <p className="text-lg font-semibold">{meeting.llm_model || 'N/A'}</p>
      </div>
      <div>
        <p className="text-sm text-zinc-500">Agentes</p>
        <p className="text-lg font-semibold">{agentAnalyses.length}</p>
      </div>
      <div>
        <p className="text-sm text-zinc-500">Versão</p>
        <p className="text-lg font-semibold">{logs.version || 'v2.0'}</p>
      </div>
    </div>
  )
}
