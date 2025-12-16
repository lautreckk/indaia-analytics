'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Calendar } from 'lucide-react'
import { useState } from 'react'

type PeriodOption = 'current' | 'last' | 'two_months_ago' | 'custom'

interface PeriodFilterProps {
  basePath: string
}

export function PeriodFilter({ basePath }: PeriodFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const currentPeriod = (searchParams.get('period') as PeriodOption) || 'current'
  const customFrom = searchParams.get('from') || ''
  const customTo = searchParams.get('to') || ''
  
  const [showCustom, setShowCustom] = useState(currentPeriod === 'custom')
  const [fromDate, setFromDate] = useState(customFrom)
  const [toDate, setToDate] = useState(customTo)

  const handlePeriodChange = (period: PeriodOption) => {
    if (period === 'custom') {
      setShowCustom(true)
      return
    }
    
    setShowCustom(false)
    const params = new URLSearchParams(searchParams.toString())
    params.set('period', period)
    params.delete('from')
    params.delete('to')
    params.delete('page') // Reset pagination
    router.push(`${basePath}?${params.toString()}`)
  }

  const handleCustomFilter = () => {
    if (!fromDate || !toDate) return
    
    const params = new URLSearchParams(searchParams.toString())
    params.set('period', 'custom')
    params.set('from', fromDate)
    params.set('to', toDate)
    params.delete('page')
    router.push(`${basePath}?${params.toString()}`)
  }

  const clearFilters = () => {
    setShowCustom(false)
    setFromDate('')
    setToDate('')
    router.push(basePath)
  }

  // Helpers para labels
  const now = new Date()
  const months = [
    { value: 'current', label: getMonthLabel(0) },
    { value: 'last', label: getMonthLabel(-1) },
    { value: 'two_months_ago', label: getMonthLabel(-2) },
  ]

  function getMonthLabel(offset: number) {
    const date = new Date(now.getFullYear(), now.getMonth() + offset, 1)
    return date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
  }

  return (
    <div className="space-y-3">
      {/* Botões de período */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-zinc-500 mr-2">Período:</span>
        
        {months.map((month) => (
          <Button
            key={month.value}
            variant={currentPeriod === month.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => handlePeriodChange(month.value as PeriodOption)}
            className={currentPeriod === month.value ? 'bg-primary-600' : ''}
          >
            {month.label}
          </Button>
        ))}
        
        <Button
          variant={currentPeriod === 'custom' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handlePeriodChange('custom')}
          className={currentPeriod === 'custom' ? 'bg-primary-600' : ''}
        >
          <Calendar className="w-4 h-4 mr-1" />
          Personalizado
        </Button>

        {currentPeriod !== 'current' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-zinc-500"
          >
            Limpar
          </Button>
        )}
      </div>

      {/* Campos de data customizada */}
      {showCustom && (
        <div className="flex flex-wrap items-end gap-3 p-4 bg-zinc-50 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Data inicial
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Data final
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <Button 
            onClick={handleCustomFilter}
            disabled={!fromDate || !toDate}
            className="bg-primary-600 hover:bg-primary-700"
          >
            Aplicar
          </Button>
        </div>
      )}
    </div>
  )
}
