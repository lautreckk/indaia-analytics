'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Edit2, Save, X, Calendar, Clock, FileText, DollarSign } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { TagsInput } from '@/components/ui/tags-input';

interface MeetingInfoEditorProps {
  meeting: {
    id: string;
    title: string;
    client_name?: string | null;
    client_names?: string[] | null;
    budget_number?: string | null;
    meeting_date?: string | null;
    meeting_time?: string | null;
    contract_value?: number | null;
  };
}

export function MeetingInfoEditor({ meeting }: MeetingInfoEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: meeting.title || '',
    client_name: meeting.client_name || '',
    client_names: (meeting.client_names && Array.isArray(meeting.client_names)) ? meeting.client_names : (meeting.client_name ? [meeting.client_name] : []),
    budget_number: meeting.budget_number || '',
    meeting_date: meeting.meeting_date || '',
    meeting_time: meeting.meeting_time || '',
    contract_value: meeting.contract_value?.toString() || '',
  });
  const router = useRouter();
  const supabase = createClient();

  const handleSave = async () => {
    setLoading(true);
    try {
      const updateData: any = {
        title: formData.title.trim(),
        budget_number: formData.budget_number.trim() || null,
        meeting_date: formData.meeting_date || null,
        meeting_time: formData.meeting_time || null,
      };

      // Atualizar client_names (nova estrutura) e manter client_name para compatibilidade
      if (formData.client_names && formData.client_names.length > 0) {
        updateData.client_names = formData.client_names;
        updateData.client_name = formData.client_names[0]; // Primeiro nome como fallback
      } else {
        updateData.client_names = [];
        updateData.client_name = null;
      }

      // Processar valor do contrato
      if (formData.contract_value) {
        const cleanValue = formData.contract_value.replace(/[^\d,.-]/g, '').replace(',', '.');
        const numValue = parseFloat(cleanValue);
        if (!isNaN(numValue) && numValue > 0) {
          updateData.contract_value = numValue;
        }
      } else {
        updateData.contract_value = null;
      }

      const { error } = await supabase
        .from('meetings')
        .update(updateData)
        .eq('id', meeting.id);

      if (error) throw error;

      toast.success('Informações atualizadas com sucesso!');
      setIsEditing(false);
      router.refresh();
    } catch (error: any) {
      console.error('Erro ao atualizar:', error);
      toast.error(`Erro ao atualizar: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      title: meeting.title || '',
      client_name: meeting.client_name || '',
      client_names: (meeting.client_names && Array.isArray(meeting.client_names)) ? meeting.client_names : (meeting.client_name ? [meeting.client_name] : []),
      budget_number: meeting.budget_number || '',
      meeting_date: meeting.meeting_date || '',
      meeting_time: meeting.meeting_time || '',
      contract_value: meeting.contract_value?.toString() || '',
    });
    setIsEditing(false);
  };

  // Formatar data para input (YYYY-MM-DD)
  const formatDateForInput = (dateStr: string | null | undefined) => {
    if (!dateStr) return '';
    // Se já estiver no formato correto, retornar
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) return dateStr;
    // Tentar converter de outros formatos
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    return '';
  };

  // Formatar hora para input (HH:MM)
  const formatTimeForInput = (timeStr: string | null | undefined) => {
    if (!timeStr) return '';
    // Se já estiver no formato correto, retornar
    if (timeStr.match(/^\d{2}:\d{2}$/)) return timeStr;
    // Tentar extrair hora de timestamps
    if (timeStr.includes(':')) {
      const parts = timeStr.split(':');
      return `${parts[0].padStart(2, '0')}:${parts[1]?.padStart(2, '0') || '00'}`;
    }
    return '';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            Informações da Reunião
          </CardTitle>
          {!isEditing ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="gap-2"
            >
              <Edit2 className="h-4 w-4" />
              Editar
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                disabled={loading}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={loading}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                Salvar
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="edit-title">Título *</Label>
          {isEditing ? (
            <Input
              id="edit-title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="mt-1"
            />
          ) : (
            <p className="mt-1 text-zinc-900 font-medium">{meeting.title || '-'}</p>
          )}
        </div>

        <div>
          <Label htmlFor="edit-client-names">Clientes</Label>
          {isEditing ? (
            <TagsInput
              tags={formData.client_names}
              onChange={(tags) => setFormData(prev => ({ ...prev, client_names: tags }))}
              placeholder="Digite o nome e pressione Enter"
              className="mt-1"
            />
          ) : (
            <div className="mt-1 flex flex-wrap gap-2">
              {(meeting.client_names && Array.isArray(meeting.client_names) && meeting.client_names.length > 0) ? (
                meeting.client_names.map((name, index) => (
                  <span key={index} className="px-2 py-1 bg-zinc-100 rounded-md text-zinc-700 text-sm">
                    {name}
                  </span>
                ))
              ) : meeting.client_name ? (
                <span className="px-2 py-1 bg-zinc-100 rounded-md text-zinc-700 text-sm">
                  {meeting.client_name}
                </span>
              ) : (
                <span className="text-zinc-500">-</span>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <div>
            <Label htmlFor="edit-budget-number">Número de Orçamento</Label>
            {isEditing ? (
              <Input
                id="edit-budget-number"
                value={formData.budget_number}
                onChange={(e) => setFormData(prev => ({ ...prev, budget_number: e.target.value }))}
                className="mt-1"
                placeholder="Ex: ORC-2024-001"
              />
            ) : (
              <p className="mt-1 text-zinc-700">{meeting.budget_number || '-'}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="edit-meeting-date" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Data da Reunião
            </Label>
            {isEditing ? (
              <Input
                id="edit-meeting-date"
                type="date"
                value={formatDateForInput(formData.meeting_date)}
                onChange={(e) => setFormData(prev => ({ ...prev, meeting_date: e.target.value }))}
                className="mt-1"
              />
            ) : (
              <p className="mt-1 text-zinc-700">
                {meeting.meeting_date 
                  ? new Date(meeting.meeting_date).toLocaleDateString('pt-BR')
                  : '-'}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="edit-meeting-time" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Hora da Reunião
            </Label>
            {isEditing ? (
              <Input
                id="edit-meeting-time"
                type="time"
                value={formatTimeForInput(formData.meeting_time)}
                onChange={(e) => setFormData(prev => ({ ...prev, meeting_time: e.target.value }))}
                className="mt-1"
              />
            ) : (
              <p className="mt-1 text-zinc-700">{meeting.meeting_time || '-'}</p>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="edit-contract-value" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Valor do Contrato (R$)
          </Label>
          {isEditing ? (
            <Input
              id="edit-contract-value"
              type="text"
              value={formData.contract_value}
              onChange={(e) => setFormData(prev => ({ ...prev, contract_value: e.target.value }))}
              className="mt-1"
              placeholder="150000"
            />
          ) : (
            <p className="mt-1 text-zinc-700">
              {meeting.contract_value 
                ? new Intl.NumberFormat('pt-BR', { 
                    style: 'currency', 
                    currency: 'BRL' 
                  }).format(meeting.contract_value)
                : '-'}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
