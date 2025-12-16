# Setup Modal - Indaiá Analytics

## ✅ Arquivo Criado

O arquivo `modal_jobs.py` foi criado na raiz do projeto.

## 📋 Próximos Passos

### 1. Instalar Modal CLI

```bash
cd indaia-analytics
pip install modal
modal token new
```

Isso vai abrir o browser para autenticar. Faça login/cadastro no Modal.

### 2. Criar Secret no Modal Dashboard

1. Acesse: https://modal.com/secrets
2. Clique em "Create new secret"
3. Nome: `indaia-secrets`
4. Adicione as variáveis (Environment variables):

```
NEON_HOST=ep-lucky-grass-ac8uxskn-pooler.sa-east-1.aws.neon.tech
NEON_DATABASE=neondb
NEON_USER=neondb_owner
NEON_PASSWORD=npg_9kXlTHrn7Lqx
SUPABASE_URL=<PEGAR_NO_SUPABASE>
SUPABASE_SERVICE_KEY=<PEGAR_NO_SUPABASE>
GROQ_API_KEY=<PEGAR_NO_GROQ>
```

**Para pegar o SUPABASE_SERVICE_KEY:**
- Supabase Dashboard → Settings → API → service_role (secret)
- Copie a chave completa

### 3. Testar Localmente

```bash
cd indaia-analytics
modal run modal_jobs.py
```

Deve mostrar:
```
🚀 Executando job manualmente...
🔄 Iniciando sync incremental...
   ✅ X mensagens sincronizadas
🎤 Iniciando transcrição de áudios...
   ✅ X áudios transcritos
```

### 4. Deploy (ativa o CRON automático)

```bash
modal deploy modal_jobs.py
```

Isso vai:
1. Fazer deploy do app no Modal
2. Ativar o CRON para rodar a cada 1 minuto
3. Você pode ver os logs em: https://modal.com/apps/indaia-analytics

### 5. Verificar Logs

```bash
# Ver logs em tempo real
modal logs indaia-analytics
```

Ou acesse o dashboard: https://modal.com/apps

## 📊 O que o Job Faz

### Sync Incremental (`sync_new_messages`)
- Busca mensagens novas do Neon (após último ID sincronizado)
- Sincroniza até 1000 mensagens por execução
- Salva log em `sync_logs` para rastreamento

### Transcrição de Áudios (`transcribe_pending_audios`)
- Busca mensagens de áudio sem transcrição
- Processa até 10 áudios por execução
- Usa Groq Whisper Large V3
- Salva transcrição em `messages.metadata` e `transcriptions`

### Job Principal (`sync_and_transcribe`)
- Roda a cada 1 minuto (CRON)
- Executa sync + transcrição em sequência
- Retorna métricas de sucesso

## 💰 Custos Estimados

| Item | Custo/mês |
|------|-----------|
| Modal (execução) | ~$2 |
| Groq Whisper | ~$3 |
| **Total** | **~$5/mês** |

## 🔧 Troubleshooting

### Erro: Secret não encontrado
- Verifique se o secret `indaia-secrets` foi criado no Modal Dashboard
- Confirme que todas as variáveis estão corretas

### Erro: Timeout
- O sync tem timeout de 5 minutos
- A transcrição tem timeout de 10 minutos
- Se der timeout, verifique os logs para identificar o problema

### Mensagens não sincronizando
- Verifique se o `last_synced_id` está sendo atualizado em `sync_logs`
- Confirme que as credenciais do Neon estão corretas
