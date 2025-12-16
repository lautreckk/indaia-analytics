import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface AtendenteInfo {
  nome: string
  mensagens: number
  score: number
  contexto: string
}

export interface AtendentesData {
  principal: string
  todos: AtendenteInfo[]
}

/**
 * Extrai informações de atendentes do raw_analysis
 * Suporta nova estrutura (array de atendentes) e estrutura antiga (atendente_nome)
 */
export function getAtendentesFromAnalysis(analysis: any): AtendentesData {
  let rawAnalysis: any = {}
  
  try {
    const raw = analysis.raw_analysis
    rawAnalysis = typeof raw === 'string' ? JSON.parse(raw) : raw || {}
  } catch {
    rawAnalysis = {}
  }

  const atendentes = rawAnalysis.atendentes || []

  if (atendentes.length > 0) {
    return {
      principal: rawAnalysis.atendente_principal || atendentes[0]?.nome || 'Não identificado',
      todos: atendentes.map((a: any) => ({
        nome: a.nome || 'Não identificado',
        mensagens: a.mensagens_enviadas || 0,
        score: a.scores?.score_geral || 0,
        contexto: a.contexto || ''
      }))
    }
  }

  // Fallback para estrutura antiga
  return {
    principal: rawAnalysis.atendente_nome || 'Não identificado',
    todos: []
  }
}
