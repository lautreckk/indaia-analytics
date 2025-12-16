'use client'

import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { X, Search } from 'lucide-react'

export interface AnalysisFilters {
  search: string
  atendente: string
  tipoEvento: string
  faixaScore: string
  agendamento: string
  dataInicio: string | null
  dataFim: string | null
}

interface AnalysisFiltersProps {
  atendentes: string[]
  filters: AnalysisFilters
  onFilterChange: (filters: AnalysisFilters) => void
  onClearFilters: () => void
}

export function AnalysisFilters({ 
  atendentes, 
  filters, 
  onFilterChange, 
  onClearFilters 
}: AnalysisFiltersProps) {
  
  const updateFilter = (key: keyof AnalysisFilters, value: any) => {
    onFilterChange({ ...filters, [key]: value })
  }

  const hasActiveFilters = 
    filters.search !== '' ||
    filters.atendente !== 'todos' ||
    filters.tipoEvento !== 'todos' ||
    filters.faixaScore !== 'todos' ||
    filters.agendamento !== 'todos' ||
    filters.dataInicio !== null ||
    filters.dataFim !== null

  return (
    <Card className="p-4">
      <div className="space-y-4">
        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            placeholder="Buscar por cliente, telefone ou resumo..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Linha de filtros */}
        <div className="flex flex-wrap gap-3">
          {/* Atendente */}
          <Select 
            value={filters.atendente} 
            onValueChange={(v) => updateFilter('atendente', v)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Atendente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Atendentes</SelectItem>
              {atendentes.map(a => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Tipo Evento */}
          <Select 
            value={filters.tipoEvento} 
            onValueChange={(v) => updateFilter('tipoEvento', v)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Tipos</SelectItem>
              <SelectItem value="casamento">Casamento</SelectItem>
              <SelectItem value="15_anos">15 Anos</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
              <SelectItem value="nao_identificado">Não Identificado</SelectItem>
            </SelectContent>
          </Select>

          {/* Score */}
          <Select 
            value={filters.faixaScore} 
            onValueChange={(v) => updateFilter('faixaScore', v)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Score" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Scores</SelectItem>
              <SelectItem value="excelente">🟢 Excelente (80+)</SelectItem>
              <SelectItem value="bom">🟡 Bom (60-79)</SelectItem>
              <SelectItem value="regular">🟠 Regular (40-59)</SelectItem>
              <SelectItem value="ruim">🔴 Ruim (0-39)</SelectItem>
            </SelectContent>
          </Select>

          {/* Agendamento */}
          <Select 
            value={filters.agendamento} 
            onValueChange={(v) => updateFilter('agendamento', v)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Agendamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="agendado">✅ Agendou</SelectItem>
              <SelectItem value="nao_agendado">❌ Não Agendou</SelectItem>
            </SelectContent>
          </Select>

          {/* Botão Limpar */}
          {hasActiveFilters && (
            <Button variant="outline" onClick={onClearFilters}>
              <X className="h-4 w-4 mr-1" />
              Limpar Filtros
            </Button>
          )}
        </div>

        {/* Filtros de Data */}
        <div className="flex gap-3 items-center">
          <div className="flex-1">
            <label className="text-sm text-zinc-600 mb-1 block">Data Início</label>
            <Input
              type="date"
              value={filters.dataInicio || ''}
              onChange={(e) => updateFilter('dataInicio', e.target.value || null)}
            />
          </div>
          <div className="flex-1">
            <label className="text-sm text-zinc-600 mb-1 block">Data Fim</label>
            <Input
              type="date"
              value={filters.dataFim || ''}
              onChange={(e) => updateFilter('dataFim', e.target.value || null)}
            />
          </div>
        </div>
      </div>
    </Card>
  )
}
