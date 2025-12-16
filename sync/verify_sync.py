#!/usr/bin/env python3
"""
Script de Verificação - Verifica se os dados foram sincronizados corretamente.

Compara contagens entre Neon e Supabase.
"""

from utils.neon import get_neon_connection, fetch_users, fetch_leads, fetch_conversations
from utils.supabase import get_supabase_client, get_tenant_id
from datetime import datetime

def main():
    print("=" * 60)
    print("🔍 VERIFICAÇÃO DE SINCRONIZAÇÃO")
    print("=" * 60)
    
    # Conectar aos bancos
    print("\n🔌 Conectando aos bancos...")
    neon = get_neon_connection()
    supabase = get_supabase_client()
    tenant_id = get_tenant_id(supabase)
    print(f"   ✅ Neon conectado")
    print(f"   ✅ Supabase conectado (tenant: {tenant_id[:8]}...)")
    
    # Data de início (mesma do sync)
    start_date = datetime(2025, 11, 1)
    
    print("\n" + "=" * 60)
    print("📊 COMPARAÇÃO DE DADOS")
    print("=" * 60)
    
    # 1. Atendentes
    print("\n👤 ATENDENTES:")
    neon_users = fetch_users(neon)
    supabase_agents = supabase.table('agents').select('id', count='exact').eq('tenant_id', tenant_id).execute()
    
    print(f"   Neon:      {len(neon_users)} atendentes")
    print(f"   Supabase:  {supabase_agents.count} atendentes")
    
    if len(neon_users) == supabase_agents.count:
        print("   ✅ Contagem OK")
    else:
        print(f"   ⚠️  Diferença: {abs(len(neon_users) - supabase_agents.count)}")
    
    # 2. Contatos (leads)
    print("\n📇 CONTATOS (leads):")
    neon_leads = fetch_leads(neon)
    supabase_contacts = supabase.table('contacts').select('id', count='exact').eq('tenant_id', tenant_id).execute()
    
    print(f"   Neon:      {len(neon_leads)} leads")
    print(f"   Supabase:  {supabase_contacts.count} contatos")
    
    if len(neon_leads) == supabase_contacts.count:
        print("   ✅ Contagem OK")
    else:
        print(f"   ⚠️  Diferença: {abs(len(neon_leads) - supabase_contacts.count)}")
    
    # 3. Conversas
    print("\n💬 CONVERSAS (desde 01/11/2025):")
    neon_conversations = fetch_conversations(neon, start_date=start_date)
    supabase_conversations = supabase.table('conversations').select('id', count='exact').eq('tenant_id', tenant_id).gte('created_at', start_date.isoformat()).execute()
    
    print(f"   Neon:      {len(neon_conversations)} conversas")
    print(f"   Supabase:  {supabase_conversations.count} conversas")
    
    if len(neon_conversations) == supabase_conversations.count:
        print("   ✅ Contagem OK")
    else:
        print(f"   ⚠️  Diferença: {abs(len(neon_conversations) - supabase_conversations.count)}")
    
    # 4. Mensagens
    print("\n📨 MENSAGENS:")
    # Contar mensagens no Supabase
    supabase_messages = supabase.table('messages').select('id', count='exact').eq('tenant_id', tenant_id).gte('created_at', start_date.isoformat()).execute()
    
    print(f"   Supabase:  {supabase_messages.count} mensagens")
    
    # Estimar do Neon (buscar algumas conversas e contar)
    if neon_conversations:
        sample_size = min(10, len(neon_conversations))
        sample_ids = [c['id'] for c in neon_conversations[:sample_size]]
        
        from utils.neon import fetch_messages
        sample_messages = fetch_messages(neon, conversation_ids=sample_ids)
        avg_messages_per_conv = len(sample_messages) / sample_size if sample_size > 0 else 0
        estimated_neon = int(avg_messages_per_conv * len(neon_conversations))
        
        print(f"   Neon (estimado): ~{estimated_neon} mensagens")
        print(f"   Média: ~{avg_messages_per_conv:.1f} mensagens por conversa")
    
    # 5. Verificar integridade
    print("\n" + "=" * 60)
    print("🔍 VERIFICAÇÕES DE INTEGRIDADE")
    print("=" * 60)
    
    # Conversas sem contato
    print("\n📋 Conversas sem contato:")
    convs_no_contact = supabase.table('conversations').select('id', count='exact').eq('tenant_id', tenant_id).is_('contact_id', 'null').execute()
    print(f"   {convs_no_contact.count} conversas")
    
    # Conversas sem atendente
    print("\n👤 Conversas sem atendente:")
    convs_no_agent = supabase.table('conversations').select('id', count='exact').eq('tenant_id', tenant_id).is_('agent_id', 'null').execute()
    print(f"   {convs_no_agent.count} conversas")
    
    # Mensagens sem conversa (não deveria ter)
    print("\n⚠️  Mensagens órfãs (sem conversa):")
    orphan_messages = supabase.table('messages').select('id', count='exact').eq('tenant_id', tenant_id).is_('conversation_id', 'null').execute()
    print(f"   {orphan_messages.count} mensagens")
    
    # Resumo final
    print("\n" + "=" * 60)
    print("✅ VERIFICAÇÃO COMPLETA!")
    print("=" * 60)
    
    neon.close()

if __name__ == '__main__':
    main()
