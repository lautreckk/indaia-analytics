import { startOfMonth, endOfMonth, format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function getPeriodDates(fromParam?: string | null, toParam?: string | null) {
  // Se tem params, usar
  if (fromParam && toParam) {
    const from = parseISO(fromParam)
    const to = parseISO(toParam)
    // Ajustar horário para incluir dia todo
    from.setHours(0, 0, 0, 0)
    to.setHours(23, 59, 59, 999)
    return {
      startISO: from.toISOString(),
      endISO: to.toISOString(),
    }
  }
  
  // Padrão: mês atual
  const now = new Date()
  const start = startOfMonth(now)
  const end = endOfMonth(now)
  end.setHours(23, 59, 59, 999)
  
  return {
    startISO: start.toISOString(),
    endISO: end.toISOString(),
  }
}

export function getPeriodLabel(fromParam?: string | null, toParam?: string | null) {
  if (fromParam && toParam) {
    const from = parseISO(fromParam)
    const to = parseISO(toParam)
    return `${format(from, 'dd/MM', { locale: ptBR })} - ${format(to, 'dd/MM/yyyy', { locale: ptBR })}`
  }
  
  const now = new Date()
  return format(now, "MMMM 'de' yyyy", { locale: ptBR })
}
