'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Target, Lightbulb } from 'lucide-react';

interface ResumoEstrategicoProps {
  resumo: string;
  classification: string;
  finalScore: number;
  isFallback?: boolean;
}

export function ResumoEstrategico({ resumo, classification, finalScore, isFallback }: ResumoEstrategicoProps) {
  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case 'EXCELENTE': return 'bg-green-100 text-green-800 border-green-200';
      case 'BOM': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'REGULAR': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'FRACO': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'CRÍTICO': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-zinc-100 text-zinc-800 border-zinc-200';
    }
  };

  const getClassificationIcon = (classification: string) => {
    switch (classification) {
      case 'EXCELENTE':
      case 'BOM':
        return <CheckCircle className="h-5 w-5" />;
      case 'REGULAR':
        return <Target className="h-5 w-5" />;
      case 'FRACO':
      case 'CRÍTICO':
        return <AlertTriangle className="h-5 w-5" />;
      default:
        return <Target className="h-5 w-5" />;
    }
  };

  // Processar texto do resumo (converter \n em quebras de linha)
  const formattedResumo = resumo?.split('\n').map((paragraph, index) => (
    <p key={index} className={paragraph.trim() ? 'mb-3' : 'mb-1'}>
      {paragraph}
    </p>
  ));

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            Resumo Estratégico
          </CardTitle>
          <div className="flex items-center gap-2">
            {isFallback && (
              <Badge variant="outline" className="text-amber-600 border-amber-300">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Modo Fallback
              </Badge>
            )}
            <Badge className={getClassificationColor(classification)}>
              {getClassificationIcon(classification)}
              <span className="ml-1">{finalScore}/100 - {classification}</span>
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="prose prose-sm max-w-none text-zinc-700 leading-relaxed">
          {formattedResumo}
        </div>
      </CardContent>
    </Card>
  );
}
