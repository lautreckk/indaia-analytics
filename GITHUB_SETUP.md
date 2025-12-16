# 📦 Configuração do Repositório GitHub

## ✅ Status Atual

- ✅ Repositório Git inicializado
- ✅ Commit inicial criado
- ✅ Arquivos preparados

## 🚀 Próximos Passos

### 1. Criar Repositório no GitHub

1. Acesse: **https://github.com/new**
2. Preencha:
   - **Repository name**: `indaia-analytics`
   - **Description**: `Sistema de análise de reuniões e conversas com IA para a Indaiá`
   - **Visibility**: Private (recomendado) ou Public
   - **⚠️ NÃO marque**: "Add a README file", "Add .gitignore", ou "Choose a license"
3. Clique em **"Create repository"**

### 2. Conectar Repositório Local ao GitHub

Execute estes comandos no terminal (dentro da pasta `indaia-analytics`):

```bash
# Substitua SEU_USUARIO pelo seu username do GitHub
git remote add origin https://github.com/SEU_USUARIO/indaia-analytics.git

# Renomear branch para main (se necessário)
git branch -M main

# Fazer push do código
git push -u origin main
```

**Exemplo:**
```bash
git remote add origin https://github.com/lautreck/indaia-analytics.git
git branch -M main
git push -u origin main
```

### 3. Se pedir autenticação

Se o GitHub pedir usuário/senha, você pode:

**Opção A: Usar Personal Access Token (Recomendado)**
1. Vá em: https://github.com/settings/tokens
2. Clique em "Generate new token (classic)"
3. Dê um nome (ex: "Vercel Deploy")
4. Selecione escopo: `repo` (acesso completo aos repositórios)
5. Clique em "Generate token"
6. **Copie o token** (você não verá novamente!)
7. Use o token como senha quando o git pedir

**Opção B: Usar GitHub CLI**
```bash
# Instalar GitHub CLI (se não tiver)
brew install gh

# Fazer login
gh auth login

# Depois fazer push normalmente
git push -u origin main
```

### 4. Verificar

Após o push, acesse seu repositório no GitHub:
```
https://github.com/SEU_USUARIO/indaia-analytics
```

Você deve ver todos os arquivos do projeto lá!

## 🔄 Comandos Úteis

```bash
# Ver status do repositório
git status

# Ver commits
git log --oneline

# Adicionar mudanças e fazer commit
git add .
git commit -m "Descrição das mudanças"
git push

# Ver remote configurado
git remote -v
```

## 📝 Próximo: Deploy no Vercel

Após o repositório estar no GitHub, siga o guia em `DEPLOY_VERCEL.md` para fazer o deploy no Vercel.

