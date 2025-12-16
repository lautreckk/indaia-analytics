import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Phone, User, Bot, Mic, Image as ImageIcon, FileText, Video, UserCircle } from 'lucide-react'
import Link from 'next/link'
import { MessageImage } from '@/components/message-image'

interface PageProps {
  params: Promise<{ id: string }>
}

// ============================================
// TIPOS DE MENSAGEM
// ============================================
type MessageType = 'text' | 'audio' | 'image' | 'video' | 'document' | 'unknown'

interface ParsedContent {
  type: MessageType
  text?: string
  audioUrl?: string
  imageUrl?: string
  thumbnailUrl?: string
  fileName?: string
  transcription?: string
}

// ============================================
// FUNÇÕES HELPER
// ============================================

/**
 * Extrai o nome do atendente do início da mensagem
 * Formato: *Atendente - Maria Izabel*:\nMensagem...
 */
function extractAgentNameFromContent(content: string): string | null {
  if (!content) return null
  // Regex: captura tudo entre * e *:
  const match = content.match(/^\*([^*]+)\*:/)
  if (match) {
    return match[1].trim()
  }
  return null
}

/**
 * Remove o prefixo do atendente da mensagem
 * *Atendente - Maria Izabel*:\nBoa tarde! -> Boa tarde!
 */
function removeAgentPrefix(content: string): string {
  if (!content) return ''
  // Remove o prefixo *Nome*: do início da mensagem
  return content.replace(/^\*[^*]+\*:\s*\n?/, '').trim()
}

function parseMessageContent(message: any): ParsedContent {
  const content = message.content || ''
  const contentType = message.content_type?.toLowerCase() || ''
  
  // 1. Verificar content_type explícito
  if (contentType === 'audio') {
    const urls = extractUrlsFromJson(content, 'audio')
    return {
      type: 'audio',
      audioUrl: urls.dataUrl,
      transcription: getTranscription(message)
    }
  }
  
  if (contentType === 'image') {
    const urls = extractUrlsFromJson(content, 'image')
    return {
      type: 'image',
      imageUrl: urls.dataUrl,
      thumbnailUrl: urls.thumbUrl
    }
  }
  
  if (contentType === 'video') {
    const urls = extractUrlsFromJson(content, 'video')
    return {
      type: 'video',
      imageUrl: urls.dataUrl
    }
  }
  
  if (contentType === 'document' || contentType === 'file') {
    return {
      type: 'document',
      fileName: extractFileName(content)
    }
  }
  
  // 2. Se content_type é 'text' ou vazio, verificar se o conteúdo é JSON
  if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
    try {
      const json = JSON.parse(content)
      
      // Verificar attachments
      if (json.attachments && Array.isArray(json.attachments)) {
        for (const att of json.attachments) {
          const fileType = att.file_type?.toLowerCase()
          
          if (fileType === 'audio') {
            return {
              type: 'audio',
              audioUrl: att.data_url,
              transcription: getTranscription(message)
            }
          }
          
          if (fileType === 'image') {
            return {
              type: 'image',
              imageUrl: att.data_url,
              thumbnailUrl: att.thumb_url
            }
          }
          
          if (fileType === 'video') {
            return {
              type: 'video',
              imageUrl: att.data_url
            }
          }
          
          if (fileType === 'file' || fileType === 'document') {
            return {
              type: 'document',
              fileName: att.file_name || 'Documento'
            }
          }
        }
      }
      
      // JSON sem attachments reconhecidos
      return { type: 'unknown', text: '[Conteúdo não suportado]' }
      
    } catch {
      // Não é JSON válido, tratar como texto
    }
  }
  
  // 3. É texto normal
  // Remover prefixo do atendente (*Nome:*)
  const text = removeAgentPrefix(content)
  
  // Se ainda parece JSON, não mostrar
  if (text.startsWith('{') || text.startsWith('[')) {
    return { type: 'unknown', text: '[Conteúdo não suportado]' }
  }
  
  return {
    type: 'text',
    text: text || '(mensagem vazia)'
  }
}

function extractUrlsFromJson(content: string, fileType: string): { dataUrl?: string, thumbUrl?: string } {
  try {
    const json = JSON.parse(content)
    if (json.attachments) {
      for (const att of json.attachments) {
        if (att.file_type?.toLowerCase() === fileType) {
          return {
            dataUrl: att.data_url,
            thumbUrl: att.thumb_url
          }
        }
      }
    }
  } catch {}
  return {}
}

function extractFileName(content: string): string {
  try {
    const json = JSON.parse(content)
    if (json.attachments?.[0]?.file_name) {
      return json.attachments[0].file_name
    }
  } catch {}
  return 'Documento'
}

function getTranscription(message: any): string | undefined {
  // 1. Tabela transcriptions (join)
  if (message.transcriptions?.length > 0) {
    const t = message.transcriptions[0]
    if (t.transcription?.trim()) return t.transcription
  }
  
  // 2. metadata.transcricao
  if (message.metadata?.transcricao) return message.metadata.transcricao
  
  // 3. metadata.transcription
  if (message.metadata?.transcription) return message.metadata.transcription
  
  return undefined
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/**
 * Determina quem enviou a mensagem: Cliente, Atendente ou Bot
 */
function getSenderInfo(message: any, agentFromConversation?: any) {
  const fromMe = message.from_me
  const agentId = message.agent_id
  const senderType = message.sender_type?.toLowerCase()
  const content = message.content || ''
  
  // 1. CLIENTE: from_me = false OU sender_type = 'customer'
  if (fromMe === false || senderType === 'customer') {
    return { 
      label: 'Cliente', 
      color: 'bg-white border border-zinc-200', 
      textColor: 'text-blue-600',
      avatarBg: 'bg-blue-100',
      icon: 'user' as const,
      isClient: true
    }
  }
  
  // 2. Verificar se é ATENDENTE
  // 2a. Tem agent_id no registro
  if (agentId) {
    // Se tiver o agent da conversa, usar o nome dele
    const agentName = agentFromConversation?.name || 'Atendente'
    return { 
      label: agentName, 
      color: 'bg-green-50 border border-green-200', 
      textColor: 'text-green-600',
      avatarBg: 'bg-green-100',
      icon: 'agent' as const,
      isClient: false
    }
  }
  
  // 2b. Tem nome do atendente no início da mensagem (*Nome:*)
  const agentNameFromContent = extractAgentNameFromContent(content)
  if (agentNameFromContent) {
    return { 
      label: agentNameFromContent, 
      color: 'bg-green-50 border border-green-200', 
      textColor: 'text-green-600',
      avatarBg: 'bg-green-100',
      icon: 'agent' as const,
      isClient: false
    }
  }
  
  // 3. BOT: from_me = true, sem agent_id, sem nome de atendente
  return { 
    label: 'Bot', 
    color: 'bg-purple-50 border border-purple-200', 
    textColor: 'text-purple-600',
    avatarBg: 'bg-purple-100',
    icon: 'bot' as const,
    isClient: false
  }
}

// ============================================
// COMPONENTE DE MENSAGEM
// ============================================

function MessageBubble({ message, agentFromConversation }: { message: any, agentFromConversation?: any }) {
  const parsed = parseMessageContent(message)
  const sender = getSenderInfo(message, agentFromConversation)
  const isFromClient = sender.isClient
  
  // Ícone baseado no tipo de remetente
  const SenderIcon = () => {
    if (sender.icon === 'user') {
      return (
        <div className={`w-10 h-10 rounded-full ${sender.avatarBg} flex items-center justify-center flex-shrink-0`}>
          <User className="w-5 h-5 text-blue-600" />
        </div>
      )
    }
    if (sender.icon === 'agent') {
      return (
        <div className={`w-10 h-10 rounded-full ${sender.avatarBg} flex items-center justify-center flex-shrink-0`}>
          <UserCircle className="w-5 h-5 text-green-600" />
        </div>
      )
    }
    // Bot
    return (
      <div className={`w-10 h-10 rounded-full ${sender.avatarBg} flex items-center justify-center flex-shrink-0`}>
        <Bot className="w-5 h-5 text-purple-600" />
      </div>
    )
  }
  
  return (
    <div className={`flex ${isFromClient ? 'justify-start' : 'justify-end'}`}>
      {/* Avatar esquerda (cliente) */}
      {isFromClient && (
        <div className="mr-3">
          <SenderIcon />
        </div>
      )}
      
      <div className={`max-w-[70%]`}>
        {/* Label do remetente */}
        <p className={`text-xs font-medium mb-1 ${sender.textColor} ${isFromClient ? '' : 'text-right'}`}>
          {sender.label}
        </p>
        
        {/* Bolha da mensagem */}
        <div className={`rounded-lg p-3 ${sender.color}`}>
          
          {/* TEXTO */}
          {parsed.type === 'text' && (
            <p className="text-sm text-zinc-700 whitespace-pre-wrap">
              {parsed.text}
            </p>
          )}
          
          {/* ÁUDIO */}
          {parsed.type === 'audio' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-zinc-600">
                <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center">
                  <Mic className="w-4 h-4" />
                </div>
                <span className="text-sm">Mensagem de áudio</span>
              </div>
              
              {parsed.transcription ? (
                <div className="border-t border-zinc-200 pt-2 mt-2">
                  <p className="text-xs text-zinc-500 mb-1">📝 Transcrição:</p>
                  <p className="text-sm text-zinc-700 italic">"{parsed.transcription}"</p>
                </div>
              ) : (
                <p className="text-xs text-zinc-400 italic mt-1">Sem transcrição</p>
              )}
            </div>
          )}
          
          {/* IMAGEM */}
          {parsed.type === 'image' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-zinc-600 mb-2">
                <ImageIcon className="w-4 h-4" />
                <span className="text-sm">Imagem</span>
              </div>
              
              <MessageImage 
                imageUrl={parsed.imageUrl}
                thumbnailUrl={parsed.thumbnailUrl}
              />
            </div>
          )}
          
          {/* VÍDEO */}
          {parsed.type === 'video' && (
            <div className="flex items-center gap-2 text-zinc-600">
              <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center">
                <Video className="w-4 h-4" />
              </div>
              <span className="text-sm">Vídeo enviado</span>
            </div>
          )}
          
          {/* DOCUMENTO */}
          {parsed.type === 'document' && (
            <div className="flex items-center gap-2 text-zinc-600">
              <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
              <span className="text-sm">{parsed.fileName}</span>
            </div>
          )}
          
          {/* DESCONHECIDO */}
          {parsed.type === 'unknown' && (
            <p className="text-sm text-zinc-400 italic">{parsed.text}</p>
          )}
          
          {/* Hora */}
          <p className="text-xs text-zinc-400 text-right mt-2">
            {formatTime(message.sent_at)}
          </p>
        </div>
      </div>
      
      {/* Avatar direita (atendente/bot) */}
      {!isFromClient && (
        <div className="ml-3">
          <SenderIcon />
        </div>
      )}
    </div>
  )
}

// ============================================
// PÁGINA PRINCIPAL
// ============================================

export default async function ConversationPage({ params }: PageProps) {
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

  // Buscar conversa
  const { data: conversation } = await supabase
    .from('conversations')
    .select(`
      id, external_id, status, platform, created_at,
      contacts (id, name, phone, identifier),
      agents (id, name)
    `)
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single()

  if (!conversation) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500">Conversa não encontrada</p>
        <Link href="/conversations" className="text-blue-500 underline">Voltar</Link>
      </div>
    )
  }

  // Buscar mensagens
  const { data: messages } = await supabase
    .from('messages')
    .select(`
      id, external_id, content, content_type, sender_type, 
      from_me, sent_at, metadata, agent_id,
      transcriptions (id, transcription, status)
    `)
    .eq('conversation_id', id)
    .order('sent_at', { ascending: true })

  const contact = conversation.contacts as any
  const agent = conversation.agents as any

  // Agrupar mensagens por data
  const messagesByDate: Record<string, any[]> = {}
  messages?.forEach((msg) => {
    const date = formatDate(msg.sent_at)
    if (!messagesByDate[date]) messagesByDate[date] = []
    messagesByDate[date].push(msg)
  })

  // Contar mensagens por tipo de remetente
  const clientMessages = messages?.filter(m => m.sender_type === 'customer' || m.from_me === false).length || 0
  
  const agentBotMessages = messages?.filter(m => m.from_me === true) || []
  const agentMessages = agentBotMessages.filter(m => {
    const hasAgentId = !!m.agent_id
    const hasAgentName = extractAgentNameFromContent(m.content || '')
    return hasAgentId || hasAgentName
  }).length
  const botMessages = agentBotMessages.length - agentMessages

  return (
    <div className="flex gap-6">
      {/* Coluna principal - Chat */}
      <div className="flex-1 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link 
            href="/conversations" 
            className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-serif font-semibold text-zinc-900">
              {contact?.name || 'Cliente sem nome'}
            </h1>
            <div className="flex items-center gap-2 text-zinc-500">
              <Phone className="w-4 h-4" />
              {contact?.phone || contact?.identifier?.replace('@s.whatsapp.net', '') || 'Sem telefone'}
            </div>
          </div>
          <span className={`px-3 py-1 text-sm rounded-full ${
            conversation.status === 'open' ? 'bg-green-100 text-green-700' :
            conversation.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
            'bg-zinc-100 text-zinc-700'
          }`}>
            {conversation.status}
          </span>
        </div>

        {/* Chat */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-serif">Histórico da Conversa</CardTitle>
            <span className="text-sm text-zinc-500">{messages?.length || 0} mensagens</span>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {Object.entries(messagesByDate).map(([date, msgs]) => (
                <div key={date}>
                  {/* Separador de data */}
                  <div className="flex items-center gap-4 my-4">
                    <div className="flex-1 h-px bg-zinc-200"></div>
                    <span className="text-xs text-zinc-400 flex items-center gap-1">
                      📅 {date}
                    </span>
                    <div className="flex-1 h-px bg-zinc-200"></div>
                  </div>
                  
                  {/* Mensagens do dia */}
                  <div className="space-y-4">
                    {msgs.map((message) => (
                      <MessageBubble 
                        key={message.id} 
                        message={message} 
                        agentFromConversation={agent}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sidebar - Info do cliente */}
      <div className="w-80 space-y-4">
        {/* Card Cliente */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-serif">Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-zinc-500">Nome</p>
              <p className="font-medium">{contact?.name || 'Não informado'}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Telefone</p>
              <p className="font-medium">{contact?.phone || 'Não informado'}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">WhatsApp ID</p>
              <p className="text-sm text-zinc-600 break-all">{contact?.identifier || '-'}</p>
            </div>
          </CardContent>
        </Card>

        {/* Card Conversa */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-serif">Conversa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-zinc-500">Status</p>
              <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                conversation.status === 'open' ? 'bg-green-100 text-green-700' :
                conversation.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                'bg-zinc-100 text-zinc-700'
              }`}>
                {conversation.status}
              </span>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Atendente</p>
              <p className="font-medium">{agent?.name || 'Não atribuído'}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Plataforma</p>
              <p className="font-medium capitalize">{conversation.platform || 'Whatsapp'}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Criada em</p>
              <p className="text-sm">{new Date(conversation.created_at).toLocaleString('pt-BR')}</p>
            </div>
          </CardContent>
        </Card>

        {/* Card Estatísticas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-serif">Estatísticas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-zinc-500">Total de mensagens</span>
              <span className="font-medium">{messages?.length || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-zinc-500 flex items-center gap-1">
                <User className="w-3 h-3 text-blue-500" /> Cliente
              </span>
              <span className="font-medium text-blue-600">{clientMessages}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-zinc-500 flex items-center gap-1">
                <UserCircle className="w-3 h-3 text-green-500" /> Atendente
              </span>
              <span className="font-medium text-green-600">{agentMessages}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-zinc-500 flex items-center gap-1">
                <Bot className="w-3 h-3 text-purple-500" /> Bot
              </span>
              <span className="font-medium text-purple-600">{botMessages}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
