"""
Indaiá Analytics - Modal Jobs
Sync automático + Transcrição de áudios

CRON: A cada 1 minuto
1. Sync mensagens novas (Neon → Supabase)
2. Transcrever áudios pendentes (Groq Whisper)
"""

import modal
import os
from datetime import datetime, timedelta

# ============================================================
# MODAL APP
# ============================================================
app = modal.App("indaia-analytics")

# Imagem com dependências
image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "psycopg2-binary",
    "supabase",
    "httpx",
    "groq",
)

# Secrets (configurar no Modal Dashboard)
secrets = modal.Secret.from_name("indaia-secrets")


# ============================================================
# SYNC INCREMENTAL
# ============================================================
@app.function(
    image=image,
    secrets=[secrets],
    timeout=300,
)
def sync_new_messages():
    """Sincroniza apenas mensagens novas."""
    import psycopg2
    from psycopg2.extras import RealDictCursor
    from supabase import create_client
    
    print("🔄 Iniciando sync incremental...")
    
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
    
    # Buscar tenant
    tenant = supabase.table('tenants').select('id').eq('slug', 'indaia').single().execute()
    tenant_id = tenant.data['id']
    
    # Buscar última mensagem sincronizada
    last_sync = supabase.table('sync_logs')\
        .select('last_synced_id')\
        .eq('tenant_id', tenant_id)\
        .eq('entity_type', 'messages')\
        .order('created_at', desc=True)\
        .limit(1)\
        .execute()
    
    last_id = last_sync.data[0]['last_synced_id'] if last_sync.data else 0
    
    # Buscar mensagens novas do Neon
    with neon.cursor() as cur:
        cur.execute("""
            SELECT 
                id, external_id, conversation_id, lead_id, user_id,
                inbox_id, content, content_type, from_me, status,
                sent_at, transcricao, platform, created_at
            FROM messages
            WHERE id > %s
            ORDER BY id
            LIMIT 1000
        """, (last_id,))
        messages = cur.fetchall()
    
    if not messages:
        print("   ✅ Nenhuma mensagem nova")
        neon.close()
        return {"synced": 0}
    
    print(f"   📥 {len(messages)} mensagens novas encontradas")
    
    # Buscar mapas de IDs (com paginação para pegar todos)
    def fetch_all(table, columns):
        all_data = []
        offset = 0
        while True:
            result = supabase.table(table).select(columns).eq('tenant_id', tenant_id).range(offset, offset + 999).execute()
            if not result.data:
                break
            all_data.extend(result.data)
            if len(result.data) < 1000:
                break
            offset += 1000
        return all_data
    
    contacts = fetch_all('contacts', 'id,external_id')
    contact_map = {c['external_id']: c['id'] for c in contacts}
    
    agents = fetch_all('agents', 'id,external_id')
    agent_map = {a['external_id']: a['id'] for a in agents}
    
    convs = fetch_all('conversations', 'id,external_id')
    conv_map = {c['external_id']: c['id'] for c in convs}
    
    # Preparar mensagens
    data = []
    max_id = last_id
    
    for m in messages:
        if m['conversation_id'] not in conv_map:
            continue
        
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
        
        if m.get('lead_id') and m['lead_id'] in contact_map:
            msg['contact_id'] = contact_map[m['lead_id']]
        
        if user_id and user_id in agent_map:
            msg['agent_id'] = agent_map[user_id]
        
        data.append(msg)
        max_id = max(max_id, m['id'])
    
    # Inserir no Supabase
    if data:
        # Inserir em batches de 100
        for i in range(0, len(data), 100):
            batch = data[i:i+100]
            supabase.table('messages').upsert(
                batch,
                on_conflict='tenant_id,external_id'
            ).execute()
    
    # Salvar log de sync
    supabase.table('sync_logs').insert({
        'tenant_id': tenant_id,
        'entity_type': 'messages',
        'last_synced_id': max_id,
        'records_synced': len(data),
        'status': 'success',
        'completed_at': datetime.utcnow().isoformat()
    }).execute()
    
    print(f"   ✅ {len(data)} mensagens sincronizadas")
    neon.close()
    
    return {"synced": len(data), "last_id": max_id}


# ============================================================
# TRANSCRIÇÃO DE ÁUDIOS
# ============================================================
@app.function(
    image=image,
    secrets=[secrets],
    timeout=600,
)
def transcribe_pending_audios():
    """Transcreve áudios pendentes usando Groq Whisper."""
    import httpx
    import json
    import tempfile
    from groq import Groq
    from supabase import create_client
    
    print("🎤 Iniciando transcrição de áudios...")
    
    supabase = create_client(
        os.environ['SUPABASE_URL'],
        os.environ['SUPABASE_SERVICE_KEY']
    )
    
    groq_client = Groq(api_key=os.environ['GROQ_API_KEY'])
    
    # Buscar tenant
    tenant = supabase.table('tenants').select('id').eq('slug', 'indaia').single().execute()
    tenant_id = tenant.data['id']
    
    # Buscar mensagens de áudio sem transcrição
    pending = supabase.table('messages')\
        .select('id,external_id,content,metadata')\
        .eq('tenant_id', tenant_id)\
        .like('content', '%"file_type":"audio"%')\
        .limit(10)\
        .execute()
    
    # Filtrar apenas os que não têm transcrição
    pending_data = [
        m for m in pending.data 
        if not (m.get('metadata') or {}).get('transcricao')
    ]
    
    if not pending_data:
        print("   ✅ Nenhum áudio pendente")
        return {"transcribed": 0}
    
    print(f"   📥 {len(pending_data)} áudios pendentes")
    
    transcribed = 0
    
    for msg in pending_data:
        try:
            # Extrair URL do áudio
            audio_url = None
            content = msg.get('content', '')
            
            if content and '{' in content:
                try:
                    data = json.loads(content)
                    attachments = data.get('attachments', [])
                    for att in attachments:
                        if att.get('file_type') == 'audio':
                            audio_url = att.get('data_url')
                            break
                except:
                    pass
            
            if not audio_url:
                print(f"   ⚠️  Msg {msg['id'][:8]}: URL não encontrada")
                continue
            
            print(f"   🔊 Transcrevendo {msg['external_id']}...")
            
            # Baixar áudio
            with httpx.Client(timeout=60) as client:
                response = client.get(audio_url)
                if response.status_code != 200:
                    print(f"   ⚠️  Erro ao baixar: {response.status_code}")
                    continue
                audio_bytes = response.content
            
            # Determinar extensão
            ext = '.ogg'
            if 'mp3' in audio_url.lower() or 'mpeg' in audio_url.lower():
                ext = '.mp3'
            elif 'webm' in audio_url.lower():
                ext = '.webm'
            
            # Salvar temporariamente
            with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as f:
                f.write(audio_bytes)
                temp_path = f.name
            
            # Transcrever com Groq
            with open(temp_path, 'rb') as audio_file:
                result = groq_client.audio.transcriptions.create(
                    file=(os.path.basename(temp_path), audio_file),
                    model="whisper-large-v3",
                    language="pt",
                    response_format="text"
                )
                # Groq retorna string diretamente quando response_format="text"
                transcription = result if isinstance(result, str) else str(result)
            
            # Limpar arquivo temporário
            os.unlink(temp_path)
            
            # Atualizar mensagem com transcrição
            metadata = msg.get('metadata', {}) or {}
            metadata['transcricao'] = transcription
            metadata['transcribed_at'] = datetime.utcnow().isoformat()
            
            supabase.table('messages').update({
                'metadata': metadata
            }).eq('id', msg['id']).execute()
            
            # Também salvar na tabela transcriptions
            supabase.table('transcriptions').upsert({
                'message_id': msg['id'],
                'tenant_id': tenant_id,
                'audio_url': audio_url,
                'transcription': transcription,
                'language': 'pt',
                'source': 'groq-whisper',
                'status': 'completed',
                'processed_at': datetime.utcnow().isoformat()
            }, on_conflict='message_id').execute()
            
            transcribed += 1
            print(f"   ✅ Transcrito: {transcription[:50]}...")
            
        except Exception as e:
            print(f"   ❌ Erro: {str(e)}")
            continue
    
    print(f"   🎉 {transcribed} áudios transcritos")
    return {"transcribed": transcribed}


# ============================================================
# JOB PRINCIPAL (CRON) - TEMPORARIAMENTE DESABILITADO
# ============================================================
# ⏸️ ANÁLISES AUTOMÁTICAS DESABILITADAS TEMPORARIAMENTE
# O sync agora roda via sync_worker.py a cada 10 minutos
# @app.function(
#     image=image,
#     secrets=[secrets],
#     schedule=modal.Cron("* * * * *"),  # A cada 1 minuto
#     timeout=300,
# )
@app.function(
    image=image,
    secrets=[secrets],
    timeout=300,
)
def sync_and_transcribe():
    """Job principal - DESABILITADO (agora usa sync_worker.py)."""
    print("⏸️ Análises automáticas desabilitadas temporariamente")
    print("📝 Use sync_worker.py para sincronização a cada 10 minutos")
    return {"status": "disabled"}


# ============================================================
# COMANDOS MANUAIS (para testes)
# ============================================================
@app.local_entrypoint()
def main():
    """Executa manualmente para teste."""
    print("🚀 Executando job manualmente...")
    result = sync_and_transcribe.remote()
    print(f"Resultado: {result}")
