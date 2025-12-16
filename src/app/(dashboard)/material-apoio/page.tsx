'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, Loader2, ArrowLeft, Trash2, CheckCircle2, XCircle, Clock, RotateCcw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import Link from 'next/link';
import { usePermissions } from '@/hooks/use-permissions';

interface Document {
  id: string;
  file_name: string;
  title: string | null;
  description: string | null;
  file_type: string;
  file_size: number;
  status: 'processing' | 'completed' | 'failed';
  error_message: string | null;
  total_chunks: number;
  created_at: string;
  access: Array<{
    access_type: 'team' | 'agent';
    team_id: string | null;
    team_name?: string;
    agent_key: string | null;
    agent_name?: string;
  }>;
}

interface Team {
  id: string;
  name: string;
}

interface Agent {
  id: string;
  key: string;
  name: string;
}

export default function MaterialApoioPage() {
  const router = useRouter();
  const { role, loading: permissionsLoading } = usePermissions();
  const supabase = createClient();
  
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<Team[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [accessType, setAccessType] = useState<'team' | 'agent'>('team');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedAgentKey, setSelectedAgentKey] = useState<string>('');

  useEffect(() => {
    if (permissionsLoading) return;
    
    if (role !== 'admin') {
      toast.error('Acesso negado. Apenas administradores podem acessar esta página.');
      router.push('/');
      return;
    }
    
    loadDocuments();
    loadTeams();
    loadAgents();
  }, [role, permissionsLoading, router]);

  const loadDocuments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile?.tenant_id) return;

      // Buscar documentos (sem join para evitar erro 404)
      const { data: docs, error } = await supabase
        .from('agent_knowledge_documents')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Buscar acesso separadamente para cada documento
      const docsWithAccess = await Promise.all(
        (docs || []).map(async (doc: any) => {
          const { data: accessData } = await supabase
            .from('agent_knowledge_access')
            .select('access_type, team_id, agent_key')
            .eq('document_id', doc.id);
          
          return { ...doc, access: accessData || [] };
        })
      );

      // Buscar nomes das equipes e agentes
      const docsWithNames = await Promise.all(
        docsWithAccess.map(async (doc: any) => {
          const accessWithNames = await Promise.all(
            (doc.access || []).map(async (acc: any) => {
              if (acc.access_type === 'team' && acc.team_id) {
                const { data: team } = await supabase
                  .from('ai_teams')
                  .select('name')
                  .eq('id', acc.team_id)
                  .single();
                return { ...acc, team_name: team?.name };
              }
              if (acc.access_type === 'agent' && acc.agent_key) {
                const { data: agent } = await supabase
                  .from('ai_agents')
                  .select('name')
                  .eq('key', acc.agent_key)
                  .single();
                return { ...acc, agent_name: agent?.name };
              }
              return acc;
            })
          );
          return { ...doc, access: accessWithNames };
        })
      );

      setDocuments(docsWithNames);
    } catch (error: any) {
      console.error('Erro ao carregar documentos:', error);
      toast.error('Erro ao carregar documentos');
    } finally {
      setLoading(false);
    }
  };

  const loadTeams = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile?.tenant_id) return;

      const { data, error } = await supabase
        .from('ai_teams')
        .select('id, name')
        .eq('tenant_id', profile.tenant_id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setTeams(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar equipes:', error);
    }
  };

  const loadAgents = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile?.tenant_id) return;

      const { data, error } = await supabase
        .from('ai_agents')
        .select('id, key, name')
        .eq('tenant_id', profile.tenant_id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setAgents(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar agentes:', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validar tipo de arquivo
    const validTypes = ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const validExtensions = ['.pdf', '.txt', '.doc', '.docx'];
    const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();

    if (!validTypes.includes(selectedFile.type) && !validExtensions.includes(`.${fileExtension}`)) {
      toast.error('Formato de arquivo não suportado. Use PDF, TXT, DOC ou DOCX');
      return;
    }

    // Limite de 50MB
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (selectedFile.size > maxSize) {
      toast.error('Arquivo muito grande. Tamanho máximo: 50MB');
      return;
    }

    setFile(selectedFile);
    
    // Preencher título automaticamente se vazio
    if (!title) {
      setTitle(selectedFile.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Selecione um arquivo primeiro');
      return;
    }

    if (accessType === 'team' && !selectedTeamId) {
      toast.error('Selecione uma equipe');
      return;
    }

    if (accessType === 'agent' && !selectedAgentKey) {
      toast.error('Selecione um agente');
      return;
    }

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile?.tenant_id) {
        throw new Error('Perfil não encontrado');
      }

      // Upload para Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const bucketName = 'knowledge-base';

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Erro ao fazer upload: ${uploadError.message}`);
      }

      // Criar documento e processar
      const response = await fetch('/api/material-apoio/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath: uploadData.path,
          fileName: file.name,
          fileType: fileExt?.toLowerCase() || 'pdf',
          fileSize: file.size,
          title: title || file.name,
          description: description || null,
          tenantId: profile.tenant_id,
          accessType,
          teamId: accessType === 'team' ? selectedTeamId : null,
          agentKey: accessType === 'agent' ? selectedAgentKey : null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao processar arquivo');
      }

      toast.success('Arquivo enviado com sucesso! O processamento será feito em background.');
      
      // Reset form
      setFile(null);
      setTitle('');
      setDescription('');
      setSelectedTeamId('');
      setSelectedAgentKey('');
      
      // Recarregar lista
      await loadDocuments();
    } catch (error: any) {
      console.error('Erro:', error);
      toast.error(error.message || 'Erro ao processar arquivo');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm('Tem certeza que deseja excluir este documento?')) return;

    try {
      const response = await fetch(`/api/material-apoio/${docId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Erro ao excluir documento');
      }

      toast.success('Documento excluído com sucesso');
      await loadDocuments();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao excluir documento');
    }
  };

  const handleReset = async (docId: string) => {
    if (!confirm('Tem certeza que deseja cancelar e reprocessar este documento?')) return;

    try {
      const response = await fetch(`/api/material-apoio/${docId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'reset' }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao resetar documento');
      }

      toast.success('Documento resetado. O processamento será reiniciado.');
      await loadDocuments();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao resetar documento');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" /> Completo</Badge>;
      case 'processing':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" /> Processando</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" /> Erro</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (permissionsLoading || loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (role !== 'admin') {
    return null;
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-serif font-semibold text-zinc-900">Material de Apoio Agentes</h1>
          <p className="text-zinc-500 mt-1">Envie documentos para enriquecer o contexto dos agentes</p>
        </div>
      </div>

      {/* Upload Form */}
      <Card>
        <CardHeader>
          <CardTitle>Novo Documento</CardTitle>
          <CardDescription>
            Envie arquivos PDF, TXT, DOC ou DOCX (máximo 50MB)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="file-upload">Arquivo</Label>
            <Input
              id="file-upload"
              type="file"
              accept=".pdf,.txt,.doc,.docx"
              onChange={handleFileChange}
              disabled={uploading}
              className="mt-2"
            />
            {file && (
              <div className="mt-2 flex items-center gap-2 text-sm text-zinc-600">
                <FileText className="h-4 w-4" />
                <span>{file.name}</span>
                <span className="text-zinc-400">({formatFileSize(file.size)})</span>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título do documento"
              disabled={uploading}
            />
          </div>

          <div>
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição do conteúdo do documento"
              disabled={uploading}
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="access-type">Disponibilizar para</Label>
            <Select value={accessType} onValueChange={(value: 'team' | 'agent') => setAccessType(value)}>
              <SelectTrigger id="access-type" disabled={uploading}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="team">Equipe (todos os agentes da equipe)</SelectItem>
                <SelectItem value="agent">Agente específico</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {accessType === 'team' && (
            <div>
              <Label htmlFor="team">Equipe</Label>
              <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                <SelectTrigger id="team" disabled={uploading}>
                  <SelectValue placeholder="Selecione uma equipe" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {accessType === 'agent' && (
            <div>
              <Label htmlFor="agent">Agente</Label>
              <Select value={selectedAgentKey} onValueChange={setSelectedAgentKey}>
                <SelectTrigger id="agent" disabled={uploading}>
                  <SelectValue placeholder="Selecione um agente" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.key}>
                      {agent.name} ({agent.key})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Enviar Documento
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle>Documentos Enviados</CardTitle>
          <CardDescription>
            {documents.length} {documents.length === 1 ? 'documento' : 'documentos'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-center text-zinc-500 py-8">Nenhum documento enviado ainda</p>
          ) : (
            <div className="space-y-4">
              {documents.map((doc) => (
                <div key={doc.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-zinc-400" />
                        <h3 className="font-semibold">{doc.title || doc.file_name}</h3>
                        {getStatusBadge(doc.status)}
                      </div>
                      {doc.description && (
                        <p className="text-sm text-zinc-600 mt-1">{doc.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
                        <span>{doc.file_name}</span>
                        <span>{formatFileSize(doc.file_size)}</span>
                        <span>{doc.total_chunks} chunks</span>
                        <span>{new Date(doc.created_at).toLocaleDateString('pt-BR')}</span>
                      </div>
                      {doc.status === 'failed' && doc.error_message && (
                        <p className="text-sm text-red-600 mt-2">{doc.error_message}</p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {doc.access.map((acc, idx) => (
                          <Badge key={idx} variant="outline">
                            {acc.access_type === 'team' ? (
                              <>Equipe: {acc.team_name || acc.team_id}</>
                            ) : (
                              <>Agente: {acc.agent_name || acc.agent_key}</>
                            )}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {(doc.status === 'processing' || doc.status === 'failed') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleReset(doc.id)}
                          className="text-blue-600 hover:text-blue-700"
                          title="Cancelar e reprocessar"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(doc.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
