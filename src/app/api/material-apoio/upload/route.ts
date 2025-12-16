import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Verificar se é admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const {
      filePath,
      fileName,
      fileType,
      fileSize,
      title,
      description,
      tenantId,
      accessType,
      teamId,
      agentKey,
    } = body;

    // Validar campos obrigatórios
    if (!filePath || !fileName || !tenantId || !accessType) {
      return NextResponse.json(
        { error: 'Campos obrigatórios faltando' },
        { status: 400 }
      );
    }

    if (accessType === 'team' && !teamId) {
      return NextResponse.json(
        { error: 'teamId é obrigatório quando accessType é "team"' },
        { status: 400 }
      );
    }

    if (accessType === 'agent' && !agentKey) {
      return NextResponse.json(
        { error: 'agentKey é obrigatório quando accessType é "agent"' },
        { status: 400 }
      );
    }

    // Criar registro do documento
    const { data: document, error: docError } = await supabase
      .from('agent_knowledge_documents')
      .insert({
        tenant_id: tenantId,
        uploaded_by: user.id,
        file_name: fileName,
        file_path: filePath,
        file_type: fileType,
        file_size: fileSize,
        title: title || fileName,
        description: description || null,
        status: 'processing',
      })
      .select()
      .single();

    if (docError) {
      console.error('Erro ao criar documento:', docError);
      return NextResponse.json(
        { error: 'Erro ao criar documento', details: docError.message },
        { status: 500 }
      );
    }

    // Criar registro de acesso
    const { error: accessError } = await supabase
      .from('agent_knowledge_access')
      .insert({
        document_id: document.id,
        access_type: accessType,
        team_id: accessType === 'team' ? teamId : null,
        agent_key: accessType === 'agent' ? agentKey : null,
      });

    if (accessError) {
      console.error('Erro ao criar acesso:', accessError);
      // Rollback: deletar documento criado
      await supabase
        .from('agent_knowledge_documents')
        .delete()
        .eq('id', document.id);
      
      return NextResponse.json(
        { error: 'Erro ao criar acesso', details: accessError.message },
        { status: 500 }
      );
    }

    // Chamar endpoint Modal para processar documento
    const MODAL_WEBHOOK_URL = process.env.MODAL_KNOWLEDGE_WEBHOOK_URL;
    
    if (MODAL_WEBHOOK_URL) {
      try {
        // Chamar endpoint Modal de forma assíncrona (não bloquear resposta)
        fetch(MODAL_WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            document_id: document.id,
          }),
        }).catch((error) => {
          console.error('Erro ao chamar Modal webhook:', error);
          // Não falhar o upload se o webhook falhar
        });
      } catch (error) {
        console.error('Erro ao chamar Modal webhook:', error);
        // Não falhar o upload se o webhook falhar
      }
    }

    return NextResponse.json({
      success: true,
      documentId: document.id,
      message: 'Documento criado com sucesso. O processamento será feito pelo Modal em background.',
    });
  } catch (error: any) {
    console.error('Erro no upload:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error.message },
      { status: 500 }
    );
  }
}
