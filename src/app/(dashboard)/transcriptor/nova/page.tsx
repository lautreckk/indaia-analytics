'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, FileVideo, Loader2, ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import Link from 'next/link';

export default function NovaTranscricaoPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const supabase = createClient();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validar tamanho (2GB = 2 * 1024 * 1024 * 1024 bytes)
    const maxSize = 2 * 1024 * 1024 * 1024; // 2GB
    if (selectedFile.size > maxSize) {
      toast.error('Arquivo muito grande. Tamanho máximo: 2GB');
      return;
    }

    // Validar tipo de arquivo
    const validTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/quicktime', 'video/x-msvideo', 'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a'];
    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.match(/\.(mp4|avi|mov|mp3|wav|m4a)$/i)) {
      toast.error('Formato de arquivo não suportado. Use MP4, AVI, MOV, MP3, WAV ou M4A');
      return;
    }

    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Selecione um arquivo primeiro');
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
      const bucketName = 'transcriptions';

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Erro ao fazer upload: ${uploadError.message}. Verifique se o bucket existe e as políticas RLS estão configuradas.`);
      }

      // Enfileirar transcrição
      const transcribeResponse = await fetch('/api/transcriptor/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath: uploadData.path,
          fileName: file.name,
          tenantId: profile.tenant_id,
        }),
      });

      if (!transcribeResponse.ok) {
        const error = await transcribeResponse.json();
        throw new Error(error.message || 'Erro ao enfileirar transcrição');
      }

      const result = await transcribeResponse.json();
      
      toast.success('Arquivo enviado com sucesso! A transcrição será processada em background.');
      router.push(`/transcriptor/${result.transcriptionId}`);
    } catch (error: any) {
      console.error('Erro:', error);
      toast.error(error.message || 'Erro ao processar arquivo');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/transcriptor">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-serif font-semibold text-zinc-900">Nova Transcrição</h1>
          <p className="text-zinc-500 mt-1">Envie um vídeo ou áudio para transcrição automática</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload de Arquivo</CardTitle>
          <CardDescription>
            Selecione um arquivo de vídeo ou áudio de até 2GB
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="file-upload">Arquivo (MP4, AVI, MOV, MP3, WAV, M4A)</Label>
            <div className="mt-2 flex items-center gap-4">
              <Input
                id="file-upload"
                type="file"
                accept="video/*,audio/*,.mp4,.avi,.mov,.mp3,.wav,.m4a"
                onChange={handleFileChange}
                disabled={uploading}
                className="flex-1"
              />
              {file && (
                <div className="flex items-center gap-2 text-sm text-zinc-600">
                  <FileVideo className="h-4 w-4" />
                  <span>{file.name}</span>
                  <span className="text-zinc-400">({formatFileSize(file.size)})</span>
                </div>
              )}
            </div>
          </div>

          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Fazendo Upload...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Enviar para Transcrição
              </>
            )}
          </Button>

          <p className="text-xs text-zinc-500">
            O arquivo será processado em background. Você pode fechar esta página e voltar depois para ver o resultado.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
