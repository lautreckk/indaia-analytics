'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMeetings } from '@/hooks/use-meetings'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Clock, CheckCircle, XCircle, AlertCircle, Plus, FileText, RefreshCw, Settings, RotateCcw, ChevronLeft, ChevronRight, AlertTriangle, X, MoreVertical, Eye, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export default function ReunioesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [page, setPage] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Usar hook otimizado com React Query
  const { data, isLoading, isFetching, refetch } = useMeetings({ 
    page,
    pageSize: 20 
  })

  const meetings = data?.meetings || []
  const queueStatus = data?.queueStatus

  // Verificar se houve sucesso no upload
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      const id = searchParams.get('id')
      if (id) {
        router.replace('/reunioes')
        refetch()
      }
    }
  }, [searchParams, router, refetch])

  // Auto-refresh quando há itens na fila
  useEffect(() => {
    const hasItemsInQueue = meetings.some(m => 
      ['queued', 'processing', 'retrying'].includes(m.status)
    )
    
    if (hasItemsInQueue) {
      const interval = setInterval(() => {
        refetch()
      }, 10000) // 10 segundos
      return () => clearInterval(interval)
    }
  }, [meetings, refetch])

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      queued: { label: 'Na Fila', className: 'bg-blue-500' },
      processing: { label: 'Processando', className: 'bg-yellow-500' },
      completed: { label: 'Concluída', className: 'bg-green-500' },
      failed: { label: 'Falhou', className: 'bg-red-500' },
      retrying: { label: 'Tentando Novamente', className: 'bg-orange-500' },
      cancelled: { label: 'Cancelada', className: 'bg-gray-500' },
    }

    const variant = variants[status] || { label: status, className: 'bg-zinc-500' }
    return (
      <Badge className={variant.className}>
        {variant.label}
      </Badge>
    )
  }

  const formatDate = (date: string | null) => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handleRetry = async (meetingId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!confirm('Tentar processar esta reunião novamente?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('meetings')
        .update({
          status: 'queued',
          error_message: null,
          processing_started_at: null,
        })
        .eq('id', meetingId)

      if (error) {
        console.error('Erro ao tentar novamente:', error)
        toast.error('Erro ao tentar novamente', {
          description: error.message || 'Tente mais tarde.'
        })
        return
      }

      toast.success('Reunião adicionada à fila novamente')
      refetch()
    } catch (err: any) {
      console.error('Erro:', err)
      toast.error('Erro ao tentar novamente', {
        description: err.message || 'Erro desconhecido'
      })
    }
  }

  const handleRefresh = () => {
    setRefreshKey(k => k + 1)
    refetch()
  }

  const isStuck = (meeting: any) => {
    if (meeting.status !== 'processing') return false
    
    // Tentar usar processing_started_at, depois queued_at, depois created_at
    const startedAt = meeting.processing_started_at || meeting.queued_at || meeting.created_at
    if (!startedAt) return false
    
    const now = new Date()
    const started = new Date(startedAt)
    const diffMinutes = (now.getTime() - started.getTime()) / 1000 / 60
    return diffMinutes > 10
  }

  const handleCancel = async (meetingId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    if (!confirm('Tem certeza que deseja cancelar esta análise?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('meetings')
        .update({ 
          status: 'cancelled', 
          error_message: 'Cancelado pelo usuário',
          cancelled_at: new Date().toISOString()
        })
        .eq('id', meetingId)

      if (error) {
        console.error('Erro ao cancelar:', error)
        toast.error('Erro ao cancelar análise', {
          description: error.message || 'Tente mais tarde.'
        })
        return
      }

      toast.success('Análise cancelada com sucesso')
      refetch()
    } catch (err: any) {
      console.error('Erro:', err)
      toast.error('Erro ao cancelar análise', {
        description: err.message || 'Erro desconhecido'
      })
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    
    try {
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', deleteId)
      
      if (error) {
        console.error('Erro ao deletar:', error)
        toast.error('Erro ao deletar reunião', {
          description: error.message || 'Tente mais tarde.'
        })
        return
      }
      
      toast.success('Reunião deletada com sucesso')
      setDeleteId(null)
      refetch()
    } catch (err: any) {
      console.error('Erro:', err)
      toast.error('Erro ao deletar reunião', {
        description: err.message || 'Erro desconhecido'
      })
    }
  }

  // Contar análises em processamento
  const processingCount = meetings.filter(m => m.status === 'processing').length

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <p className="text-zinc-500">Carregando reuniões...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-zinc-900 flex items-center gap-2">
            <FileText className="w-6 h-6" />
            Reuniões
          </h1>
          <p className="text-zinc-500 mt-1">{meetings.length} reuniões cadastradas</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={handleRefresh}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Link href="/reunioes/configuracoes">
            <Button variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Configurar Equipes
            </Button>
          </Link>
          <Link href="/reunioes/nova">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Reunião
            </Button>
          </Link>
        </div>
      </div>

      {/* Banner de Aviso - Análises em Processamento */}
      {processingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-amber-800 font-medium">
              {processingCount} análise(s) em andamento
            </p>
            <p className="text-amber-600 text-sm">
              Evite fazer alterações nos agentes ou equipes até o processamento terminar.
            </p>
          </div>
        </div>
      )}

      {/* Status da Fila */}
      {queueStatus && (queueStatus.queued > 0 || queueStatus.processing > 0 || queueStatus.retrying > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Status da Fila
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              {queueStatus.queued > 0 && (
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-500">{queueStatus.queued}</Badge>
                  <span className="text-sm text-zinc-600">Na fila</span>
                </div>
              )}
              {queueStatus.processing > 0 && (
                <div className="flex items-center gap-2">
                  <Badge className="bg-yellow-500">{queueStatus.processing}</Badge>
                  <span className="text-sm text-zinc-600">Processando</span>
                </div>
              )}
              {queueStatus.retrying > 0 && (
                <div className="flex items-center gap-2">
                  <Badge className="bg-orange-500">{queueStatus.retrying}</Badge>
                  <span className="text-sm text-zinc-600">Tentando novamente</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Reuniões */}
      <div className="space-y-3">
        {meetings.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="h-12 w-12 text-zinc-400 mx-auto mb-4" />
              <p className="text-zinc-500 mb-4">Nenhuma reunião cadastrada ainda</p>
              <Link href="/reunioes/nova">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeira Reunião
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          meetings.map((meeting) => {
            const isFailed = meeting.status === 'failed'
            const CardWrapper = isFailed ? 'div' : Link
            const cardProps = isFailed ? {} : { href: `/reunioes/analises/${meeting.id}` }
            
            return (
              <CardWrapper key={meeting.id} {...cardProps}>
                <Card className={`hover:shadow-md transition-shadow ${!isFailed ? 'cursor-pointer' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-medium text-zinc-900">{meeting.title}</h3>
                          {getStatusBadge(meeting.status)}
                          {meeting.closed && (
                            <Badge className="bg-green-500">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Fechado
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-zinc-500 space-y-1">
                          {meeting.client_name && (
                            <p>Cliente: {meeting.client_name}</p>
                          )}
                          <div className="flex items-center gap-4">
                            <span>Tipo: {meeting.meeting_type}</span>
                            {meeting.profiles && (
                              <span>Consultor: {meeting.profiles.name}</span>
                            )}
                            {meeting.contract_value && (
                              <span className="text-green-600 font-medium">
                                R$ {parseFloat(meeting.contract_value).toLocaleString('pt-BR')}
                              </span>
                            )}
                          </div>
                          {meeting.error_message && (
                            <p className="text-xs text-red-600 bg-red-50 p-2 rounded mt-2">
                              <AlertCircle className="h-3 w-3 inline mr-1" />
                              {meeting.error_message}
                            </p>
                          )}
                          <p className="text-xs">
                            Criado em: {formatDate(meeting.created_at)}
                            {meeting.completed_at && (
                              <span className="ml-2">
                                • Concluído em: {formatDate(meeting.completed_at)}
                              </span>
                            )}
                            {meeting.retry_count > 0 && (
                              <span className="ml-2 text-orange-600">
                                • Tentativas: {meeting.retry_count}/3
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex flex-col gap-2">
                        {meeting.status === 'completed' ? (
                          <Button variant="outline" size="sm">
                            Ver Análise →
                          </Button>
                        ) : meeting.status === 'failed' ? (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={(e) => handleRetry(meeting.id, e)}
                            className="border-orange-500 text-orange-600 hover:bg-orange-50"
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Tentar Novamente
                          </Button>
                        ) : meeting.status === 'processing' && isStuck(meeting) ? (
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={(e) => handleCancel(meeting.id, e)}
                          >
                            <X className="h-4 w-4 mr-2" />
                            Cancelar
                          </Button>
                        ) : (
                          <div className="text-xs text-zinc-400">
                            {meeting.status === 'queued' && 'Aguardando processamento'}
                            {meeting.status === 'processing' && 'Em análise...'}
                            {meeting.status === 'retrying' && 'Tentando novamente...'}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </CardWrapper>
            )
          })
        )}
      </div>

      {/* Paginação */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm text-zinc-500">
            Página {page + 1} de {data.totalPages} • {data.totalCount} reuniões no total
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(data.totalPages - 1, p + 1))}
              disabled={page >= data.totalPages - 1}
            >
              Próxima
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
