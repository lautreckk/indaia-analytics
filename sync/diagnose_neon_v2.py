#!/usr/bin/env python3
"""
Diagnóstico do banco Neon v2 - Listar TODAS as tabelas
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

def list_all_tables(conn):
    """Lista todas as tabelas do banco."""
    query = """
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
    """
    with conn.cursor() as cur:
        cur.execute(query)
        return [row['table_name'] for row in cur.fetchall()]

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

def get_row_count(conn, table_name):
    """Conta registros de uma tabela."""
    try:
        with conn.cursor() as cur:
            cur.execute(f'SELECT COUNT(*) as count FROM "{table_name}"')
            return cur.fetchone()['count']
    except Exception as e:
        conn.rollback()
        return f"Erro: {e}"

def get_sample_row(conn, table_name):
    """Retorna uma linha de exemplo."""
    try:
        with conn.cursor() as cur:
            cur.execute(f'SELECT * FROM "{table_name}" LIMIT 1')
            return cur.fetchone()
    except Exception as e:
        conn.rollback()
        return None

def main():
    print("=" * 70)
    print("🔍 DIAGNÓSTICO COMPLETO DO BANCO NEON")
    print("=" * 70)
    
    conn = get_connection()
    
    # 1. Listar TODAS as tabelas
    print("\n📋 TODAS AS TABELAS DO BANCO:")
    print("-" * 70)
    tables = list_all_tables(conn)
    
    for table in tables:
        count = get_row_count(conn, table)
        print(f"   {table:40} {str(count):>20}")
    
    # 2. Identificar tabelas importantes
    print("\n" + "=" * 70)
    print("🔎 BUSCANDO TABELAS DE LEADS/CONTATOS/MENSAGENS...")
    print("=" * 70)
    
    keywords = ['lead', 'contact', 'message', 'conversation', 'chat', 'inbox', 'customer', 'user', 'agent']
    relevant_tables = []
    
    for table in tables:
        for kw in keywords:
            if kw in table.lower():
                relevant_tables.append(table)
                break
    
    if relevant_tables:
        print(f"\n   Tabelas relevantes encontradas ({len(relevant_tables)}):")
        for table in relevant_tables:
            print(f"      ✅ {table}")
    else:
        print("\n   ⚠️  Nenhuma tabela relevante encontrada com essas palavras-chave")
    
    # 3. Detalhar tabelas relevantes
    if relevant_tables:
        for table in relevant_tables:
            print(f"\n{'='*70}")
            print(f"📊 DETALHES: {table}")
            print("="*70)
            
            columns = get_table_columns(conn, table)
            print(f"\n   COLUNAS ({len(columns)}):")
            for col in columns:
                nullable = "NULL" if col['is_nullable'] == 'YES' else "NOT NULL"
                print(f"      - {col['column_name']:30} {col['data_type']:20} {nullable}")
            
            sample = get_sample_row(conn, table)
            if sample:
                print("\n   EXEMPLO DE REGISTRO:")
                for key, value in sample.items():
                    str_val = str(value)
                    if len(str_val) > 80:
                        str_val = str_val[:80] + "..."
                    print(f"      {key}: {str_val}")
            else:
                print("\n   (tabela vazia ou erro ao buscar exemplo)")
    
    # 4. Verificar tabela 'users' que sabemos que existe
    if 'users' in tables:
        print(f"\n{'='*70}")
        print("👤 DETALHES: users (já confirmada)")
        print("="*70)
        
        sample = get_sample_row(conn, 'users')
        if sample:
            print("\n   Campos disponíveis:")
            for key in sample.keys():
                print(f"      - {key}")
            
            # Verificar valores de campos importantes
            print("\n   Valores de exemplo:")
            with conn.cursor() as cur:
                cur.execute("SELECT id, name, email, type FROM users LIMIT 3")
                rows = cur.fetchall()
                for row in rows:
                    print(f"      ID: {row.get('id')}, Name: {row.get('name')}, Email: {row.get('email')}, Type: {row.get('type')}")
    
    # 5. Buscar por áudios
    print(f"\n{'='*70}")
    print("🎤 BUSCANDO TABELAS COM ÁUDIO/MEDIA")
    print("=" * 70)
    
    audio_tables = []
    for table in tables:
        columns = get_table_columns(conn, table)
        col_names = [c['column_name'].lower() for c in columns]
        
        audio_keywords = ['audio', 'media', 'file', 'attachment', 'content', 'url']
        has_audio = any(kw in name for name in col_names for kw in audio_keywords)
        
        if has_audio:
            audio_tables.append(table)
            print(f"\n   📁 {table}:")
            for col in columns:
                if any(kw in col['column_name'].lower() for kw in audio_keywords):
                    print(f"      ⭐ {col['column_name']} ({col['data_type']})")
    
    if not audio_tables:
        print("\n   (nenhuma tabela com campos de áudio/mídia encontrada)")
    
    # 6. Buscar views
    print(f"\n{'='*70}")
    print("👁️  VIEWS DISPONÍVEIS")
    print("=" * 70)
    
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT table_name 
                FROM information_schema.views 
                WHERE table_schema = 'public'
                ORDER BY table_name
            """)
            views = [row['table_name'] for row in cur.fetchall()]
            if views:
                for view in views:
                    print(f"   - {view}")
            else:
                print("   (nenhuma view encontrada)")
    except Exception as e:
        print(f"   ❌ Erro: {e}")
    
    conn.close()
    print("\n" + "=" * 70)
    print("✅ Diagnóstico completo!")
    print("=" * 70)
    print(f"\n📊 Resumo:")
    print(f"   - Total de tabelas: {len(tables)}")
    print(f"   - Tabelas relevantes: {len(relevant_tables)}")
    print(f"   - Tabelas com áudio/mídia: {len(audio_tables)}")

if __name__ == '__main__':
    main()
