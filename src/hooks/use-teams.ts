import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AITeam, AITeamWithMembers, TeamFormData, TeamMemberFormData } from '@/types/agents';

const supabase = createClient();

// Buscar todas as equipes com membros
export function useTeams() {
  const [teams, setTeams] = useState<AITeamWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadTeams = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile) {
        setLoading(false);
        return;
      }

      // Query otimizada - apenas colunas necessárias
      const { data, error: fetchError } = await supabase
        .from('ai_teams')
        .select(`
          id,
          tenant_id,
          name,
          description,
          event_type,
          is_default,
          is_active,
          created_by,
          created_at,
          updated_at,
          members:ai_team_members(
            id,
            team_id,
            agent_id,
            weight,
            sort_order,
            prompt_business_override,
            is_active,
            created_at,
            agent:ai_agents(
              id,
              key,
              name,
              description,
              icon,
              prompt_system,
              prompt_business,
              prompt_output
            )
          )
        `)
        .eq('is_active', true)
        .eq('tenant_id', profile.tenant_id)
        .order('name');

      if (fetchError) throw fetchError;

      // Calcular total_weight e ordenar membros
      const teamsWithWeight = (data || []).map(team => ({
        ...team,
        members: (team.members || []).sort((a: any, b: any) => a.sort_order - b.sort_order),
        total_weight: (team.members || []).reduce((sum: number, m: any) => sum + (parseFloat(m.weight) || 0), 0)
      })) as AITeamWithMembers[];

      setTeams(teamsWithWeight);
    } catch (err: any) {
      setError(err);
      console.error('Erro ao carregar equipes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  return { teams, loading, error, refetch: loadTeams };
}

// Buscar equipe específica com membros
export function useTeam(id: string | null) {
  const [team, setTeam] = useState<AITeamWithMembers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadTeam = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // Query otimizada - apenas colunas necessárias
      const { data, error: fetchError } = await supabase
        .from('ai_teams')
        .select(`
          id,
          tenant_id,
          name,
          description,
          event_type,
          is_default,
          is_active,
          created_by,
          created_at,
          updated_at,
          members:ai_team_members(
            id,
            team_id,
            agent_id,
            weight,
            sort_order,
            prompt_business_override,
            is_active,
            created_at,
            agent:ai_agents(
              id,
              key,
              name,
              description,
              icon,
              prompt_system,
              prompt_business,
              prompt_output
            )
          )
        `)
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Ordenar members: coordenador primeiro (sort_order = -1), depois os outros
      const sortedMembers = (data.members || []).sort((a: any, b: any) => {
        // Coordenador sempre primeiro
        if (a.is_coordinator || a.agent?.is_coordinator) return -1;
        if (b.is_coordinator || b.agent?.is_coordinator) return 1;
        // Depois por sort_order
        return (a.sort_order || 0) - (b.sort_order || 0);
      });

      const teamWithWeight = {
        ...data,
        members: sortedMembers,
        total_weight: (data.members || []).reduce((sum: number, m: any) => sum + (parseFloat(m.weight) || 0), 0)
      } as AITeamWithMembers;

      setTeam(teamWithWeight);
    } catch (err: any) {
      setError(err);
      console.error('Erro ao carregar equipe:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  // ✅ AGORA RETORNA REFETCH!
  return { team, loading, error, refetch: loadTeam };
}

// Criar equipe
export function useCreateTeam() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const create = useCallback(async (data: TeamFormData) => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile) throw new Error('Perfil não encontrado');

      const { data: team, error: insertError } = await supabase
        .from('ai_teams')
        .insert({
          ...data,
          tenant_id: profile.tenant_id,
          created_by: user.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      return team;
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { create, loading, error };
}

// Atualizar equipe
export function useUpdateTeam() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const update = useCallback(async (id: string, data: Partial<AITeam>) => {
    try {
      setLoading(true);
      setError(null);

      const { data: team, error: updateError } = await supabase
        .from('ai_teams')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;
      return team;
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { update, loading, error };
}

// Deletar equipe
export function useDeleteTeam() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const remove = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      const { error: updateError } = await supabase
        .from('ai_teams')
        .update({ is_active: false })
        .eq('id', id);

      if (updateError) throw updateError;
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { remove, loading, error };
}

// Adicionar membro à equipe
export function useAddTeamMember() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const add = useCallback(async (teamId: string, data: TeamMemberFormData) => {
    try {
      setLoading(true);
      setError(null);

      // Buscar maior sort_order atual
      const { data: members } = await supabase
        .from('ai_team_members')
        .select('sort_order')
        .eq('team_id', teamId)
        .order('sort_order', { ascending: false })
        .limit(1);

      const nextOrder = (members?.[0]?.sort_order || 0) + 1;

      const { data: member, error: insertError } = await supabase
        .from('ai_team_members')
        .insert({
          team_id: teamId,
          agent_id: data.agent_id,
          weight: data.weight,
          sort_order: nextOrder,
          prompt_business_override: data.prompt_business_override,
        })
        .select('*, agent:ai_agents(*)')
        .single();

      if (insertError) throw insertError;
      return member;
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { add, loading, error };
}

// Atualizar membro da equipe
export function useUpdateTeamMember() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const update = useCallback(async (id: string, teamId: string, data: Partial<TeamMemberFormData>) => {
    try {
      setLoading(true);
      setError(null);

      const { data: member, error: updateError } = await supabase
        .from('ai_team_members')
        .update(data)
        .eq('id', id)
        .select('*, agent:ai_agents(*)')
        .single();

      if (updateError) throw updateError;
      return member;
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { update, loading, error };
}

// Remover membro da equipe
export function useRemoveTeamMember() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const remove = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      // Verificar se é coordenador antes de remover
      const { data: member } = await supabase
        .from('ai_team_members')
        .select('is_coordinator, agent:ai_agents(is_coordinator)')
        .eq('id', id)
        .single();
      
      if (member?.is_coordinator || (member?.agent as any)?.is_coordinator) {
        throw new Error('Não é possível remover o Coordenador da equipe. Ele é obrigatório.');
      }

      const { error: deleteError } = await supabase
        .from('ai_team_members')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { remove, loading, error };
}

// Reordenar membros
export function useReorderTeamMembers() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const reorder = useCallback(async (teamId: string, memberIds: string[]) => {
    try {
      setLoading(true);
      setError(null);

      // Atualizar sort_order de cada membro
      const updates = memberIds.map((id, index) =>
        supabase
          .from('ai_team_members')
          .update({ sort_order: index })
          .eq('id', id)
      );

      await Promise.all(updates);
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { reorder, loading, error };
}
