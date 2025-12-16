'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ArrowLeft, Upload, FileText, DollarSign, Users, Calendar, User } from 'lucide-react'
import Link from 'next/link'
import { TagsInput } from '@/components/ui/tags-input'

const LLM_MODELS = [
  { 
    value: 'openai/gpt-4o', 
    label: 'GPT-4o (Recomendado)', 
    cost: '~$0.45/análise',
    description: 'Melhor custo-benefício'
  },
  { 
    value: 'openai/gpt-4o-mini', 
    label: 'GPT-4o Mini', 
    cost: '~$0.15/análise',
    description: 'Mais econômico'
  },
  { 
    value: 'openai/gpt-4.5-preview', 
    label: 'GPT-4.5 Preview', 
    cost: '~$0.60/análise',
    description: 'Mais avançado'
  },
  { 
    value: 'openai/gpt-5.1', 
    label: 'GPT-5.1', 
    cost: '~$0.80/análise',
    description: 'Última geração'
  },
  { 
    value: 'openai/gpt-5.2-pro', 
    label: 'GPT-5.2 Pro', 
    cost: '~$1.20/análise',
    description: 'Máxima qualidade'
  },
  { 
    value: 'anthropic/claude-3.5-sonnet', 
    label: 'Claude 3.5 Sonnet', 
    cost: '~$0.50/análise',
    description: 'Alternativa ao GPT'
  },
]

export default function NovaReuniaoPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [consultants, setConsultants] = useState<Array<{ id: string; name: string }>>([])
  const [teams, setTeams] = useState<Array<{ id: string; name: string; event_type: string; is_default: boolean }>>([])

  const [formData, setFormData] = useState({
    title: '',
    team_id: '',
    transcription: '',
    closed: false,
    contract_status: 'na' as 'closed' | 'not_closed' | 'na',
    contract_value: '',
    num_guests: '',
    client_names: [] as string[],
    event_date: '',
    budget_number: '',
    meeting_date: '',
    meeting_time: '',
    llm_model: 'openai/gpt-4o',
    consultant_id: '',
  })

  // Carregar consultores e equipes
  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single()

      if (!profile) return

      // Buscar consultores
      const { data: consultantsData } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('tenant_id', profile.tenant_id)
        .not('name', 'is', null)
        .order('name')

      if (consultantsData) {
        setConsultants(consultantsData.map(p => ({ id: p.id, name: p.name || 'Sem nome' })))
      }

      // Buscar equipes de ai_teams (corrigido de meeting_teams)
      const { data: teamsData } = await supabase
        .from('ai_teams')
        .select('id, name, event_type, is_default')
        .eq('tenant_id', profile.tenant_id)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('name')

      if (teamsData && teamsData.length > 0) {
        setTeams(teamsData.map(t => ({ 
          id: t.id, 
          name: t.name, 
          event_type: t.event_type || 'all',
          is_default: t.is_default || false
        })))
        
        // Selecionar equipe padrão automaticamente se não houver seleção
        const defaultTeam = teamsData.find(t => t.is_default) || teamsData[0] // Fallback para primeira equipe
        setFormData(prev => {
          // Só atualiza se não tiver team_id já selecionado
          if (!prev.team_id) {
            return { ...prev, team_id: defaultTeam.id }
          }
          return prev
        })
      }
    }
    loadData()
  }, [supabase])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== 'text/plain' && !file.name.endsWith('.txt')) {
      setError('Por favor, envie um arquivo .txt')
      return
    }

    const text = await file.text()
    setFormData(prev => ({ ...prev, transcription: text }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Validações
    if (!formData.title.trim()) {
      setError('Título é obrigatório')
      setLoading(false)
      return
    }

    if (formData.transcription.length < 100) {
      setError('A transcrição deve ter no mínimo 100 caracteres')
      setLoading(false)
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Usuário não autenticado')
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single()

      if (!profile) {
        setError('Perfil não encontrado')
        setLoading(false)
        return
      }

      if (!profile.tenant_id) {
        setError('Seu perfil não tem tenant_id configurado. Entre em contato com o administrador.')
        setLoading(false)
        return
      }

      // Validar equipe - verificar se existe em ai_teams
      if (!formData.team_id) {
        setError('Selecione uma equipe')
        setLoading(false)
        return
      }

      // Verificar se a equipe existe e está ativa (validação de integridade)
      const { data: teamCheck, error: teamCheckError } = await supabase
        .from('ai_teams')
        .select('id, name, event_type, is_active')
        .eq('id', formData.team_id)
        .eq('tenant_id', profile.tenant_id)
        .eq('is_active', true)
        .single()

      if (teamCheckError || !teamCheck) {
        console.error('Erro ao validar equipe:', teamCheckError)
        setError('Equipe selecionada não encontrada ou inativa. Por favor, selecione outra equipe.')
        setLoading(false)
        return
      }

      // Preparar dados para inserção
      // Usar event_type da equipe ou default 'casamento'
      const meetingType = teamCheck.event_type === 'all' || !teamCheck.event_type 
        ? 'casamento' 
        : teamCheck.event_type
      
      const meetingData: any = {
        tenant_id: profile.tenant_id,
        title: formData.title.trim(),
        team_id: formData.team_id, // ID de ai_teams (validado acima)
        meeting_type: meetingType, // Baseado no event_type da equipe
        transcription: formData.transcription.trim(),
        llm_model: formData.llm_model,
        status: 'queued',
        closed: formData.contract_status === 'closed',
        created_by: user.id,
        budget_number: formData.budget_number.trim() || null,
        meeting_date: formData.meeting_date || null,
        meeting_time: formData.meeting_time || null,
      }

      if (formData.consultant_id) {
        meetingData.consultant_id = formData.consultant_id
      }

      // Adicionar dados do contrato (se fechou ou não fechou mas tem dados)
      if (formData.contract_status === 'closed' || (formData.contract_status === 'not_closed' && formData.contract_value)) {
        if (formData.contract_value) {
          // Remove tudo exceto números, vírgula e ponto
          const cleanValue = formData.contract_value.replace(/[^\d,.-]/g, '').replace(',', '.')
          const numValue = parseFloat(cleanValue)
          if (!isNaN(numValue) && numValue > 0) {
            meetingData.contract_value = numValue
          }
        }
        if (formData.num_guests) {
          meetingData.num_guests = parseInt(formData.num_guests)
        }
      }

      // Adicionar clientes e data do evento (sempre, se preenchidos)
      if (formData.client_names && formData.client_names.length > 0) {
        meetingData.client_names = formData.client_names
      }
      if (formData.event_date) {
        meetingData.event_date = formData.event_date
      }

      // Inserir no Supabase
      const { data, error: insertError } = await supabase
        .from('meetings')
        .insert(meetingData)
        .select('id')
        .single()

      if (insertError) {
        console.error('Erro ao inserir:', insertError)
        setError(`Erro ao salvar reunião: ${insertError.message}`)
        setLoading(false)
        return
      }

      // Sucesso - redirecionar
      router.push(`/reunioes?success=true&id=${data.id}`)
    } catch (err: any) {
      console.error('Erro:', err)
      setError(err.message || 'Erro ao processar formulário')
      setLoading(false)
    }
  }

  const selectedModel = LLM_MODELS.find(m => m.value === formData.llm_model)
  
  // Calcular custo estimado baseado no modelo e tamanho da transcrição
  const estimateCost = (model: string, charCount: number): string => {
    const tokensEstimate = charCount / 4 // ~4 chars per token
    const costs: Record<string, number> = {
      'openai/gpt-4o': 0.005, // per 1K tokens
      'openai/gpt-4o-mini': 0.00015,
      'openai/gpt-4.5-preview': 0.01,
      'openai/gpt-5.1': 0.015,
      'openai/gpt-5.2-pro': 0.025,
      'anthropic/claude-3.5-sonnet': 0.006,
    }
    const costPer1K = costs[model] || 0.005
    const estimatedCost = (tokensEstimate / 1000) * costPer1K
    return estimatedCost.toFixed(2)
  }
  
  const estimatedCost = formData.transcription.length > 0 
    ? estimateCost(formData.llm_model, formData.transcription.length)
    : null

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/reunioes">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-serif font-semibold text-zinc-900">Nova Reunião</h1>
          <p className="text-zinc-500 mt-1">Envie a transcrição para análise</p>
        </div>
      </div>

      {/* Formulário */}
      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Informações Básicas */}
          <Card>
            <CardHeader>
              <CardTitle>Informações Básicas</CardTitle>
              <CardDescription>Dados principais da reunião</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Ex: Reunião com João e Maria - Casamento"
                  required
                />
              </div>

              <div>
                <Label htmlFor="client_names">Clientes</Label>
                <TagsInput
                  tags={formData.client_names}
                  onChange={(tags) => setFormData(prev => ({ ...prev, client_names: tags }))}
                  placeholder="Digite o nome e pressione Enter para adicionar"
                  className="mt-1"
                />
                <p className="text-xs text-zinc-500 mt-1">
                  Adicione quantos clientes desejar. Digite o nome e pressione Enter para adicionar.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="team_id">Equipe de Análise *</Label>
                  <Select
                    value={formData.team_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, team_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a equipe" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map(team => {
                        // Ícone baseado no event_type
                        const icon = team.event_type === 'casamento' ? '💒' : 
                                    team.event_type === '15_anos' ? '🎂' : 
                                    '🤖'
                        return (
                          <SelectItem key={team.id} value={team.id}>
                            {icon} {team.name} {team.is_default && '(Padrão)'}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                  {teams.length === 0 && (
                    <p className="text-xs text-zinc-500 mt-1">
                      Nenhuma equipe disponível. <Link href="/settings/teams" className="text-blue-500 underline">Criar equipe</Link>
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="consultant_id">Consultor</Label>
                  <Select
                    value={formData.consultant_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, consultant_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o consultor" />
                    </SelectTrigger>
                    <SelectContent>
                      {consultants.map(consultant => (
                        <SelectItem key={consultant.id} value={consultant.id}>
                          {consultant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="budget_number">Número de Orçamento</Label>
                  <Input
                    id="budget_number"
                    value={formData.budget_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, budget_number: e.target.value }))}
                    placeholder="Ex: ORC-2024-001"
                  />
                </div>

                <div>
                  <Label htmlFor="meeting_date">Data da Reunião</Label>
                  <Input
                    id="meeting_date"
                    type="date"
                    value={formData.meeting_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, meeting_date: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="meeting_time">Hora da Reunião</Label>
                  <Input
                    id="meeting_time"
                    type="time"
                    value={formData.meeting_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, meeting_time: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="event_date">Data do Evento</Label>
                <Input
                  id="event_date"
                  type="date"
                  value={formData.event_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, event_date: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Transcrição */}
          <Card>
            <CardHeader>
              <CardTitle>Transcrição</CardTitle>
              <CardDescription>Cole a transcrição ou faça upload de um arquivo .txt</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="transcription">Transcrição * (mínimo 100 caracteres)</Label>
                <Textarea
                  id="transcription"
                  value={formData.transcription}
                  onChange={(e) => setFormData(prev => ({ ...prev, transcription: e.target.value }))}
                  placeholder="Cole aqui a transcrição completa da reunião..."
                  className="min-h-[300px] font-mono text-sm"
                  required
                />
                <p className="text-xs text-zinc-500 mt-1">
                  {formData.transcription.length} caracteres
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Label htmlFor="file-upload" className="cursor-pointer">
                  <Button type="button" variant="outline" asChild>
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      Fazer Upload de Arquivo .txt
                    </span>
                  </Button>
                </Label>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".txt,text/plain"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                {formData.transcription && (
                  <span className="text-sm text-green-600 flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    Arquivo carregado
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Configuração da Análise */}
          <Card>
            <CardHeader>
              <CardTitle>Configuração da Análise</CardTitle>
              <CardDescription>Escolha o modelo de IA para análise</CardDescription>
            </CardHeader>
            <CardContent>
              <div>
                <Label htmlFor="llm_model">Modelo LLM *</Label>
                <Select
                  value={formData.llm_model}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, llm_model: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LLM_MODELS.map(model => (
                      <SelectItem key={model.value} value={model.value}>
                        <div className="flex flex-col w-full">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{model.label}</span>
                            <span className="text-xs text-zinc-500 ml-4">{model.cost}</span>
                          </div>
                          {model.description && (
                            <span className="text-xs text-zinc-400 mt-0.5">{model.description}</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedModel && (
                  <div className="mt-1 space-y-0.5">
                    <p className="text-xs text-zinc-500">
                      {selectedModel.description && `${selectedModel.description} • `}
                      Custo base: {selectedModel.cost}
                    </p>
                    {estimatedCost && formData.transcription.length > 0 && (
                      <p className="text-xs text-emerald-600 font-medium">
                        Custo estimado para esta transcrição: ~${estimatedCost}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Contrato */}
          <Card>
            <CardHeader>
              <CardTitle>Contrato</CardTitle>
              <CardDescription>Status do fechamento e informações do contrato (opcional)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="contract_status">Status do Contrato</Label>
                <Select
                  value={formData.contract_status}
                  onValueChange={(value) => {
                    setFormData(prev => ({ 
                      ...prev, 
                      contract_status: value as 'closed' | 'not_closed' | 'na',
                      closed: value === 'closed'
                    }))
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="closed">Contrato foi fechado</SelectItem>
                    <SelectItem value="not_closed">Contrato não foi fechado</SelectItem>
                    <SelectItem value="na">Não se aplica</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(formData.contract_status === 'closed' || formData.contract_status === 'not_closed') && (
                <div className="space-y-4 pt-4 border-t">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="contract_value">Valor do Contrato (R$)</Label>
                      <Input
                        id="contract_value"
                        type="text"
                        value={formData.contract_value}
                        onChange={(e) => setFormData(prev => ({ ...prev, contract_value: e.target.value }))}
                        placeholder="150000"
                      />
                      <p className="text-xs text-zinc-500 mt-1">
                        {formData.contract_status === 'closed' ? 'Valor do contrato fechado' : 'Valor estimado ou discutido'}
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="num_guests">Número de Convidados</Label>
                      <Input
                        id="num_guests"
                        type="number"
                        value={formData.num_guests}
                        onChange={(e) => setFormData(prev => ({ ...prev, num_guests: e.target.value }))}
                        placeholder="150"
                        min="1"
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Erro */}
          {error && (
            <Card className="border-red-500">
              <CardContent className="pt-6">
                <p className="text-red-500">{error}</p>
              </CardContent>
            </Card>
          )}

          {/* Botões */}
          <div className="flex justify-end gap-3">
            <Link href="/reunioes">
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </Link>
            <Button type="submit" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar para Análise'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
