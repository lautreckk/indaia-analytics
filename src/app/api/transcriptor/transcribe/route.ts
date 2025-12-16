import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    const { filePath, fileName, tenantId } = await request.json();

    if (!filePath || !fileName || !tenantId) {
      return NextResponse.json(
        { error: 'filePath, fileName e tenantId são obrigatórios' },
        { status: 400 }
      );
    }

    // Buscar informações do arquivo do Storage para obter tamanho
    const bucketName = 'transcriptions';
    const { data: fileList, error: listError } = await supabase.storage
      .from(bucketName)
      .list(filePath.split('/').slice(0, -1).join('/'), {
        search: fileName,
      });

    let fileSize = 0;
    if (fileList && fileList.length > 0) {
      fileSize = fileList[0].metadata?.size || 0;
    }

    // Criar registro na fila de transcrições
    const { data: transcriptionRecord, error: dbError } = await supabase
      .from('transcriptions')
      .insert({
        user_id: user.id,
        tenant_id: tenantId,
        file_path: filePath,
        file_name: fileName,
        file_size: fileSize,
        status: 'queued',
      })
      .select('id')
      .single();

    if (dbError || !transcriptionRecord) {
      console.error('Erro ao criar transcrição:', dbError);
      return NextResponse.json(
        { error: 'Erro ao criar registro de transcrição: ' + (dbError?.message || 'Unknown error') },
        { status: 500 }
      );
    }

    // Retornar ID para que o frontend possa acompanhar o status
    return NextResponse.json({
      transcriptionId: transcriptionRecord.id,
      status: 'queued',
      message: 'Transcrição enfileirada. O processamento será feito em background.',
    });
  } catch (error: any) {
    console.error('Erro ao enfileirar transcrição:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao enfileirar transcrição' },
      { status: 500 }
    );
  }
}
