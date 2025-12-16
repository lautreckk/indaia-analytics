# Sync Neon → Supabase

Scripts para sincronizar dados do banco Neon (Chatwoot) para o Supabase.

## Setup

### 1. Criar ambiente virtual

```bash
cd sync
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou: venv\Scripts\activate  # Windows
```

### 2. Instalar dependências

```bash
pip install -r requirements.txt
```

### 3. Configurar variáveis de ambiente

Copie o arquivo `.env.example` para `.env`:

```bash
cp .env.example .env
```

Edite o arquivo `.env` e adicione a **Service Role Key** do Supabase:

- Acesse: Supabase Dashboard → Settings → API
- Copie a chave **service_role** (NÃO a anon key!)
- Cole no arquivo `.env` na variável `SUPABASE_SERVICE_KEY`

## Uso

### Diagnóstico do Banco (opcional)

Antes de rodar o sync, você pode verificar a estrutura real das tabelas:

**Versão completa (recomendada):**
```bash
python diagnose_neon_v2.py
```

Este script mostra:
- **TODAS** as tabelas do banco com contagem
- Identifica tabelas relevantes automaticamente
- Detalhes completos das tabelas encontradas
- Busca por tabelas com áudio/mídia
- Lista views disponíveis

**Versão básica:**
```bash
python diagnose_neon.py
```

**Use o v2 se encontrar erros ou se não souber quais tabelas existem!**

### Sync Inicial (uma vez)

Sincroniza todos os dados históricos de Novembro/2025 em diante:

```bash
python sync_initial.py
```

O script vai:
- ✅ Sincronizar atendentes (users)
- ✅ Sincronizar contatos
- ✅ Sincronizar conversas (desde 01/11/2025)
- ✅ Sincronizar mensagens dessas conversas

**Tempo estimado:** 5-10 minutos dependendo do volume

### Verificar Sincronização

Após rodar o sync, verifique se os dados foram sincronizados corretamente:

```bash
python verify_sync.py
```

O script compara:
- Contagens de atendentes, contatos, conversas
- Integridade referencial (conversas sem contato, etc.)

## Estrutura

```
sync/
├── requirements.txt          # Dependências Python
├── .env                      # Variáveis de ambiente (não commitado)
├── env.template             # Template de configuração
├── cleanup.sql              # SQL para limpar dados antes de re-sync
├── diagnose_neon.py          # Script de diagnóstico básico
├── diagnose_neon_v2.py      # Script de diagnóstico completo (recomendado)
├── sync_initial.py           # Script de sync inicial
├── verify_sync.py            # Script de verificação
└── utils/
    ├── __init__.py
    ├── neon.py               # Conexão e queries Neon
    ├── supabase.py           # Conexão e upserts Supabase (com paginação)
    └── transformers.py       # Transformadores de dados
```

## Próximos Passos

1. ✅ Rodar sync inicial
2. ✅ Verificar dados sincronizados
3. 🔜 Criar sync incremental (Modal + CRON)
4. 🔜 Implementar transcrição de áudios

## Troubleshooting

### Erro de conexão Neon

Verifique se as credenciais no `.env` estão corretas.

### Erro de permissão Supabase

Certifique-se de estar usando a **Service Role Key** (não a anon key).

### Erro de coluna não encontrada

Se o script der erro sobre colunas que não existem, rode o diagnóstico completo:

```bash
python diagnose_neon_v2.py
```

Isso vai mostrar:
- Todas as tabelas do banco
- Estrutura real das tabelas relevantes
- Exemplos de dados

**Envie o output completo para ajustar o script!**

### Limite de 1000 linhas do Supabase

**IMPORTANTE:** O Supabase retorna no máximo 1000 linhas por query por padrão. 

O script foi corrigido para usar paginação automática nos mapas de IDs. Se você rodou o sync antes da correção e viu apenas 1000 contatos/conversas mapeados, você precisa:

1. **Limpar os dados antigos** (opcional, mas recomendado):
   - Execute o SQL em `cleanup.sql` no Supabase SQL Editor
   - Ou delete manualmente: `DELETE FROM messages; DELETE FROM conversations;`

2. **Rodar o sync novamente**:
   ```bash
   python sync_initial.py
   ```

Agora os mapas vão buscar **TODOS** os registros usando paginação automática.

### Timeout ao sincronizar mensagens

O script processa em batches. Se der timeout, rode novamente - ele usa `upsert` então não vai duplicar dados.
