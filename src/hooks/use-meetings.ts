import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

const PAGE_SIZE = 20;

interface UseMeetingsOptions {
  page?: number;
  pageSize?: number;
  status?: string;
}

export function useMeetings(options: UseMeetingsOptions = {}) {
  const { page = 0, pageSize = PAGE_SIZE, status } = options;

  return useQuery({
    queryKey: ['meetings', page, pageSize, status],
    queryFn: async () => {
      const supabase = createClient();
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id, role')
        .eq('id', user.id)
        .single();

      if (!profile) throw new Error('Perfil não encontrado');

      // Query otimizada - apenas colunas necessárias
      let query = supabase
        .from('meetings')
        .select(`
          id,
          title,
          client_name,
          status,
          created_at,
          completed_at,
          contract_value,
          closed,
          error_message,
          retry_count,
          meeting_type,
          processing_started_at,
          consultant:profiles!meetings_consultant_id_fkey(name)
        `, { count: 'exact' })
        .eq('tenant_id', profile.tenant_id);

      // Se for consultor, filtrar apenas reuniões onde ele é o consultor
      if (profile.role === 'consultor') {
        query = query.eq('consultant_id', user.id);
      }

      query = query
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (status) {
        query = query.eq('status', status);
      }

      const { data, count, error } = await query;

      if (error) throw error;

      // Buscar status da fila em paralelo (apenas na primeira página)
      let queueStatus = null;
      if (page === 0) {
        let queueQuery = supabase
          .from('meetings')
          .select('status')
          .eq('tenant_id', profile.tenant_id);

        // Se for consultor, filtrar apenas reuniões dele
        if (profile.role === 'consultor') {
          queueQuery = queueQuery.eq('consultant_id', user.id);
        }

        const { data: queueData } = await queueQuery
          .in('status', ['queued', 'processing', 'retrying']);

        if (queueData) {
          queueStatus = {
            queued: queueData.filter((m: any) => m.status === 'queued').length,
            processing: queueData.filter((m: any) => m.status === 'processing').length,
            retrying: queueData.filter((m: any) => m.status === 'retrying').length,
          };
        }
      }

      return {
        meetings: data || [],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
        queueStatus,
      };
    },
    staleTime: 1000 * 60 * 2, // 2 minutos
  });
}
