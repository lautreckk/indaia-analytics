'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAgent, useUpdateAgent } from '@/hooks/use-agents';

export default function EditAgentPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;

  const { agent, loading, error } = useAgent(agentId);
  const updateAgent = useUpdateAgent();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '🤖',
    prompt_system: '',
    prompt_business: '',
    prompt_output: '',
  });

  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (agent) {
      setFormData({
        name: agent.name,
        description: agent.description || '',
        icon: agent.icon,
        prompt_system: agent.prompt_system,
        prompt_business: agent.prompt_business || '',
        prompt_output: agent.prompt_output,
      });
    }
  }, [agent]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      await updateAgent.update(agentId, formData);
      alert('Agente atualizado com sucesso!');
      setHasChanges(false);
    } catch (err: any) {
      alert('Erro ao salvar agente: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <p className="text-zinc-500">Agente não encontrado</p>
        <Button variant="outline" onClick={() => router.push('/settings/agents')}>
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
          <Button variant="ghost" size="icon" onClick={() => router.push('/settings/agents')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{formData.icon}</span>
            <div>
              <h1 className="text-2xl font-serif font-semibold text-zinc-900">{formData.name}</h1>
              <code className="text-sm text-zinc-500">{agent.key}</code>
            </div>
          </div>
        </div>
        <Button onClick={handleSave} disabled={!hasChanges || updateAgent.loading}>
          {updateAgent.loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Salvar
        </Button>
      </div>

      {/* Info básica */}
      <Card>
        <CardHeader>
          <CardTitle>Informações Básicas</CardTitle>
          <CardDescription>Identificação e descrição do agente</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-2">
              <Label>Ícone</Label>
              <Input
                value={formData.icon}
                onChange={(e) => handleChange('icon', e.target.value)}
                className="text-center text-2xl mt-1.5"
              />
            </div>
            <div className="col-span-5">
              <Label>Nome</Label>
              <Input
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div className="col-span-5">
              <Label>Key (identificador)</Label>
              <Input
                value={agent.key}
                disabled
                className="mt-1.5 bg-zinc-100"
              />
            </div>
          </div>
          <div>
            <Label>Descrição</Label>
            <Input
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Breve descrição do que o agente analisa"
              className="mt-1.5"
            />
          </div>
        </CardContent>
      </Card>

      {/* Prompts */}
      <Card>
        <CardHeader>
          <CardTitle>Configuração de Prompts</CardTitle>
          <CardDescription>
            Estrutura "sanduíche" - Sistema + Regras de Negócio + Formato de Saída
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="system" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger 
                value="system"
                className="text-zinc-600 data-[state=active]:text-zinc-900"
              >
                🔧 Sistema
              </TabsTrigger>
              <TabsTrigger 
                value="business"
                className="text-zinc-600 data-[state=active]:text-zinc-900"
              >
                📋 Regras de Negócio
              </TabsTrigger>
              <TabsTrigger 
                value="output"
                className="text-zinc-600 data-[state=active]:text-zinc-900"
              >
                📤 Formato de Saída
              </TabsTrigger>
            </TabsList>

            <TabsContent value="system" className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <Label>Prompt do Sistema</Label>
                <span className="text-xs text-zinc-500">
                  {formData.prompt_system.length} caracteres
                </span>
              </div>
              <p className="text-sm text-zinc-500">
                Instruções fixas que definem o comportamento e personalidade do agente.
              </p>
              <Textarea
                value={formData.prompt_system}
                onChange={(e) => handleChange('prompt_system', e.target.value)}
                placeholder="Você é um Agente Segmentador especializado..."
                className="min-h-[400px] font-mono text-sm"
              />
            </TabsContent>

            <TabsContent value="business" className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <Label>Regras de Negócio</Label>
                <span className="text-xs text-zinc-500">
                  {formData.prompt_business.length} caracteres
                </span>
              </div>
              <p className="text-sm text-zinc-500">
                Critérios específicos de avaliação. Pode ser sobrescrito por equipe.
              </p>
              <Textarea
                value={formData.prompt_business}
                onChange={(e) => handleChange('prompt_business', e.target.value)}
                placeholder="CRITÉRIOS DE AVALIAÇÃO:&#10;1. ..."
                className="min-h-[400px] font-mono text-sm"
              />
            </TabsContent>

            <TabsContent value="output" className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <Label>Formato de Saída</Label>
                <span className="text-xs text-zinc-500">
                  {formData.prompt_output.length} caracteres
                </span>
              </div>
              <p className="text-sm text-zinc-500">
                Estrutura JSON esperada na resposta. Deve conter o campo "score".
              </p>
              <Textarea
                value={formData.prompt_output}
                onChange={(e) => handleChange('prompt_output', e.target.value)}
                placeholder='FORMATO DE SAÍDA: JSON&#10;{"score": ...}'
                className="min-h-[400px] font-mono text-sm"
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Aviso de alterações não salvas */}
      {hasChanges && (
        <div className="fixed bottom-4 right-4 bg-amber-100 text-amber-800 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <span className="text-sm font-medium">Alterações não salvas</span>
          <Button size="sm" onClick={handleSave} disabled={updateAgent.loading}>
            Salvar
          </Button>
        </div>
      )}
    </div>
  );
}
