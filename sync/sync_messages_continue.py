#!/usr/bin/env python3
"""
Sync de Mensagens - Continuação
Continua o sync de onde parou, com rate limiting e retry.

USO:
  python sync_messages_continue.py           # Continua de onde parou
  python sync_messages_continue.py --reset   # Recomeça do zero
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
# CONFIGURAÇÕES
# ============================================================
CHECKPOINT_FILE = "sync_checkpoint.json"
BATCH_SIZE = 500  # Reduzido de 1000 para 500
DELAY_BETWEEN_BATCHES = 0.5  # segundos
MAX_RETRIES = 5
RETRY_DELAY = 5  # segundos (vai dobrando)
START_DATE = datetime(2025, 11, 1)


# ============================================================
# CONEXÕES
# ============================================================
def get_neon_connection():
    """Conecta ao Neon (banco origem)."""
    return psycopg2.connect(
        host=os.getenv('NEON_HOST'),
        database=os.getenv('NEON_DATABASE'),
        user=os.getenv('NEON_USER'),
        password=os.getenv('NEON_PASSWORD'),
        sslmode='require',
        cursor_factory=RealDictCursor
    )


def get_supabase_client() -> Client:
    """Conecta ao Supabase."""
    return create_client(
        os.getenv('SUPABASE_URL'),
        os.getenv('SUPABASE_SERVICE_KEY')
    )


# ============================================================
# CHECKPOINT (salvar/carregar progresso)
# ============================================================
def load_checkpoint() -> dict:
    """Carrega checkpoint do arquivo."""
    if os.path.exists(CHECKPOINT_FILE):
        with open(CHECKPOINT_FILE, 'r') as f:
            return json.load(f)
    return {"last_offset": 0, "total_synced": 0, "total_skipped": 0}


def save_checkpoint(offset: int, synced: int, skipped: int):
    """Salva checkpoint no arquivo."""
    with open(CHECKPOINT_FILE, 'w') as f:
        json.dump({
            "last_offset": offset,
            "total_synced": synced,
            "total_skipped": skipped,
            "updated_at": datetime.now().isoformat()
        }, f)


def clear_checkpoint():
    """Remove arquivo de checkpoint."""
    if os.path.exists(CHECKPOINT_FILE):
        os.remove(CHECKPOINT_FILE)
        print("   ✅ Checkpoint removido")


# ============================================================
# FUNÇÕES DE MAPEAMENTO (com paginação)
# ============================================================
def fetch_all_paginated(client: Client, table: str, columns: str, tenant_id: str) -> list:
    """Busca TODOS os registros de uma tabela usando paginação."""
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
    
    return all_data


def get_maps(client: Client, tenant_id: str):
    """Carrega todos os mapas de IDs."""
    print("\n🗺️  Carregando mapas de IDs...")
    
    # Contatos
    contacts = fetch_all_paginated(client, 'contacts', 'id,external_id', tenant_id)
    contact_map = {c['external_id']: c['id'] for c in contacts}
    print(f"   ✅ {len(contact_map):,} contatos")
    
    # Atendentes
    agents = fetch_all_paginated(client, 'agents', 'id,external_id', tenant_id)
    agent_map = {a['external_id']: a['id'] for a in agents}
    print(f"   ✅ {len(agent_map)} atendentes")
    
    # Conversas
    conversations = fetch_all_paginated(client, 'conversations', 'id,external_id', tenant_id)
    conv_map = {c['external_id']: c['id'] for c in conversations}
    print(f"   ✅ {len(conv_map):,} conversas")
    
    return contact_map, agent_map, conv_map


# ============================================================
# INSERÇÃO COM RETRY
# ============================================================
def insert_with_retry(client: Client, data: list) -> bool:
    """Insere dados com retry exponencial."""
    delay = RETRY_DELAY
    
    for attempt in range(MAX_RETRIES):
        try:
            client.table('messages').upsert(
                data,
                on_conflict='tenant_id,external_id'
            ).execute()
            return True
        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                print(f"\n   ⚠️  Erro (tentativa {attempt + 1}/{MAX_RETRIES}): {str(e)[:100]}")
                print(f"   ⏳ Aguardando {delay}s antes de tentar novamente...")
                time.sleep(delay)
                delay *= 2  # Exponential backoff
            else:
                print(f"\n   ❌ Falha após {MAX_RETRIES} tentativas!")
                raise e
    
    return False


def insert_messages_batch(client: Client, tenant_id: str, messages: list, 
                          conv_map: dict, contact_map: dict, agent_map: dict):
    """Insere mensagens em batch com retry."""
    data = []
    skipped = 0
    
    for m in messages:
        # Ignorar se conversa não existe no mapa
        if m['conversation_id'] not in conv_map:
            skipped += 1
            continue
        
        # Determinar sender_type
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
        
        # Mapear lead_id → contact_id
        if m.get('lead_id') and m['lead_id'] in contact_map:
            msg['contact_id'] = contact_map[m['lead_id']]
        
        # Mapear user_id → agent_id
        if user_id and user_id in agent_map:
            msg['agent_id'] = agent_map[user_id]
        
        data.append(msg)
    
    if not data:
        return 0, skipped
    
    # Inserir com retry
    insert_with_retry(client, data)
    
    return len(data), skipped


# ============================================================
# MAIN
# ============================================================
def main():
    # Verificar se deve resetar
    if "--reset" in sys.argv:
        print("🔄 Resetando checkpoint...")
        clear_checkpoint()
    
    print("=" * 60)
    print("📨 SYNC DE MENSAGENS - Continuação")
    print("=" * 60)
    
    # Carregar checkpoint
    checkpoint = load_checkpoint()
    start_offset = checkpoint["last_offset"]
    total_synced = checkpoint["total_synced"]
    total_skipped = checkpoint["total_skipped"]
    
    if start_offset > 0:
        print(f"\n📍 Continuando do offset {start_offset:,}")
        print(f"   Já sincronizados: {total_synced:,} mensagens")
    
    # Conectar
    print("\n🔌 Conectando aos bancos...")
    neon = get_neon_connection()
    supabase = get_supabase_client()
    
    # Buscar tenant
    result = supabase.table('tenants').select('id').eq('slug', 'indaia').single().execute()
    tenant_id = result.data['id']
    print(f"   ✅ Conectado (tenant: {tenant_id[:8]}...)")
    
    # Carregar mapas
    contact_map, agent_map, conv_map = get_maps(supabase, tenant_id)
    
    # Contar total de mensagens
    print("\n📊 Contando mensagens...")
    with neon.cursor() as cur:
        cur.execute("SELECT COUNT(*) as total FROM messages WHERE created_at >= %s", (START_DATE,))
        total_msg = cur.fetchone()['total']
    print(f"   Total no Neon: {total_msg:,}")
    print(f"   Restantes: {total_msg - start_offset:,}")
    
    # Sincronizar mensagens
    print("\n📨 Sincronizando mensagens...")
    print(f"   Batch size: {BATCH_SIZE}")
    print(f"   Delay entre batches: {DELAY_BETWEEN_BATCHES}s")
    
    chunk_size = 2000  # Buscar 2000 do Neon por vez
    offset = start_offset
    
    with tqdm(total=total_msg, initial=start_offset, desc="   Progresso") as pbar:
        while offset < total_msg:
            # Buscar chunk de mensagens do Neon
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
            
            # Inserir em batches menores
            for i in range(0, len(messages), BATCH_SIZE):
                batch = messages[i:i+BATCH_SIZE]
                
                try:
                    count, skipped = insert_messages_batch(
                        supabase, tenant_id, batch,
                        conv_map, contact_map, agent_map
                    )
                    
                    total_synced += count
                    total_skipped += skipped
                    
                    # Salvar checkpoint a cada batch
                    current_offset = offset + i + len(batch)
                    save_checkpoint(current_offset, total_synced, total_skipped)
                    
                    pbar.update(len(batch))
                    
                    # Rate limiting
                    time.sleep(DELAY_BETWEEN_BATCHES)
                    
                except Exception as e:
                    print(f"\n\n❌ ERRO FATAL: {e}")
                    print(f"💾 Checkpoint salvo. Execute novamente para continuar.")
                    neon.close()
                    sys.exit(1)
            
            offset += chunk_size
    
    # Sucesso!
    print("\n" + "=" * 60)
    print("✅ SYNC COMPLETO!")
    print("=" * 60)
    print(f"""
📊 Resumo Final:
   - Mensagens sincronizadas: {total_synced:,}
   - Mensagens ignoradas: {total_skipped:,}
   
🔜 Próximos passos:
   1. Testar o frontend
   2. Verificar conversas com mensagens
    """)
    
    # Limpar checkpoint após sucesso
    clear_checkpoint()
    neon.close()


if __name__ == '__main__':
    main()
