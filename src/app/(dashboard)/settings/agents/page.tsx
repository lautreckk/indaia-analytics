'use client';

import { useState } from 'react';
import { Plus, Search, Copy, Pencil, Trash2, Bot, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAgents, useDeleteAgent, useDuplicateAgent } from '@/hooks/use-agents';
import { AIAgent } from '@/types/agents';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export default function AgentsPage() {
  const { agents, loading, error, refetch } = useAgents();
  const deleteAgent = useDeleteAgent();
  const duplicateAgent = useDuplicateAgent();
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

  const [search, setSearch] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<AIAgent | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const filteredAgents = agents?.filter(agent =>
    agent.name.toLowerCase().includes(search.toLowerCase()) ||
    agent.key.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (agent: AIAgent) => {
    if (confirm(`Tem certeza que deseja excluir o agente "${agent.name}"?`)) {
      try {
        await deleteAgent.remove(agent.id);
        refetch();
      } catch (error: any) {
        alert('Erro ao excluir: ' + error.message);
      }
    }
  };

  const handleDuplicate = async (agent: AIAgent) => {
    const newKey = prompt(`Digite a nova key para "${agent.name}":`, `${agent.key}_copy`);
    const newName = prompt(`Digite o novo nome:`, `${agent.name} (Cópia)`);

    if (newKey && newName) {
      try {
        await duplicateAgent.duplicate(agent.id, newKey, newName);
        refetch();
        alert('Agente duplicado com sucesso!');
      } catch (error: any) {
        alert('Erro ao duplicar: ' + error.message);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-zinc-900 flex items-center gap-2">
            <Bot className="w-6 h-6" />
            Biblioteca de Agentes
          </h1>
          <p className="text-zinc-500 mt-1">
            Gerencie os agentes de IA disponíveis para análise
          </p>
        </div>
        <Link href="/settings/agents/novo">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Novo Agente
          </Button>
        </Link>
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

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            placeholder="Buscar agentes..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-medium">Erro ao carregar agentes</p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-24 bg-zinc-100" />
            </Card>
          ))}
        </div>
      ) : !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {!filteredAgents || filteredAgents.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Bot className="h-12 w-12 mx-auto text-zinc-300 mb-4" />
              <p className="text-zinc-500">Nenhum agente cadastrado</p>
              <Link href="/settings/agents/novo">
                <Button className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Criar primeiro agente
                </Button>
              </Link>
            </div>
          ) : (
            filteredAgents.map(agent => (
            <Card key={agent.id} className="group hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{agent.icon}</span>
                    <div>
                      <CardTitle className="text-base">{agent.name}</CardTitle>
                      <code className="text-xs text-zinc-500">{agent.key}</code>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {agent.is_coordinator && (
                      <Badge className="bg-amber-100 text-amber-800 border-amber-300">
                        Coordenador
                      </Badge>
                    )}
                    {agent.is_template && (
                      <Badge variant="secondary">Template</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-500 line-clamp-2 mb-4">
                  {agent.description || 'Sem descrição'}
                </p>
                {!agent.is_coordinator && (
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="sm" variant="outline" onClick={() => handleDuplicate(agent)}>
                      <Copy className="h-3.5 w-3.5 mr-1" />
                      Duplicar
                    </Button>
                    {!agent.is_template && (
                      <>
                        <Link href={`/settings/agents/${agent.id}`}>
                          <Button size="sm" variant="outline">
                            <Pencil className="h-3.5 w-3.5 mr-1" />
                            Editar
                          </Button>
                        </Link>
                        <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleDelete(agent)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
            ))
          )}

          {/* Card para criar novo */}
          <Link href="/settings/agents/novo">
            <Card className="border-dashed cursor-pointer hover:border-primary hover:bg-zinc-50 transition-colors">
              <CardContent className="flex flex-col items-center justify-center h-full min-h-[200px] text-zinc-500">
                <Plus className="h-8 w-8 mb-2" />
                <span>Criar novo agente</span>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}
    </div>
  );
}
