'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CalendarIcon } from 'lucide-react'
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { DateRange } from 'react-day-picker'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface DateRangePickerProps {
  basePath: string
  className?: string
}

const presets = [
  { label: 'Últimos 7 dias', days: 7 },
  { label: 'Últimos 14 dias', days: 14 },
  { label: 'Últimos 30 dias', days: 30 },
  { label: 'Mês atual', days: 'month' },
]

export function DateRangePicker({ basePath, className }: DateRangePickerProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Ler datas da URL
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')
  
  // Estado inicial baseado nos params ou mês atual
  const getInitialRange = (): DateRange => {
    if (fromParam && toParam) {
      return {
        from: new Date(fromParam),
        to: new Date(toParam),
      }
    }
    // Padrão: mês atual
    const now = new Date()
    return {
      from: startOfMonth(now),
      to: endOfMonth(now),
    }
  }
  
  const [date, setDate] = React.useState<DateRange | undefined>(getInitialRange())
  const [open, setOpen] = React.useState(false)

  // Aplicar filtro
  const applyFilter = (range: DateRange | undefined) => {
    if (!range?.from || !range?.to) return
    
    const params = new URLSearchParams(searchParams.toString())
    params.set('from', format(range.from, 'yyyy-MM-dd'))
    params.set('to', format(range.to, 'yyyy-MM-dd'))
    params.delete('page') // Reset pagination
    
    router.push(`${basePath}?${params.toString()}`)
    setOpen(false)
  }

  // Aplicar preset
  const applyPreset = (preset: typeof presets[0]) => {
    const now = new Date()
    let from: Date
    let to: Date
    
    if (preset.days === 'month') {
      from = startOfMonth(now)
      to = endOfMonth(now)
    } else {
      from = subDays(now, preset.days as number)
      to = now
    }
    
    const newRange = { from, to }
    setDate(newRange)
    applyFilter(newRange)
  }

  // Limpar filtro (voltar ao mês atual)
  const clearFilter = () => {
    const now = new Date()
    const newRange = {
      from: startOfMonth(now),
      to: endOfMonth(now),
    }
    setDate(newRange)
    
    const params = new URLSearchParams()
    params.set('from', format(newRange.from, 'yyyy-MM-dd'))
    params.set('to', format(newRange.to, 'yyyy-MM-dd'))
    
    router.push(`${basePath}?${params.toString()}`)
    setOpen(false)
  }

  // Formatar label do botão
  const getButtonLabel = () => {
    if (!date?.from) return 'Selecionar período'
    
    if (date.to) {
      return `${format(date.from, 'dd MMM', { locale: ptBR })} - ${format(date.to, 'dd MMM yyyy', { locale: ptBR })}`
    }
    
    return format(date.from, 'dd MMM yyyy', { locale: ptBR })
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className="text-sm text-zinc-500">Período:</span>
      
      {/* Botões de preset */}
      {presets.map((preset) => (
        <Button
          key={preset.label}
          variant="outline"
          size="sm"
          onClick={() => applyPreset(preset)}
          className="hidden sm:inline-flex"
        >
          {preset.label}
        </Button>
      ))}
      
      {/* Date Range Picker */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'justify-start text-left font-normal min-w-[240px]',
              !date && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {getButtonLabel()}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start" sideOffset={4}>
          <div className="flex">
            {/* Presets sidebar (mobile friendly) */}
            <div className="border-r p-2 space-y-1 hidden sm:block min-w-[140px]">
              <p className="text-xs font-medium text-zinc-500 px-2 py-1">Atalhos</p>
              {presets.map((preset) => (
                <Button
                  key={preset.label}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-sm"
                  onClick={() => applyPreset(preset)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            
            {/* Calendar */}
            <div className="p-2">
              <Calendar
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={setDate}
                numberOfMonths={2}
                locale={ptBR}
                captionLayout="dropdown"
                fromYear={2024}
                toYear={2030}
              />
              
              {/* Actions */}
              <div className="flex items-center justify-between border-t pt-3 mt-3 px-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilter}
                >
                  Limpar
                </Button>
                <Button
                  size="sm"
                  onClick={() => applyFilter(date)}
                  disabled={!date?.from || !date?.to}
                  className="bg-primary-600 hover:bg-primary-700"
                >
                  Aplicar
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
