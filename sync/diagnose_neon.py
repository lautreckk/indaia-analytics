#!/usr/bin/env python3
"""
Diagnóstico do banco Neon - Verificar estrutura das tabelas
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()

def get_connection():
    return psycopg2.connect(
        host=os.getenv('NEON_HOST'),
        database=os.getenv('NEON_DATABASE'),
        user=os.getenv('NEON_USER'),
        password=os.getenv('NEON_PASSWORD'),
        sslmode='require',
        cursor_factory=RealDictCursor
    )

def get_table_columns(conn, table_name):
    """Retorna colunas de uma tabela."""
    query = """
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = %s
        ORDER BY ordinal_position
    """
    with conn.cursor() as cur:
        cur.execute(query, (table_name,))
        return cur.fetchall()

def get_sample_rows(conn, table_name, limit=3):
    """Retorna algumas linhas de exemplo."""
    query = f"SELECT * FROM {table_name} LIMIT {limit}"
    with conn.cursor() as cur:
        cur.execute(query)
        return cur.fetchall()

def main():
    print("=" * 60)
    print("🔍 DIAGNÓSTICO DO BANCO NEON (Chatwoot)")
    print("=" * 60)
    
    conn = get_connection()
    
    tables = ['users', 'contacts', 'conversations', 'messages']
    
    for table in tables:
        print(f"\n{'='*60}")
        print(f"📋 TABELA: {table}")
        print("="*60)
        
        # Colunas
        print("\n📊 COLUNAS:")
        columns = get_table_columns(conn, table)
        for col in columns:
            nullable = "NULL" if col['is_nullable'] == 'YES' else "NOT NULL"
            print(f"   - {col['column_name']:30} {col['data_type']:20} {nullable}")
        
        # Sample
        print(f"\n📄 AMOSTRA (3 linhas):")
        try:
            rows = get_sample_rows(conn, table)
            if rows:
                for i, row in enumerate(rows):
                    print(f"\n   --- Linha {i+1} ---")
                    for key, value in row.items():
                        # Truncar valores longos
                        str_val = str(value)
                        if len(str_val) > 100:
                            str_val = str_val[:100] + "..."
                        print(f"   {key}: {str_val}")
            else:
                print("   (tabela vazia)")
        except Exception as e:
            print(f"   ❌ Erro: {e}")
    
    # Contar registros
    print(f"\n{'='*60}")
    print("📈 CONTAGEM DE REGISTROS")
    print("="*60)
    
    for table in tables:
        try:
            with conn.cursor() as cur:
                cur.execute(f"SELECT COUNT(*) as count FROM {table}")
                count = cur.fetchone()['count']
                print(f"   {table:20} {count:>10,}")
        except Exception as e:
            print(f"   {table:20} ❌ Erro: {e}")
    
    # Verificar tabela de mensagens com áudio
    print(f"\n{'='*60}")
    print("🎤 MENSAGENS COM ÁUDIO")
    print("="*60)
    
    try:
        with conn.cursor() as cur:
            # Verificar content_type
            cur.execute("""
                SELECT content_type, COUNT(*) as count 
                FROM messages 
                WHERE content_type IS NOT NULL
                GROUP BY content_type 
                ORDER BY count DESC
                LIMIT 10
            """)
            types = cur.fetchall()
            if types:
                print("\n   Content types encontrados:")
                for t in types:
                    print(f"   - {t['content_type']:30} {t['count']:>10,}")
            else:
                print("   (nenhum content_type encontrado)")
    except Exception as e:
        print(f"   ❌ Erro: {e}")
    
    # Verificar sender_type nas mensagens
    print(f"\n{'='*60}")
    print("👤 SENDER_TYPE NAS MENSAGENS")
    print("="*60)
    
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT sender_type, COUNT(*) as count 
                FROM messages 
                WHERE sender_type IS NOT NULL
                GROUP BY sender_type 
                ORDER BY count DESC
            """)
            types = cur.fetchall()
            if types:
                print("\n   Sender types encontrados:")
                for t in types:
                    print(f"   - {t['sender_type']:30} {t['count']:>10,}")
            else:
                print("   (nenhum sender_type encontrado)")
    except Exception as e:
        print(f"   ❌ Erro: {e}")
    
    # Verificar estrutura de users
    print(f"\n{'='*60}")
    print("👥 ESTRUTURA DE USERS")
    print("="*60)
    
    try:
        with conn.cursor() as cur:
            # Verificar se existe type ou role
            cur.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'users' 
                AND column_name IN ('type', 'role', 'confirmed_at')
            """)
            cols = cur.fetchall()
            print("\n   Colunas relevantes encontradas:")
            for col in cols:
                print(f"   ✅ {col['column_name']}")
            
            # Verificar valores de type/role se existir
            cur.execute("""
                SELECT DISTINCT type 
                FROM users 
                WHERE type IS NOT NULL
                LIMIT 10
            """)
            types = cur.fetchall()
            if types:
                print("\n   Valores de 'type' encontrados:")
                for t in types:
                    print(f"   - {t['type']}")
    except Exception as e:
        print(f"   ❌ Erro ao verificar users: {e}")
    
    conn.close()
    print("\n" + "=" * 60)
    print("✅ Diagnóstico completo!")
    print("=" * 60)

if __name__ == '__main__':
    main()
