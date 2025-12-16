# 🔧 Como Configurar MODAL_KNOWLEDGE_WEBHOOK_URL

Este guia explica como configurar a variável de ambiente `MODAL_KNOWLEDGE_WEBHOOK_URL` no Next.js para processar documentos do Material de Apoio.

## 📋 Pré-requisitos

1. **Fazer deploy do Modal worker:**
   ```bash
   cd indaia-reunioes
   modal deploy modal_knowledge_worker.py
   ```

2. **Obter a URL do webhook:**
   - Após o deploy, acesse: https://modal.com/apps/indaia-knowledge-worker
   - Clique na função `process_single_document`
   - Copie a URL do webhook (formato: `https://<workspace>--indaia-knowledge-worker-process-single-document.modal.run`)

## 🏠 Desenvolvimento Local

### 1. Criar arquivo `.env.local`

Na raiz do projeto `indaia-analytics`, crie o arquivo `.env.local`:

```bash
cd indaia-analytics
touch .env.local
```

### 2. Adicionar a variável

Abra o arquivo `.env.local` e adicione:

```env
MODAL_KNOWLEDGE_WEBHOOK_URL=https://seu-workspace--indaia-knowledge-worker-process-single-document.modal.run
```

**⚠️ IMPORTANTE:** Substitua `seu-workspace` pela URL real do seu webhook do Modal.

### 3. Reiniciar o servidor de desenvolvimento

```bash
# Parar o servidor (Ctrl+C)
# Depois iniciar novamente
npm run dev
```

## 🚀 Produção (Vercel)

### Opção 1: Via Dashboard do Vercel

1. Acesse: https://vercel.com/dashboard
2. Selecione seu projeto `indaia-analytics`
3. Vá em **Settings** → **Environment Variables**
4. Clique em **Add New**
5. Preencha:
   - **Key:** `MODAL_KNOWLEDGE_WEBHOOK_URL`
   - **Value:** `https://seu-workspace--indaia-knowledge-worker-process-single-document.modal.run`
   - **Environment:** Selecione `Production`, `Preview` e `Development` (ou apenas Production)
6. Clique em **Save**
7. Faça um novo deploy para aplicar as mudanças

### Opção 2: Via CLI do Vercel

```bash
cd indaia-analytics
vercel env add MODAL_KNOWLEDGE_WEBHOOK_URL
# Cole a URL do webhook quando solicitado
# Selecione os ambientes (Production, Preview, Development)
```

## 🔍 Verificar se está funcionando

### 1. Verificar variável no código

A variável está sendo usada em:
```typescript
// indaia-analytics/src/app/api/material-apoio/upload/route.ts
const modalWebhookUrl = process.env.MODAL_KNOWLEDGE_WEBHOOK_URL;
```

### 2. Testar localmente

1. Faça upload de um PDF no Material de Apoio
2. Verifique os logs do servidor Next.js:
   ```bash
   npm run dev
   ```
3. Se a URL estiver configurada, você verá uma chamada HTTP para o Modal
4. Se não estiver configurada, verá um aviso no console

### 3. Verificar processamento

1. Após o upload, o documento deve mudar de "Processando" para "Completo" em alguns segundos
2. Se não processar imediatamente, o cron job do Modal processará em até 1 minuto

## 🐛 Troubleshooting

### Problema: Documento fica "Processando" infinitamente

**Soluções:**

1. **Verificar se a URL do webhook está correta:**
   ```bash
   # No terminal do Next.js, adicione um log temporário:
   console.log('Modal URL:', process.env.MODAL_KNOWLEDGE_WEBHOOK_URL);
   ```

2. **Verificar se o Modal está deployado:**
   ```bash
   cd indaia-reunioes
   modal app list
   # Deve mostrar "indaia-knowledge-worker"
   ```

3. **Verificar logs do Modal:**
   ```bash
   modal logs indaia-knowledge-worker
   ```

4. **Testar webhook manualmente:**
   ```bash
   curl -X POST https://seu-workspace--indaia-knowledge-worker-process-single-document.modal.run \
     -H "Content-Type: application/json" \
     -d '{"document_id": "seu-document-id-aqui"}'
   ```

### Problema: Variável não está disponível

**Soluções:**

1. **No Next.js, variáveis sem `NEXT_PUBLIC_` só estão disponíveis no servidor:**
   - ✅ Correto: `process.env.MODAL_KNOWLEDGE_WEBHOOK_URL` (em API routes)
   - ❌ Errado: Tentar usar no cliente (browser)

2. **Reiniciar servidor após adicionar variável:**
   - Variáveis de ambiente são carregadas apenas na inicialização

3. **Verificar se o arquivo `.env.local` está na raiz do projeto:**
   ```bash
   ls -la indaia-analytics/.env.local
   ```

## 📝 Notas Importantes

- **Segurança:** A URL do webhook do Modal não precisa ser secreta, mas é recomendado não commitá-la no Git
- **Fallback:** Se a URL não estiver configurada, o sistema ainda funciona via cron job (processa em até 1 minuto)
- **Ambientes:** Configure a variável em todos os ambientes (Development, Preview, Production) se necessário

## ✅ Checklist

- [ ] Deploy do Modal worker feito (`modal deploy modal_knowledge_worker.py`)
- [ ] URL do webhook copiada do dashboard do Modal
- [ ] Arquivo `.env.local` criado com a variável (desenvolvimento)
- [ ] Variável adicionada no Vercel (produção)
- [ ] Servidor reiniciado (desenvolvimento)
- [ ] Novo deploy feito (produção)
- [ ] Teste de upload realizado
- [ ] Documento processado com sucesso

