"""
Transformadores de dados para conversão entre formatos Neon/Chatwoot e Supabase.
"""

def transform_user_to_agent(user_data: dict) -> dict:
    """Transforma um usuário do Chatwoot em agente do Supabase."""
    return {
        'external_id': user_data['id'],
        'name': user_data.get('name') or f"User {user_data['id']}",
        'email': user_data.get('email'),
        'role': user_data.get('role'),
        'active': True
    }

def transform_contact_to_contact(contact_data: dict) -> dict:
    """Transforma um contato do Chatwoot em contato do Supabase."""
    return {
        'external_id': contact_data['id'],
        'name': contact_data.get('name'),
        'phone': contact_data.get('phone'),
        'email': contact_data.get('email'),
        'identifier': contact_data.get('identifier'),
        'custom_attributes': contact_data.get('additional_attributes') or {}
    }

def transform_message_sender_type(message_data: dict) -> str:
    """Determina o tipo de remetente da mensagem."""
    if message_data.get('user_id'):
        return 'agent'
    elif message_data.get('contact_id'):
        return 'customer'
    else:
        return 'bot'
