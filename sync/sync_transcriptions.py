"""
Sincroniza transcrições existentes do Neon para o Supabase.
"""

import psycopg2
from psycopg2.extras import RealDictCursor
from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv()

def sync_transcriptions():
    # Conectar ao Neon
    neon = psycopg2.connect(
        host=os.getenv('NEON_HOST'),
        database=os.getenv('NEON_DATABASE'),
        user=os.getenv('NEON_USER'),
        password=os.getenv('NEON_PASSWORD'),
        sslmode='require',
        cursor_factory=RealDictCursor
    )
    
    # Conectar ao Supabase
    supabase = create_client(
        os.getenv('NEXT_PUBLIC_SUPABASE_URL'),
        os.getenv('SUPABASE_SERVICE_KEY')
    )
    
    # Buscar tenant
    tenant = supabase.table('tenants').select('id').eq('slug', 'indaia').single().execute()
    tenant_id = tenant.data['id']
    
    print("🔄 Buscando transcrições do Neon...")
    
    # Buscar mensagens com transcrição no Neon
    with neon.cursor() as cur:
        cur.execute("""
            SELECT id, transcricao
            FROM messages
            WHERE transcricao IS NOT NULL
            AND transcricao != ''
            AND LENGTH(transcricao) > 10
        """)
        transcriptions = cur.fetchall()
    
    print(f"📥 {len(transcriptions)} transcrições encontradas")
    
    # Atualizar no Supabase
    updated = 0
    for t in transcriptions:
        neon_id = t['id']
        transcricao = t['transcricao']
        
        # Buscar mensagem no Supabase pelo external_id
        msg = supabase.table('messages')\
            .select('id, metadata')\
            .eq('external_id', neon_id)\
            .eq('tenant_id', tenant_id)\
            .execute()
        
        if msg.data:
            supabase_id = msg.data[0]['id']
            current_metadata = msg.data[0].get('metadata') or {}
            
            # Adicionar transcrição ao metadata
            current_metadata['transcricao'] = transcricao
            
            supabase.table('messages')\
                .update({'metadata': current_metadata})\
                .eq('id', supabase_id)\
                .execute()
            
            updated += 1
            
            if updated % 100 == 0:
                print(f"   ✅ {updated} atualizadas...")
    
    print(f"\n🎉 CONCLUÍDO!")
    print(f"   - Transcrições atualizadas: {updated}")
    
    neon.close()

if __name__ == "__main__":
    sync_transcriptions()
