#!/usr/bin/env python3
"""
Sync de Mensagens - VERSÃO LENTA E SEGURA
Batches pequenos + delays maiores = não sobrecarrega o Supabase

USO:
  python sync_messages_slow.py           # Continua de onde parou
  python sync_messages_slow.py --reset   # Recomeça do zero
"""

import os
import sys
import time
import json
from datetime import datetime
from tqdm import tqdm
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor
from supabase import create_client, Client

load_dotenv()

# ============================================================
# CONFIGURAÇÕES - MAIS CONSERVADORAS
# ============================================================
CHECKPOINT_FILE = "sync_checkpoint.json"
BATCH_SIZE = 100  # Reduzido de 500 para 100
DELAY_BETWEEN_BATCHES = 1.0  # Aumentado de 0.5 para 1 segundo
MAX_RETRIES = 10  # Mais tentativas
RETRY_DELAY = 10  # Começa com 10 segundos
START_DATE = datetime(2025, 11, 1)


# ============================================================
# CONEXÕES
# ============================================================
def get_neon_connection():
    return psycopg2.connect(
        host=os.getenv('NEON_HOST'),
        database=os.getenv('NEON_DATABASE'),
        user=os.getenv('NEON_USER'),
        password=os.getenv('NEON_PASSWORD'),
        sslmode='require',
        cursor_factory=RealDictCursor
    )


def get_supabase_client() -> Client:
    return create_client(
        os.getenv('SUPABASE_URL'),
        os.getenv('SUPABASE_SERVICE_KEY')
    )


# ============================================================
# CHECKPOINT
# ============================================================
def load_checkpoint() -> dict:
    if os.path.exists(CHECKPOINT_FILE):
        with open(CHECKPOINT_FILE, 'r') as f:
            return json.load(f)
    return {"last_offset": 0, "total_synced": 0, "total_skipped": 0}


def save_checkpoint(offset: int, synced: int, skipped: int):
    with open(CHECKPOINT_FILE, 'w') as f:
        json.dump({
            "last_offset": offset,
            "total_synced": synced,
            "total_skipped": skipped,
            "updated_at": datetime.now().isoformat()
        }, f)


def clear_checkpoint():
    if os.path.exists(CHECKPOINT_FILE):
        os.remove(CHECKPOINT_FILE)


# ============================================================
# FUNÇÕES DE MAPEAMENTO
# ============================================================
def fetch_all_paginated(client: Client, table: str, columns: str, tenant_id: str) -> list:
    all_data = []
    page_size = 1000
    offset = 0
    
    while True:
        result = client.table(table)\
            .select(columns)\
            .eq('tenant_id', tenant_id)\
            .range(offset, offset + page_size - 1)\
            .execute()
        
        if not result.data:
            break
            
        all_data.extend(result.data)
        
        if len(result.data) < page_size:
            break
            
        offset += page_size
        time.sleep(0.2)
    
    return all_data


def get_maps(client: Client, tenant_id: str):
    print("\n🗺️  Carregando mapas de IDs...")
    
    contacts = fetch_all_paginated(client, 'contacts', 'id,external_id', tenant_id)
    contact_map = {c['external_id']: c['id'] for c in contacts}
    print(f"   ✅ {len(contact_map):,} contatos")
    
    agents = fetch_all_paginated(client, 'agents', 'id,external_id', tenant_id)
    agent_map = {a['external_id']: a['id'] for a in agents}
    print(f"   ✅ {len(agent_map)} atendentes")
    
    conversations = fetch_all_paginated(client, 'conversations', 'id,external_id', tenant_id)
    conv_map = {c['external_id']: c['id'] for c in conversations}
    print(f"   ✅ {len(conv_map):,} conversas")
    
    return contact_map, agent_map, conv_map


# ============================================================
# INSERÇÃO UNITÁRIA (mais lenta mas mais segura)
# ============================================================
def insert_single_batch(client: Client, data: list) -> bool:
    """Insere um único batch com retry."""
    delay = RETRY_DELAY
    
    for attempt in range(MAX_RETRIES):
        try:
            client.table('messages').upsert(
                data,
                on_conflict='tenant_id,external_id'
            ).execute()
            return True
        except Exception as e:
            error_msg = str(e)[:100]
            if attempt < MAX_RETRIES - 1:
                print(f"\n   ⚠️  Tentativa {attempt + 1}/{MAX_RETRIES}: {error_msg}")
                print(f"   ⏳ Aguardando {delay}s...")
                time.sleep(delay)
                delay = min(delay * 1.5, 60)  # Max 60 segundos
            else:
                print(f"\n   ❌ Falha após {MAX_RETRIES} tentativas")
                return False
    
    return False


def prepare_message(m: dict, tenant_id: str, conv_map: dict, contact_map: dict, agent_map: dict):
    """Prepara uma mensagem para inserção."""
    if m['conversation_id'] not in conv_map:
        return None
    
    from_me = m.get('from_me', False)
    user_id = m.get('user_id')
    
    if not from_me:
        sender_type = 'customer'
    elif user_id:
        sender_type = 'agent'
    else:
        sender_type = 'bot'
    
    msg = {
        'tenant_id': tenant_id,
        'external_id': m['id'],
        'conversation_id': conv_map[m['conversation_id']],
        'content': m.get('content'),
        'content_type': m.get('content_type'),
        'sender_type': sender_type,
        'from_me': from_me,
        'status': m.get('status'),
        'sent_at': m['sent_at'].isoformat() if m.get('sent_at') else None,
        'metadata': {
            'transcricao': m.get('transcricao'),
            'platform': m.get('platform'),
            'inbox_id': m.get('inbox_id')
        }
    }
    
    if m.get('lead_id') and m['lead_id'] in contact_map:
        msg['contact_id'] = contact_map[m['lead_id']]
    
    if user_id and user_id in agent_map:
        msg['agent_id'] = agent_map[user_id]
    
    return msg


# ============================================================
# MAIN
# ============================================================
def main():
    if "--reset" in sys.argv:
        print("🔄 Resetando checkpoint...")
        clear_checkpoint()
    
    print("=" * 60)
    print("📨 SYNC DE MENSAGENS - Versão Lenta e Segura")
    print("=" * 60)
    
    checkpoint = load_checkpoint()
    start_offset = checkpoint["last_offset"]
    total_synced = checkpoint["total_synced"]
    total_skipped = checkpoint["total_skipped"]
    
    if start_offset > 0:
        print(f"\n📍 Continuando do offset {start_offset:,}")
        print(f"   Já sincronizados: {total_synced:,} mensagens")
    
    print("\n🔌 Conectando aos bancos...")
    neon = get_neon_connection()
    supabase = get_supabase_client()
    
    result = supabase.table('tenants').select('id').eq('slug', 'indaia').single().execute()
    tenant_id = result.data['id']
    print(f"   ✅ Conectado (tenant: {tenant_id[:8]}...)")
    
    contact_map, agent_map, conv_map = get_maps(supabase, tenant_id)
    
    print("\n📊 Contando mensagens...")
    with neon.cursor() as cur:
        cur.execute("SELECT COUNT(*) as total FROM messages WHERE created_at >= %s", (START_DATE,))
        total_msg = cur.fetchone()['total']
    print(f"   Total no Neon: {total_msg:,}")
    print(f"   Restantes: {total_msg - start_offset:,}")
    
    print("\n📨 Sincronizando mensagens...")
    print(f"   Batch size: {BATCH_SIZE} (pequeno para evitar timeout)")
    print(f"   Delay entre batches: {DELAY_BETWEEN_BATCHES}s")
    print(f"   ⏱️  Estimativa: ~{(total_msg - start_offset) / BATCH_SIZE * DELAY_BETWEEN_BATCHES / 60:.0f} minutos")
    
    chunk_size = 1000
    offset = start_offset
    failed_batches = 0
    
    with tqdm(total=total_msg, initial=start_offset, desc="   Progresso") as pbar:
        while offset < total_msg:
            # Buscar chunk do Neon
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
                cur.execute(query, (START_DATE,))
                messages = cur.fetchall()
            
            if not messages:
                break
            
            # Processar em batches pequenos
            for i in range(0, len(messages), BATCH_SIZE):
                batch_messages = messages[i:i+BATCH_SIZE]
                
                # Preparar dados
                data = []
                skipped = 0
                for m in batch_messages:
                    prepared = prepare_message(m, tenant_id, conv_map, contact_map, agent_map)
                    if prepared:
                        data.append(prepared)
                    else:
                        skipped += 1
                
                if data:
                    success = insert_single_batch(supabase, data)
                    
                    if success:
                        total_synced += len(data)
                        total_skipped += skipped
                        failed_batches = 0  # Reset contador de falhas
                    else:
                        failed_batches += 1
                        if failed_batches >= 3:
                            print("\n\n❌ Muitas falhas consecutivas. Salvando checkpoint...")
                            save_checkpoint(offset + i, total_synced, total_skipped)
                            print(f"💾 Checkpoint salvo no offset {offset + i:,}")
                            print("   Execute novamente para continuar.")
                            neon.close()
                            sys.exit(1)
                
                # Salvar checkpoint a cada batch
                current_offset = offset + i + len(batch_messages)
                save_checkpoint(current_offset, total_synced, total_skipped)
                pbar.update(len(batch_messages))
                
                # Delay entre batches
                time.sleep(DELAY_BETWEEN_BATCHES)
            
            offset += chunk_size
    
    print("\n" + "=" * 60)
    print("✅ SYNC COMPLETO!")
    print("=" * 60)
    print(f"""
📊 Resumo Final:
   - Mensagens sincronizadas: {total_synced:,}
   - Mensagens ignoradas: {total_skipped:,}
   
🔜 Próximos passos:
   1. Testar o frontend - clicar em conversas
   2. Verificar se as mensagens aparecem
    """)
    
    clear_checkpoint()
    neon.close()


if __name__ == '__main__':
    main()
