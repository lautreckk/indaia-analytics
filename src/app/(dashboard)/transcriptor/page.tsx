'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, FileText, Loader2, CheckCircle, XCircle, Clock, Download, Copy } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function TranscriptorPage() {
  const router = useRouter();
  const supabase = createClient();
  const [transcriptions, setTranscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTranscriptions();
    
    // Atualizar a cada 5 segundos se houver transcrições em processamento
    const interval = setInterval(() => {
      const hasProcessing = transcriptions.some(t => 
        t.status === 'queued' || t.status === 'processing' || t.status === 'retrying'
      );
      if (hasProcessing) {
        loadTranscriptions();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [transcriptions.length]);

  async function loadTranscriptions() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id, role')
        .eq('id', user.id)
        .single();

      if (!profile) return;

      let query = supabase
        .from('transcriptions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      // Se não for admin, filtrar por tenant_id
      if (profile.role !== 'admin') {
        query = query.eq('tenant_id', profile.tenant_id);
      }

      // Se for consultor, mostrar apenas suas próprias
      if (profile.role === 'consultor') {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTranscriptions(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar transcrições:', error);
      toast.error('Erro ao carregar transcrições');
    } finally {
      setLoading(false);
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

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-zinc-900">Transcriptor</h1>
          <p className="text-zinc-500 mt-1">Gerencie suas transcrições de vídeos e áudios</p>
        </div>
        <Link href="/transcriptor/nova">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nova Transcrição
          </Button>
        </Link>
      </div>

      {transcriptions.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 text-zinc-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-zinc-900 mb-2">Nenhuma transcrição ainda</h3>
            <p className="text-zinc-500 mb-4">Comece enviando um arquivo de vídeo ou áudio para transcrição</p>
            <Link href="/transcriptor/nova">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Transcrição
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {transcriptions.map((transcription) => (
            <Card key={transcription.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-zinc-900">{transcription.file_name}</h3>
                      {getStatusBadge(transcription.status)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-zinc-500">
                      <span>{formatDate(transcription.created_at)}</span>
                      {transcription.file_size && (
                        <span>{(transcription.file_size / 1024 / 1024).toFixed(2)} MB</span>
                      )}
                      {(transcription.total_chunks > 0) && (
                        <span>
                          {transcription.chunks_processed || 0}/{transcription.total_chunks} chunks
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {transcription.status === 'completed' ? (
                      <>
                        <Link href={`/transcriptor/${transcription.id}`}>
                          <Button variant="outline" size="sm">
                            <FileText className="h-4 w-4 mr-2" />
                            Ver Transcrição
                          </Button>
                        </Link>
                      </>
                    ) : transcription.status === 'failed' ? (
                      <Link href={`/transcriptor/${transcription.id}`}>
                        <Button variant="outline" size="sm">
                          Ver Detalhes
                        </Button>
                      </Link>
                    ) : (
                      <span className="text-sm text-zinc-500">Aguardando processamento...</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
