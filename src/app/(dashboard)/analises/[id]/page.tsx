import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, Users } from 'lucide-react'
import { getAtendentesFromAnalysis } from '@/lib/utils'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AnaliseDetailPage({ params }: PageProps) {
  const { id } = await params
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
        <p className="text-red-500">Erro: Perfil não encontrado</p>
      </div>
    )
  }

  const { data: analysis } = await supabase
    .from('conversation_analyses')
    .select(`
      *,
      conversations (
        id,
        status,
        contacts (name, phone)
      )
    `)
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single()

  if (!analysis) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500">Análise não encontrada</p>
        <Link href="/analises" className="text-blue-500 underline">Voltar</Link>
      </div>
    )
  }

  // Parse JSONs
  let etapas: Record<string, boolean> = {}
  let errors: any[] = []
  let errorsCount: Record<string, number> = {}
  let positivePoints: string[] = []
  let improvementPoints: string[] = []
  let rawAnalysis: any = {}

  try {
    etapas = analysis.etapas_cumpridas 
      ? (typeof analysis.etapas_cumpridas === 'string' 
          ? JSON.parse(analysis.etapas_cumpridas) 
          : analysis.etapas_cumpridas)
      : {}
  } catch {
    etapas = {}
  }

  try {
    errors = analysis.errors_detected 
      ? (typeof analysis.errors_detected === 'string' 
          ? JSON.parse(analysis.errors_detected) 
          : analysis.errors_detected)
      : []
    if (!Array.isArray(errors)) errors = []
  } catch {
    errors = []
  }

  try {
    errorsCount = analysis.errors_count 
      ? (typeof analysis.errors_count === 'string' 
          ? JSON.parse(analysis.errors_count) 
          : analysis.errors_count)
      : {}
  } catch {
    errorsCount = {}
  }

  try {
    positivePoints = analysis.positive_points 
      ? (typeof analysis.positive_points === 'string' 
          ? JSON.parse(analysis.positive_points) 
          : analysis.positive_points)
      : []
    if (!Array.isArray(positivePoints)) positivePoints = []
  } catch {
    positivePoints = []
  }

  try {
    improvementPoints = analysis.improvement_points 
      ? (typeof analysis.improvement_points === 'string' 
          ? JSON.parse(analysis.improvement_points) 
          : analysis.improvement_points)
      : []
    if (!Array.isArray(improvementPoints)) improvementPoints = []
  } catch {
    improvementPoints = []
  }

  try {
    rawAnalysis = analysis.raw_analysis 
      ? (typeof analysis.raw_analysis === 'string' 
          ? JSON.parse(analysis.raw_analysis) 
          : analysis.raw_analysis)
      : {}
  } catch {
    rawAnalysis = {}
  }

  const score = analysis.overall_score || 0
  const scoreColor = score >= 70 ? 'text-green-500' : score >= 50 ? 'text-yellow-500' : 'text-red-500'
  
  // Extrair informações de atendentes
  const { principal, todos } = getAtendentesFromAnalysis(analysis)

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/analises">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-serif font-semibold text-zinc-900">Análise de Conversa</h1>
      </div>

      {/* Resumo */}
      <Card>
        <CardHeader>
          <CardTitle>📝 Resumo</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-zinc-600 mb-4">{analysis.summary || 'Sem resumo disponível'}</p>
          <div className="flex gap-4 flex-wrap items-center">
            <div className={`text-3xl font-bold ${scoreColor}`}>
              {score}/100
            </div>
            <Badge variant="outline" className="text-lg">
              {analysis.tipo_evento || 'N/A'}
            </Badge>
            {analysis.agendamento_realizado ? (
              <Badge className="bg-green-500 hover:bg-green-600 text-lg">Agendou ✅</Badge>
            ) : (
              <Badge variant="secondary" className="text-lg">Não agendou</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Scores e Etapas */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Scores */}
        <Card>
          <CardHeader>
            <CardTitle>📊 Scores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScoreBar label="Aderência ao Roteiro" value={analysis.script_adherence_score} />
            <ScoreBar label="Qualidade Geral" value={analysis.overall_score} />
            <ScoreBar label="Personalização" value={analysis.personalization_score} />
            <ScoreBar label="Uso de Escassez" value={rawAnalysis.scores?.uso_escassez} />
          </CardContent>
        </Card>

        {/* Etapas */}
        <Card>
          <CardHeader>
            <CardTitle>📋 Etapas do Roteiro</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {Object.entries(etapas).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
                  {value ? (
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  )}
                  <span className="text-sm">{formatEtapaName(key)}</span>
                </div>
              ))}
              {Object.keys(etapas).length === 0 && (
                <p className="text-sm text-zinc-400">Nenhuma etapa registrada</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Erros */}
      {errors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-500">⚠️ Erros Detectados ({errors.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {errors.map((error: any, i: number) => (
                <div key={i} className="border-l-4 border-red-500 pl-4 py-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={error.severidade === 'alta' ? 'destructive' : 'secondary'}>
                      {error.severidade?.toUpperCase() || 'N/A'}
                    </Badge>
                    <span className="font-medium">{error.tipo || 'Erro desconhecido'}</span>
                  </div>
                  <p className="text-sm text-zinc-600 mt-1">{error.descricao || 'Sem descrição'}</p>
                  {error.evidencia && (
                    <p className="text-xs bg-zinc-100 p-2 rounded mt-2 italic">"{error.evidencia}"</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pontos Positivos e Melhorias */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-green-600">✅ Pontos Positivos</CardTitle>
          </CardHeader>
          <CardContent>
            {positivePoints.length > 0 ? (
              <ul className="space-y-2">
                {positivePoints.map((point: string, i: number) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{point}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-400">Nenhum ponto positivo registrado</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-orange-600">📈 Pontos de Melhoria</CardTitle>
          </CardHeader>
          <CardContent>
            {improvementPoints.length > 0 ? (
              <ul className="space-y-2">
                {improvementPoints.map((point: string, i: number) => (
                  <li key={i} className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{point}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-400">Nenhum ponto de melhoria registrado</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Seção de Atendentes */}
      {todos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Atendentes ({todos.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {todos.map((atendente, i) => {
                const isPrincipal = atendente.nome === principal
                const scoreColor = atendente.score >= 70 
                  ? 'bg-emerald-100 text-emerald-700 border-emerald-200' 
                  : atendente.score >= 50 
                  ? 'bg-amber-100 text-amber-700 border-amber-200'
                  : 'bg-red-100 text-red-700 border-red-200'
                
                return (
                  <div 
                    key={i} 
                    className={`border rounded-lg p-4 ${isPrincipal ? 'border-emerald-300 bg-emerald-50/50' : 'border-zinc-200'}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-zinc-900">{atendente.nome}</span>
                        {isPrincipal && (
                          <Badge className="bg-emerald-500 hover:bg-emerald-600 text-xs">
                            Principal
                          </Badge>
                        )}
                        {atendente.contexto && (
                          <span className="text-xs text-zinc-500 italic">
                            {atendente.contexto}
                          </span>
                        )}
                      </div>
                      <div className={`px-3 py-1 rounded-full text-sm font-medium border ${scoreColor}`}>
                        {atendente.score}/100
                      </div>
                    </div>
                    <p className="text-sm text-zinc-500">
                      {atendente.mensagens} {atendente.mensagens === 1 ? 'mensagem' : 'mensagens'} enviada{atendente.mensagens !== 1 ? 's' : ''}
                    </p>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feedback */}
      {rawAnalysis.feedback_atendente && (
        <Card>
          <CardHeader>
            <CardTitle>💬 Feedback para o Atendente</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-zinc-600">{rawAnalysis.feedback_atendente}</p>
          </CardContent>
        </Card>
      )}

      {/* Link para conversa */}
      <div className="flex justify-center">
        <Link href={`/conversations/${analysis.conversation_id}`}>
          <Button variant="outline">
            Ver Conversa Original →
          </Button>
        </Link>
      </div>
    </div>
  )
}

function ScoreBar({ label, value }: { label: string; value?: number }) {
  const score = value || 0
  const colorClass = score >= 70 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500'
  
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span className="font-medium">{score}%</span>
      </div>
      <div className="h-2 bg-zinc-200 rounded-full overflow-hidden">
        <div 
          className={`h-full ${colorClass} transition-all`} 
          style={{ width: `${score}%` }} 
        />
      </div>
    </div>
  )
}

function formatEtapaName(key: string): string {
  const names: Record<string, string> = {
    '1_apresentacao': '1. Apresentação Inicial',
    '2_fotos': '2. Envio de Fotos',
    '3_explicacao_indaia': '3. Explicação do Indaiá',
    '4_cardapio': '4. Cardápio',
    '5_venda_reuniao': '5. Venda da Reunião',
    '6_escassez_horario': '6. Imposição de Horário',
    '7_regras_reuniao': '7. Regras da Reunião',
    '8_bloqueio_falta': '8. Bloqueio por Falta',
    '9_confirmacoes_robo': '9. Confirmações do Robô',
    '10_agradecimento': '10. Agradecimento',
    '11_pos_confirmacao': '11. Pós-confirmação',
    '12_prospeccao': '12. Prospecção',
    '13_objecoes': '13. Objeções',
    '14_personalizacao': '14. Personalização',
  }
  return names[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}
