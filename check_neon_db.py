#!/usr/bin/env python3
"""Script para verificar estrutura do banco Neon (Chatwoot)"""

import psycopg2
from psycopg2.extras import RealDictCursor
import json

# String de conexão
conn_string = 'postgresql://neondb_owner:npg_9kXlTHrn7Lqx@ep-lucky-grass-ac8uxskn-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require'

try:
    conn = psycopg2.connect(conn_string)
    conn.autocommit = True  # Evitar problemas de transação
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    print("=" * 80)
    print("1. ESTRUTURA DA TABELA conversations")
    print("=" * 80)
    cur.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'conversations'
        ORDER BY ordinal_position;
    """)
    cols = cur.fetchall()
    for col in cols:
        print(f"  {col['column_name']:30} {col['data_type']}")
    
    print("\n" + "=" * 80)
    print("2. CONVERSATIONS COM user_id PREENCHIDO (5 primeiras)")
    print("=" * 80)
    cur.execute("""
        SELECT id, user_id, status 
        FROM conversations 
        WHERE user_id IS NOT NULL 
        LIMIT 5;
    """)
    rows = cur.fetchall()
    for row in rows:
        print(f"  ID: {row['id']}")
        print(f"  user_id: {row['user_id']}")
        print(f"  status: {row['status']}")
        print()
    
    print("=" * 80)
    print("3. ESTATÍSTICAS DE user_id")
    print("=" * 80)
    cur.execute("""
        SELECT 
          COUNT(*) as total,
          COUNT(user_id) as com_user_id,
          COUNT(*) - COUNT(user_id) as sem_user_id
        FROM conversations;
    """)
    stats = cur.fetchone()
    print(f"  Total de conversas: {stats['total']:,}")
    if stats['total'] > 0:
        print(f"  Com user_id: {stats['com_user_id']:,} ({stats['com_user_id']*100/stats['total']:.1f}%)")
        print(f"  Sem user_id: {stats['sem_user_id']:,} ({stats['sem_user_id']*100/stats['total']:.1f}%)")
    
    print("\n" + "=" * 80)
    print("4. VERIFICAR SE EXISTE TABELA agents OU users")
    print("=" * 80)
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND (table_name LIKE '%agent%' OR table_name LIKE '%user%')
        ORDER BY table_name;
    """)
    tables = cur.fetchall()
    for table in tables:
        print(f"  Tabela encontrada: {table['table_name']}")
    
    # Tentar buscar da tabela users
    print("\n" + "=" * 80)
    print("5. TABELA users (10 primeiros)")
    print("=" * 80)
    try:
        cur.execute("""
            SELECT id, name, email 
            FROM users 
            LIMIT 10;
        """)
        users = cur.fetchall()
        for user in users:
            print(f"  {user['name']:30} {user['email']}")
    except Exception as e:
        print(f"  ERRO ao buscar users: {e}")
    
    # Tentar buscar da tabela agents
    print("\n" + "=" * 80)
    print("6. TABELA agents (se existir)")
    print("=" * 80)
    try:
        cur.execute("""
            SELECT id, name, email 
            FROM agents 
            LIMIT 10;
        """)
        agents = cur.fetchall()
        for agent in agents:
            print(f"  {agent['name']:30} {agent['email']}")
    except Exception as e:
        print(f"  Tabela agents não existe ou erro: {e}")
    
    print("\n" + "=" * 80)
    print("7. JOIN conversations ↔ users (5 primeiras)")
    print("=" * 80)
    try:
        cur.execute("""
            SELECT 
              c.id as conversation_id,
              c.user_id,
              u.name as user_name,
              u.email as user_email
            FROM conversations c
            LEFT JOIN users u ON c.user_id = u.id
            WHERE c.user_id IS NOT NULL
            LIMIT 5;
        """)
        joins = cur.fetchall()
        for join in joins:
            print(f"  Conversation: {join['conversation_id']}")
            print(f"  user_id: {join['user_id']}")
            print(f"  user_name: {join['user_name']}")
            print(f"  user_email: {join['user_email']}")
            print()
    except Exception as e:
        print(f"  ERRO no JOIN: {e}")
    
    print("=" * 80)
    print("8. ESTRUTURA DA TABELA messages")
    print("=" * 80)
    cur.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'messages'
        ORDER BY ordinal_position;
    """)
    msg_cols = cur.fetchall()
    for col in msg_cols:
        print(f"  {col['column_name']:30} {col['data_type']}")
    
    print("\n" + "=" * 80)
    print("9. MENSAGENS DE EXEMPLO (from_me = true)")
    print("=" * 80)
    try:
        cur.execute("""
            SELECT id, content, from_me, user_id
            FROM messages 
            WHERE from_me = true 
            LIMIT 3;
        """)
        messages = cur.fetchall()
        for msg in messages:
            print(f"  ID: {msg['id']}")
            print(f"  from_me: {msg['from_me']}")
            print(f"  user_id: {msg.get('user_id', 'N/A')}")
            content_preview = str(msg['content'])[:150] if msg['content'] else 'N/A'
            print(f"  content (primeiros 150 chars): {content_preview}...")
            print()
    except Exception as e:
        print(f"  ERRO: {e}")
    
    # Query adicional: verificar se messages tem user_id ou sender_id
    print("=" * 80)
    print("9. VERIFICAR SE messages TEM user_id ou sender_id")
    print("=" * 80)
    cur.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'messages'
        AND (column_name LIKE '%agent%' OR column_name LIKE '%user%' OR column_name LIKE '%sender%')
        ORDER BY ordinal_position;
    """)
    msg_cols = cur.fetchall()
    if msg_cols:
        for col in msg_cols:
            print(f"  {col['column_name']:30} {col['data_type']}")
    else:
        print("  Nenhuma coluna relevante encontrada na tabela messages")
    
    # Verificar todas as colunas de messages
    print("\n" + "=" * 80)
    print("10. TODAS AS COLUNAS DA TABELA messages")
    print("=" * 80)
    cur.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'messages'
        ORDER BY ordinal_position;
    """)
    all_msg_cols = cur.fetchall()
    relevant = [c for c in all_msg_cols if any(x in c['column_name'].lower() for x in ['agent', 'sender', 'user', 'account', 'inbox'])]
    if relevant:
        for col in relevant:
            print(f"  {col['column_name']:30} {col['data_type']}")
    else:
        print("  Nenhuma coluna relevante encontrada")
    
    cur.close()
    conn.close()
    
    print("\n" + "=" * 80)
    print("VERIFICAÇÃO CONCLUÍDA")
    print("=" * 80)
    
except Exception as e:
    print(f"ERRO: {e}")
    import traceback
    traceback.print_exc()
