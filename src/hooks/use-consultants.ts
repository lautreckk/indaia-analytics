import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

export interface Consultant {
  id: string;
  tenant_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export function useConsultants() {
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadConsultants = useCallback(async () => {
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
        .from('consultants')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .eq('is_active', true)
        .order('name');

      if (fetchError) throw fetchError;
      setConsultants(data || []);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConsultants();
  }, [loadConsultants]);

  return { consultants, loading, error, refetch: loadConsultants };
}

export function useCreateConsultant() {
  const [loading, setLoading] = useState(false);

  const create = useCallback(async (data: { name: string; email?: string; phone?: string }) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile) throw new Error('Profile não encontrado');

      const { data: newConsultant, error } = await supabase
        .from('consultants')
        .insert({
          tenant_id: profile.tenant_id,
          name: data.name,
          email: data.email || null,
          phone: data.phone || null,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return newConsultant;
    } finally {
      setLoading(false);
    }
  }, []);

  return { create, loading };
}
