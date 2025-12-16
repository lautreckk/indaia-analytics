#!/usr/bin/env python3
"""Script para verificar user_id nas mensagens do banco Neon"""

import psycopg2
from psycopg2.extras import RealDictCursor

# String de conexão
conn_string = 'postgresql://neondb_owner:npg_9kXlTHrn7Lqx@ep-lucky-grass-ac8uxskn-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require'

try:
    conn = psycopg2.connect(conn_string)
    conn.autocommit = True
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    print("=" * 80)
    print("1. CONVERSATIONS + MESSAGES + USERS (JOIN completo)")
    print("=" * 80)
    cur.execute("""
        SELECT 
          c.id as conversation_id,
          c.user_id as conv_user_id,
          m.user_id as msg_user_id,
          u.name as agent_name
        FROM conversations c
        JOIN messages m ON m.conversation_id = c.id
        JOIN users u ON m.user_id = u.id
        WHERE m.user_id IS NOT NULL
          AND m.from_me = true
        LIMIT 10;
    """)
    rows = cur.fetchall()
    for row in rows:
        print(f"  Conversation ID: {row['conversation_id']}")
        print(f"  conv.user_id: {row['conv_user_id']}")
        print(f"  msg.user_id: {row['msg_user_id']}")
        print(f"  Agent Name: {row['agent_name']}")
        print()
    
    print("=" * 80)
    print("2. CONTAGEM DE CONVERSAS COM MENSAGENS COM user_id")
    print("=" * 80)
    cur.execute("""
        SELECT 
          COUNT(DISTINCT conversation_id) as conversas_com_msg_user_id
        FROM messages
        WHERE user_id IS NOT NULL;
    """)
    result = cur.fetchone()
    print(f"  Conversas com pelo menos uma mensagem com user_id: {result['conversas_com_msg_user_id']:,}")
    
    # Query adicional: comparar com total de conversas
    print("\n" + "=" * 80)
    print("3. COMPARAÇÃO: conversations.user_id vs messages.user_id")
    print("=" * 80)
    cur.execute("""
        SELECT 
          COUNT(DISTINCT c.id) as total_conversas,
          COUNT(DISTINCT CASE WHEN c.user_id IS NOT NULL THEN c.id END) as convs_com_user_id,
          COUNT(DISTINCT CASE WHEN m.user_id IS NOT NULL THEN c.id END) as convs_com_msg_user_id,
          COUNT(DISTINCT CASE WHEN c.user_id IS NOT NULL OR m.user_id IS NOT NULL THEN c.id END) as convs_com_qualquer_user_id
        FROM conversations c
        LEFT JOIN messages m ON m.conversation_id = c.id AND m.from_me = true;
    """)
    stats = cur.fetchone()
    print(f"  Total de conversas: {stats['total_conversas']:,}")
    print(f"  Com user_id na conversation: {stats['convs_com_user_id']:,} ({stats['convs_com_user_id']*100/stats['total_conversas']:.1f}%)")
    print(f"  Com user_id em pelo menos uma mensagem: {stats['convs_com_msg_user_id']:,} ({stats['convs_com_msg_user_id']*100/stats['total_conversas']:.1f}%)")
    print(f"  Com user_id em conversation OU mensagem: {stats['convs_com_qualquer_user_id']:,} ({stats['convs_com_qualquer_user_id']*100/stats['total_conversas']:.1f}%)")
    
    # Query adicional: verificar se há casos onde conversation.user_id != message.user_id
    print("\n" + "=" * 80)
    print("4. CASOS ONDE conversation.user_id != message.user_id")
    print("=" * 80)
    cur.execute("""
        SELECT 
          c.id as conversation_id,
          c.user_id as conv_user_id,
          u1.name as conv_agent_name,
          m.user_id as msg_user_id,
          u2.name as msg_agent_name,
          COUNT(*) as total_mensagens
        FROM conversations c
        JOIN messages m ON m.conversation_id = c.id AND m.from_me = true
        LEFT JOIN users u1 ON c.user_id = u1.id
        LEFT JOIN users u2 ON m.user_id = u2.id
        WHERE c.user_id IS NOT NULL 
          AND m.user_id IS NOT NULL
          AND c.user_id != m.user_id
        GROUP BY c.id, c.user_id, u1.name, m.user_id, u2.name
        LIMIT 5;
    """)
    conflicts = cur.fetchall()
    if conflicts:
        print("  Encontrados casos onde conversation.user_id != message.user_id:")
        for conflict in conflicts:
            print(f"  Conversation {conflict['conversation_id']}:")
            print(f"    conv.user_id: {conflict['conv_user_id']} ({conflict['conv_agent_name']})")
            print(f"    msg.user_id: {conflict['msg_user_id']} ({conflict['msg_agent_name']})")
            print(f"    Total mensagens: {conflict['total_mensagens']}")
            print()
    else:
        print("  Nenhum conflito encontrado (ou não há dados suficientes)")
    
    cur.close()
    conn.close()
    
    print("=" * 80)
    print("VERIFICAÇÃO CONCLUÍDA")
    print("=" * 80)
    
except Exception as e:
    print(f"ERRO: {e}")
    import traceback
    traceback.print_exc()
