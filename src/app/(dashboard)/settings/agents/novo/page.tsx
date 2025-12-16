'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCreateAgent } from '@/hooks/use-agents';
import Link from 'next/link';

export default function NovoAgentePage() {
  const router = useRouter();
  const createAgent = useCreateAgent();

  const [formData, setFormData] = useState({
    key: '',
    name: '',
    description: '',
    icon: '🤖',
    prompt_system: 'Você é um Agente Segmentador especializado em análise de reuniões de vendas.',
    prompt_business: '',
    prompt_output: `FORMATO DE SAÍDA: JSON

Retorne EXATAMENTE neste formato:

{
  "score": <número 0-100>,
  "insights": {
    "pontos_fortes": ["..."],
    "pontos_fracos": ["..."]
  },
  "recommendations": ["..."]
}`,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.key || !formData.name || !formData.prompt_system || !formData.prompt_output) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }

    // Validar key (apenas letras minúsculas e underscore)
    if (!/^[a-z_]+$/.test(formData.key)) {
      alert('A key deve conter apenas letras minúsculas e underscore');
      return;
    }

    try {
      await createAgent.create(formData);
      router.push('/settings/agents');
    } catch (error: any) {
      alert('Erro ao criar agente: ' + error.message);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/settings/agents">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-serif font-semibold text-zinc-900">Novo Agente</h1>
          <p className="text-zinc-500 mt-1">Configure o agente de IA para análise de reuniões</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Informações Básicas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-2">
                <Label htmlFor="icon">Ícone</Label>
                <Input
                  id="icon"
                  value={formData.icon}
                  onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
                  className="text-center text-2xl"
                />
              </div>

              <div className="col-span-5">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Análise do Consultor"
                  required
                />
              </div>

              <div className="col-span-5">
                <Label htmlFor="key">Key (identificador) *</Label>
                <Input
                  id="key"
                  value={formData.key}
                  onChange={(e) => setFormData(prev => ({ ...prev, key: e.target.value.toLowerCase() }))}
                  placeholder="ex: consultor"
                  pattern="[a-z_]+"
                  required
                />
                <p className="text-xs text-zinc-500 mt-1">Apenas letras minúsculas e _</p>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Breve descrição do que o agente analisa"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Prompts</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="system" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger 
                  value="system"
                  className="text-zinc-600 data-[state=active]:text-zinc-900"
                >
                  Sistema
                </TabsTrigger>
                <TabsTrigger 
                  value="business"
                  className="text-zinc-600 data-[state=active]:text-zinc-900"
                >
                  Regras de Negócio
                </TabsTrigger>
                <TabsTrigger 
                  value="output"
                  className="text-zinc-600 data-[state=active]:text-zinc-900"
                >
                  Formato de Saída
                </TabsTrigger>
              </TabsList>

              <TabsContent value="system" className="mt-4">
                <Label htmlFor="prompt_system">Prompt do Sistema *</Label>
                <p className="text-xs text-zinc-500 mb-2">
                  Instruções fixas que definem o comportamento do agente
                </p>
                <Textarea
                  id="prompt_system"
                  value={formData.prompt_system}
                  onChange={(e) => setFormData(prev => ({ ...prev, prompt_system: e.target.value }))}
                  className="min-h-[300px] font-mono text-sm"
                  required
                />
              </TabsContent>

              <TabsContent value="business" className="mt-4">
                <Label htmlFor="prompt_business">Regras de Negócio</Label>
                <p className="text-xs text-zinc-500 mb-2">
                  Critérios específicos de avaliação (pode ser editado por equipe)
                </p>
                <Textarea
                  id="prompt_business"
                  value={formData.prompt_business}
                  onChange={(e) => setFormData(prev => ({ ...prev, prompt_business: e.target.value }))}
                  className="min-h-[300px] font-mono text-sm"
                />
              </TabsContent>

              <TabsContent value="output" className="mt-4">
                <Label htmlFor="prompt_output">Formato de Saída *</Label>
                <p className="text-xs text-zinc-500 mb-2">
                  Estrutura JSON esperada na resposta do agente
                </p>
                <Textarea
                  id="prompt_output"
                  value={formData.prompt_output}
                  onChange={(e) => setFormData(prev => ({ ...prev, prompt_output: e.target.value }))}
                  className="min-h-[300px] font-mono text-sm"
                  required
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Link href="/settings/agents">
            <Button type="button" variant="outline">Cancelar</Button>
          </Link>
          <Button type="submit" disabled={createAgent.loading}>
            {createAgent.loading ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </form>
    </div>
  );
}
