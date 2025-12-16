#!/usr/bin/env python3
"""
Sync Inicial - Neon → Supabase

Executa uma vez para popular o banco com dados de Novembro/2025.
"""

from datetime import datetime
from tqdm import tqdm

from utils.neon import (
    get_neon_connection,
    fetch_users,
    fetch_leads,
    fetch_conversations,
    fetch_messages_count
)
from utils.supabase import (
    get_supabase_client,
    get_tenant_id,
    upsert_agents,
    upsert_contacts,
    upsert_conversations,
    get_contact_uuid_map,
    get_agent_uuid_map,
    get_conversation_uuid_map,
    insert_messages_batch
)


def main():
    print("=" * 60)
    print("🔄 SYNC INICIAL - Neon → Supabase")
    print("=" * 60)
    
    # Configuração: puxar dados de novembro/2025
    start_date = datetime(2025, 11, 1)
    print(f"\n📅 Período: {start_date.strftime('%d/%m/%Y')} em diante")
    
    # Conectar aos bancos
    print("\n🔌 Conectando aos bancos...")
    neon = get_neon_connection()
    supabase = get_supabase_client()
    tenant_id = get_tenant_id(supabase)
    print(f"   ✅ Neon conectado")
    print(f"   ✅ Supabase conectado (tenant: {tenant_id[:8]}...)")
    
    # 1. Sincronizar Atendentes (users → agents)
    print("\n👤 Sincronizando atendentes...")
    users = fetch_users(neon)
    print(f"   📥 {len(users)} atendentes encontrados no Neon")
    upsert_agents(supabase, tenant_id, users)
    print(f"   ✅ Atendentes sincronizados")
    
    # 2. Sincronizar Contatos (leads → contacts)
    print("\n📇 Sincronizando contatos (leads)...")
    leads = fetch_leads(neon)
    print(f"   📥 {len(leads)} leads encontrados no Neon")
    
    batch_size = 500
    for i in tqdm(range(0, len(leads), batch_size), desc="   Inserindo"):
        batch = leads[i:i+batch_size]
        upsert_contacts(supabase, tenant_id, batch)
    print(f"   ✅ Contatos sincronizados")
    
    # Criar mapas de IDs (COMPLETOS, sem limite de 1000)
    print("\n🗺️  Criando mapas de IDs (buscando TODOS)...")
    contact_map = get_contact_uuid_map(supabase, tenant_id)
    agent_map = get_agent_uuid_map(supabase, tenant_id)
    print(f"   ✅ {len(contact_map):,} contatos mapeados")
    print(f"   ✅ {len(agent_map)} atendentes mapeados")
    
    # 3. Sincronizar Conversas
    print("\n💬 Sincronizando conversas...")
    conversations = fetch_conversations(neon, start_date=start_date)
    print(f"   📥 {len(conversations)} conversas encontradas (desde {start_date.strftime('%d/%m/%Y')})")
    
    batch_size = 500
    for i in tqdm(range(0, len(conversations), batch_size), desc="   Inserindo"):
        batch = conversations[i:i+batch_size]
        upsert_conversations(supabase, tenant_id, batch, contact_map, agent_map)
    print(f"   ✅ Conversas sincronizadas")
    
    # Criar mapa de conversas (COMPLETO)
    print("\n🗺️  Criando mapa de conversas (buscando TODAS)...")
    conv_map = get_conversation_uuid_map(supabase, tenant_id)
    print(f"   ✅ {len(conv_map):,} conversas mapeadas")
    
    # 4. Sincronizar Mensagens
    print("\n📨 Sincronizando mensagens...")
    
    # Contar total para progress bar
    total_msg = fetch_messages_count(neon, start_date=start_date)
    print(f"   📊 {total_msg:,} mensagens para sincronizar")
    
    # Buscar e inserir em chunks
    chunk_size = 5000
    offset = 0
    total_synced = 0
    total_skipped = 0
    
    with tqdm(total=total_msg, desc="   Sincronizando") as pbar:
        while True:
            # Buscar chunk de mensagens
            query = f"""
                SELECT 
                    id, external_id, conversation_id, lead_id, user_id,
                    inbox_id, content, content_type, from_me, status,
                    sent_at, transcricao, platform, created_at
                FROM messages
                WHERE created_at >= %s
                ORDER BY id
                LIMIT {chunk_size} OFFSET {offset}
            """
            
            with neon.cursor() as cur:
                cur.execute(query, (start_date,))
                messages = cur.fetchall()
            
            if not messages:
                break
            
            # Inserir no Supabase
            count, skipped = insert_messages_batch(
                supabase, tenant_id, messages,
                conv_map, contact_map, agent_map
            )
            
            total_synced += count
            total_skipped += skipped
            pbar.update(len(messages))
            offset += chunk_size
    
    print(f"   ✅ {total_synced:,} mensagens sincronizadas")
    if total_skipped > 0:
        print(f"   ⚠️  {total_skipped:,} mensagens ignoradas (conversa não encontrada)")
    
    # 5. Resumo final
    print("\n" + "=" * 60)
    print("✅ SYNC INICIAL COMPLETO!")
    print("=" * 60)
    print(f"""
📊 Resumo:

   - Atendentes: {len(users)}
   - Contatos: {len(leads):,} (mapeados: {len(contact_map):,})
   - Conversas: {len(conversations):,} (mapeadas: {len(conv_map):,})
   - Mensagens: {total_synced:,}

   
📅 Período sincronizado: {start_date.strftime('%d/%m/%Y')} - hoje


🔜 Próximos passos:

   1. Verificar dados no Supabase Dashboard
   2. Testar o frontend
   3. Configurar sync incremental no Modal
    """)
    
    neon.close()


if __name__ == '__main__':
    main()
