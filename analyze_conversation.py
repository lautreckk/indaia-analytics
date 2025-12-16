"""
🎯 INDAIÁ ANALYTICS - Modal Functions
Análise de conversas com Claude via OpenRouter

Deploy:
    modal deploy modal_analyze.py

Testar uma conversa:
    modal run modal_analyze.py

Rodar análise em lote:
    modal run modal_analyze.py::analyze_pending_conversations
"""

import modal
import json
import re
from datetime import datetime
from typing import Optional, Tuple, List, Dict, Any

# ============================================
# CONFIGURAÇÃO DO MODAL
# ============================================

app = modal.App("indaia-analytics")

image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "requests",
)

# ============================================
# SECRETS (configurar no Modal Dashboard)
# ============================================
# Vá em https://modal.com/secrets e crie:
# - supabase-indaia: SUPABASE_URL, SUPABASE_KEY
# - openrouter: OPENROUTER_API_KEY

# Para teste rápido, usando valores diretos (depois mover para secrets)
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# ============================================
# ROTEIROS DE VENDAS
# ============================================

ROTEIRO_CASAMENTO = """
## ROTEIRO DE VENDAS - CASAMENTO (14 etapas)

| # | Etapa | O que verificar | Obrigatória |
|---|-------|-----------------|-------------|
| 1 | Apresentação inicial | Saudação + identificação do evento (data, convidados) | ✅ |
| 2 | Envio de fotos | Enviou fotos do espaço? Perguntou se gostou? | ✅ |
| 3 | Explicação do Indaiá | Explicou os 80%? (buffet, bebidas, decoração, garçons, locação) | ✅ |
| 4 | Cardápio | Explicou + enviou PDF? | ✅ |
| 5 | Venda da reunião | Explicou valor da consultoria (R$500) + promoção gratuita? | ✅ |
| 6 | Imposição de horário | Usou ESCASSEZ? ("Último horário disponível") | ✅ |
| 7 | Regras da reunião | Explicou: presença de todos + 3h + comprometimento? | ✅ |
| 8 | Bloqueio por falta | Avisou sobre bloqueio de 12 meses? R$5.000 desconto? | ✅ |
| 9 | Confirmações do robô | Explicou os lembretes? | ✅ |
| 10 | Agradecimento | Finalizou cordialmente? | ⚪ |
| 11 | Pós-confirmação | Agradeceu comprometimento? | ⚪ |
| 12 | Prospecção | Usou cupom + escassez? | ⚪ |
| 13 | Objeções | Respondeu bem objeções? | ⚪ |
| 14 | Personalização | Usou nome do cliente? Criou conexão? | ✅ |

**Regras específicas - Casamento:**
- Presença obrigatória: Casal junto
- Duração reunião: 3 horas
- Sistema anti-falta: Bloqueio de 12 meses por falta
"""

ROTEIRO_15_ANOS = """
## ROTEIRO DE VENDAS - 15 ANOS (13 etapas)

| # | Etapa | O que verificar | Obrigatória |
|---|-------|-----------------|-------------|
| 1 | Apresentação inicial | Saudação + perguntou se é mãe/pai da aniversariante | ✅ |
| 2 | Envio de fotos | Enviou fotos do espaço? Perguntou se gostou? | ✅ |
| 3 | Explicação do Indaiá | Explicou os 80%? (buffet, bebidas, decoração, garçons, locação) | ✅ |
| 4 | Cardápio | Explicou + enviou PDF? | ✅ |
| 5 | Venda da reunião | Explicou valor da consultoria (R$500) + promoção gratuita? | ✅ |
| 6 | Agendamento | Usou ESCASSEZ? Impôs horário? | ✅ |
| 7 | Regras da reunião | Explicou: família junta + 2-3h + comprometimento? | ✅ |
| 8 | Confirmação do robô | Explicou os lembretes? | ✅ |
| 9 | Agradecimento | Finalizou cordialmente? | ⚪ |
| 10 | Pós-confirmação | Agradeceu comprometimento? | ⚪ |
| 11 | Prospecção | Usou cupom + escassez? | ⚪ |
| 12 | Objeções | Tratou objeções corretamente? | ⚪ |
| 13 | Pacotes promocionais | Mencionou Tiny/Colors corretamente? | ⚪ |

**Regras específicas - 15 Anos:**
- Se for a própria aniversariante → pedir contato do responsável
- Presença obrigatória: Família junta
- Duração reunião: 2-3 horas
"""

TIPOS_ERRO = """
## OS 7 TIPOS DE ERRO A DETECTAR

| # | Tipo | Descrição | Severidade |
|---|------|-----------|------------|
| 1 | pular_etapa | Não explicou Indaiá, não enviou cardápio, etc. | 🔴 Alta |
| 2 | sem_escassez | Não criou urgência | 🟡 Média |
| 3 | sem_personalizacao | Mensagens genéricas, não usou nome | 🟡 Média |
| 4 | nao_confirmou_regras | Não falou sobre presença, duração, bloqueio | 🔴 Alta |
| 5 | demora | Tempo de resposta > 10 minutos | 🟡 Média |
| 6 | mensagens_roboticas | Copiar/colar sem adaptar | 🟡 Média |
| 7 | nao_tratou_objecao | Cliente perguntou e atendente ignorou | 🔴 Alta |
"""

SYSTEM_PROMPT = f"""Você é um especialista em análise de conversas de pré-venda para a Indaiá Eventos, especializada em Casamentos e Festas de 15 Anos.

IMPORTANTE: O pré-vendedor NÃO VENDE, ele apenas AGENDA A REUNIÃO com o consultor.

{ROTEIRO_CASAMENTO}

{ROTEIRO_15_ANOS}

{TIPOS_ERRO}

## TÉCNICAS ESPERADAS
- **Escassez**: "última vaga", "cupom até dia X" - OBRIGATÓRIO
- **Personalização**: Usar nome do cliente - OBRIGATÓRIO
- **Exclusividade**: "vou abrir agenda só pra vocês" - Desejável
- **Validação**: "está de acordo?", "combinado?" - Desejável

## VALORES PARA VALIDAÇÃO
- Consultoria normal: R$ 500,00
- Consultoria promocional: Gratuita
- Desconto por presença: R$ 5.000
- Bloqueio por falta: 12 meses
- Pacote Tiny Fifteen: R$ 24.900 (até 70 pessoas)
- Pacote Colors Fifteen: R$ 28.900 (até 70 pessoas)

## FORMATO DE RESPOSTA

Responda APENAS com JSON válido (sem markdown):

{{
  "resumo": "Síntese da conversa em 2-3 frases",
  "tipo_evento": "casamento" | "15_anos" | "outro" | "nao_identificado",
  "atendente_nome": "Nome do atendente principal",
  
  "scores": {{
    "aderencia_roteiro": 0-100,
    "qualidade_atendimento": 0-100,
    "personalizacao": 0-100,
    "uso_escassez": 0-100,
    "score_geral": 0-100
  }},
  
  "etapas_cumpridas": {{
    "1_apresentacao": true/false,
    "2_fotos": true/false,
    "3_explicacao_indaia": true/false,
    "4_cardapio": true/false,
    "5_venda_reuniao": true/false,
    "6_escassez_horario": true/false,
    "7_regras_reuniao": true/false,
    "8_bloqueio_falta": true/false,
    "9_confirmacoes_robo": true/false,
    "10_agradecimento": true/false,
    "11_pos_confirmacao": true/false,
    "12_prospeccao": true/false,
    "13_objecoes": true/false,
    "14_personalizacao": true/false
  }},
  
  "erros_detectados": [
    {{
      "tipo": "pular_etapa|sem_escassez|sem_personalizacao|nao_confirmou_regras|demora|mensagens_roboticas|nao_tratou_objecao",
      "severidade": "alta|media|baixa",
      "descricao": "Descrição específica",
      "evidencia": "Trecho da conversa"
    }}
  ],
  
  "tom_cliente": {{
    "sentimento": "positivo|neutro|negativo",
    "engajamento": "alto|medio|baixo",
    "objecoes_levantadas": ["lista"]
  }},
  
  "tom_atendente": {{
    "sentimento": "positivo|neutro|negativo",
    "profissionalismo": "alto|medio|baixo"
  }},
  
  "ponto_parada": {{
    "cliente_parou_responder": true/false,
    "ultima_etapa": "nome da etapa",
    "possivel_motivo": "hipótese"
  }},
  
  "resultado": {{
    "agendamento_realizado": true/false,
    "proximo_passo": "recomendação"
  }},
  
  "pontos_positivos": ["lista"],
  "pontos_melhoria": ["lista"],
  "feedback_atendente": "Feedback direto e construtivo"
}}
"""

# ============================================
# FUNÇÕES HELPER
# ============================================

def extract_agent_name(content: str) -> Optional[str]:
    """Extrai nome do atendente do formato *Nome*:"""
    if not content:
        return None
    match = re.match(r'^\*([^*]+)\*:', content)
    if match:
        return match.group(1).strip()
    return None

def remove_agent_prefix(content: str) -> str:
    """Remove o prefixo *Nome*: da mensagem"""
    if not content:
        return ''
    return re.sub(r'^\*[^*]+\*:\s*\n?', '', content).strip()

def get_sender_type(msg: dict) -> Tuple[str, str]:
    """Retorna (tipo, nome) do remetente"""
    from_me = msg.get('from_me')
    content = msg.get('content') or ''
    
    if from_me == False:
        return ('cliente', 'Cliente')
    
    agent_name = extract_agent_name(content)
    if agent_name:
        return ('atendente', agent_name)
    
    return ('bot', 'Bot')

def format_message(msg: dict) -> str:
    """Formata uma mensagem para o contexto da IA"""
    sender_type, sender_name = get_sender_type(msg)
    
    sent_at = msg.get('sent_at', '')
    timestamp = ''
    if sent_at:
        try:
            dt = datetime.fromisoformat(sent_at.replace('Z', '+00:00'))
            timestamp = dt.strftime('%d/%m %H:%M')
        except:
            pass
    
    content = msg.get('content') or ''
    content_type = msg.get('content_type') or ''
    
    # Áudio
    if content_type == 'audio' or (content.startswith('{') and 'audio' in content.lower()):
        metadata = msg.get('metadata') or {}
        transcription = metadata.get('transcricao') or metadata.get('transcription')
        text = f"[ÁUDIO] {transcription}" if transcription else "[ÁUDIO - sem transcrição]"
    # Imagem
    elif content.startswith('{') and 'image' in content.lower():
        text = "[IMAGEM ENVIADA]"
    # Vídeo
    elif content.startswith('{') and 'video' in content.lower():
        text = "[VÍDEO ENVIADO]"
    # Documento
    elif content.startswith('{') and ('file' in content.lower() or 'document' in content.lower()):
        text = "[DOCUMENTO ENVIADO]"
    # Texto
    else:
        text = remove_agent_prefix(content) if sender_type == 'atendente' else content
    
    return f"{timestamp} | [{sender_type.upper()}] {sender_name}: {text}"

def calculate_response_times(messages: list) -> dict:
    """Calcula tempos de resposta do atendente"""
    response_times = []
    last_client_time = None
    
    for msg in messages:
        sender_type, _ = get_sender_type(msg)
        sent_at = msg.get('sent_at')
        
        if not sent_at:
            continue
            
        try:
            msg_time = datetime.fromisoformat(sent_at.replace('Z', '+00:00'))
        except:
            continue
        
        if sender_type == 'cliente':
            last_client_time = msg_time
        elif sender_type == 'atendente' and last_client_time:
            diff = (msg_time - last_client_time).total_seconds()
            if 0 < diff < 86400:
                response_times.append(diff)
            last_client_time = None
    
    if not response_times:
        return {'avg': 0, 'max': 0, 'min': 0, 'count': 0}
    
    return {
        'avg': sum(response_times) / len(response_times),
        'max': max(response_times),
        'min': min(response_times),
        'count': len(response_times)
    }

# ============================================
# FUNÇÃO PRINCIPAL DE ANÁLISE
# ============================================

@app.function(image=image, timeout=300)
def analyze_conversation(conversation_id: str) -> Dict[str, Any]:
    """
    Analisa uma conversa específica
    """
    import requests
    
    print(f"🎯 Analisando conversa: {conversation_id}")
    
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    
    base_url = f"{SUPABASE_URL}/rest/v1"
    
    # 1. Buscar conversa
    print("   📥 Buscando conversa...")
    resp = requests.get(
        f"{base_url}/conversations?id=eq.{conversation_id}&select=id,external_id,status,platform,created_at,tenant_id",
        headers=headers
    )
    resp.raise_for_status()
    conversations = resp.json()
    
    if not conversations:
        return {"error": "Conversa não encontrada", "conversation_id": conversation_id}
    
    conversation = conversations[0]
    tenant_id = conversation.get('tenant_id')
    
    # 2. Buscar contact da conversa
    resp = requests.get(
        f"{base_url}/contacts?id=eq.{conversation.get('contact_id', '')}&select=id,name,phone,identifier",
        headers=headers
    )
    contacts = resp.json() if resp.status_code == 200 else []
    contact = contacts[0] if contacts else {}
    
    print(f"   👤 Cliente: {contact.get('name') or contact.get('phone') or 'Desconhecido'}")
    
    # 3. Buscar mensagens
    print("   📨 Buscando mensagens...")
    resp = requests.get(
        f"{base_url}/messages?conversation_id=eq.{conversation_id}&select=id,content,content_type,sender_type,from_me,sent_at,metadata&order=sent_at.asc",
        headers=headers
    )
    resp.raise_for_status()
    messages = resp.json()
    
    print(f"   📊 Total: {len(messages)} mensagens")
    
    if len(messages) < 3:
        return {
            "error": "Conversa muito curta para análise",
            "conversation_id": conversation_id,
            "message_count": len(messages)
        }
    
    # 4. Contar por tipo
    client_msgs = [m for m in messages if get_sender_type(m)[0] == 'cliente']
    agent_msgs = [m for m in messages if get_sender_type(m)[0] == 'atendente']
    bot_msgs = [m for m in messages if get_sender_type(m)[0] == 'bot']
    
    print(f"   📈 Cliente: {len(client_msgs)} | Atendente: {len(agent_msgs)} | Bot: {len(bot_msgs)}")
    
    # 5. Calcular tempos
    response_times = calculate_response_times(messages)
    
    # 6. Formatar conversa
    formatted_messages = [format_message(msg) for msg in messages]
    conversation_text = "\n".join(formatted_messages)
    
    # 7. Montar contexto
    context = f"""
## INFORMAÇÕES DA CONVERSA

- **Cliente:** {contact.get('name') or 'Não informado'} ({contact.get('phone') or contact.get('identifier') or 'Sem telefone'})
- **Status:** {conversation.get('status')}
- **Total mensagens:** {len(messages)}
- **Mensagens cliente:** {len(client_msgs)}
- **Mensagens atendente:** {len(agent_msgs)}
- **Mensagens bot:** {len(bot_msgs)}
- **Tempo médio resposta:** {response_times['avg']/60:.1f} minutos
- **Tempo máximo resposta:** {response_times['max']/60:.1f} minutos

## HISTÓRICO DA CONVERSA

{conversation_text}

---

Analise esta conversa e retorne APENAS o JSON, sem markdown.
"""
    
    # 8. Chamar Claude via OpenRouter
    print("   🤖 Enviando para Claude...")
    
    openrouter_headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://indaia-analytics.vercel.app",
        "X-Title": "Indaia Analytics"
    }
    
    payload = {
        "model": "anthropic/claude-sonnet-4-20250514",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": context}
        ],
        "temperature": 0.3,
        "max_tokens": 4000
    }
    
    resp = requests.post(OPENROUTER_URL, headers=openrouter_headers, json=payload, timeout=120)
    resp.raise_for_status()
    result = resp.json()
    
    # 9. Extrair e parsear resposta
    assistant_message = result['choices'][0]['message']['content']
    
    # Limpar markdown se houver
    json_str = assistant_message
    if '```' in json_str:
        json_match = re.search(r'```(?:json)?\s*(.*?)\s*```', json_str, re.DOTALL)
        if json_match:
            json_str = json_match.group(1)
    
    try:
        analysis = json.loads(json_str)
    except json.JSONDecodeError as e:
        print(f"   ⚠️ Erro ao parsear JSON: {e}")
        analysis = {"raw_response": assistant_message, "parse_error": str(e)}
    
    # 10. Adicionar metadados
    analysis['_meta'] = {
        'conversation_id': conversation_id,
        'analyzed_at': datetime.now().isoformat(),
        'total_messages': len(messages),
        'client_messages': len(client_msgs),
        'agent_messages': len(agent_msgs),
        'bot_messages': len(bot_msgs),
        'response_time_avg_seconds': response_times['avg'],
        'response_time_max_seconds': response_times['max'],
        'model_used': 'claude-sonnet-4-20250514'
    }
    
    # 11. Salvar no Supabase
    print("   💾 Salvando análise...")
    
    # Preparar dados para salvar
    save_data = {
        'conversation_id': conversation_id,
        'tenant_id': tenant_id,
        'tipo_evento': analysis.get('tipo_evento'),
        'total_messages': len(messages),
        'customer_messages': len(client_msgs),
        'agent_messages': len(agent_msgs),
        'bot_messages': len(bot_msgs),
        'avg_response_time_seconds': response_times['avg'],
        'max_response_time_seconds': response_times['max'],
        'script_adherence_score': analysis.get('scores', {}).get('aderencia_roteiro'),
        'overall_score': analysis.get('scores', {}).get('score_geral'),
        'personalization_score': analysis.get('scores', {}).get('personalizacao'),
        'etapas_cumpridas': json.dumps(analysis.get('etapas_cumpridas', {})),
        'errors_detected': json.dumps(analysis.get('erros_detectados', [])),
        'customer_sentiment_label': analysis.get('tom_cliente', {}).get('sentimento'),
        'agent_sentiment_label': analysis.get('tom_atendente', {}).get('sentimento'),
        'cliente_parou_responder': analysis.get('ponto_parada', {}).get('cliente_parou_responder'),
        'agendamento_realizado': analysis.get('resultado', {}).get('agendamento_realizado'),
        'summary': analysis.get('resumo'),
        'positive_points': json.dumps(analysis.get('pontos_positivos', [])),
        'improvement_points': json.dumps(analysis.get('pontos_melhoria', [])),
        'raw_analysis': json.dumps(analysis),
        'model_used': 'claude-sonnet-4-20250514',
        'analyzed_at': datetime.now().isoformat()
    }
    
    # Upsert via API REST
    resp = requests.post(
        f"{base_url}/conversation_analyses",
        headers={**headers, "Prefer": "resolution=merge-duplicates"},
        json=save_data
    )
    
    if resp.status_code not in [200, 201]:
        print(f"   ⚠️ Erro ao salvar: {resp.text}")
    
    print(f"   ✅ Análise concluída! Score: {analysis.get('scores', {}).get('score_geral', 'N/A')}/100")
    
    return analysis

# ============================================
# COMANDOS CLI
# ============================================

@app.local_entrypoint()
def analyze_single_conversation(conversation_id: str = "76f0114a-6c03-4b6f-99d2-3634f4af844b"):
    """
    Analisa uma conversa específica
    
    Uso:
        modal run modal_analyze.py --conversation-id "UUID"
    """
    print("=" * 60)
    print("🎯 INDAIÁ ANALYTICS - Análise Individual")
    print("=" * 60)
    
    result = analyze_conversation.remote(conversation_id)
    
    # Exibir resultado formatado
    print("\n" + "=" * 60)
    print("📋 RESULTADO")
    print("=" * 60)
    
    if 'error' in result:
        print(f"\n❌ Erro: {result['error']}")
        return
    
    if 'raw_response' in result:
        print(f"\n⚠️ Resposta não estruturada:")
        print(result['raw_response'][:500])
        return
    
    # Resumo
    print(f"\n📝 RESUMO: {result.get('resumo', 'N/A')}")
    print(f"🎯 TIPO: {result.get('tipo_evento', 'N/A').upper()}")
    print(f"👤 ATENDENTE: {result.get('atendente_nome', 'N/A')}")
    
    # Scores
    scores = result.get('scores', {})
    print(f"\n📊 SCORES:")
    print(f"   Aderência: {scores.get('aderencia_roteiro', 0)}/100")
    print(f"   Qualidade: {scores.get('qualidade_atendimento', 0)}/100")
    print(f"   Personalização: {scores.get('personalizacao', 0)}/100")
    print(f"   Escassez: {scores.get('uso_escassez', 0)}/100")
    print(f"   🏆 GERAL: {scores.get('score_geral', 0)}/100")
    
    # Erros
    erros = result.get('erros_detectados', [])
    print(f"\n⚠️ ERROS: {len(erros)}")
    for e in erros[:5]:
        sev = "🔴" if e.get('severidade') == 'alta' else "🟡"
        print(f"   {sev} {e.get('tipo')}: {e.get('descricao', '')[:60]}")
    
    # Resultado
    agendou = result.get('resultado', {}).get('agendamento_realizado', False)
    print(f"\n🎯 RESULTADO: {'✅ AGENDOU' if agendou else '❌ NÃO AGENDOU'}")
    
    # Feedback
    print(f"\n💬 FEEDBACK:")
    print(f"   {result.get('feedback_atendente', 'N/A')[:200]}")
    
    print("\n" + "=" * 60)
    print("✅ Análise salva no banco de dados!")
    print("=" * 60)


@app.function(image=image, timeout=600, schedule=modal.Cron("0 6 * * *"))
def analyze_pending_conversations():
    """
    Analisa todas as conversas pendentes (roda todo dia às 6h)
    
    Critérios:
    - Conversas com status 'pending' ou 'open'
    - Que ainda não foram analisadas
    - Com pelo menos 5 mensagens
    """
    import requests
    
    print("=" * 60)
    print("🎯 INDAIÁ ANALYTICS - Análise em Lote")
    print(f"⏰ Iniciado em: {datetime.now().isoformat()}")
    print("=" * 60)
    
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    
    base_url = f"{SUPABASE_URL}/rest/v1"
    
    # Buscar conversas pendentes
    resp = requests.get(
        f"{base_url}/conversations?status=in.(pending,open)&select=id&limit=50",
        headers=headers
    )
    
    conversations = resp.json() if resp.status_code == 200 else []
    print(f"\n📋 Conversas para analisar: {len(conversations)}")
    
    analyzed = 0
    errors = 0
    
    for conv in conversations:
        conv_id = conv['id']
        try:
            # Verificar se já foi analisada
            resp = requests.get(
                f"{base_url}/conversation_analyses?conversation_id=eq.{conv_id}&select=id",
                headers=headers
            )
            existing = resp.json() if resp.status_code == 200 else []
            
            if existing:
                print(f"   ⏭️ Já analisada: {conv_id[:8]}")
                continue
            
            # Analisar
            analyze_conversation.remote(conv_id)
            analyzed += 1
            
        except Exception as e:
            print(f"   ❌ Erro em {conv_id[:8]}: {e}")
            errors += 1
    
    print(f"\n✅ Concluído: {analyzed} analisadas, {errors} erros")
    return {"analyzed": analyzed, "errors": errors}