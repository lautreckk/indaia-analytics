"""
Supabase Utils - Versão com Rate Limiting e Retry
"""

import os
import time
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# Rate limiting
BATCH_SIZE = 500
DELAY_BETWEEN_BATCHES = 0.3
MAX_RETRIES = 5
RETRY_DELAY = 3


def get_supabase_client() -> Client:
    """Conecta ao Supabase com service role (bypass RLS)."""
    return create_client(
        os.getenv('SUPABASE_URL'),
        os.getenv('SUPABASE_SERVICE_KEY')
    )


def get_tenant_id(client: Client, slug: str = 'indaia') -> str:
    """Busca o ID do tenant."""
    result = client.table('tenants').select('id').eq('slug', slug).single().execute()
    return result.data['id']


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
        time.sleep(0.1)  # Pequeno delay entre páginas
    
    return all_data


def upsert_with_retry(client: Client, table: str, data: list, on_conflict: str) -> bool:
    """Insere dados com retry exponencial."""
    delay = RETRY_DELAY
    
    for attempt in range(MAX_RETRIES):
        try:
            client.table(table).upsert(
                data,
                on_conflict=on_conflict
            ).execute()
            return True
        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                print(f"\n   ⚠️  Retry {attempt + 1}/{MAX_RETRIES}: {str(e)[:80]}...")
                time.sleep(delay)
                delay *= 2
            else:
                raise e
    return False


def upsert_agents(client: Client, tenant_id: str, users: list):
    """Insere ou atualiza atendentes (users → agents)."""
    data = [{
        'tenant_id': tenant_id,
        'external_id': u['id'],
        'name': u['name'] or f"User {u['id']}",
        'email': u.get('email'),
        'role': u.get('role'),
        'active': u.get('active', True),
        'avatar_url': u.get('avatar_url')
    } for u in users]
    
    return upsert_with_retry(client, 'agents', data, 'tenant_id,external_id')


def upsert_contacts(client: Client, tenant_id: str, leads: list):
    """Insere ou atualiza contatos (leads → contacts)."""
    data = []
    for lead in leads:
        contact = {
            'tenant_id': tenant_id,
            'external_id': lead['id'],
            'name': lead.get('name'),
            'phone': lead.get('phone'),
            'email': lead.get('email'),
            'identifier': lead.get('identifier'),
            'status': lead.get('status'),
            'custom_attributes': {
                **(lead.get('additional_attributes') or {}),
                **(lead.get('custom_attributes') or {}),
                'utm_source': lead.get('utm_source'),
                'utm_medium': lead.get('utm_medium'),
                'utm_campaign': lead.get('utm_campaign'),
            }
        }
        data.append(contact)
    
    # Inserir em batches com delay
    for i in range(0, len(data), BATCH_SIZE):
        batch = data[i:i+BATCH_SIZE]
        upsert_with_retry(client, 'contacts', batch, 'tenant_id,external_id')
        time.sleep(DELAY_BETWEEN_BATCHES)
    
    return len(data)


def get_contact_uuid_map(client: Client, tenant_id: str) -> dict:
    """Retorna mapeamento COMPLETO external_id → UUID dos contatos."""
    all_contacts = fetch_all_paginated(client, 'contacts', 'id,external_id', tenant_id)
    return {c['external_id']: c['id'] for c in all_contacts}


def get_agent_uuid_map(client: Client, tenant_id: str) -> dict:
    """Retorna mapeamento external_id → UUID dos atendentes."""
    all_agents = fetch_all_paginated(client, 'agents', 'id,external_id', tenant_id)
    return {a['external_id']: a['id'] for a in all_agents}


def upsert_conversations(client: Client, tenant_id: str, conversations: list, contact_map: dict, agent_map: dict):
    """Insere ou atualiza conversas."""
    data = []
    for c in conversations:
        conv = {
            'tenant_id': tenant_id,
            'external_id': c['id'],
            'status': c.get('status'),
            'platform': c.get('platform') or 'whatsapp',
            'last_message': c.get('last_message'),
            'last_message_at': c['last_message_at'].isoformat() if c.get('last_message_at') else None,
            'created_at': c['created_at'].isoformat() if c.get('created_at') else None,
            'metadata': {
                'team_id': c.get('team_id'),
                'folder_id': c.get('folder_id'),
                'is_bot': c.get('is_bot')
            }
        }
        
        # Mapear lead_id → contact_id
        if c.get('lead_id') and c['lead_id'] in contact_map:
            conv['contact_id'] = contact_map[c['lead_id']]
        
        # Mapear user_id → agent_id
        if c.get('user_id') and c['user_id'] in agent_map:
            conv['agent_id'] = agent_map[c['user_id']]
        
        data.append(conv)
    
    # Inserir em batches com delay
    for i in range(0, len(data), BATCH_SIZE):
        batch = data[i:i+BATCH_SIZE]
        upsert_with_retry(client, 'conversations', batch, 'tenant_id,external_id')
        time.sleep(DELAY_BETWEEN_BATCHES)
    
    return len(data)


def get_conversation_uuid_map(client: Client, tenant_id: str) -> dict:
    """Retorna mapeamento COMPLETO external_id → UUID das conversas."""
    all_conversations = fetch_all_paginated(client, 'conversations', 'id,external_id', tenant_id)
    return {c['external_id']: c['id'] for c in all_conversations}


def insert_messages_batch(client: Client, tenant_id: str, messages: list, 
                          conv_map: dict, contact_map: dict, agent_map: dict):
    """Insere mensagens em batch."""
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
    
    # Inserir em batches menores com delay
    for i in range(0, len(data), BATCH_SIZE):
        batch = data[i:i+BATCH_SIZE]
        upsert_with_retry(client, 'messages', batch, 'tenant_id,external_id')
        time.sleep(DELAY_BETWEEN_BATCHES)
    
    return len(data), skipped
