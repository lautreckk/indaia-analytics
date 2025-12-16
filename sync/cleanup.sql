-- Script de Limpeza - Executar no Supabase SQL Editor ANTES de rodar o sync novamente
-- ATENÇÃO: Isso vai deletar TODOS os dados sincronizados!

-- Deletar mensagens
DELETE FROM messages WHERE tenant_id IS NOT NULL;

-- Deletar conversas
DELETE FROM conversations WHERE tenant_id IS NOT NULL;

-- NÃO deletar contacts e agents - eles serão atualizados pelo upsert
-- Se quiser limpar também (opcional):
-- DELETE FROM contacts WHERE tenant_id IS NOT NULL;
-- DELETE FROM agents WHERE tenant_id IS NOT NULL;

-- Verificar contagens após limpeza
SELECT 
    (SELECT COUNT(*) FROM messages WHERE tenant_id IS NOT NULL) as messages_count,
    (SELECT COUNT(*) FROM conversations WHERE tenant_id IS NOT NULL) as conversations_count,
    (SELECT COUNT(*) FROM contacts WHERE tenant_id IS NOT NULL) as contacts_count,
    (SELECT COUNT(*) FROM agents WHERE tenant_id IS NOT NULL) as agents_count;
