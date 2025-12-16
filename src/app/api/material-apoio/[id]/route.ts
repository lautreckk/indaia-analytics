import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const documentId = params.id;
    const body = await request.json();
    const { action } = body;

    if (action === 'reset') {
      // Buscar documento para verificar tenant_id
      const { data: document, error: docError } = await supabase
        .from('agent_knowledge_documents')
        .select('id, tenant_id')
        .eq('id', documentId)
        .single();

      if (docError || !document) {
        return NextResponse.json(
          { error: 'Documento não encontrado' },
          { status: 404 }
        );
      }

      if (document.tenant_id !== profile.tenant_id) {
        return NextResponse.json(
          { error: 'Acesso negado' },
          { status: 403 }
        );
      }

      // Deletar chunks e embeddings relacionados
      const { data: chunks } = await supabase
        .from('agent_knowledge_chunks')
        .select('id')
        .eq('document_id', documentId);

      if (chunks && chunks.length > 0) {
        const chunkIds = chunks.map(c => c.id);
        
        // Deletar embeddings
        for (const chunkId of chunkIds) {
          await supabase
            .from('agent_knowledge_embeddings')
            .delete()
            .eq('chunk_id', chunkId);
        }
        
        // Deletar chunks
        await supabase
          .from('agent_knowledge_chunks')
          .delete()
          .eq('document_id', documentId);
      }

      // Resetar status do documento
      const { error: updateError } = await supabase
        .from('agent_knowledge_documents')
        .update({
          status: 'processing',
          total_chunks: null,
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId);

      if (updateError) {
        console.error('Erro ao resetar documento:', updateError);
        return NextResponse.json(
          { error: 'Erro ao resetar documento', details: updateError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Documento resetado com sucesso. O processamento será reiniciado.',
      });
    }

    return NextResponse.json(
      { error: 'Ação não reconhecida' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Erro ao resetar documento:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const documentId = params.id;

    // Buscar documento para verificar tenant_id
    const { data: document, error: docError } = await supabase
      .from('agent_knowledge_documents')
      .select('id, tenant_id, file_path')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: 'Documento não encontrado' },
        { status: 404 }
      );
    }

    if (document.tenant_id !== profile.tenant_id) {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      );
    }

    // Deletar arquivo do Storage
    const bucketName = 'knowledge-base';
    const { error: storageError } = await supabase.storage
      .from(bucketName)
      .remove([document.file_path]);

    if (storageError) {
      console.error('Erro ao deletar arquivo do storage:', storageError);
      // Continuar mesmo se falhar, pois pode não existir mais
    }

    // Deletar documento (cascade vai deletar chunks, embeddings e access)
    const { error: deleteError } = await supabase
      .from('agent_knowledge_documents')
      .delete()
      .eq('id', documentId);

    if (deleteError) {
      console.error('Erro ao deletar documento:', deleteError);
      return NextResponse.json(
        { error: 'Erro ao deletar documento', details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Documento deletado com sucesso',
    });
  } catch (error: any) {
    console.error('Erro ao deletar documento:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error.message },
      { status: 500 }
    );
  }
}
