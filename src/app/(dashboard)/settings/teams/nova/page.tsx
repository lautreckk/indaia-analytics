'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useAgents } from '@/hooks/use-agents';
import { useCreateTeam } from '@/hooks/use-teams';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface SelectedAgent {
  agent_id: string;
  agent_name: string;
  agent_icon: string;
  weight: number;
}

export default function NewTeamPage() {
  const router = useRouter();
  const { agents, loading: loadingAgents } = useAgents();
  const createTeam = useCreateTeam();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState<string>('all');
  const [isDefault, setIsDefault] = useState(false);
  const [selectedAgents, setSelectedAgents] = useState<SelectedAgent[]>([]);
  const [saving, setSaving] = useState(false);

  // Agentes disponíveis = todos que NÃO estão selecionados E NÃO são coordenador
  const availableAgents = agents?.filter(
    a => !a.is_coordinator && !selectedAgents.some(sa => sa.agent_id === a.id)
  ) || [];

  const totalWeight = selectedAgents.reduce((sum, a) => sum + a.weight, 0);

  const handleAddAgent = (agentId: string) => {
    const agent = agents?.find(a => a.id === agentId);
    if (!agent) return;

    setSelectedAgents(prev => [
      ...prev,
      {
        agent_id: agent.id,
        agent_name: agent.name,
        agent_icon: agent.icon,
        weight: 10
      }
    ]);
  };

  const handleRemoveAgent = (agentId: string) => {
    setSelectedAgents(prev => prev.filter(a => a.agent_id !== agentId));
  };

  const handleWeightChange = (agentId: string, weight: number) => {
    setSelectedAgents(prev => prev.map(a =>
      a.agent_id === agentId ? { ...a, weight } : a
    ));
  };

  const handleDistributeEvenly = () => {
    if (selectedAgents.length === 0) return;
    const weightPerAgent = Math.floor(100 / selectedAgents.length);
    const remainder = 100 - (weightPerAgent * selectedAgents.length);

    setSelectedAgents(prev => prev.map((a, i) => ({
      ...a,
      weight: weightPerAgent + (i === 0 ? remainder : 0)
    })));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.warning('Campo obrigatório', {
        description: 'Nome da equipe é obrigatório',
      });
      return;
    }

    if (selectedAgents.length === 0) {
      toast.warning('Validação', {
        description: 'Adicione pelo menos um agente à equipe',
      });
      return;
    }

    if (totalWeight !== 100) {
      toast.warning('Pesos inválidos', {
        description: `Os pesos devem somar 100%. Atual: ${totalWeight}%`,
      });
      return;
    }

    setSaving(true);

    try {
      const supabase = createClient();

      // Buscar tenant_id do usuário
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user?.id)
        .single();

      if (!profile?.tenant_id) {
        throw new Error('Tenant não encontrado');
      }

      // Criar equipe
      const { data: team, error: teamError } = await supabase
        .from('ai_teams')
        .insert({
          tenant_id: profile.tenant_id,
          name,
          description: description || null,
          event_type: eventType === 'all' ? null : eventType,
          is_default: isDefault,
        })
        .select()
        .single();

      if (teamError) throw teamError;

      // Adicionar membros
      const members = selectedAgents.map((a, index) => ({
        team_id: team.id,
        agent_id: a.agent_id,
        weight: a.weight,
        sort_order: index,
      }));

      const { error: membersError } = await supabase
        .from('ai_team_members')
        .insert(members);

      if (membersError) throw membersError;

      // Verificar se o trigger adicionou o coordenador automaticamente
      const { data: teamMembers } = await supabase
        .from('ai_team_members')
        .select('*, agent:ai_agents(is_coordinator)')
        .eq('team_id', team.id);
      
      const hasCoordinator = teamMembers?.some(m => m.is_coordinator || (m.agent as any)?.is_coordinator);
      
      if (!hasCoordinator) {
        console.warn('⚠️ Coordenador não foi adicionado automaticamente, adicionando manualmente...');
        
        // Buscar coordenador template do mesmo tenant
        const { data: coordinator } = await supabase
          .from('ai_agents')
          .select('id')
          .eq('is_coordinator', true)
          .eq('is_template', true)
          .eq('tenant_id', profile.tenant_id)
          .single();
        
        if (coordinator) {
          await supabase
            .from('ai_team_members')
            .insert({
              team_id: team.id,
              agent_id: coordinator.id,
              weight: 0,
              sort_order: -1,
              is_coordinator: true
            });
        }
      }

      toast.success('Equipe criada com sucesso!');
      router.push(`/settings/teams/${team.id}`);

    } catch (err: any) {
      toast.error('Erro ao criar equipe', {
        description: err.message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/settings/teams')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-serif font-semibold text-zinc-900">Nova Equipe</h1>
            <p className="text-zinc-500 mt-1">Configure os agentes e pesos</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Criar Equipe
        </Button>
      </div>

      {/* Info básica */}
      <Card>
        <CardHeader>
          <CardTitle>Informações da Equipe</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nome da Equipe *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Equipe Casamento Premium"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Tipo de Evento</Label>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="casamento">💒 Casamento</SelectItem>
                  <SelectItem value="15_anos">🎂 15 Anos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição opcional da equipe..."
              className="mt-1.5"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_default"
              checked={isDefault}
              onCheckedChange={setIsDefault}
            />
            <Label htmlFor="is_default" className="cursor-pointer">
              Equipe padrão para este tipo de evento
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Agentes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Agentes da Equipe</CardTitle>
              <CardDescription>
                Adicione agentes e configure os pesos (devem somar 100%)
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={totalWeight === 100 ? 'default' : 'destructive'}>
                Total: {totalWeight}%
              </Badge>
              {selectedAgents.length > 0 && (
                <Button variant="outline" size="sm" onClick={handleDistributeEvenly}>
                  Distribuir igual
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Dropdown para adicionar agente */}
          <div>
            <Label>Adicionar Agente</Label>
            <Select 
              onValueChange={handleAddAgent} 
              value=""
              disabled={loadingAgents || availableAgents.length === 0}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder={
                  loadingAgents 
                    ? "Carregando agentes..." 
                    : availableAgents.length === 0
                    ? (agents?.length === 0 
                        ? "Nenhum agente cadastrado" 
                        : "Todos os agentes já foram adicionados")
                    : "Selecione um agente para adicionar..."
                } />
              </SelectTrigger>
              <SelectContent>
                {loadingAgents ? (
                  <div className="px-2 py-4 text-sm text-center text-zinc-500">
                    Carregando agentes...
                  </div>
                ) : availableAgents.length > 0 ? (
                  availableAgents.map(agent => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.icon} {agent.name}
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-2 py-4 text-sm text-center text-zinc-500">
                    {agents?.length === 0
                      ? 'Nenhum agente cadastrado'
                      : 'Todos os agentes já foram adicionados'}
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Lista de agentes selecionados */}
          <div className="space-y-2">
            {selectedAgents.map((agent) => (
              <div
                key={agent.agent_id}
                className="flex items-center gap-4 p-3 bg-zinc-50 rounded-lg border"
              >
                <div className="flex items-center gap-2 min-w-[180px]">
                  <span className="text-xl">{agent.agent_icon}</span>
                  <span className="font-medium">{agent.agent_name}</span>
                </div>

                <div className="flex-1 flex items-center gap-3">
                  <Slider
                    value={[agent.weight]}
                    onValueChange={([value]) => handleWeightChange(agent.agent_id, value)}
                    max={100}
                    step={1}
                    className="flex-1"
                  />
                  <Badge variant="secondary" className="min-w-[50px] justify-center">
                    {agent.weight}%
                  </Badge>
                </div>

                <Button
                  size="icon"
                  variant="ghost"
                  className="text-red-600"
                  onClick={() => handleRemoveAgent(agent.agent_id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {selectedAgents.length === 0 && (
              <div className="text-center py-12 text-zinc-500 border rounded-lg border-dashed">
                <p className="font-medium">Nenhum agente adicionado</p>
                <p className="text-sm mt-1">Use o seletor acima para adicionar agentes à equipe</p>
              </div>
            )}
          </div>

          {totalWeight !== 100 && selectedAgents.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                ⚠️ Os pesos devem somar exatamente 100%.
                Atualmente: <strong>{totalWeight}%</strong>
                ({totalWeight < 100 ? `faltam ${100 - totalWeight}%` : `excede em ${totalWeight - 100}%`})
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
