import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

export interface ChatwootAgent {
  id: string;
  tenant_id: string;
  external_id: number;
  name: string;
  email: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export function useChatwootAgents() {
  const [agents, setAgents] = useState<ChatwootAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadAgents = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile) return;

      const { data, error: fetchError } = await supabase
        .from('agents')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .eq('active', true)
        .order('name');

      if (fetchError) throw fetchError;
      setAgents(data || []);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  return { agents, loading, error, refetch: loadAgents };
}
