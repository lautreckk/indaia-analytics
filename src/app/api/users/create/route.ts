import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Cliente admin do Supabase (usa service_role key)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name, role, tenant_id, agent_id } = body;

    // Validações
    if (!email || !password || !name || !role || !tenant_id) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: email, password, name, role, tenant_id' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Senha deve ter pelo menos 6 caracteres' },
        { status: 400 }
      );
    }

    // Validar vinculações obrigatórias
    if (role === 'pre_vendedor' && !agent_id) {
      return NextResponse.json(
        { error: 'Pré-vendedor deve ser vinculado a um Atendente' },
        { status: 400 }
      );
    }

    // Criar usuário no Auth (usando admin client - não afeta sessão atual)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (authError) {
      console.error('Erro ao criar usuário:', authError);
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Erro ao criar usuário' },
        { status: 500 }
      );
    }

    // Criar/atualizar profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authData.user.id,
        tenant_id,
        email,
        name,
        role,
        agent_id: role === 'pre_vendedor' ? agent_id : null,
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (profileError) {
      // Rollback: deletar usuário do auth se profile falhar
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      console.error('Erro ao criar profile:', profileError);
      return NextResponse.json(
        { error: 'Erro ao criar perfil do usuário' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email,
        name,
        role,
      },
    });
  } catch (error: any) {
    console.error('Erro na API:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
