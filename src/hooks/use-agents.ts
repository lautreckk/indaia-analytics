import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AIAgent, AgentFormData } from '@/types/agents';

const supabase = createClient();

// Buscar todos os agentes do tenant
export function useAgents() {
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadAgents = useCallback(async () => {
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
        .from('ai_agents')
        .select(`
          id,
          tenant_id,
          key,
          name,
          description,
          icon,
          prompt_system,
          prompt_business,
          prompt_output,
          is_template,
          is_active,
          is_coordinator,
          created_by,
          created_at,
          updated_at
        `)
        .eq('is_active', true)
        .or(`tenant_id.eq.${profile.tenant_id},is_template.eq.true`)
        .order('is_coordinator', { ascending: false }) // Coordenador primeiro
        .order('name');

      if (fetchError) throw fetchError;
      setAgents(data || []);
    } catch (err: any) {
      setError(err);
      console.error('Erro ao carregar agentes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  return { agents, loading, error, refetch: loadAgents };
}

// Buscar agente específico
export function useAgent(id: string | null) {
  const [agent, setAgent] = useState<AIAgent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    async function loadAgent() {
      try {
        setLoading(true);
        // Query otimizada - apenas colunas necessárias
        const { data, error: fetchError } = await supabase
          .from('ai_agents')
          .select(`
            id,
            tenant_id,
            key,
            name,
            description,
            icon,
            prompt_system,
            prompt_business,
            prompt_output,
            is_template,
            is_active,
            created_by,
            created_at,
            updated_at
          `)
          .eq('id', id)
          .single();

        if (fetchError) throw fetchError;
        setAgent(data);
      } catch (err: any) {
        setError(err);
        console.error('Erro ao carregar agente:', err);
      } finally {
        setLoading(false);
      }
    }

    loadAgent();
  }, [id]);

  return { agent, loading, error };
}

// Criar agente
export function useCreateAgent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const create = useCallback(async (data: AgentFormData) => {
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

      const { data: agent, error: insertError } = await supabase
        .from('ai_agents')
        .insert({
          ...data,
          tenant_id: profile.tenant_id,
          created_by: user.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      return agent;
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { create, loading, error };
}

// Atualizar agente
export function useUpdateAgent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const update = useCallback(async (id: string, data: Partial<AgentFormData>) => {
    try {
      setLoading(true);
      setError(null);

      const { data: agent, error: updateError } = await supabase
        .from('ai_agents')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;
      return agent;
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { update, loading, error };
}

// Deletar agente (soft delete)
export function useDeleteAgent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const remove = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      const { error: updateError } = await supabase
        .from('ai_agents')
        .update({ is_active: false, updated_at: new Date().toISOString() })
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

// Duplicar agente
export function useDuplicateAgent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const duplicate = useCallback(async (id: string, newKey: string, newName: string) => {
    try {
      setLoading(true);
      setError(null);

      // Buscar agente original
      const { data: original, error: fetchError } = await supabase
        .from('ai_agents')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile) throw new Error('Perfil não encontrado');

      // Criar cópia
      const { data: copy, error: insertError } = await supabase
        .from('ai_agents')
        .insert({
          tenant_id: profile.tenant_id,
          key: newKey,
          name: newName,
          description: `Cópia de ${original.name}`,
          icon: original.icon,
          prompt_system: original.prompt_system,
          prompt_business: original.prompt_business,
          prompt_output: original.prompt_output,
          is_template: false,
          created_by: user.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      return copy;
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { duplicate, loading, error };
}
