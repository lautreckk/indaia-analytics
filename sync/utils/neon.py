import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()

def get_neon_connection():
    """Conecta ao banco Neon."""
    return psycopg2.connect(
        host=os.getenv('NEON_HOST'),
        database=os.getenv('NEON_DATABASE'),
        user=os.getenv('NEON_USER'),
        password=os.getenv('NEON_PASSWORD'),
        sslmode='require',
        cursor_factory=RealDictCursor
    )

def fetch_users(conn, limit=None):
    """Busca usuários (atendentes) - tabela users."""
    query = """
        SELECT 
            id,
            name,
            email,
            role,
            active,
            avatar_url,
            created_at
        FROM users
        ORDER BY id
    """
    if limit:
        query += f" LIMIT {limit}"
    
    with conn.cursor() as cur:
        cur.execute(query)
        return cur.fetchall()

def fetch_leads(conn, limit=None):
    """Busca leads/contatos - tabela leads (NÃO contacts!)."""
    query = """
        SELECT 
            id,
            external_id,
            identifier,
            name,
            email,
            phone_number as phone,
            status,
            additional_attributes,
            custom_attributes,
            utm_source,
            utm_medium,
            utm_campaign,
            created_at
        FROM leads
        ORDER BY id
    """
    if limit:
        query += f" LIMIT {limit}"
    
    with conn.cursor() as cur:
        cur.execute(query)
        return cur.fetchall()

def fetch_conversations(conn, start_date=None, limit=None):
    """Busca conversas."""
    query = """
        SELECT 
            id,
            lead_id,
            user_id,
            status,
            team_id,
            folder_id,
            is_bot,
            platform,
            last_message,
            last_message_at,
            created_at,
            updated_at
        FROM conversations
        WHERE 1=1
    """
    params = []
    
    if start_date:
        query += " AND created_at >= %s"
        params.append(start_date)
    
    query += " ORDER BY id"
    
    if limit:
        query += f" LIMIT {limit}"
    
    with conn.cursor() as cur:
        cur.execute(query, params)
        return cur.fetchall()

def fetch_messages(conn, conversation_ids=None, start_date=None, limit=None):
    """Busca mensagens."""
    query = """
        SELECT 
            id,
            external_id,
            conversation_id,
            lead_id,
            user_id,
            inbox_id,
            content,
            content_type,
            from_me,
            status,
            sent_at,
            transcricao,
            platform,
            created_at
        FROM messages
        WHERE 1=1
    """
    params = []
    
    if conversation_ids:
        query += " AND conversation_id = ANY(%s)"
        params.append(conversation_ids)
    
    if start_date:
        query += " AND created_at >= %s"
        params.append(start_date)
    
    query += " ORDER BY id"
    
    if limit:
        query += f" LIMIT {limit}"
    
    with conn.cursor() as cur:
        cur.execute(query, params)
        return cur.fetchall()

def fetch_messages_count(conn, start_date=None):
    """Conta mensagens para progress bar."""
    query = "SELECT COUNT(*) as count FROM messages WHERE 1=1"
    params = []
    
    if start_date:
        query += " AND created_at >= %s"
        params.append(start_date)
    
    with conn.cursor() as cur:
        cur.execute(query, params)
        return cur.fetchone()['count']
