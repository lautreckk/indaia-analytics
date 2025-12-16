'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { ArrowLeft, Save, Loader2, Trash2, GripVertical, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useTeam,
  useUpdateTeam,
  useAddTeamMember,
  useUpdateTeamMember,
  useRemoveTeamMember,
  useReorderTeamMembers
} from '@/hooks/use-teams';
import { useAgents } from '@/hooks/use-agents';
import { SortableMemberItem } from '@/components/teams/sortable-member-item';
import { toast } from 'sonner';

export default function EditTeamPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = params.id as string;

  const { team, loading, error, refetch } = useTeam(teamId);
  const { agents } = useAgents();
  const updateTeam = useUpdateTeam();
  const addMember = useAddTeamMember();
  const updateMember = useUpdateTeamMember();
  const removeMember = useRemoveTeamMember();
  const reorderMembers = useReorderTeamMembers();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState<string>('all');
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Estado LOCAL dos pesos (não salva até clicar em Salvar)
  const [localWeights, setLocalWeights] = useState<Record<string, number>>({});
  const [hasWeightChanges, setHasWeightChanges] = useState(false);

  // Modal de criar novo agente
  const [isNewAgentModalOpen, setIsNewAgentModalOpen] = useState(false);
  const [newAgentForm, setNewAgentForm] = useState({
    name: '',
    key: '',
    description: '',
    icon: '🤖',
    prompt_system: '',
    prompt_business: '',
    prompt_output: '',
  });
  const [creatingAgent, setCreatingAgent] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (team) {
      setName(team.name);
      setDescription(team.description || '');
      setEventType(team.event_type || 'all');
      setIsDefault(team.is_default);
      
      // Inicializar pesos locais (apenas membros regulares, não coordenador)
      const weights: Record<string, number> = {};
      team.members?.forEach((m: any) => {
        // Coordenador sempre tem peso 0, não precisa salvar no estado local
        if (!m.is_coordinator && !m.agent?.is_coordinator) {
          weights[m.id] = m.weight;
        }
      });
      setLocalWeights(weights);
      setHasWeightChanges(false);
    }
  }, [team]);

  // Filtrar agentes disponíveis - excluir coordenador e agentes já na equipe
  const availableAgents = agents?.filter(agent => {
    // Excluir coordenador (não pode ser adicionado manualmente)
    if (agent.is_coordinator) return false;
    
    // Excluir agentes já na equipe
    if (team?.members?.some(m => m.agent_id === agent.id)) return false;
    
    return true;
  });

  // Separar coordenador dos membros regulares
  const coordinatorMember = team?.members?.find((m: any) => m.is_coordinator || m.agent?.is_coordinator);
  const regularMembers = team?.members?.filter((m: any) => !m.is_coordinator && !m.agent?.is_coordinator) || [];

  // Calcular peso total apenas dos agentes regulares (coordenador não conta)
  const totalWeight = Object.keys(localWeights).length > 0
    ? Object.entries(localWeights)
        .filter(([memberId]) => {
          const member = team?.members?.find((m: any) => m.id === memberId);
          return member && !member.is_coordinator && !member.agent?.is_coordinator;
        })
        .reduce((sum, [, w]) => sum + w, 0)
    : (regularMembers.reduce((sum, m) => sum + (m.weight || 0), 0) || 0);

  const handleSaveInfo = async () => {
    setSaving(true);
    try {
      await updateTeam.update(teamId, {
        name,
        description: description || null,
        event_type: eventType === 'all' ? null : eventType,
        is_default: isDefault,
      });
      toast.success('Equipe atualizada!');
    } catch (err: any) {
      toast.error('Erro ao atualizar equipe', {
        description: err.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddAgent = async (agentId: string) => {
    try {
      const newMember = await addMember.add(teamId, {
        agent_id: agentId,
        weight: 10,
      });
      
      // Adicionar ao estado local também
      if (newMember?.id) {
        setLocalWeights(prev => ({ ...prev, [newMember.id]: 10 }));
        setHasWeightChanges(true);
      }
      
      refetch();
      toast.success('Agente adicionado à equipe');
    } catch (err: any) {
      toast.error('Erro ao adicionar agente', {
        description: err.message,
      });
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      await removeMember.remove(memberId);
      
      // Remover do estado local também
      setLocalWeights(prev => {
        const newWeights = { ...prev };
        delete newWeights[memberId];
        return newWeights;
      });
      setHasWeightChanges(false);
      
      refetch();
      toast.success('Agente removido da equipe');
    } catch (err: any) {
      toast.error('Erro ao remover agente', {
        description: err.message,
      });
    }
  };

  // Apenas atualiza estado local - não chama API
  // Não permite alterar peso do coordenador
  const handleWeightChange = (memberId: string, weight: number) => {
    const member = team?.members?.find((m: any) => m.id === memberId);
    if (member?.is_coordinator || member?.agent?.is_coordinator) {
      toast.warning('Peso do Coordenador', {
        description: 'O Coordenador sempre tem peso 0% (não conta no cálculo).',
      });
      return;
    }
    setLocalWeights(prev => ({ ...prev, [memberId]: weight }));
    setHasWeightChanges(true);
  };

  // Salvar todos os pesos de uma vez (apenas membros regulares, não coordenador)
  const handleSaveWeights = async () => {
    // Filtrar apenas pesos de membros regulares (não coordenador)
    const regularWeights = Object.entries(localWeights).filter(([memberId]) => {
      const member = team?.members?.find((m: any) => m.id === memberId);
      return member && !member.is_coordinator && !member.agent?.is_coordinator;
    });
    
    const currentTotal = regularWeights.reduce((sum, [, w]) => sum + w, 0);
    
    if (currentTotal !== 100) {
      toast.warning('Pesos inválidos', {
        description: `Os pesos devem somar 100%. Atual: ${currentTotal}%`,
      });
      return;
    }

    setSaving(true);
    try {
      // Atualizar todos os membros regulares em paralelo (excluir coordenador)
      await Promise.all(
        regularWeights.map(([memberId, weight]) =>
          updateMember.update(memberId, teamId, { weight })
        )
      );
      
      setHasWeightChanges(false);
      refetch();
      toast.success('Pesos salvos com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao salvar pesos', {
        description: err.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && team) {
      const oldIndex = team.members.findIndex(m => m.id === active.id);
      const newIndex = team.members.findIndex(m => m.id === over.id);
      const newOrder = arrayMove(team.members, oldIndex, newIndex);

      try {
        await reorderMembers.reorder(teamId, newOrder.map(m => m.id));
        refetch();
      } catch (err: any) {
        toast.error('Erro ao reordenar', {
          description: err.message,
        });
      }
    }
  };

  // Distribuir pesos apenas no estado local (não salva até clicar Salvar)
  // Excluir coordenador da distribuição
  const handleDistributeEvenly = () => {
    if (!regularMembers.length) return;

    const count = regularMembers.length;
    const weightPerAgent = Math.floor(100 / count);
    const remainder = 100 - (weightPerAgent * count);

    const newWeights: Record<string, number> = {};
    regularMembers.forEach((member: any, i: number) => {
      newWeights[member.id] = weightPerAgent + (i === 0 ? remainder : 0);
    });
    
    setLocalWeights(newWeights);
    setHasWeightChanges(true);
  };

  // Gerar key automaticamente a partir do nome
  const handleNewAgentNameChange = (name: string) => {
    setNewAgentForm(prev => ({
      ...prev,
      name,
      key: name.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/[^a-z0-9]+/g, '_')      // Substitui espaços e especiais por _
        .replace(/^_|_$/g, ''),           // Remove _ do início e fim
    }));
  };

  // Criar novo agente e adicionar à equipe
  const handleCreateNewAgent = async () => {
    if (!newAgentForm.name.trim()) {
      toast.warning('Campo obrigatório', {
        description: 'Nome do agente é obrigatório',
      });
      return;
    }
    if (!newAgentForm.key.trim()) {
      toast.warning('Campo obrigatório', {
        description: 'Key do agente é obrigatória',
      });
      return;
    }
    if (!newAgentForm.prompt_system.trim()) {
      toast.warning('Campo obrigatório', {
        description: 'Prompt do Sistema é obrigatório',
      });
      return;
    }

    setCreatingAgent(true);
    try {
      const supabase = (await import('@/lib/supabase/client')).createClient();
      
      // Buscar tenant_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();
      
      if (!profile) throw new Error('Perfil não encontrado');

      // Criar o agente
      const { data: newAgent, error: agentError } = await supabase
        .from('ai_agents')
        .insert({
          tenant_id: profile.tenant_id,
          key: newAgentForm.key.toLowerCase().replace(/\s+/g, '_'),
          name: newAgentForm.name,
          description: newAgentForm.description || null,
          icon: newAgentForm.icon,
          prompt_system: newAgentForm.prompt_system,
          prompt_business: newAgentForm.prompt_business || null,
          prompt_output: newAgentForm.prompt_output || '{"score": 0, "analise": ""}',
          is_template: false,
          is_active: true,
          created_by: user.id,
        })
        .select()
        .single();

      if (agentError) throw agentError;

      // Adicionar à equipe atual
      const currentMembersCount = team?.members?.length || 0;
      const { error: memberError } = await supabase
        .from('ai_team_members')
        .insert({
          team_id: teamId,
          agent_id: newAgent.id,
          weight: 10, // Peso inicial padrão
          sort_order: currentMembersCount,
          is_active: true,
        });

      if (memberError) throw memberError;

      // Fechar modal e atualizar lista
      setIsNewAgentModalOpen(false);
      setNewAgentForm({
        name: '',
        key: '',
        description: '',
        icon: '🤖',
        prompt_system: '',
        prompt_business: '',
        prompt_output: '',
      });
      refetch();
      toast.success('Agente criado e adicionado à equipe!');
    } catch (err: any) {
      toast.error('Erro ao criar agente', {
        description: err.message,
      });
    } finally {
      setCreatingAgent(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <p className="text-zinc-500">Equipe não encontrada</p>
        <Button variant="outline" onClick={() => router.push('/settings/teams')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/settings/teams')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-serif font-semibold text-zinc-900">
              {team?.name || 'Carregando...'}
            </h1>
            <p className="text-zinc-500 mt-1">
              {team?.members?.length || 0} agente{team?.members?.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Info básica */}
      <Card>
        <CardHeader>
          <CardTitle>Informações da Equipe</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nome da Equipe</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
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
              className="mt-1.5"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Switch
                id="is_default"
                checked={isDefault}
                onCheckedChange={setIsDefault}
              />
              <Label htmlFor="is_default" className="cursor-pointer">Equipe padrão</Label>
            </div>

            <Button onClick={handleSaveInfo} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar Info
            </Button>
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
                Arraste para reordenar · Pesos devem somar 100%
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={totalWeight === 100 ? 'default' : 'destructive'}>
                Total: {totalWeight}%
              </Badge>
              <Button variant="outline" size="sm" onClick={handleDistributeEvenly}>
                Distribuir igual
              </Button>
              {hasWeightChanges && (
                <Button 
                  size="sm" 
                  onClick={handleSaveWeights}
                  disabled={saving || totalWeight !== 100}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {saving ? 'Salvando...' : 'Salvar Pesos'}
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsNewAgentModalOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Criar Novo
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Adicionar agente */}
          <Select 
            onValueChange={handleAddAgent} 
            value=""
            disabled={availableAgents?.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder={
                availableAgents?.length === 0
                  ? "Todos os agentes já foram adicionados"
                  : "Adicionar agente..."
              } />
            </SelectTrigger>
            <SelectContent>
              {availableAgents && availableAgents.length > 0 ? (
                availableAgents.map(agent => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.icon} {agent.name}
                  </SelectItem>
                ))
              ) : (
                <div className="px-2 py-4 text-sm text-center text-zinc-500">
                  Todos os agentes já foram adicionados
                </div>
              )}
            </SelectContent>
          </Select>

          {/* Coordenador (sempre primeiro, não drag-drop) */}
          {coordinatorMember && (
            <div className="border-2 border-amber-300 rounded-lg p-4 bg-gradient-to-r from-amber-50 to-orange-50 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-xl">
                    {coordinatorMember.agent?.icon || '🎯'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-zinc-900">{coordinatorMember.agent?.name || 'Coordenador MAX'}</span>
                      <Badge className="bg-amber-500 text-white border-0">
                        Padrão
                      </Badge>
                    </div>
                    <p className="text-sm text-zinc-500">
                      Consolida os resultados de todos os agentes em um relatório único
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-zinc-400">Peso</p>
                    <p className="text-sm font-medium text-zinc-500">—</p>
                  </div>
                  <div className="w-8" /> {/* Espaço onde ficaria o botão de remover */}
                </div>
              </div>
              
              <div className="mt-3 pt-3 border-t border-amber-200">
                <p className="text-xs text-amber-700 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  Este agente é obrigatório e executa após todos os outros para gerar o resumo final.
                </p>
              </div>
            </div>
          )}

          {/* Lista com drag and drop (apenas membros regulares) */}
          {regularMembers.length > 0 && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={regularMembers.map(m => m.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {regularMembers.map(member => (
                    <SortableMemberItem
                      key={member.id}
                      member={member}
                      localWeight={localWeights[member.id] ?? member.weight}
                      onWeightChange={(weight) => handleWeightChange(member.id, weight)}
                      onRemove={() => handleRemoveMember(member.id)}
                      onAgentUpdated={() => refetch()}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {regularMembers.length === 0 && !coordinatorMember && (
            <div className="text-center py-8 text-zinc-500 border rounded-lg border-dashed">
              <p>Nenhum agente na equipe</p>
            </div>
          )}

          {totalWeight !== 100 && regularMembers.length > 0 && (
            <p className="text-sm text-amber-600">
              ⚠️ Os pesos devem somar exatamente 100%. Atualmente: {totalWeight}%
            </p>
          )}
        </CardContent>
      </Card>

      {/* Modal de Criar Novo Agente */}
      <Dialog open={isNewAgentModalOpen} onOpenChange={setIsNewAgentModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
          {/* Header */}
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-3">
              <span className="text-2xl">{newAgentForm.icon}</span>
              Criar Novo Agente
            </DialogTitle>
            <DialogDescription>
              Crie um agente do zero e adicione automaticamente a esta equipe
            </DialogDescription>
          </DialogHeader>

          {/* Conteúdo com scroll */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-6">
              {/* Info básica */}
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-2">
                  <Label>Ícone</Label>
                  <Input
                    value={newAgentForm.icon}
                    onChange={(e) => setNewAgentForm(prev => ({ ...prev, icon: e.target.value }))}
                    className="text-center text-2xl mt-1.5"
                  />
                </div>
                <div className="col-span-5">
                  <Label>Nome *</Label>
                  <Input
                    value={newAgentForm.name}
                    onChange={(e) => handleNewAgentNameChange(e.target.value)}
                    placeholder="Ex: Análise de Objeções"
                    className="mt-1.5"
                  />
                </div>
                <div className="col-span-5">
                  <Label>Key (identificador) *</Label>
                  <Input
                    value={newAgentForm.key}
                    onChange={(e) => setNewAgentForm(prev => ({ ...prev, key: e.target.value }))}
                    placeholder="analise_objecoes"
                    className="mt-1.5 font-mono"
                  />
                  <p className="text-xs text-zinc-500 mt-1">Apenas letras minúsculas e _</p>
                </div>
              </div>

              <div>
                <Label>Descrição</Label>
                <Input
                  value={newAgentForm.description}
                  onChange={(e) => setNewAgentForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Breve descrição do que o agente analisa"
                  className="mt-1.5"
                />
              </div>

              {/* Tabs de prompts */}
              <Tabs defaultValue="system" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="system">🔧 Sistema *</TabsTrigger>
                  <TabsTrigger value="business">📋 Regras de Negócio</TabsTrigger>
                  <TabsTrigger value="output">📤 Formato de Saída</TabsTrigger>
                </TabsList>

                <TabsContent value="system" className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Prompt do Sistema *</Label>
                    <span className="text-xs text-zinc-500">
                      {newAgentForm.prompt_system.length} caracteres
                    </span>
                  </div>
                  <p className="text-sm text-zinc-500">
                    Instruções fixas que definem o comportamento e personalidade do agente.
                  </p>
                  <Textarea
                    value={newAgentForm.prompt_system}
                    onChange={(e) => setNewAgentForm(prev => ({ ...prev, prompt_system: e.target.value }))}
                    placeholder="Você é um Agente especializado em análise de reuniões de vendas.



OBJETIVO: Analisar uma transcrição completa de reunião e avaliar exclusivamente o Módulo [NOME], identificando se cada parte foi realizada, se foi bem executada e oferecendo sugestões de melhoria.



TOM: técnico, analítico, neutro



MODO DE ANÁLISE:

- Revisar a transcrição completa do início ao fim

- Localizar todos os trechos relacionados ao Módulo

- Nunca inventar evidências, sempre citar trechos reais

- Cada parte deve ser avaliada através do checklist oficial"
                    className="min-h-[250px] font-mono text-sm"
                  />
                </TabsContent>

                <TabsContent value="business" className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Regras de Negócio</Label>
                    <span className="text-xs text-zinc-500">
                      {newAgentForm.prompt_business.length} caracteres
                    </span>
                  </div>
                  <p className="text-sm text-zinc-500">
                    Critérios específicos de avaliação (opcional).
                  </p>
                  <Textarea
                    value={newAgentForm.prompt_business}
                    onChange={(e) => setNewAgentForm(prev => ({ ...prev, prompt_business: e.target.value }))}
                    placeholder="CRITÉRIOS DE AVALIAÇÃO:



1. [Critério 1] - Peso 30%

   - Subcritério A

   - Subcritério B



2. [Critério 2] - Peso 40%

   - Subcritério A

   - Subcritério B



3. [Critério 3] - Peso 30%

   - Subcritério A

   - Subcritério B"
                    className="min-h-[250px] font-mono text-sm"
                  />
                </TabsContent>

                <TabsContent value="output" className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Formato de Saída</Label>
                    <span className="text-xs text-zinc-500">
                      {newAgentForm.prompt_output.length} caracteres
                    </span>
                  </div>
                  <p className="text-sm text-zinc-500">
                    Estrutura JSON esperada na resposta. Deve conter o campo "score".
                  </p>
                  <Textarea
                    value={newAgentForm.prompt_output}
                    onChange={(e) => setNewAgentForm(prev => ({ ...prev, prompt_output: e.target.value }))}
                    placeholder='{
  "score": 0,
  "analise": "Descrição da análise...",
  "pontos_positivos": [],
  "pontos_negativos": [],
  "sugestoes": []
}'
                    className="min-h-[250px] font-mono text-sm"
                  />
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* Footer FIXO */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t bg-white">
            <Button variant="outline" onClick={() => setIsNewAgentModalOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateNewAgent} 
              disabled={creatingAgent}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {creatingAgent ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar e Adicionar à Equipe
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
