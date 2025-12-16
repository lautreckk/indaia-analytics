"""
🎤 INDAIÁ ANALYTICS - Agente de Transcrição
Transcreve áudios do WhatsApp usando Groq Whisper

Deploy:
    modal deploy modal_transcribe.py

Testar um áudio:
    modal run modal_transcribe.py::run_single --message-id "UUID"

Transcrever áudios pendentes:
    modal run modal_transcribe.py::run_batch --limit 50

CRON automático: A cada 6 horas
"""

import modal
import json
import re
import os
import tempfile
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List

# ============================================
# CONFIGURAÇÃO DO MODAL
# ============================================

app = modal.App("indaia-transcription")

image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "requests",
    "groq",
)

# ============================================
# CREDENCIAIS
# ============================================

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")


# ============================================
# FUNÇÕES AUXILIARES
# ============================================

def extract_audio_url(content: str) -> Optional[str]:
    """Extrai URL do áudio do campo content JSON"""
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


def get_audio_extension(url: str) -> str:
    """Retorna extensão do arquivo de áudio - sempre .ogg para OGA"""
    url_lower = url.lower()
    if '.mp3' in url_lower:
        return 'mp3'
    elif '.webm' in url_lower:
        return 'webm'
    elif '.m4a' in url_lower:
        return 'm4a'
    elif '.wav' in url_lower:
        return 'wav'
    elif '.flac' in url_lower:
        return 'flac'
    elif '.opus' in url_lower:
        return 'opus'
    else:
        # OGA, OGG e outros -> usar OGG (Groq aceita)
        return 'ogg'


# ============================================
# FUNÇÃO DE TRANSCRIÇÃO
# ============================================

@app.function(image=image, timeout=120)
def transcribe_audio(message_id: str) -> Dict[str, Any]:
    """
    Transcreve um áudio específico usando Groq Whisper
    """
    import requests
    from groq import Groq
    
    print(f"🎤 Transcrevendo: {message_id[:8]}...")
    
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    base_url = f"{SUPABASE_URL}/rest/v1"
    
    # 1. Buscar mensagem
    resp = requests.get(
        f"{base_url}/messages?id=eq.{message_id}&select=id,content,content_type,conversation_id,sent_at",
        headers=headers
    )
    messages = resp.json() if resp.status_code == 200 else []
    
    if not messages:
        return {"error": "Mensagem não encontrada", "message_id": message_id}
    
    message = messages[0]
    
    # 2. Verificar se já tem transcrição
    resp = requests.get(
        f"{base_url}/transcriptions?message_id=eq.{message_id}&select=id",
        headers=headers
    )
    existing = resp.json() if resp.status_code == 200 else []
    
    if existing:
        print(f"   ⏭️ Já transcrito")
        return {"status": "already_transcribed", "message_id": message_id}
    
    # 3. Extrair URL do áudio
    audio_url = extract_audio_url(message.get('content'))
    
    if not audio_url:
        return {"error": "URL de áudio não encontrada", "message_id": message_id}
    
    print(f"   📥 Baixando áudio...")
    
    # 4. Baixar o áudio
    try:
        audio_resp = requests.get(audio_url, timeout=30)
        audio_resp.raise_for_status()
        audio_data = audio_resp.content
        print(f"   📦 Tamanho: {len(audio_data) / 1024:.1f} KB")
    except Exception as e:
        print(f"   ❌ Erro ao baixar: {e}")
        # Salvar erro na tabela
        save_transcription_error(message_id, audio_url, str(e))
        return {"error": f"Erro ao baixar áudio: {e}", "message_id": message_id}
    
    # 5. Salvar temporariamente
    ext = get_audio_extension(audio_url)
    
    with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
        tmp.write(audio_data)
        tmp_path = tmp.name
    
    try:
        # 6. Transcrever com Groq Whisper
        print(f"   🤖 Enviando para Whisper...")
        
        client = Groq(api_key=GROQ_API_KEY)
        
        with open(tmp_path, "rb") as audio_file:
            transcription = client.audio.transcriptions.create(
                file=(f"audio.{ext}", audio_file),
                model="whisper-large-v3",
                language="pt",
                response_format="verbose_json"
            )
        
        text = transcription.text
        duration = getattr(transcription, 'duration', None)
        
        print(f"   ✅ Transcrito: {len(text)} chars")
        print(f"   📝 \"{text[:100]}...\"" if len(text) > 100 else f"   📝 \"{text}\"")
        
        # 7. Salvar no Supabase
        save_data = {
            'message_id': message_id,
            'tenant_id': get_tenant_id(),
            'audio_url': audio_url,
            'audio_duration_seconds': duration,
            'transcription': text,
            'language': 'pt',
            'confidence': None,
            'source': 'groq-whisper-large-v3',
            'status': 'completed',
            'processed_at': datetime.now().isoformat(),
            'created_at': datetime.now().isoformat()
        }
        
        resp = requests.post(
            f"{base_url}/transcriptions",
            headers=headers,
            json=save_data
        )
        
        if resp.status_code not in [200, 201]:
            print(f"   ⚠️ Erro ao salvar: {resp.text[:200]}")
        
        return {
            "status": "success",
            "message_id": message_id,
            "transcription": text,
            "duration": duration
        }
        
    except Exception as e:
        print(f"   ❌ Erro Whisper: {e}")
        save_transcription_error(message_id, audio_url, str(e))
        return {"error": f"Erro na transcrição: {e}", "message_id": message_id}
    
    finally:
        # Limpar arquivo temporário
        try:
            os.unlink(tmp_path)
        except:
            pass


def get_tenant_id() -> str:
    """Retorna o tenant_id padrão"""
    import requests
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    }
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/tenants?slug=eq.indaia&select=id",
        headers=headers
    )
    tenants = resp.json() if resp.status_code == 200 else []
    return tenants[0]['id'] if tenants else None


def save_transcription_error(message_id: str, audio_url: str, error: str):
    """Salva registro de erro na transcrição"""
    import requests
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    
    save_data = {
        'message_id': message_id,
        'tenant_id': get_tenant_id(),
        'audio_url': audio_url,
        'status': 'error',
        'error_message': error[:500],
        'created_at': datetime.now().isoformat()
    }
    
    requests.post(
        f"{SUPABASE_URL}/rest/v1/transcriptions",
        headers=headers,
        json=save_data
    )


# ============================================
# TRANSCRIÇÃO EM LOTE
# ============================================

@app.function(image=image, timeout=3600)
def transcribe_batch(limit: int = 50, days: int = 7) -> Dict[str, Any]:
    """
    Transcreve áudios pendentes dos últimos X dias
    """
    import requests
    
    print("=" * 60)
    print(f"🎤 TRANSCRIÇÃO EM LOTE")
    print(f"📅 Últimos {days} dias | Limite: {limit}")
    print("=" * 60)
    
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    }
    base_url = f"{SUPABASE_URL}/rest/v1"
    
    # 1. Buscar áudios dos últimos X dias
    since = (datetime.now() - timedelta(days=days)).isoformat()
    
    resp = requests.get(
        f"{base_url}/messages?content_type=eq.audio&sent_at=gte.{since}&select=id,content&limit={limit * 2}",
        headers=headers
    )
    messages = resp.json() if resp.status_code == 200 else []
    
    print(f"📋 Áudios encontrados: {len(messages)}")
    
    if not messages:
        return {"transcribed": 0, "errors": 0}
    
    # 2. Filtrar os que já têm transcrição
    msg_ids = [m['id'] for m in messages]
    
    resp = requests.get(
        f"{base_url}/transcriptions?select=message_id",
        headers=headers
    )
    transcribed = resp.json() if resp.status_code == 200 else []
    transcribed_ids = {t['message_id'] for t in transcribed}
    
    pending = [m for m in messages if m['id'] not in transcribed_ids]
    print(f"📋 Pendentes: {len(pending)}")
    
    # 3. Limitar
    pending = pending[:limit]
    
    # 4. Transcrever
    success = 0
    errors = 0
    
    for i, msg in enumerate(pending):
        print(f"\n[{i+1}/{len(pending)}]", end=" ")
        
        try:
            result = transcribe_audio.remote(msg['id'])
            
            if result.get('status') == 'success':
                success += 1
            elif result.get('error'):
                errors += 1
        except Exception as e:
            print(f"❌ Erro: {e}")
            errors += 1
    
    print("\n" + "=" * 60)
    print(f"✅ CONCLUÍDO: {success} transcritos, {errors} erros")
    print("=" * 60)
    
    return {"transcribed": success, "errors": errors}


# ============================================
# CRON: TRANSCRIÇÃO AUTOMÁTICA
# ============================================

@app.function(image=image, timeout=3600, schedule=modal.Cron("0 */6 * * *"))
def cron_transcribe_pending():
    """
    CRON: Roda a cada 6 horas
    Transcreve áudios pendentes dos últimos 7 dias
    """
    print("=" * 60)
    print(f"⏰ CRON: Transcrição Automática")
    print(f"🕐 {datetime.now().isoformat()}")
    print("=" * 60)
    
    result = transcribe_batch.remote(limit=30, days=7)
    
    print(f"✅ Resultado: {result}")
    return result


# ============================================
# ENTRY POINTS
# ============================================

@app.local_entrypoint()
def run_single(message_id: str = None):
    """Transcreve um áudio específico"""
    import requests
    
    if not message_id:
        # Buscar um áudio recente para teste
        print("🔍 Buscando áudio recente para teste...")
        
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
        }
        
        since = (datetime.now() - timedelta(days=5)).isoformat()
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/messages?content_type=eq.audio&sent_at=gte.{since}&select=id&limit=1",
            headers=headers
        )
        messages = resp.json() if resp.status_code == 200 else []
        
        if not messages:
            print("❌ Nenhum áudio encontrado")
            return
        
        message_id = messages[0]['id']
        print(f"📋 Usando: {message_id}")
    
    result = transcribe_audio.remote(message_id)
    
    print("\n📋 RESULTADO:")
    print(json.dumps(result, indent=2, ensure_ascii=False))


@app.local_entrypoint()
def run_batch(limit: int = 50, days: int = 7):
    """Transcreve áudios em lote"""
    result = transcribe_batch.remote(limit=limit, days=days)
    
    print("\n📋 RESUMO:")
    print(f"   Transcritos: {result.get('transcribed', 0)}")
    print(f"   Erros: {result.get('errors', 0)}")
