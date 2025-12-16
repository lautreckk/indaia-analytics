import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    // Buscar perfil
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Perfil não encontrado' },
        { status: 404 }
      )
    }

    // Validar dados
    const body = await request.json()
    
    if (!body.title || !body.title.trim()) {
      return NextResponse.json(
        { error: 'Título é obrigatório' },
        { status: 400 }
      )
    }

    if (!body.transcription || body.transcription.length < 100) {
      return NextResponse.json(
        { error: 'Transcrição deve ter no mínimo 100 caracteres' },
        { status: 400 }
      )
    }

    // Validar team_id se fornecido
    let teamId = body.team_id
    let meetingType = body.meeting_type || 'casamento'

    if (teamId) {
      // Verificar se a equipe existe e está ativa
      const { data: teamCheck, error: teamCheckError } = await supabase
        .from('ai_teams')
        .select('id, name, event_type, is_active')
        .eq('id', teamId)
        .eq('tenant_id', profile.tenant_id)
        .eq('is_active', true)
        .single()

      if (teamCheckError || !teamCheck) {
        return NextResponse.json(
          { error: 'Equipe selecionada não encontrada ou inativa' },
          { status: 400 }
        )
      }

      // Usar event_type da equipe se não foi fornecido
      if (!body.meeting_type && teamCheck.event_type && teamCheck.event_type !== 'all') {
        meetingType = teamCheck.event_type
      }
    } else {
      // Se não forneceu team_id, buscar equipe padrão
      const { data: defaultTeam } = await supabase
        .from('ai_teams')
        .select('id, event_type')
        .eq('tenant_id', profile.tenant_id)
        .eq('is_active', true)
        .eq('is_default', true)
        .single()

      if (defaultTeam) {
        teamId = defaultTeam.id
        if (!body.meeting_type && defaultTeam.event_type && defaultTeam.event_type !== 'all') {
          meetingType = defaultTeam.event_type
        }
      } else {
        return NextResponse.json(
          { error: 'Nenhuma equipe disponível. Crie uma equipe antes de criar reuniões.' },
          { status: 400 }
        )
      }
    }

    // Preparar dados
    const meetingData: any = {
      tenant_id: profile.tenant_id,
      title: body.title.trim(),
      client_name: body.client_name?.trim() || null,
      team_id: teamId, // ID de ai_teams (validado acima)
      meeting_type: meetingType,
      transcription: body.transcription.trim(),
      llm_model: body.llm_model || 'gpt-4o',
      status: 'queued',
      closed: body.closed || false,
      created_by: user.id,
    }

    if (body.consultant_id) {
      meetingData.consultant_id = body.consultant_id
    }

    // Dados do contrato (se fechado)
    if (body.closed) {
      if (body.contract_value) {
        const numValue = parseFloat(String(body.contract_value).replace(/[^\d,.-]/g, '').replace(',', '.'))
        if (!isNaN(numValue) && numValue > 0) {
          meetingData.contract_value = numValue
        }
      }
      if (body.num_guests) {
        meetingData.num_guests = parseInt(String(body.num_guests))
      }
      if (body.groom_name) {
        meetingData.groom_name = body.groom_name.trim()
      }
      if (body.bride_name) {
        meetingData.bride_name = body.bride_name.trim()
      }
      if (body.event_date) {
        meetingData.event_date = body.event_date
      }
    }

    // Inserir no Supabase
    const { data, error: insertError } = await supabase
      .from('meetings')
      .insert(meetingData)
      .select('id')
      .single()

    if (insertError) {
      console.error('Erro ao inserir reunião:', insertError)
      return NextResponse.json(
        { error: `Erro ao salvar reunião: ${insertError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { 
        success: true, 
        id: data.id,
        message: 'Reunião adicionada à fila de análise com sucesso'
      },
      { status: 201 }
    )

  } catch (error: any) {
    console.error('Erro na API:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao processar requisição' },
      { status: 500 }
    )
  }
}
