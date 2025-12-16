'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Loader2, CheckCircle, XCircle, Clock, Download, Copy, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function TranscricaoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const supabase = createClient();
  
  const [transcription, setTranscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    loadTranscription();
    
    // Se está processando, fazer polling
    if (transcription && (transcription.status === 'queued' || transcription.status === 'processing' || transcription.status === 'retrying')) {
      setPolling(true);
      const interval = setInterval(() => {
        loadTranscription(false);
      }, 5000);
      
      return () => {
        clearInterval(interval);
        setPolling(false);
      };
    }
  }, [id, transcription?.status]);

  async function loadTranscription(showLoading = true) {
    if (showLoading) setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('transcriptions')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      
      setTranscription(data);
      
      // Parar polling se concluído ou falhou
      if (data.status === 'completed' || data.status === 'failed') {
        setPolling(false);
      }
    } catch (error: any) {
      console.error('Erro ao carregar transcrição:', error);
      toast.error('Erro ao carregar transcrição');
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Concluída</Badge>;
      case 'processing':
        return <Badge className="bg-blue-500"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processando</Badge>;
      case 'queued':
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Na Fila</Badge>;
      case 'failed':
        return <Badge className="bg-red-500"><XCircle className="h-3 w-3 mr-1" />Falhou</Badge>;
      case 'retrying':
        return <Badge className="bg-yellow-500"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Tentando Novamente</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleCopy = () => {
    if (transcription?.transcription) {
      navigator.clipboard.writeText(transcription.transcription);
      toast.success('Transcrição copiada!');
    }
  };

  const handleDownload = () => {
    if (transcription?.transcription) {
      const blob = new Blob([transcription.transcription], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${transcription.file_name.replace(/\.[^/.]+$/, '')}_transcricao.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Download iniciado!');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!transcription) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Card>
          <CardContent className="p-8 text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Transcrição não encontrada</h2>
            <Link href="/transcriptor">
              <Button variant="outline">Voltar para Lista</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/transcriptor">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-serif font-semibold text-zinc-900">Transcrição</h1>
            <p className="text-zinc-500 mt-1">{transcription.file_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(transcription.status)}
          {polling && (
            <Badge variant="outline" className="text-xs">
              Atualizando...
            </Badge>
          )}
        </div>
      </div>

      {/* Informações */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-zinc-500">Data de Criação</p>
              <p className="font-medium">
                {new Date(transcription.created_at).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            {transcription.file_size && (
              <div>
                <p className="text-zinc-500">Tamanho</p>
                <p className="font-medium">{(transcription.file_size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            )}
            {transcription.total_chunks > 0 && (
              <div>
                <p className="text-zinc-500">Progresso</p>
                <p className="font-medium">
                  {transcription.chunks_processed || 0}/{transcription.total_chunks} chunks
                </p>
              </div>
            )}
            {transcription.completed_at && (
              <div>
                <p className="text-zinc-500">Concluído em</p>
                <p className="font-medium">
                  {new Date(transcription.completed_at).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Status: Processando */}
      {(transcription.status === 'queued' || transcription.status === 'processing' || transcription.status === 'retrying') && (
        <Card>
          <CardContent className="p-8 text-center">
            <Loader2 className="h-12 w-12 text-blue-500 animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">
              {transcription.status === 'queued' && 'Aguardando na fila...'}
              {transcription.status === 'processing' && 'Processando transcrição...'}
              {transcription.status === 'retrying' && 'Tentando novamente...'}
            </h2>
            {transcription.total_chunks > 0 && (
              <p className="text-zinc-500">
                Processando chunk {transcription.chunks_processed || 0} de {transcription.total_chunks}
              </p>
            )}
            <p className="text-sm text-zinc-400 mt-2">
              Esta página será atualizada automaticamente quando concluir
            </p>
          </CardContent>
        </Card>
      )}

      {/* Status: Falhou */}
      {transcription.status === 'failed' && (
        <Card className="border-red-500">
          <CardContent className="p-8">
            <div className="flex items-center gap-3 mb-4">
              <XCircle className="h-8 w-8 text-red-500" />
              <div>
                <h2 className="text-xl font-semibold">Falha no Processamento</h2>
                <p className="text-sm text-zinc-500">A transcrição não pôde ser concluída</p>
              </div>
            </div>
            {transcription.last_error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm font-medium text-red-800 mb-2">Erro:</p>
                <p className="text-sm text-red-700">{transcription.last_error}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Status: Concluída - Mostrar Transcrição */}
      {transcription.status === 'completed' && transcription.transcription && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Transcrição</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download TXT
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              value={transcription.transcription}
              readOnly
              className="min-h-[400px] font-mono text-sm"
            />
          </CardContent>
        </Card>
      )}

      {/* Botão para usar em Nova Reunião */}
      {transcription.status === 'completed' && transcription.transcription && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold mb-1">Usar esta transcrição</h3>
                <p className="text-sm text-zinc-500">Copie a transcrição e use na criação de uma nova reunião</p>
              </div>
              <Link href="/reunioes/nova">
                <Button>
                  Criar Nova Reunião
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
