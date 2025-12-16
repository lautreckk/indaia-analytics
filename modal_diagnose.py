"""
Diagnóstico - Entender problemas de sync e áudio
"""

import modal
import os
from datetime import datetime

app = modal.App("indaia-debug")

image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "psycopg2-binary",
    "supabase",
    "httpx",
)

secrets = modal.Secret.from_name("indaia-secrets")


@app.function(image=image, secrets=[secrets], timeout=300)
def diagnose():
    """Diagnóstico completo."""
    import psycopg2
    from psycopg2.extras import RealDictCursor
    from supabase import create_client
    import httpx
    import json
    
    print("=" * 60)
    print("🔍 DIAGNÓSTICO INDAIÁ")
    print("=" * 60)
    
    # Conectar
    neon = psycopg2.connect(
        host=os.environ['NEON_HOST'],
        database=os.environ['NEON_DATABASE'],
        user=os.environ['NEON_USER'],
        password=os.environ['NEON_PASSWORD'],
        sslmode='require',
        cursor_factory=RealDictCursor
    )
    
    supabase = create_client(
        os.environ['SUPABASE_URL'],
        os.environ['SUPABASE_SERVICE_KEY']
    )
    
    tenant = supabase.table('tenants').select('id').eq('slug', 'indaia').single().execute()
    tenant_id = tenant.data['id']
    
    print(f"\n✅ Conectado ao tenant: {tenant_id[:8]}...")
    
    # ============================================================
    # 1. VERIFICAR ÚLTIMA MENSAGEM SINCRONIZADA
    # ============================================================
    print("\n" + "=" * 60)
    print("📊 1. ÚLTIMA MENSAGEM SINCRONIZADA")
    print("=" * 60)
    
    # Maior external_id no Supabase
    last_msg = supabase.table('messages')\
        .select('external_id')\
        .eq('tenant_id', tenant_id)\
        .order('external_id', desc=True)\
        .limit(1)\
        .execute()
    
    last_external_id = last_msg.data[0]['external_id'] if last_msg.data else 0
    print(f"   Último external_id no Supabase: {last_external_id}")
    
    # Maior ID no Neon
    with neon.cursor() as cur:
        cur.execute("SELECT MAX(id) as max_id FROM messages")
        max_neon_id = cur.fetchone()['max_id']
    print(f"   Maior ID no Neon: {max_neon_id}")
    
    # ============================================================
    # 2. VERIFICAR MAPAS DE IDs
    # ============================================================
    print("\n" + "=" * 60)
    print("📊 2. MAPAS DE IDs")
    print("=" * 60)
    
    # Supabase
    convs = supabase.table('conversations').select('id,external_id', count='exact').eq('tenant_id', tenant_id).limit(5).execute()
    print(f"   Conversas no Supabase: {convs.count}")
    if convs.data:
        print(f"   Exemplo: external_id={convs.data[0]['external_id']}")
    
    # Neon - buscar algumas mensagens novas
    with neon.cursor() as cur:
        cur.execute("""
            SELECT id, conversation_id, lead_id, user_id, content_type
            FROM messages
            WHERE id > %s
            ORDER BY id
            LIMIT 5
        """, (last_external_id,))
        neon_msgs = cur.fetchall()
    
    print(f"\n   Mensagens novas no Neon (após {last_external_id}):")
    conv_ids_neon = set()
    for m in neon_msgs:
        print(f"      id={m['id']}, conversation_id={m['conversation_id']}, lead_id={m['lead_id']}")
        conv_ids_neon.add(m['conversation_id'])
    
    # Verificar se esses conversation_ids existem no Supabase
    print(f"\n   Verificando se conversation_ids existem no Supabase:")
    for conv_id in list(conv_ids_neon)[:3]:
        check = supabase.table('conversations')\
            .select('id,external_id')\
            .eq('tenant_id', tenant_id)\
            .eq('external_id', conv_id)\
            .execute()
        exists = "✅ SIM" if check.data else "❌ NÃO"
        print(f"      conversation_id={conv_id}: {exists}")
    
    # ============================================================
    # 3. VERIFICAR URLs DE ÁUDIO
    # ============================================================
    print("\n" + "=" * 60)
    print("📊 3. URLs DE ÁUDIO")
    print("=" * 60)
    
    # Buscar um áudio do Supabase
    audio_msg = supabase.table('messages')\
        .select('id,external_id,content')\
        .eq('tenant_id', tenant_id)\
        .like('content', '%"file_type":"audio"%')\
        .limit(1)\
        .execute()
    
    if audio_msg.data:
        msg = audio_msg.data[0]
        content = msg.get('content', '')
        
        try:
            data = json.loads(content)
            attachments = data.get('attachments', [])
            for att in attachments:
                if att.get('file_type') == 'audio':
                    url = att.get('data_url', '')
                    print(f"   URL encontrada: {url[:100]}...")
                    
                    # Testar acesso
                    with httpx.Client(timeout=10) as client:
                        resp = client.head(url)
                        print(f"   Status HEAD: {resp.status_code}")
                        
                        if resp.status_code == 403:
                            print("   ⚠️  ERRO 403 = URL protegida/expirada")
                            print("   💡 Possíveis soluções:")
                            print("      1. URLs são signed URLs que expiram")
                            print("      2. Precisa autenticação do Chatwoot")
                            print("      3. Precisa gerar nova URL via API")
        except Exception as e:
            print(f"   Erro ao parsear: {e}")
    
    # ============================================================
    # 4. VERIFICAR SE TEM ÁUDIOS COM TRANSCRIÇÃO NO NEON
    # ============================================================
    print("\n" + "=" * 60)
    print("📊 4. TRANSCRIÇÕES EXISTENTES NO NEON")
    print("=" * 60)
    
    with neon.cursor() as cur:
        cur.execute("""
            SELECT COUNT(*) as total 
            FROM messages 
            WHERE transcricao IS NOT NULL 
            AND transcricao != ''
        """)
        transcribed_count = cur.fetchone()['total']
    print(f"   Mensagens com transcrição no Neon: {transcribed_count}")
    
    # Exemplo de transcrição existente
    with neon.cursor() as cur:
        cur.execute("""
            SELECT id, transcricao
            FROM messages 
            WHERE transcricao IS NOT NULL 
            AND transcricao != ''
            LIMIT 1
        """)
        example = cur.fetchone()
    
    if example:
        print(f"   Exemplo (id={example['id']}): {example['transcricao'][:100]}...")
    
    # ============================================================
    # 5. RESUMO E RECOMENDAÇÕES
    # ============================================================
    print("\n" + "=" * 60)
    print("📋 RESUMO E RECOMENDAÇÕES")
    print("=" * 60)
    
    print("""
    PROBLEMA 1: Sync não está funcionando
    ------------------------------------
    O sync busca mensagens com id > last_synced_id, mas o mapeamento
    de conversation_id pode não estar encontrando as conversas.
    
    SOLUÇÃO: Usar external_id como referência, não id interno.
    
    PROBLEMA 2: URLs de áudio retornam 403
    --------------------------------------
    As URLs são protegidas (S3 signed URLs ou autenticação Chatwoot).
    
    SOLUÇÕES POSSÍVEIS:
    1. Se já tem transcrições no Neon → usar essas!
    2. Se URLs expiram → precisamos acessar via API do Chatwoot
    3. Se precisa auth → conseguir credenciais de acesso
    """)
    
    neon.close()
    
    return {
        "last_external_id": last_external_id,
        "max_neon_id": max_neon_id,
        "transcribed_in_neon": transcribed_count
    }


@app.local_entrypoint()
def main():
    result = diagnose.remote()
    print(f"\n\nResultado: {result}")