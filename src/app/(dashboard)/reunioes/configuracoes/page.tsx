'use client';

import { Settings, Clock, Webhook, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function ConfiguracoesReunioes() {
  const upcomingFeatures = [
    {
      icon: Webhook,
      title: 'Webhooks',
      description: 'Configure webhooks para integrar com sistemas externos'
    },
    {
      icon: FileText,
      title: 'Formato de Transcrição',
      description: 'Escolha o formato e nível de detalhe das transcrições'
    },
    {
      icon: Settings,
      title: 'Integrações',
      description: 'Conecte com Google Meet, Zoom e outras plataformas'
    }
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-100 mb-4">
          <Clock className="w-8 h-8 text-zinc-400" />
        </div>
        <h1 className="text-3xl font-serif font-semibold text-zinc-900">
          Configurações de Reuniões
        </h1>
        <Badge variant="secondary" className="text-sm">
          Em breve
        </Badge>
        <p className="text-zinc-500 max-w-md mx-auto">
          Configurações avançadas para análise de reuniões estarão disponíveis em breve.
          Por enquanto, gerencie suas equipes de agentes em{' '}
          <a href="/settings/teams" className="text-emerald-600 hover:underline font-medium">
            Equipes IA
          </a>.
        </p>
      </div>

      {/* Features coming soon */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl w-full mt-8">
        {upcomingFeatures.map((feature, index) => (
          <Card key={index} className="bg-zinc-50/50 border-dashed">
            <CardHeader className="pb-2">
              <feature.icon className="w-5 h-5 text-zinc-400 mb-2" />
              <CardTitle className="text-base font-medium text-zinc-700">
                {feature.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm">
                {feature.description}
              </CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
