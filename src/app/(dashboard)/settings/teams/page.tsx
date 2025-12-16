'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Users, Settings, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTeams, useDeleteTeam } from '@/hooks/use-teams';
import { AITeamWithMembers } from '@/types/agents';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export default function TeamsPage() {
  const router = useRouter();
  const { teams, loading, error, refetch } = useTeams();
  const deleteTeam = useDeleteTeam();
  const supabase = createClient();

  // Verificar análises em processamento
  const { data: processingCount = 0 } = useQuery({
    queryKey: ['processing-meetings'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile) return 0;

      const { count } = await supabase
        .from('meetings')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', profile.tenant_id)
        .eq('status', 'processing');
      
      return count || 0;
    },
    refetchInterval: 10000, // Atualiza a cada 10s
  });

  const handleDelete = async (team: AITeamWithMembers) => {
    if (confirm(`Tem certeza que deseja excluir a equipe "${team.name}"?`)) {
      try {
        await deleteTeam.remove(team.id);
        refetch();
      } catch (error: any) {
        toast.error('Erro ao excluir equipe', {
          description: error.message,
        });
      }
    }
  };

  const getEventTypeBadge = (type: string | null) => {
    switch (type) {
      case 'casamento':
        return <Badge variant="default">💒 Casamento</Badge>;
      case '15_anos':
        return <Badge variant="secondary">🎂 15 Anos</Badge>;
      default:
        return <Badge variant="outline">📋 Todos</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-zinc-900 flex items-center gap-2">
            <Users className="w-6 h-6" />
            Equipes de Análise
          </h1>
          <p className="text-zinc-500 mt-1">
            Configure equipes de agentes com pesos personalizados
          </p>
        </div>
        <Button onClick={() => router.push('/settings/teams/nova')}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Equipe
        </Button>
      </div>

      {/* Banner de Aviso - Análises em Processamento */}
      {processingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-amber-800 font-medium">
              {processingCount} análise(s) em andamento
            </p>
            <p className="text-amber-600 text-sm">
              Evite fazer alterações nos agentes ou equipes até o processamento terminar.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-medium">Erro ao carregar equipes</p>
          <p className="text-red-600 text-sm mt-1">{error.message || 'Erro desconhecido'}</p>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-3"
            onClick={() => refetch()}
          >
            Tentar novamente
          </Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-20 bg-zinc-100" />
            </Card>
          ))}
        </div>
      ) : !error && (
        <div className="space-y-4">
          {!teams || teams.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-zinc-300 mb-4" />
              <p className="text-zinc-500">Nenhuma equipe cadastrada</p>
              <Button className="mt-4" onClick={() => router.push('/settings/teams/nova')}>
                <Plus className="h-4 w-4 mr-2" />
                Criar primeira equipe
              </Button>
            </div>
          ) : (
            teams.map(team => (
            <Card key={team.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-zinc-400" />
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{team.name}</CardTitle>
                        {team.is_default && (
                          <Badge variant="outline" className="text-xs">Padrão</Badge>
                        )}
                      </div>
                      <CardDescription>
                        {team.members?.length || 0} agentes · {getEventTypeBadge(team.event_type)}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => router.push(`/settings/teams/${team.id}`)}
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      Configurar
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleDelete(team)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {team.members?.slice(0, 8).map(member => (
                    <div
                      key={member.id}
                      className="flex items-center gap-1.5 px-2 py-1 bg-zinc-100 rounded-md text-sm"
                    >
                      <span>{member.agent?.icon}</span>
                      <span>{member.agent?.name}</span>
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {member.weight}%
                      </Badge>
                    </div>
                  ))}
                  {(team.members?.length || 0) > 8 && (
                    <div className="px-2 py-1 text-sm text-zinc-500">
                      +{team.members!.length - 8} mais
                    </div>
                  )}
                </div>

                {team.total_weight !== 100 && (
                  <p className="mt-3 text-sm text-amber-600">
                    ⚠️ Pesos somam {team.total_weight}% (devem somar 100%)
                  </p>
                )}
              </CardContent>
            </Card>
            ))
          )}

          {/* Card para criar nova equipe */}
          <Card className="border-dashed cursor-pointer hover:border-primary hover:bg-zinc-50 transition-colors" onClick={() => router.push('/settings/teams/nova')}>
            <CardContent className="flex items-center justify-center py-8 text-zinc-500">
              <Plus className="h-5 w-5 mr-2" />
              <span>Criar nova equipe</span>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
