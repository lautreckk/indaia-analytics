'use client';

import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Pencil, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUpdateAgent } from '@/hooks/use-agents';
import { toast } from 'sonner';

interface AgentData {
  id: string;
  name: string;
  icon: string;
  key: string;
  description?: string;
  prompt_system: string;
  prompt_business?: string;
  prompt_output: string;
}

interface SortableMemberItemProps {
  member: {
    id: string;
    weight: number;
    is_coordinator?: boolean;
    agent?: AgentData & { is_coordinator?: boolean };
  };
  localWeight: number;
  onWeightChange: (weight: number) => void;
  onRemove: () => void;
  onAgentUpdated?: () => void;
}

// Verificar se é coordenador
const isCoordinator = (member: SortableMemberItemProps['member']) => {
  return member?.is_coordinator || member?.agent?.is_coordinator;
}

export function SortableMemberItem({
  member,
  localWeight,
  onWeightChange,
  onRemove,
  onAgentUpdated,
}: SortableMemberItemProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    icon: '',
    prompt_system: '',
    prompt_business: '',
    prompt_output: '',
  });
  
  const updateAgent = useUpdateAgent();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: member.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleOpenEdit = () => {
    // Não permitir editar coordenador
    if (isCoordinator(member)) {
      setIsEditOpen(true); // Abre modal, mas será bloqueado dentro
      return;
    }
    
    if (member.agent) {
      setEditForm({
        name: member.agent.name,
        description: member.agent.description || '',
        icon: member.agent.icon,
        prompt_system: member.agent.prompt_system,
        prompt_business: member.agent.prompt_business || '',
        prompt_output: member.agent.prompt_output,
      });
      setIsEditOpen(true);
    }
  };

  const handleSaveAgent = async () => {
    if (!member.agent) return;
    
    try {
      await updateAgent.update(member.agent.id, editForm);
      setIsEditOpen(false);
      onAgentUpdated?.();
      toast.success('Agente atualizado!');
    } catch (err: any) {
      toast.error('Erro ao salvar agente', {
        description: err.message,
      });
    }
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className="flex items-center gap-4 p-4 bg-white border rounded-lg hover:border-zinc-300 transition-colors"
      >
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab hover:bg-zinc-100 p-1 rounded"
        >
          <GripVertical className="h-4 w-4 text-zinc-400" />
        </button>

        {/* Agent info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-2xl">{member.agent?.icon}</span>
          <div className="min-w-0">
            <p className="font-medium text-zinc-900 truncate">{member.agent?.name}</p>
            <code className="text-xs text-zinc-500">{member.agent?.key}</code>
          </div>
        </div>

        {/* Weight input - desabilitado para coordenador */}
        {!isCoordinator(member) ? (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={100}
              value={localWeight}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 0;
                onWeightChange(Math.min(100, Math.max(0, val)));
              }}
              className="w-20 text-center font-medium"
            />
            <span className="text-zinc-500 font-medium">%</span>
          </div>
        ) : (
          <div className="text-sm text-zinc-500">
            Padrão (0%)
          </div>
        )}

        {/* Edit button */}
        {!isCoordinator(member) && (
          <Button
            size="icon"
            variant="ghost"
            className="text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
            onClick={handleOpenEdit}
            title="Editar agente"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}

        {/* Remove button - não mostrar para coordenador */}
        {!isCoordinator(member) && (
          <Button
            size="icon"
            variant="ghost"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={onRemove}
            title="Remover da equipe"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Modal de edição do agente */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
          {/* Se for coordenador, mostrar mensagem especial */}
          {isCoordinator(member) ? (
            <>
              <DialogHeader className="px-6 pt-6 pb-4 border-b">
                <DialogTitle className="flex items-center gap-3">
                  <span className="text-2xl">🎯</span>
                  {member.agent?.name || 'Coordenador MAX'}
                </DialogTitle>
              </DialogHeader>
              
              <div className="py-6 text-center px-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H9m3-4V8m0 0V6m0 2h2m-2 0H9" />
                  </svg>
                </div>
                <p className="text-zinc-600 mb-2 font-medium">
                  O Coordenador MAX é um agente especial que não pode ser editado.
                </p>
                <p className="text-sm text-zinc-500">
                  Ele é responsável por consolidar os resultados de todos os outros agentes
                  em um relatório único com resumo estratégico e sugestões práticas.
                </p>
              </div>
              
              <div className="px-6 pb-6 border-t">
                <Button variant="outline" onClick={() => setIsEditOpen(false)} className="w-full">
                  Fechar
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Header */}
              <DialogHeader className="px-6 pt-6 pb-4 border-b">
                <DialogTitle className="flex items-center gap-3">
                  <span className="text-2xl">{editForm.icon}</span>
                  Editar Agente: {editForm.name}
                </DialogTitle>
                <DialogDescription>
                  Configure os prompts e informações do agente
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
                    value={editForm.icon}
                    onChange={(e) => setEditForm(prev => ({ ...prev, icon: e.target.value }))}
                    className="text-center text-2xl mt-1.5"
                  />
                </div>
                <div className="col-span-5">
                  <Label>Nome</Label>
                  <Input
                    value={editForm.name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                    className="mt-1.5"
                  />
                </div>
                <div className="col-span-5">
                  <Label>Key (identificador)</Label>
                  <Input
                    value={member.agent?.key || ''}
                    disabled
                    className="mt-1.5 bg-zinc-100"
                  />
                </div>
              </div>

              <div>
                <Label>Descrição</Label>
                <Input
                  value={editForm.description}
                  onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Breve descrição do que o agente analisa"
                  className="mt-1.5"
                />
              </div>

              {/* Tabs de prompts */}
              <Tabs defaultValue="system" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="system">🔧 Sistema</TabsTrigger>
                  <TabsTrigger value="business">📋 Regras de Negócio</TabsTrigger>
                  <TabsTrigger value="output">📤 Formato de Saída</TabsTrigger>
                </TabsList>

                <TabsContent value="system" className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Prompt do Sistema</Label>
                    <span className="text-xs text-zinc-500">
                      {editForm.prompt_system.length} caracteres
                    </span>
                  </div>
                  <p className="text-sm text-zinc-500">
                    Instruções fixas que definem o comportamento e personalidade do agente.
                  </p>
                  <Textarea
                    value={editForm.prompt_system}
                    onChange={(e) => setEditForm(prev => ({ ...prev, prompt_system: e.target.value }))}
                    placeholder="Você é um Agente especializado..."
                    className="min-h-[250px] font-mono text-sm"
                  />
                </TabsContent>

                <TabsContent value="business" className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Regras de Negócio</Label>
                    <span className="text-xs text-zinc-500">
                      {editForm.prompt_business.length} caracteres
                    </span>
                  </div>
                  <p className="text-sm text-zinc-500">
                    Critérios específicos de avaliação. Pode ser sobrescrito por equipe.
                  </p>
                  <Textarea
                    value={editForm.prompt_business}
                    onChange={(e) => setEditForm(prev => ({ ...prev, prompt_business: e.target.value }))}
                    placeholder="CRITÉRIOS DE AVALIAÇÃO:&#10;1. ..."
                    className="min-h-[250px] font-mono text-sm"
                  />
                </TabsContent>

                <TabsContent value="output" className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Formato de Saída</Label>
                    <span className="text-xs text-zinc-500">
                      {editForm.prompt_output.length} caracteres
                    </span>
                  </div>
                  <p className="text-sm text-zinc-500">
                    Estrutura JSON esperada na resposta. Deve conter o campo "score".
                  </p>
                  <Textarea
                    value={editForm.prompt_output}
                    onChange={(e) => setEditForm(prev => ({ ...prev, prompt_output: e.target.value }))}
                    placeholder='FORMATO DE SAÍDA: JSON&#10;{"score": ...}'
                    className="min-h-[250px] font-mono text-sm"
                  />
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* Footer FIXO com botões - sempre visível! */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t bg-white">
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveAgent} 
              disabled={updateAgent.loading}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {updateAgent.loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Agente
                </>
              )}
            </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
