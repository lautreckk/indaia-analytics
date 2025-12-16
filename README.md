# Indaiá Analytics

Sistema de análise de reuniões e conversas com IA para a Indaiá.

## 🚀 Tecnologias

- **Next.js 14** - Framework React
- **TypeScript** - Tipagem estática
- **Supabase** - Banco de dados e autenticação
- **Tailwind CSS** - Estilização
- **Radix UI** - Componentes acessíveis
- **OpenRouter** - Integração com LLMs

## 📋 Pré-requisitos

- Node.js 18+ 
- npm ou yarn
- Conta no Supabase
- Variáveis de ambiente configuradas

## 🔧 Instalação

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env.local
# Editar .env.local com suas credenciais

# Executar em desenvolvimento
npm run dev
```

## 🌐 Deploy no Vercel

1. Conecte este repositório ao Vercel
2. Configure as variáveis de ambiente no painel do Vercel
3. O deploy será feito automaticamente a cada push na branch `main`

## 📝 Variáveis de Ambiente

Consulte `.env.example` para ver todas as variáveis necessárias.

## 📚 Estrutura do Projeto

- `/src/app` - Rotas e páginas (App Router)
- `/src/components` - Componentes React
- `/src/lib` - Utilitários e configurações
- `/src/hooks` - React Hooks customizados
- `/src/types` - Definições TypeScript

## 🔐 Autenticação

O sistema usa Supabase Auth para autenticação de usuários.

## 📊 Funcionalidades

- Análise de reuniões com IA
- Dashboard de métricas
- Análise de conversas
- Material de apoio (RAG)
- Transcrições de áudio/vídeo
- Relatórios e exportação PDF
