"""
🎯 INDAIÁ ANALYTICS - Sistema de Agentes
v2.0 - Seguindo PRD completo

Agentes:
1. analyze_conversation - Análise individual com roteiros
2. generate_agent_report - Relatório por atendente
3. analyze_batch - Análise em lote (período)

Deploy:
    modal deploy modal_agents.py

Rodar análise individual:
    modal run modal_agents.py::run_single --conversation-id "UUID"

Rodar análise em lote (Novembro):
    modal run modal_agents.py::run_batch --month 11 --year 2024 --limit 100

Gerar relatório de atendente:
    modal run modal_agents.py::run_agent_report --agent-name "Pedro Azevedo"
"""

import modal
import json
import re
from datetime import datetime, timedelta
from typing import Optional, Tuple, List, Dict, Any

# ============================================
# CONFIGURAÇÃO DO MODAL
# ============================================

app = modal.App("indaia-analytics-v2")

image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "requests",
)

# ============================================
# CREDENCIAIS
# ============================================

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")

# ============================================
# ROTEIROS DE VENDAS (DO PRD)
# ============================================

ROTEIRO_CASAMENTO = """
## ROTEIRO DE VENDAS - CASAMENTO (14 etapas)

| # | Etapa | O que verificar | Obrigatória |
|---|-------|-----------------|-------------|
| 1 | Apresentação inicial | Saudação + identificação do evento (data, convidados) | ✅ SIM |
| 2 | Envio de fotos | Enviou fotos do espaço? Perguntou se gostou? | ✅ SIM |
| 3 | Explicação do Indaiá | Explicou os 80%? (buffet, bebidas, decoração, garçons, locação) | ✅ SIM |
| 4 | Cardápio | Explicou + enviou PDF? | ✅ SIM |
| 5 | Venda da reunião | Explicou valor da consultoria (R$500) + promoção gratuita? | ✅ SIM |
| 6 | Imposição de horário | Usou ESCASSEZ? ("último horário disponível", "agenda lotada") | ✅ SIM |
| 7 | Regras da reunião | Explicou: presença do CASAL + 3h de duração + comprometimento? | ✅ SIM |
| 8 | Bloqueio por falta | Avisou sobre bloqueio de 12 meses? Desconto de R$5.000? | ✅ SIM |
| 9 | Confirmações do robô | Explicou os lembretes automáticos (5d, 3d, 1d)? | ✅ SIM |
| 10 | Agradecimento | Finalizou cordialmente? | ⚪ NÃO |
| 11 | Pós-confirmação | Agradeceu comprometimento? | ⚪ NÃO |
| 12 | Prospecção | Usou cupom + escassez? | ⚪ NÃO |
| 13 | Objeções | Tratou bem objeções como "quero orçamento pelo WhatsApp"? | ⚪ NÃO |
| 14 | Personalização | Usou nome do cliente? Criou conexão pessoal? | ✅ SIM |

REGRAS ESPECÍFICAS CASAMENTO:
- Presença obrigatória: CASAL JUNTO na reunião
- Duração reunião: 3 HORAS
- Sistema anti-falta: Bloqueio de 12 MESES por falta
"""

ROTEIRO_15_ANOS = """
## ROTEIRO DE VENDAS - 15 ANOS (13 etapas)

| # | Etapa | O que verificar | Obrigatória |
|---|-------|-----------------|-------------|
| 1 | Apresentação inicial | Saudação + perguntou se é mãe/pai da aniversariante | ✅ SIM |
| 2 | Envio de fotos | Enviou fotos do espaço? Perguntou se gostou? | ✅ SIM |
| 3 | Explicação do Indaiá | Explicou os 80%? (buffet, bebidas, decoração, garçons, locação) | ✅ SIM |
| 4 | Cardápio | Explicou + enviou PDF? | ✅ SIM |
| 5 | Venda da reunião | Explicou valor da consultoria (R$500) + promoção gratuita? | ✅ SIM |
| 6 | Agendamento | Usou ESCASSEZ? Impôs horário específico? | ✅ SIM |
| 7 | Regras da reunião | Explicou: FAMÍLIA JUNTA + 2-3h de duração + comprometimento? | ✅ SIM |
| 8 | Confirmação do robô | Explicou os lembretes automáticos? | ✅ SIM |
| 9 | Agradecimento | Finalizou cordialmente? | ⚪ NÃO |
| 10 | Pós-confirmação | Agradeceu comprometimento? | ⚪ NÃO |
| 11 | Prospecção | Usou cupom + escassez? | ⚪ NÃO |
| 12 | Objeções | Tratou objeções corretamente? | ⚪ NÃO |
| 13 | Pacotes promocionais | Mencionou Tiny (R$24.900) ou Colors (R$28.900)? | ⚪ NÃO |

REGRAS ESPECÍFICAS 15 ANOS:
- Se for a própria aniversariante → PEDIR CONTATO DO RESPONSÁVEL
- Presença obrigatória: FAMÍLIA JUNTA (responsáveis + aniversariante)
- Duração reunião: 2-3 HORAS
- Em caso de falta de responsável → reunião é REAGENDADA
"""

OS_7_ERROS = """
## OS 7 TIPOS DE ERRO A DETECTAR

| # | Tipo | Descrição | Severidade | Como detectar |
|---|------|-----------|------------|---------------|
| 1 | PULAR_ETAPA | Não explicou o Indaiá, não enviou cardápio, etc | 🔴 ALTA | Checklist de etapas |
| 2 | SEM_ESCASSEZ | Não criou urgência ("última vaga", "cupom acaba") | 🟡 MÉDIA | 0 usos de escassez |
| 3 | SEM_PERSONALIZACAO | Mensagens genéricas, não usou nome do cliente | 🟡 MÉDIA | <3 usos do nome |
| 4 | NAO_CONFIRMOU_REGRAS | Não falou sobre presença de todos, duração, bloqueio | 🔴 ALTA | Checklist de regras |
| 5 | DEMORA | Tempo de resposta > 10 minutos | 🟡 MÉDIA | Calcular tempo entre mensagens |
| 6 | MENSAGENS_ROBOTICAS | Copiar/colar sem adaptar, sem variação | 🟡 MÉDIA | Detectar padrões repetidos |
| 7 | NAO_TRATOU_OBJECAO | Cliente perguntou algo e atendente ignorou | 🔴 ALTA | Detectar perguntas não respondidas |
"""

VALORES_REFERENCIA = """
## VALORES PARA VALIDAÇÃO

| Item | Valor Correto |
|------|---------------|
| Consultoria (normal) | R$ 500,00 |
| Consultoria (promocional) | GRATUITA |
| Desconto por presença | R$ 5.000,00 |
| Bloqueio por falta | 12 MESES |
| Pacote Tiny Fifteen | R$ 24.900 (até 70 pessoas) |
| Pacote Colors Fifteen | R$ 28.900 (até 70 pessoas) |
"""

# ============================================
# SYSTEM PROMPT DO AGENTE
# ============================================

SYSTEM_PROMPT = f"""Você é um analista especializado em avaliar conversas de pré-vendas da Indaiá Eventos.

## CONTEXTO DO NEGÓCIO

A Indaiá Eventos é uma casa de eventos especializada em:
- Casamentos
- Festas de 15 anos

O PRÉ-VENDEDOR NÃO VENDE - ele apenas AGENDA A REUNIÃO com o consultor.

Fluxo: Cliente (WhatsApp) → Bot (triagem) → Pré-vendedor → Agendamento → Consultor (fecha venda)

{ROTEIRO_CASAMENTO}

{ROTEIRO_15_ANOS}

{OS_7_ERROS}

{VALORES_REFERENCIA}

## TÉCNICAS DE VENDAS ESPERADAS

1. **ESCASSEZ** (OBRIGATÓRIO): "última vaga", "cupom até dia X", "data disputada", "menos de 5 cupons"
2. **PERSONALIZAÇÃO** (OBRIGATÓRIO): Usar nome do cliente, criar conexão, elogiar escolhas
3. **EXCLUSIVIDADE** (desejável): "vou tentar abrir agenda só pra vocês"
4. **VALIDAÇÃO** (desejável): "está de acordo?", "combinado?", "é interessante?"

## IDENTIFICAÇÃO DO TIPO DE EVENTO

Identifique pelo menu do bot ou palavras-chave:
- Casamento: cliente responde "1" ou menciona "casamento", "noivo", "noiva", "casal"
- 15 Anos: cliente responde "2" ou menciona "15 anos", "quinze", "debutante", "aniversariante"

## IMPORTANTE: MÚLTIPLOS ATENDENTES

Uma conversa pode ter MÚLTIPLOS ATENDENTES. Você deve:
1. Identificar CADA atendente que participou (pelo nome no formato *Nome:*)
2. Analisar a performance de CADA UM separadamente
3. Considerar o CONTEXTO (quem pegou a conversa "quebrada"?)
4. Ser JUSTO com quem assumiu conversa no meio

## SUA TAREFA

Analise a conversa e retorne um JSON com a seguinte estrutura:

```json
{{
  "resumo": "Síntese da conversa em 2-3 frases",
  "tipo_evento": "casamento" | "15_anos" | "outro" | "nao_identificado",
  
  "atendentes": [
    {{
      "nome": "Nome do Atendente 1",
      "mensagens_enviadas": 15,
      "ordem": 1,
      "contexto": "Iniciou o atendimento" | "Assumiu no meio" | "Finalizou",
      
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
          "tipo": "PULAR_ETAPA" | "SEM_ESCASSEZ" | "SEM_PERSONALIZACAO" | "NAO_CONFIRMOU_REGRAS" | "DEMORA" | "MENSAGENS_ROBOTICAS" | "NAO_TRATOU_OBJECAO",
          "severidade": "alta" | "media" | "baixa",
          "descricao": "Descrição específica do erro",
          "evidencia": "Trecho ou contexto que comprova o erro"
        }}
      ],
      
      "contagem_erros": {{
        "pular_etapa": 0,
        "sem_escassez": 0,
        "sem_personalizacao": 0,
        "nao_confirmou_regras": 0,
        "demora": 0,
        "mensagens_roboticas": 0,
        "nao_tratou_objecao": 0
      }},
      
      "pontos_positivos": ["lista de pontos fortes DESTE atendente"],
      "pontos_melhoria": ["lista de melhorias DESTE atendente"],
      "feedback": "Feedback específico para ESTE atendente"
    }}
  ],
  
  "atendente_principal": "Nome do atendente que mais contribuiu",
  
  "transicoes": [
    {{
      "de": "Atendente 1",
      "para": "Atendente 2", 
      "momento": "Após etapa X",
      "contexto": "Cliente foi transferido porque..."
    }}
  ],
  
  "analise_geral": {{
    "score_conversa": 0-100,
    "etapas_cumpridas_total": {{
      "1_apresentacao": true/false,
      ...
    }},
    "total_erros": 0,
    "erros_por_tipo": {{
      "pular_etapa": 0,
      "sem_escassez": 0,
      ...
    }}
  }},
  
  "tom_cliente": {{
    "sentimento": "positivo" | "neutro" | "negativo",
    "engajamento": "alto" | "medio" | "baixo",
    "objecoes_levantadas": ["lista de objeções"]
  }},
  
  "ponto_parada": {{
    "cliente_parou_responder": true/false,
    "ultima_etapa_antes_parar": número ou null,
    "ultimo_atendente": "Nome",
    "possivel_motivo": "hipótese do motivo"
  }},
  
  "resultado": {{
    "agendamento_realizado": true/false,
    "data_agendada": "data se identificada ou null",
    "responsavel_pelo_resultado": "Nome do atendente que fechou ou perdeu"
  }}
}}
```

REGRAS IMPORTANTES:
1. Se houver apenas 1 atendente, o array "atendentes" terá apenas 1 elemento
2. Se houver apenas BOT e CLIENTE, retorne array vazio e explique no resumo
3. Analise CADA atendente separadamente - não misture erros/acertos
4. Seja JUSTO: quem pegou conversa no meio não pode ser penalizado por etapas anteriores
5. O "atendente_principal" é quem mais contribuiu para o resultado (positivo ou negativo)
6. Retorne APENAS o JSON, sem markdown ou texto adicional
"""

# ============================================
# FUNÇÕES AUXILIARES
# ============================================

def extract_agent_name(content: str) -> Optional[str]:
    """Extrai nome do atendente do formato *Nome:* ou *Atendente - Nome:*"""
    if not content:
        return None
    
    # Formato: *Pedro Azevedo:* ou *Atendente - Gabriel (Organização Eventos):*
    match = re.match(r'^\*([^:]+):\*', content)
    if match:
        name = match.group(1).strip()
        # Remove prefixos como "Atendente - "
        if ' - ' in name:
            name = name.split(' - ')[-1].strip()
        # Remove sufixos como "(Organização Eventos)"
        if '(' in name:
            name = name.split('(')[0].strip()
        return name
    
    # Fallback: formato *Nome*: (menos comum)
    match = re.match(r'^\*([^*]+)\*:', content)
    if match:
        name = match.group(1).strip()
        if ' - ' in name:
            name = name.split(' - ')[-1].strip()
        return name
    
    return None


def get_sender_type(msg: dict) -> Tuple[str, Optional[str]]:
    """Retorna (tipo, nome_atendente)"""
    content = msg.get('content') or ''
    from_me = msg.get('from_me', False)
    sender_type = msg.get('sender_type', '')
    
    if sender_type == 'customer' or not from_me:
        return ('cliente', None)
    
    agent_name = extract_agent_name(content)
    if agent_name:
        return ('atendente', agent_name)
    
    if sender_type == 'agent':
        return ('atendente', None)
    
    return ('bot', None)


def format_message(msg: dict) -> str:
    """Formata mensagem para contexto da IA"""
    sender_type, agent_name = get_sender_type(msg)
    content = msg.get('content') or '[sem conteúdo]'
    sent_at = msg.get('sent_at', '')
    
    # Remove prefixo do atendente
    if sender_type == 'atendente' and content.startswith('*'):
        content = re.sub(r'^\*[^:]+:\*\s*\n?', '', content)
    
    # Detectar tipo de conteúdo
    content_type = msg.get('content_type', 'text')
    
    if content_type == 'audio' or '"file_type":"audio"' in content:
        # Usar transcrição se disponível
        transcription = msg.get('transcription')
        if transcription:
            content = f'[🎤 ÁUDIO TRANSCRITO]: "{transcription}"'
        else:
            content = '[🎤 ÁUDIO - sem transcrição]'
    elif content_type == 'image' or '"file_type":"image"' in content:
        content = '[📷 IMAGEM ENVIADA]'
    elif content_type == 'document' or '"file_type":"file"' in content:
        content = '[📄 DOCUMENTO/PDF ENVIADO]'
    
    # Limitar tamanho
    if len(content) > 800:
        content = content[:800] + '...'
    
    labels = {
        'cliente': '👤 CLIENTE',
        'atendente': f'💼 ATENDENTE ({agent_name})' if agent_name else '💼 ATENDENTE',
        'bot': '🤖 BOT'
    }
    
    time_str = sent_at[11:16] if sent_at and len(sent_at) > 16 else ''
    return f"[{time_str}] {labels.get(sender_type, '?')}: {content}"


def calculate_response_times(messages: list) -> dict:
    """Calcula tempos de resposta do atendente"""
    times = []
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
            delta = (msg_time - last_client_time).total_seconds()
            if delta > 0 and delta < 86400:  # menos de 24h
                times.append(delta)
            last_client_time = None
    
    if not times:
        return {'avg': 0, 'max': 0, 'above_10min': 0}
    
    return {
        'avg': sum(times) / len(times),
        'max': max(times),
        'above_10min': len([t for t in times if t > 600])
    }


# ============================================
# AGENTE 1: ANÁLISE INDIVIDUAL
# ============================================

@app.function(image=image, timeout=300)
def analyze_conversation(conversation_id: str) -> Dict[str, Any]:
    """Analisa uma conversa individual com roteiros completos"""
    import requests
    
    print(f"🎯 Analisando: {conversation_id[:8]}...")
    
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    base_url = f"{SUPABASE_URL}/rest/v1"
    
    # 1. Buscar conversa
    resp = requests.get(
        f"{base_url}/conversations?id=eq.{conversation_id}&select=*",
        headers=headers
    )
    conversations = resp.json() if resp.status_code == 200 else []
    
    if not conversations:
        return {"error": "Conversa não encontrada", "conversation_id": conversation_id}
    
    conversation = conversations[0]
    tenant_id = conversation.get('tenant_id')
    
    # 2. Buscar contact
    contact_id = conversation.get('contact_id')
    contact = {}
    if contact_id:
        resp = requests.get(
            f"{base_url}/contacts?id=eq.{contact_id}&select=*",
            headers=headers
        )
        contacts = resp.json() if resp.status_code == 200 else []
        contact = contacts[0] if contacts else {}
    
    # 3. Buscar mensagens
    resp = requests.get(
        f"{base_url}/messages?conversation_id=eq.{conversation_id}&select=*&order=sent_at.asc",
        headers=headers
    )
    messages = resp.json() if resp.status_code == 200 else []
    
    if len(messages) < 3:
        return {
            "error": "Conversa muito curta",
            "conversation_id": conversation_id,
            "message_count": len(messages)
        }
    
    # 3b. Buscar transcrições dos áudios
    audio_msg_ids = [m['id'] for m in messages if m.get('content_type') == 'audio']
    transcriptions = {}
    
    if audio_msg_ids:
        resp = requests.get(
            f"{base_url}/transcriptions?message_id=in.({','.join(audio_msg_ids)})&status=eq.completed&select=message_id,transcription",
            headers=headers
        )
        trans_list = resp.json() if resp.status_code == 200 else []
        transcriptions = {t['message_id']: t['transcription'] for t in trans_list}
        print(f"   🎤 Transcrições encontradas: {len(transcriptions)}/{len(audio_msg_ids)} áudios")
    
    # Adicionar transcrições às mensagens
    for msg in messages:
        if msg['id'] in transcriptions:
            msg['transcription'] = transcriptions[msg['id']]
    
    # 4. Identificar atendente via agent_id da conversa
    agent_name = None
    agent_id = conversation.get('agent_id')
    
    if agent_id:
        resp = requests.get(
            f"{base_url}/agents?id=eq.{agent_id}&select=name",
            headers=headers
        )
        agents = resp.json() if resp.status_code == 200 else []
        if agents:
            agent_name = agents[0].get('name')
    
    # Fallback: tentar extrair do conteúdo das mensagens
    if not agent_name:
        for msg in messages:
            _, name = get_sender_type(msg)
            if name:
                agent_name = name
                break
    
    print(f"   👤 Atendente: {agent_name or 'Não identificado'}")
    
    # 5. Contar mensagens
    client_msgs = [m for m in messages if get_sender_type(m)[0] == 'cliente']
    agent_msgs = [m for m in messages if get_sender_type(m)[0] == 'atendente']
    bot_msgs = [m for m in messages if get_sender_type(m)[0] == 'bot']
    
    # 6. Calcular tempos
    response_times = calculate_response_times(messages)
    
    # 7. Formatar conversa
    formatted = [format_message(m) for m in messages]
    conversation_text = "\n".join(formatted)
    
    # 8. Contexto para IA
    context = f"""
## INFORMAÇÕES DA CONVERSA

- **Cliente:** {contact.get('name') or 'Não informado'} ({contact.get('phone') or contact.get('identifier') or '?'})
- **Atendente identificado:** {agent_name or 'Não identificado'}
- **Status:** {conversation.get('status')}
- **Total mensagens:** {len(messages)}
- **Mensagens cliente:** {len(client_msgs)}
- **Mensagens atendente:** {len(agent_msgs)}
- **Mensagens bot:** {len(bot_msgs)}
- **Tempo médio resposta:** {response_times['avg']/60:.1f} min
- **Tempo máximo resposta:** {response_times['max']/60:.1f} min
- **Respostas > 10min:** {response_times['above_10min']}

## HISTÓRICO DA CONVERSA

{conversation_text}

---

Analise esta conversa seguindo os roteiros e detectando os 7 tipos de erro.
Retorne APENAS o JSON, sem markdown.
"""
    
    # 9. Chamar Claude
    openrouter_headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://indaia-analytics.vercel.app",
        "X-Title": "Indaia Analytics"
    }
    
    payload = {
        "model": "anthropic/claude-3.5-sonnet",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": context}
        ],
        "temperature": 0.2,
        "max_tokens": 4000
    }
    
    resp = requests.post(OPENROUTER_URL, headers=openrouter_headers, json=payload, timeout=120)
    
    if resp.status_code != 200:
        print(f"   ❌ Erro OpenRouter: {resp.status_code} - {resp.text[:200]}")
        return {"error": f"OpenRouter error: {resp.status_code}"}
    
    result = resp.json()
    assistant_message = result['choices'][0]['message']['content']
    
    # 10. Parsear JSON
    json_str = assistant_message
    if '```' in json_str:
        match = re.search(r'```(?:json)?\s*(.*?)\s*```', json_str, re.DOTALL)
        if match:
            json_str = match.group(1)
    
    try:
        analysis = json.loads(json_str)
    except json.JSONDecodeError as e:
        print(f"   ⚠️ Erro parse JSON: {e}")
        analysis = {"raw_response": assistant_message, "parse_error": str(e)}
    
    # 11a. Garantir que atendente_nome esteja no analysis
    if agent_name and not analysis.get('atendente_nome'):
        analysis['atendente_nome'] = agent_name
    
    # 11b. Adicionar metadados
    analysis['_meta'] = {
        'conversation_id': conversation_id,
        'agent_name_from_db': agent_name,
        'analyzed_at': datetime.now().isoformat(),
        'total_messages': len(messages),
        'client_messages': len(client_msgs),
        'agent_messages': len(agent_msgs),
        'bot_messages': len(bot_msgs),
        'response_time_avg_seconds': response_times['avg'],
        'response_time_max_seconds': response_times['max'],
        'model_used': 'claude-3.5-sonnet'
    }
    
    # 12. Extrair dados para salvamento (nova estrutura com múltiplos atendentes)
    atendentes = analysis.get('atendentes', [])
    atendente_principal = analysis.get('atendente_principal')
    analise_geral = analysis.get('analise_geral', {})
    
    # Pegar scores do atendente principal ou da análise geral
    if atendentes:
        # Encontrar atendente principal
        principal = next((a for a in atendentes if a.get('nome') == atendente_principal), atendentes[0] if atendentes else {})
        scores = principal.get('scores', {})
        etapas = principal.get('etapas_cumpridas', {})
        
        # Agregar todos os erros de todos os atendentes
        todos_erros = []
        contagem_total = {
            'pular_etapa': 0,
            'sem_escassez': 0,
            'sem_personalizacao': 0,
            'nao_confirmou_regras': 0,
            'demora': 0,
            'mensagens_roboticas': 0,
            'nao_tratou_objecao': 0
        }
        for atendente in atendentes:
            for erro in atendente.get('erros_detectados', []):
                erro_com_atendente = {**erro, 'atendente': atendente.get('nome')}
                todos_erros.append(erro_com_atendente)
            for key in contagem_total:
                contagem_total[key] += atendente.get('contagem_erros', {}).get(key, 0)
    else:
        # Fallback para estrutura antiga (sem atendentes)
        scores = analysis.get('scores', {})
        etapas = analysis.get('etapas_cumpridas', {})
        todos_erros = analysis.get('erros_detectados', [])
        contagem_total = analysis.get('contagem_erros', {})
    
    # Score geral: usar da análise geral ou do atendente principal
    score_geral = analise_geral.get('score_conversa') or scores.get('score_geral', 0)
    
    # Quantidade de atendentes
    num_atendentes = len(atendentes)
    
    # 13. Salvar no Supabase
    save_data = {
        'conversation_id': conversation_id,
        'tenant_id': tenant_id,
        'agent_id': agent_id,  # Link direto com tabela agents (atendente do banco)
        'tipo_evento': analysis.get('tipo_evento'),
        'total_messages': len(messages),
        'customer_messages': len(client_msgs),
        'agent_messages': len(agent_msgs),
        'bot_messages': len(bot_msgs),
        'avg_response_time_seconds': response_times['avg'],
        'max_response_time_seconds': response_times['max'],
        'script_adherence_score': scores.get('aderencia_roteiro'),
        'overall_score': score_geral,
        'personalization_score': scores.get('personalizacao'),
        'etapas_cumpridas': json.dumps(analise_geral.get('etapas_cumpridas_total', etapas)),
        'errors_detected': json.dumps(todos_erros),
        'errors_count': json.dumps(analise_geral.get('erros_por_tipo', contagem_total)),
        'customer_sentiment_label': analysis.get('tom_cliente', {}).get('sentimento'),
        'agent_sentiment_label': None,  # Agora temos múltiplos atendentes
        'cliente_parou_responder': analysis.get('ponto_parada', {}).get('cliente_parou_responder'),
        'ultima_etapa_cliente': analysis.get('ponto_parada', {}).get('ultima_etapa_antes_parar'),
        'agendamento_realizado': analysis.get('resultado', {}).get('agendamento_realizado'),
        'summary': analysis.get('resumo'),
        'positive_points': json.dumps([]),  # Agora está por atendente
        'improvement_points': json.dumps([]),  # Agora está por atendente
        'raw_analysis': json.dumps(analysis),
        'model_used': 'claude-3.5-sonnet',
        'analyzed_at': datetime.now().isoformat()
    }
    
    # Upsert
    resp = requests.post(
        f"{base_url}/conversation_analyses",
        headers={**headers, "Prefer": "resolution=merge-duplicates"},
        json=save_data
    )
    
    # Log
    atendentes_nomes = [a.get('nome') for a in atendentes] if atendentes else ['?']
    print(f"   ✅ Score: {score_geral}/100 | Erros: {len(todos_erros)} | Atendentes: {', '.join(atendentes_nomes)}")
    
    return analysis


# ============================================
# AGENTE 2: ANÁLISE EM LOTE
# ============================================

@app.function(image=image, timeout=3600)
def analyze_batch(
    month: int = 11,
    year: int = 2024,
    limit: int = 50,
    skip_analyzed: bool = True
) -> Dict[str, Any]:
    """Analisa conversas em lote de um período"""
    import requests
    
    print("=" * 60)
    print(f"🎯 ANÁLISE EM LOTE - {month:02d}/{year}")
    print("=" * 60)
    
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    base_url = f"{SUPABASE_URL}/rest/v1"
    
    # Calcular período
    start_date = f"{year}-{month:02d}-01"
    if month == 12:
        end_date = f"{year + 1}-01-01"
    else:
        end_date = f"{year}-{month + 1:02d}-01"
    
    print(f"📅 Período: {start_date} a {end_date}")
    
    # Buscar conversas do período
    resp = requests.get(
        f"{base_url}/conversations?created_at=gte.{start_date}&created_at=lt.{end_date}&select=id&limit={limit * 2}",
        headers=headers
    )
    
    conversations = resp.json() if resp.status_code == 200 else []
    print(f"📋 Conversas encontradas: {len(conversations)}")
    
    if not conversations:
        return {"error": "Nenhuma conversa encontrada", "period": f"{month}/{year}"}
    
    # Filtrar já analisadas
    if skip_analyzed:
        conv_ids = [c['id'] for c in conversations]
        resp = requests.get(
            f"{base_url}/conversation_analyses?select=conversation_id",
            headers=headers
        )
        analyzed = resp.json() if resp.status_code == 200 else []
        analyzed_ids = {a['conversation_id'] for a in analyzed}
        
        conversations = [c for c in conversations if c['id'] not in analyzed_ids]
        print(f"📋 Após filtrar analisadas: {len(conversations)}")
    
    # Limitar
    conversations = conversations[:limit]
    print(f"📋 Processando: {len(conversations)}")
    
    # Analisar cada uma
    results = {
        "total": len(conversations),
        "success": 0,
        "errors": 0,
        "analyses": []
    }
    
    for i, conv in enumerate(conversations):
        conv_id = conv['id']
        print(f"\n[{i+1}/{len(conversations)}] {conv_id[:8]}...")
        
        try:
            analysis = analyze_conversation.remote(conv_id)
            
            if 'error' in analysis:
                results['errors'] += 1
            else:
                results['success'] += 1
                results['analyses'].append({
                    'id': conv_id,
                    'score': analysis.get('scores', {}).get('score_geral'),
                    'tipo': analysis.get('tipo_evento'),
                    'erros': len(analysis.get('erros_detectados', []))
                })
        except Exception as e:
            print(f"   ❌ Erro: {e}")
            results['errors'] += 1
    
    print("\n" + "=" * 60)
    print(f"✅ CONCLUÍDO: {results['success']} sucesso, {results['errors']} erros")
    print("=" * 60)
    
    return results


# ============================================
# AGENTE 3: RELATÓRIO POR ATENDENTE
# ============================================

@app.function(image=image, timeout=300)
def generate_agent_report(agent_name: str, days: int = 30) -> Dict[str, Any]:
    """Gera relatório agregado de um atendente"""
    import requests
    
    print(f"📊 Gerando relatório: {agent_name} (últimos {days} dias)")
    
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    base_url = f"{SUPABASE_URL}/rest/v1"
    
    # Buscar análises do período
    start_date = (datetime.now() - timedelta(days=days)).isoformat()
    
    resp = requests.get(
        f"{base_url}/conversation_analyses?analyzed_at=gte.{start_date}&select=*",
        headers=headers
    )
    
    analyses = resp.json() if resp.status_code == 200 else []
    
    if not analyses:
        return {"error": "Nenhuma análise encontrada", "agent": agent_name}
    
    # Filtrar por atendente (pelo raw_analysis)
    agent_analyses = []
    for a in analyses:
        raw = a.get('raw_analysis')
        if raw:
            try:
                data = json.loads(raw) if isinstance(raw, str) else raw
                if data.get('atendente_nome', '').lower() == agent_name.lower():
                    agent_analyses.append(a)
            except:
                pass
    
    if not agent_analyses:
        return {"error": f"Nenhuma análise encontrada para {agent_name}", "total_analyses": len(analyses)}
    
    # Agregar métricas
    total = len(agent_analyses)
    scores = [a.get('overall_score') or 0 for a in agent_analyses]
    adherence = [a.get('script_adherence_score') or 0 for a in agent_analyses]
    agendamentos = sum(1 for a in agent_analyses if a.get('agendamento_realizado'))
    
    # Contar erros
    total_errors = {
        'pular_etapa': 0,
        'sem_escassez': 0,
        'sem_personalizacao': 0,
        'nao_confirmou_regras': 0,
        'demora': 0,
        'mensagens_roboticas': 0,
        'nao_tratou_objecao': 0
    }
    
    for a in agent_analyses:
        errors_count = a.get('errors_count')
        if errors_count:
            try:
                ec = json.loads(errors_count) if isinstance(errors_count, str) else errors_count
                for key in total_errors:
                    total_errors[key] += ec.get(key, 0)
            except:
                pass
    
    # Relatório
    report = {
        'atendente': agent_name,
        'periodo_dias': days,
        'total_conversas': total,
        'taxa_agendamento': round(agendamentos / total * 100, 1) if total > 0 else 0,
        'score_medio': round(sum(scores) / len(scores), 1) if scores else 0,
        'aderencia_media': round(sum(adherence) / len(adherence), 1) if adherence else 0,
        'contagem_erros': total_errors,
        'erro_mais_comum': max(total_errors, key=total_errors.get) if any(total_errors.values()) else None,
        'generated_at': datetime.now().isoformat()
    }
    
    print(f"   ✅ Conversas: {total}")
    print(f"   📊 Score médio: {report['score_medio']}/100")
    print(f"   🎯 Taxa agendamento: {report['taxa_agendamento']}%")
    print(f"   ⚠️ Erro mais comum: {report['erro_mais_comum']}")
    
    return report


# ============================================
# CRON: ANÁLISE AUTOMÁTICA DE NOVAS CONVERSAS
# ============================================

@app.function(image=image, timeout=3600, schedule=modal.Cron("0 */6 * * *"))
def cron_analyze_new_conversations():
    """
    CRON: Roda a cada 6 horas
    Analisa conversas que ainda não foram analisadas
    """
    import requests
    
    print("=" * 60)
    print(f"⏰ CRON: Análise de Novas Conversas")
    print(f"🕐 {datetime.now().isoformat()}")
    print("=" * 60)
    
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    base_url = f"{SUPABASE_URL}/rest/v1"
    
    # Buscar conversas dos últimos 7 dias
    week_ago = (datetime.now() - timedelta(days=7)).isoformat()
    
    resp = requests.get(
        f"{base_url}/conversations?created_at=gte.{week_ago}&select=id&limit=100",
        headers=headers
    )
    conversations = resp.json() if resp.status_code == 200 else []
    
    # Buscar já analisadas
    resp = requests.get(
        f"{base_url}/conversation_analyses?select=conversation_id",
        headers=headers
    )
    analyzed = resp.json() if resp.status_code == 200 else []
    analyzed_ids = {a['conversation_id'] for a in analyzed}
    
    # Filtrar não analisadas
    pending = [c for c in conversations if c['id'] not in analyzed_ids]
    print(f"📋 Conversas pendentes: {len(pending)}")
    
    if not pending:
        print("✅ Nenhuma conversa nova para analisar")
        return {"analyzed": 0}
    
    # Limitar a 30 por execução
    pending = pending[:30]
    
    success = 0
    for conv in pending:
        try:
            analyze_conversation.remote(conv['id'])
            success += 1
        except Exception as e:
            print(f"   ❌ Erro: {e}")
    
    print(f"✅ Analisadas: {success}/{len(pending)}")
    return {"analyzed": success}


# ============================================
# CRON: MÉTRICAS DIÁRIAS POR ATENDENTE
# ============================================

@app.function(image=image, timeout=600, schedule=modal.Cron("0 6 * * *"))
def cron_generate_daily_metrics():
    """
    CRON: Roda todo dia às 6h
    Agrega métricas por atendente do dia anterior
    """
    import requests
    
    print("=" * 60)
    print(f"⏰ CRON: Métricas Diárias")
    print(f"🕐 {datetime.now().isoformat()}")
    print("=" * 60)
    
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    base_url = f"{SUPABASE_URL}/rest/v1"
    
    # Período: ontem
    yesterday = (datetime.now() - timedelta(days=1)).date()
    start = f"{yesterday}T00:00:00"
    end = f"{yesterday}T23:59:59"
    
    print(f"📅 Período: {yesterday}")
    
    # Buscar análises de ontem
    resp = requests.get(
        f"{base_url}/conversation_analyses?analyzed_at=gte.{start}&analyzed_at=lte.{end}&select=*",
        headers=headers
    )
    analyses = resp.json() if resp.status_code == 200 else []
    
    print(f"📊 Análises encontradas: {len(analyses)}")
    
    if not analyses:
        return {"metrics_generated": 0}
    
    # Agrupar por atendente
    by_agent = {}
    for a in analyses:
        raw = a.get('raw_analysis')
        if raw:
            try:
                data = json.loads(raw) if isinstance(raw, str) else raw
                agent = data.get('atendente_nome', 'Desconhecido')
                if agent not in by_agent:
                    by_agent[agent] = []
                by_agent[agent].append(a)
            except:
                pass
    
    print(f"👥 Atendentes: {list(by_agent.keys())}")
    
    # Gerar métricas por atendente
    metrics_saved = 0
    for agent_name, agent_analyses in by_agent.items():
        total = len(agent_analyses)
        scores = [a.get('overall_score') or 0 for a in agent_analyses]
        agendamentos = sum(1 for a in agent_analyses if a.get('agendamento_realizado'))
        
        # Contar erros
        total_errors = {}
        for a in agent_analyses:
            ec = a.get('errors_count')
            if ec:
                try:
                    errors = json.loads(ec) if isinstance(ec, str) else ec
                    for k, v in errors.items():
                        total_errors[k] = total_errors.get(k, 0) + v
                except:
                    pass
        
        metric = {
            'date': str(yesterday),
            'agent_name': agent_name,
            'total_conversations': total,
            'avg_score': round(sum(scores) / len(scores), 1) if scores else 0,
            'agendamentos': agendamentos,
            'taxa_agendamento': round(agendamentos / total * 100, 1) if total > 0 else 0,
            'errors_count': json.dumps(total_errors),
            'created_at': datetime.now().isoformat()
        }
        
        # Salvar (precisaria criar tabela agent_daily_metrics)
        # Por enquanto, só log
        print(f"   📈 {agent_name}: Score {metric['avg_score']}, {total} conversas, {agendamentos} agendamentos")
        metrics_saved += 1
    
    return {"metrics_generated": metrics_saved}


# ============================================
# ENTRY POINTS
# ============================================

@app.local_entrypoint()
def run_single(conversation_id: str = "76f0114a-6c03-4b6f-99d2-3634f4af844b"):
    """Analisa uma conversa específica"""
    print("=" * 60)
    print("🎯 ANÁLISE INDIVIDUAL")
    print("=" * 60)
    
    result = analyze_conversation.remote(conversation_id)
    
    print("\n📋 RESULTADO:")
    print(json.dumps(result, indent=2, ensure_ascii=False)[:2000])


@app.local_entrypoint()
def run_batch(month: int = 11, year: int = 2024, limit: int = 50, reanalyze: bool = False):
    """Analisa conversas em lote. Use --reanalyze para forçar re-análise."""
    result = analyze_batch.remote(month=month, year=year, limit=limit, skip_analyzed=not reanalyze)
    
    print("\n📋 RESUMO:")
    print(f"   Total: {result.get('total', 0)}")
    print(f"   Sucesso: {result.get('success', 0)}")
    print(f"   Erros: {result.get('errors', 0)}")


@app.local_entrypoint()
def run_agent_report(agent_name: str = "Pedro Azevedo", days: int = 30):
    """Gera relatório de atendente"""
    result = generate_agent_report.remote(agent_name=agent_name, days=days)
    
    print("\n📋 RELATÓRIO:")
    print(json.dumps(result, indent=2, ensure_ascii=False))


@app.local_entrypoint()
def run_recent(days: int = 7, limit: int = 100):
    """Analisa conversas dos últimos X dias"""
    import requests
    
    print("=" * 60)
    print(f"🎯 ANÁLISE DE CONVERSAS RECENTES")
    print(f"📅 Últimos {days} dias | Limite: {limit}")
    print("=" * 60)
    
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    base_url = f"{SUPABASE_URL}/rest/v1"
    
    # Buscar conversas dos últimos X dias
    since = (datetime.now() - timedelta(days=days)).isoformat()
    
    resp = requests.get(
        f"{base_url}/conversations?created_at=gte.{since}&select=id&limit={limit * 2}",
        headers=headers
    )
    conversations = resp.json() if resp.status_code == 200 else []
    print(f"📋 Conversas encontradas: {len(conversations)}")
    
    # Filtrar já analisadas
    resp = requests.get(
        f"{base_url}/conversation_analyses?select=conversation_id",
        headers=headers
    )
    analyzed = resp.json() if resp.status_code == 200 else []
    analyzed_ids = {a['conversation_id'] for a in analyzed}
    
    pending = [c for c in conversations if c['id'] not in analyzed_ids]
    print(f"📋 Pendentes: {len(pending)}")
    
    # Limitar
    pending = pending[:limit]
    
    success = 0
    errors = 0
    
    for i, conv in enumerate(pending):
        print(f"\n[{i+1}/{len(pending)}]", end=" ")
        try:
            result = analyze_conversation.remote(conv['id'])
            if result.get('error'):
                errors += 1
            else:
                success += 1
        except Exception as e:
            print(f"❌ Erro: {e}")
            errors += 1
    
    print("\n" + "=" * 60)
    print(f"✅ CONCLUÍDO: {success} sucesso, {errors} erros")
    print("=" * 60)


@app.local_entrypoint()
def run_reanalyze(limit: int = 50):
    """Re-analisa conversas já analisadas (para corrigir atendente_nome)"""
    import requests
    
    print("=" * 60)
    print("🔄 RE-ANÁLISE DE CONVERSAS")
    print("=" * 60)
    
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    base_url = f"{SUPABASE_URL}/rest/v1"
    
    # Buscar análises existentes
    resp = requests.get(
        f"{base_url}/conversation_analyses?select=conversation_id&limit={limit}",
        headers=headers
    )
    analyses = resp.json() if resp.status_code == 200 else []
    
    print(f"📋 Re-analisando: {len(analyses)} conversas")
    
    success = 0
    errors = 0
    
    for i, a in enumerate(analyses):
        print(f"\n[{i+1}/{len(analyses)}]", end=" ")
        try:
            # Deletar análise antiga
            requests.delete(
                f"{base_url}/conversation_analyses?conversation_id=eq.{a['conversation_id']}",
                headers=headers
            )
            
            # Re-analisar
            result = analyze_conversation.remote(a['conversation_id'])
            
            if result.get('error'):
                errors += 1
            else:
                success += 1
        except Exception as e:
            print(f"❌ Erro: {e}")
            errors += 1
    
    print("\n" + "=" * 60)
    print(f"✅ CONCLUÍDO: {success} sucesso, {errors} erros")
    print("=" * 60)