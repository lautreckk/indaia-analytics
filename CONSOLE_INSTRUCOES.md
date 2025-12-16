# Console de Execução - Instruções

## 1. Rodar SQL no Supabase

Execute no SQL Editor do Supabase:

```sql
ALTER TABLE meeting_analyses 
ADD COLUMN IF NOT EXISTS console_logs JSONB DEFAULT '[]';
```

## 2. Adicionar o componente no seu projeto

Copie o arquivo `ExecutionConsole.tsx` para:
`src/components/analysis/ExecutionConsole.tsx`

## 3. Usar na página de resultados

```tsx
import { ExecutionConsole, parseExecutionLogs } from "@/components/analysis/ExecutionConsole"

// Dentro do componente da página de resultados:
export default function ResultsPage({ analysis, isAdmin }) {
  // Parsear os logs
  const consoleLogs = parseExecutionLogs(analysis?.console_logs || [])
  
  return (
    <div>
      {/* Outros componentes... */}
      
      {/* Console só aparece para admin */}
      <ExecutionConsole 
        logs={consoleLogs} 
        isAdmin={isAdmin} 
        className="mt-6"
      />
    </div>
  )
}
```

## 4. Verificar se o usuário é admin

```tsx
// Hook ou função para verificar admin
const { data: profile } = useProfile()
const isAdmin = profile?.role === 'admin'
```

## 5. Estrutura dos logs

Cada log tem:
- `timestamp`: Hora (HH:MM:SS)
- `level`: "info" | "success" | "warning" | "error"
- `message`: Mensagem
- `agent`: Nome do agente (opcional)
- `score`: Nota 0-100 (opcional)
- `time_ms`: Tempo em ms (opcional)

## Exemplo de visualização:

```
[00:00:01] → Iniciando análise da reunião a1b2c3d4...
[00:00:02] → Título: Reunião João e Maria
[00:00:02] → Tipo: casamento | Modelo: gpt-4o
[00:00:02] → Transcrição: 93,390 caracteres
[00:00:03] → Iniciando execução de 8 agentes...
[00:00:18] ✅ [CONSULTOR] Concluído (85/100) 15.2s
[00:00:19] ✅ [CLIENTE] Concluído (72/100) 16.8s
[00:00:22] ⚠️ [PRODUTOS] Concluído (45/100) 19.3s
[00:00:25] ❌ [NEGOCIACAO] Concluído (28/100) 22.1s
...
[00:03:15] ✅ Score Final: 56/100 (REGULAR)
[00:03:15] ✅ Análise concluída em 197.5s | Custo: $0.1438
```
