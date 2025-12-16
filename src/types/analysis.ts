export interface ConversationAnalysis {
  id: string
  conversation_id: string
  tenant_id: string
  tipo_evento: 'casamento' | '15_anos' | 'outro' | null
  
  total_messages: number
  customer_messages: number
  agent_messages: number
  bot_messages: number
  
  avg_response_time_seconds: number
  max_response_time_seconds: number
  
  script_adherence_score: number
  overall_score: number
  personalization_score: number
  
  etapas_cumpridas: Record<string, boolean>
  errors_detected: AnalysisError[]
  errors_count: Record<string, number>
  
  customer_sentiment_label: 'positivo' | 'neutro' | 'negativo'
  agent_sentiment_label: 'positivo' | 'neutro' | 'negativo'
  
  cliente_parou_responder: boolean
  ultima_etapa_cliente: number | null
  agendamento_realizado: boolean
  
  summary: string
  positive_points: string[]
  improvement_points: string[]
  raw_analysis: any
  
  model_used: string
  analyzed_at: string
}

export interface AnalysisError {
  tipo: string
  severidade: 'alta' | 'media' | 'baixa'
  descricao: string
  evidencia: string
  etapa_relacionada?: number | null
}

// ============================================
// COORDENADOR MAX - Types
// ============================================

export interface ModuloResult {
  nota: number
  estrelas: string
  comentario: string
  pontos_fortes: string[]
  pontos_melhoria: string[]
}

export interface Recommendation {
  id?: string
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  impact?: 'high' | 'medium' | 'low'
  category: string
  tecnica_faltante?: string
  script_sugerido?: string
  diagnostico?: string
  cura?: string
  expected_impact?: string
}

export interface CoordinatorResult {
  final_score: number
  classification: 'EXCELENTE' | 'BOM' | 'REGULAR' | 'FRACO' | 'CRÍTICO'
  analysis_summary?: string
  
  header?: {
    vendedor: string
    cliente: string
    data: string
    hora?: string
    duracao_minutos?: number
    status: string
  }
  
  resumo_estrategico: string
  sugestao_fechamento: string | {
    diagnostico_geral?: string;
    cura_geral?: string;
    scripts?: Array<{ momento?: string; script?: string }>;
  }
  
  notas_gerais?: {
    media_modulos: number
    nota_negociacao: number
    indicador_final: number
    observacao_media?: string
    observacao_negociacao?: string
    observacao_final?: string
  }
  
  modulos: Record<string, ModuloResult>
  
  recommendations: Recommendation[]
  
  contract_analysis?: {
    fechou: boolean
    valor_final?: number
    forma_pagamento?: string
    tecnica_fechamento_usada?: string
  }
  
  warnings?: string[]
  
  _coordinator_metadata?: {
    processing_time: number
    tokens_used: number
    model: string
    agents_consolidated: number
  }
  
  _fallback?: boolean
}
