# 🚀 Guia de Deploy no Vercel

## Passo 1: Criar Repositório no GitHub

1. Acesse: https://github.com/new
2. Nome do repositório: `indaia-analytics` (ou outro nome de sua preferência)
3. **NÃO** inicialize com README, .gitignore ou licença (já temos)
4. Clique em "Create repository"

## Passo 2: Conectar Repositório Local ao GitHub

Execute os seguintes comandos no terminal (dentro da pasta `indaia-analytics`):

```bash
# Adicionar remote do GitHub (substitua SEU_USUARIO pelo seu username do GitHub)
git remote add origin https://github.com/SEU_USUARIO/indaia-analytics.git

# Renomear branch para main (se necessário)
git branch -M main

# Fazer push do código
git push -u origin main
```

**Se você ainda não fez login no GitHub via terminal:**
```bash
# Configurar git (se ainda não fez)
git config --global user.name "Seu Nome"
git config --global user.email "seu-email@exemplo.com"
```

## Passo 3: Deploy no Vercel

### Opção A: Via Dashboard do Vercel (Recomendado)

1. Acesse: https://vercel.com/new
2. Faça login com sua conta GitHub
3. Clique em "Import Project"
4. Selecione o repositório `indaia-analytics`
5. Configure o projeto:
   - **Framework Preset**: Next.js (deve detectar automaticamente)
   - **Root Directory**: `./` (raiz do repositório)
   - **Build Command**: `npm run build` (padrão)
   - **Output Directory**: `.next` (padrão)

### Opção B: Via CLI do Vercel

```bash
# Instalar Vercel CLI (se ainda não tem)
npm i -g vercel

# Fazer login
vercel login

# Deploy (dentro da pasta indaia-analytics)
vercel

# Seguir as instruções interativas
```

## Passo 4: Configurar Variáveis de Ambiente no Vercel

Após o deploy inicial, configure as variáveis de ambiente:

1. No dashboard do Vercel, vá em **Settings** → **Environment Variables**
2. Adicione todas as variáveis do seu `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=sua-url-supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
OPENROUTER_API_KEY=sua-chave-openrouter
MODAL_KNOWLEDGE_WEBHOOK_URL=url-do-webhook-modal
```

3. Clique em **Save**
4. Vá em **Deployments** e faça um **Redeploy** para aplicar as variáveis

## Passo 5: Verificar Deploy

1. Após o deploy, você receberá uma URL: `https://seu-projeto.vercel.app`
2. Acesse a URL e verifique se o sistema está funcionando
3. Verifique os logs em **Deployments** → **Functions** se houver erros

## 🔄 Deploys Automáticos

Após configurado, cada push na branch `main` fará deploy automático no Vercel.

Para fazer deploy de outras branches:
- Vercel cria automaticamente preview deployments para cada branch
- Acesse o dashboard para ver os previews

## 🐛 Troubleshooting

### Erro: "Environment variables not found"
- Verifique se todas as variáveis foram adicionadas no Vercel
- Faça um redeploy após adicionar variáveis

### Erro: "Build failed"
- Verifique os logs do build no dashboard do Vercel
- Certifique-se de que `package.json` está correto
- Verifique se todas as dependências estão listadas

### Erro: "Module not found"
- Verifique se `node_modules` está no `.gitignore`
- Certifique-se de que todas as dependências estão em `package.json`

## 📝 Próximos Passos

- [ ] Configurar domínio customizado (opcional)
- [ ] Configurar CI/CD para testes automáticos
- [ ] Configurar monitoramento e analytics

