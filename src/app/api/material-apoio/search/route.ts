import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * API Route para busca vetorial de chunks relevantes
 * Usada pelo modal_app.py para RAG (Retrieval Augmented Generation)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const body = await request.json();
    const {
      queryEmbedding, // Array de números (1536 dimensões)
      agentKey,
      teamId,
      tenantId,
      limit = 5,
      similarityThreshold = 0.7,
    } = body;

    if (!queryEmbedding || !Array.isArray(queryEmbedding) || queryEmbedding.length !== 1536) {
      return NextResponse.json(
        { error: 'queryEmbedding deve ser um array de 1536 números' },
        { status: 400 }
      );
    }

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId é obrigatório' },
        { status: 400 }
      );
    }

    if (!agentKey && !teamId) {
      return NextResponse.json(
        { error: 'agentKey ou teamId deve ser fornecido' },
        { status: 400 }
      );
    }

    // Usar a função SQL get_relevant_chunks
    // O embedding precisa ser convertido para formato PostgreSQL vector
    const embeddingString = `[${queryEmbedding.join(',')}]`;

    const { data, error } = await supabase.rpc('get_relevant_chunks', {
      p_query_embedding: embeddingString,
      p_agent_key: agentKey || null,
      p_team_id: teamId || null,
      p_tenant_id: tenantId,
      p_limit: limit,
      p_similarity_threshold: similarityThreshold,
    });

    if (error) {
      console.error('Erro na busca vetorial:', error);
      return NextResponse.json(
        { error: 'Erro na busca vetorial', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      chunks: data || [],
      count: data?.length || 0,
    });
  } catch (error: any) {
    console.error('Erro na API de busca:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error.message },
      { status: 500 }
    );
  }
}
