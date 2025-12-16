"""
Sync Worker - Neon (Chatwoot) → Supabase
Roda a cada 10 minutos para sincronizar conversas, mensagens e contatos.
"""

import modal
import os
from datetime import datetime, timedelta
from typing import Optional
import json

# Configuração do App Modal
app = modal.App("indaia-sync")

# Imagem com dependências
image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "psycopg2-binary",  # PostgreSQL (Neon)
    "supabase",         # Supabase client
    "python-dotenv",
)

# Secrets
secrets = modal.Secret.from_name("indaia-secrets")


@app.function(
    image=image,
    secrets=[secrets],
    schedule=modal.Cron("*/10 * * * *"),  # A cada 10 minutos
    timeout=300,  # 5 minutos max
)
def sync_neon_to_supabase():
    """
    Sincroniza dados do Neon (Chatwoot) para o Supabase.
    Roda a cada 10 minutos.
    """
    import psycopg2
    from psycopg2.extras import RealDictCursor
    from supabase import create_client, Client
    
    print("🔄 Iniciando sync Neon → Supabase...")
    start_time = datetime.now()
    
    # Conexões
    NEON_HOST = os.environ.get("NEON_HOST")
    NEON_DATABASE = os.environ.get("NEON_DATABASE")
    NEON_USER = os.environ.get("NEON_USER")
    NEON_PASSWORD = os.environ.get("NEON_PASSWORD")
    
    SUPABASE_URL = os.environ["SUPABASE_URL"]
    SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
    
    # Conectar Neon (read-only)
    neon_conn = psycopg2.connect(
        host=NEON_HOST,
        database=NEON_DATABASE,
        user=NEON_USER,
        password=NEON_PASSWORD,
        sslmode='require',
        cursor_factory=RealDictCursor
    )
    neon_cursor = neon_conn.cursor()
    
    # Conectar Supabase
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Buscar tenant (UUID no Supabase)
    tenant = supabase.table('tenants').select('id').eq('slug', 'indaia').single().execute()
    tenant_id = tenant.data['id']  # UUID string
    
    # Para queries no Neon, precisamos do tenant_id como integer
    # Assumindo que o tenant_id no Neon é 1 (ou buscar de outra forma)
    # Por enquanto, vamos usar um valor fixo ou buscar do Supabase metadata
    neon_tenant_id = 1  # TODO: Mapear tenant_id UUID → integer do Neon se necessário
    
    stats = {
        "agents": 0,
        "contacts": 0,
        "conversations": 0,
        "messages": 0,
    }
    
    try:
        # 1. Buscar último sync
        last_sync = get_last_sync(supabase, tenant_id)
        print(f"📅 Último sync: {last_sync or 'Nunca'}")
        
        # 2. Sync Agents (atendentes)
        stats["agents"] = sync_agents(neon_cursor, supabase, tenant_id, last_sync)
        
        # 3. Sync Contacts (leads)
        stats["contacts"] = sync_contacts(neon_cursor, supabase, tenant_id, last_sync, neon_tenant_id)
        
        # 4. Sync Conversations
        stats["conversations"] = sync_conversations(neon_cursor, supabase, tenant_id, last_sync, neon_tenant_id)
        
        # 5. Sync Messages
        stats["messages"] = sync_messages(neon_cursor, supabase, tenant_id, last_sync, neon_tenant_id)
        
        # 6. Atualizar último sync
        update_last_sync(supabase, tenant_id, stats)
        
        duration = (datetime.now() - start_time).total_seconds()
        print(f"✅ Sync completo em {duration:.1f}s")
        print(f"   📊 Agents: {stats['agents']}, Contacts: {stats['contacts']}")
        print(f"   💬 Conversations: {stats['conversations']}, Messages: {stats['messages']}")
        
        return stats
        
    except Exception as e:
        print(f"❌ Erro no sync: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        neon_cursor.close()
        neon_conn.close()


def get_last_sync(supabase, tenant_id: str) -> Optional[datetime]:
    """Busca timestamp do último sync bem-sucedido."""
    try:
        result = supabase.table("sync_logs")\
            .select("completed_at")\
            .eq("tenant_id", tenant_id)\
            .eq("entity_type", "all")\
            .eq("status", "success")\
            .order("completed_at", desc=True)\
            .limit(1)\
            .execute()
        
        if result.data and len(result.data) > 0:
            completed_str = result.data[0].get("completed_at")
            if completed_str:
                # Remover Z e converter
                if completed_str.endswith('Z'):
                    completed_str = completed_str[:-1] + '+00:00'
                return datetime.fromisoformat(completed_str)
    except Exception as e:
        print(f"   ⚠️  Erro ao buscar último sync: {e}")
    return None


def update_last_sync(supabase, tenant_id: str, stats: dict):
    """Registra o sync atual."""
    try:
        total_records = stats.get("agents", 0) + stats.get("contacts", 0) + \
                       stats.get("conversations", 0) + stats.get("messages", 0)
        
        supabase.table("sync_logs").insert({
            "tenant_id": tenant_id,
            "entity_type": "all",
            "records_synced": total_records,
            "status": "success",
            "completed_at": datetime.utcnow().isoformat()
        }).execute()
    except Exception as e:
        print(f"   ⚠️  Erro ao salvar sync log: {e}")


def sync_agents(cursor, supabase, tenant_id: str, last_sync: Optional[datetime]) -> int:
    """Sincroniza atendentes (users do Chatwoot → agents no Supabase)."""
    
    query = """
        SELECT id, name, email, role, active, created_at, updated_at
        FROM users
        WHERE active = true
    """
    params = []
    if last_sync:
        query += " AND updated_at > %s"
        params.append(last_sync)
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    
    count = 0
    for row in rows:
        external_id = row['id']  # integer no Neon
        name = row.get('name')
        email = row.get('email')
        role = row.get('role', 'agent')
        active = row.get('active', True)
        
        # Upsert no Supabase
        supabase.table("agents").upsert({
            "tenant_id": tenant_id,
            "external_id": external_id,
            "name": name,
            "email": email,
            "role": role,
            "active": active if active is not None else True,
            "synced_at": datetime.utcnow().isoformat(),
        }, on_conflict="tenant_id,external_id").execute()
        count += 1
    
    print(f"   👥 Agents sincronizados: {count}")
    return count


def sync_contacts(cursor, supabase, tenant_id: str, last_sync: Optional[datetime], neon_tenant_id: int = 1) -> int:
    """Sincroniza contatos/leads (tabela 'leads' no Neon)."""
    
    query = """
        SELECT id, external_id, identifier, name, email, phone_number, 
               additional_attributes, custom_attributes, created_at, updated_at
        FROM leads
        WHERE tenant_id = %s
    """
    params = [neon_tenant_id]
    if last_sync:
        query += " AND updated_at > %s"
        params.append(last_sync)
    query += " ORDER BY updated_at DESC LIMIT 1000"
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    
    count = 0
    for row in rows:
        # Usar external_id se existir, senão usar id
        external_id = row.get('external_id') or row['id']
        name = row.get('name')
        email = row.get('email')
        phone = row.get('phone_number')
        identifier = row.get('identifier')
        
        # Combinar additional_attributes e custom_attributes
        additional_attrs = row.get('additional_attributes') or {}
        custom_attrs = row.get('custom_attributes') or {}
        
        # Parse se for string
        if isinstance(additional_attrs, str):
            try:
                additional_attrs = json.loads(additional_attrs)
            except:
                additional_attrs = {}
        
        if isinstance(custom_attrs, str):
            try:
                custom_attrs = json.loads(custom_attrs)
            except:
                custom_attrs = {}
        
        # Mesclar atributos
        merged_attrs = {**additional_attrs, **custom_attrs}
        
        supabase.table("contacts").upsert({
            "tenant_id": tenant_id,
            "external_id": external_id,
            "name": name,
            "email": email,
            "phone": phone,
            "identifier": identifier,
            "custom_attributes": merged_attrs,
            "synced_at": datetime.utcnow().isoformat(),
        }, on_conflict="tenant_id,external_id").execute()
        count += 1
    
    print(f"   📇 Contacts sincronizados: {count}")
    return count


def sync_conversations(cursor, supabase, tenant_id: str, last_sync: Optional[datetime], neon_tenant_id: int = 1) -> int:
    """Sincroniza conversas (usa lead_id e user_id no Neon)."""
    
    query = """
        SELECT c.id, c.lead_id, c.user_id, c.status, 
               c.created_at, c.updated_at, c.last_message_at,
               c.last_message, c.platform
        FROM conversations c
        WHERE c.tenant_id = %s
    """
    params = [neon_tenant_id]
    if last_sync:
        query += " AND c.updated_at > %s"
        params.append(last_sync)
    query += " ORDER BY c.updated_at DESC LIMIT 500"
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    
    count = 0
    for row in rows:
        external_id = row['id']  # integer
        lead_ext_id = row.get('lead_id')  # integer (FK para leads)
        user_ext_id = row.get('user_id')  # integer (FK para users/agents)
        status = row.get('status', 'pending')
        last_message_at = row.get('last_message_at')
        last_message = row.get('last_message')
        platform = row.get('platform', 'whatsapp')
        
        # Buscar IDs internos
        # lead_id → contact_id no Supabase
        contact_id = get_internal_id(supabase, "contacts", tenant_id, lead_ext_id) if lead_ext_id else None
        # user_id → agent_id no Supabase
        agent_id = get_internal_id(supabase, "agents", tenant_id, user_ext_id) if user_ext_id else None
        
        # Preparar metadata
        metadata = {
            "platform": platform,
        }
        
        # Converter last_message_at para ISO se necessário
        if last_message_at:
            if isinstance(last_message_at, str):
                last_message_at_iso = last_message_at
            else:
                last_message_at_iso = last_message_at.isoformat()
        else:
            last_message_at_iso = None
        
        # Limitar tamanho do last_message
        if last_message and len(last_message) > 500:
            last_message = last_message[:500]
        
        supabase.table("conversations").upsert({
            "tenant_id": tenant_id,
            "external_id": external_id,
            "contact_id": contact_id,
            "agent_id": agent_id,
            "status": status,
            "last_message": last_message,
            "last_message_at": last_message_at_iso,
            "metadata": metadata,
            "synced_at": datetime.utcnow().isoformat(),
        }, on_conflict="tenant_id,external_id").execute()
        count += 1
    
    print(f"   💬 Conversations sincronizadas: {count}")
    return count


def sync_messages(cursor, supabase, tenant_id: str, last_sync: Optional[datetime], neon_tenant_id: int = 1) -> int:
    """Sincroniza mensagens (usa from_me, user_id, lead_id no Neon)."""
    
    # Buscar apenas mensagens recentes (últimas 24h ou desde último sync)
    if last_sync:
        since = last_sync
    else:
        since = datetime.utcnow() - timedelta(hours=24)
    
    query = """
        SELECT m.id, m.external_id, m.conversation_id, m.lead_id, m.user_id, 
               m.content, m.content_type, m.from_me, m.sent_at,
               m.is_private, m.transcricao, m.platform
        FROM messages m
        WHERE m.tenant_id = %s AND m.sent_at > %s
        ORDER BY m.sent_at DESC
        LIMIT 2000
    """
    
    cursor.execute(query, (neon_tenant_id, since))
    rows = cursor.fetchall()
    
    # Buscar mapas de IDs
    def fetch_all(table):
        all_data = []
        offset = 0
        while True:
            result = supabase.table(table).select('id,external_id').eq('tenant_id', tenant_id).range(offset, offset + 999).execute()
            if not result.data:
                break
            all_data.extend(result.data)
            if len(result.data) < 1000:
                break
            offset += 1000
        return {item['external_id']: item['id'] for item in all_data}
    
    conv_map = fetch_all('conversations')
    contact_map = fetch_all('contacts')
    agent_map = fetch_all('agents')
    
    count = 0
    for row in rows:
        # Usar external_id se existir, senão usar id
        external_id = row.get('external_id') or str(row['id'])
        conv_ext_id = row.get('conversation_id')
        lead_ext_id = row.get('lead_id')
        user_ext_id = row.get('user_id')
        content = row.get('content')
        content_type = row.get('content_type', 'text')
        from_me = row.get('from_me', False)
        sent_at = row.get('sent_at')
        is_private = row.get('is_private', False)
        transcricao = row.get('transcricao')
        platform = row.get('platform', 'whatsapp')
        
        # Buscar conversation_id interno
        conv_id = conv_map.get(conv_ext_id) if conv_ext_id else None
        if not conv_id:
            continue  # Pula se conversa não existe
        
        # Determinar sender_type baseado em from_me e user_id
        sender_type = determine_sender_type(from_me, user_ext_id, content)
        
        # Extrair audio_url se for áudio
        audio_url = extract_audio_url(content) if content_type == "audio" else None
        
        # Buscar contact_id do lead_id
        contact_id = contact_map.get(lead_ext_id) if lead_ext_id else None
        
        # Buscar agent_id do user_id (se from_me = true)
        agent_id = agent_map.get(user_ext_id) if (from_me and user_ext_id) else None
        
        # Converter sent_at para ISO se necessário
        if sent_at:
            if isinstance(sent_at, str):
                sent_at_iso = sent_at
            else:
                sent_at_iso = sent_at.isoformat()
        else:
            sent_at_iso = None
        
        supabase.table("messages").upsert({
            "tenant_id": tenant_id,
            "external_id": external_id,
            "conversation_id": conv_id,
            "contact_id": contact_id,
            "agent_id": agent_id,
            "content": clean_content(content),
            "content_type": content_type or "text",
            "sender_type": sender_type,
            "audio_url": audio_url,
            "sent_at": sent_at_iso,
            "synced_at": datetime.utcnow().isoformat(),
        }, on_conflict="tenant_id,external_id").execute()
        count += 1
    
    print(f"   📨 Messages sincronizadas: {count}")
    return count


def get_internal_id(supabase, table: str, tenant_id: str, external_id) -> Optional[str]:
    """Busca ID interno (UUID) pelo external_id (pode ser integer ou string)."""
    if not external_id:
        return None
    try:
        # Tenta buscar como integer primeiro (tipo mais comum no Neon)
        result = supabase.table(table)\
            .select("id")\
            .eq("tenant_id", tenant_id)\
            .eq("external_id", external_id)\
            .limit(1)\
            .execute()
        if result.data and len(result.data) > 0:
            return result.data[0]["id"]
    except Exception as e:
        # Se falhar, tenta como string
        try:
            result = supabase.table(table)\
                .select("id")\
                .eq("tenant_id", tenant_id)\
                .eq("external_id", str(external_id))\
                .limit(1)\
                .execute()
            if result.data and len(result.data) > 0:
                return result.data[0]["id"]
        except:
            pass
    return None


def determine_sender_type(from_me: bool, user_id: Optional[int], content: Optional[str]) -> str:
    """Determina se é customer, agent ou bot baseado em from_me e user_id."""
    # from_me = True significa que foi enviado pelo agente/sistema
    # from_me = False significa que foi enviado pelo cliente
    
    if not from_me:
        return "customer"
    
    # Se from_me = True mas não tem user_id, pode ser bot
    if not user_id:
        return "bot"
    
    # Se tem user_id e from_me = True, é agent
    return "agent"


def extract_audio_url(content: str) -> Optional[str]:
    """Extrai URL do áudio do campo content JSON."""
    if not content:
        return None
    try:
        data = json.loads(content)
        attachments = data.get("attachments", [])
        for att in attachments:
            if att.get("file_type") == "audio":
                return att.get("data_url")
    except:
        pass
    return None


def clean_content(content: str) -> str:
    """Limpa o conteúdo da mensagem."""
    if not content:
        return ""
    
    # Se for JSON (attachment), extrair texto se houver
    if content.startswith("{"):
        try:
            data = json.loads(content)
            # Retorna o content do attachment ou string vazia
            return data.get("content", "[Anexo]")
        except:
            pass
    
    return content


# Função manual para sync (para testes)
@app.function(image=image, secrets=[secrets], timeout=300)
def manual_sync():
    """Trigger manual do sync."""
    return sync_neon_to_supabase.remote()


# CLI local
@app.local_entrypoint()
def main():
    """Entrypoint para rodar localmente."""
    print("🚀 Executando sync manual...")
    result = manual_sync.remote()
    print(f"Resultado: {result}")
