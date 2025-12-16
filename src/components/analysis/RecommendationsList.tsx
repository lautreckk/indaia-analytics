'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ArrowRight, Lightbulb, Target, Stethoscope, Pill, MessageSquareQuote } from 'lucide-react';
import { Recommendation } from '@/types/analysis';

interface RecommendationsListProps {
  recommendations: Recommendation[];
}

export function RecommendationsList({ recommendations }: RecommendationsListProps) {
  if (!recommendations || recommendations.length === 0) return null;

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge variant="destructive">Prioridade: high</Badge>;
      case 'medium':
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800">Prioridade: medium</Badge>;
      case 'low':
        return <Badge variant="outline">Prioridade: low</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const getImpactBadge = (impact: string) => {
    switch (impact) {
      case 'high':
        return <Badge variant="destructive">Impacto: high</Badge>;
      case 'medium':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Impacto: medium</Badge>;
      case 'low':
        return <Badge variant="outline">Impacto: low</Badge>;
      default:
        return null;
    }
  };

  const getCategoryBadge = (category: string) => {
    if (!category) return null;
    return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{category}</Badge>;
  };

  // Função para parsear description e extrair DIAGNÓSTICO, CURA, SCRIPT
  const parseDescription = (description: string) => {
    const result = {
      diagnostico: '',
      cura: '',
      script: '',
      raw: description
    };

    if (!description) return result;

    // Padrões para encontrar seções (case insensitive, com variações)
    const diagPattern = /(?:DIAGN[ÓO]STICO|Diagn[óo]stico|DIAGNOSTICO)[:\-]?\s*(.*?)(?=(?:CURA|Script|SCRIPT|$))/is;
    const curaPattern = /(?:CURA|Cura)[:\-]?\s*(.*?)(?=(?:SCRIPT|Script|DIAGNÓSTICO|$))/is;
    const scriptPattern = /(?:SCRIPT\s*(?:SUGERIDO|sugerido)?|Script\s*(?:SUGERIDO|sugerido)?)[:\-]?\s*(.*?)(?=(?:DIAGNÓSTICO|CURA|$))/is;

    const diagMatch = description.match(diagPattern);
    const curaMatch = description.match(curaPattern);
    const scriptMatch = description.match(scriptPattern);

    if (diagMatch) result.diagnostico = diagMatch[1]?.trim() || '';
    if (curaMatch) result.cura = curaMatch[1]?.trim() || '';
    if (scriptMatch) result.script = scriptMatch[1]?.trim() || '';

    // Se não encontrou padrões, usar a descrição inteira como diagnóstico
    if (!result.diagnostico && !result.cura && !result.script) {
      result.diagnostico = description;
    }

    return result;
  };

  // Ordenar por prioridade (high primeiro) e depois por impacto
  const sortedRecommendations = [...recommendations].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const impactOrder = { high: 0, medium: 1, low: 2 };
    
    const priorityDiff = (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
    if (priorityDiff !== 0) return priorityDiff;
    
    return (impactOrder[a.impact] || 2) - (impactOrder[b.impact] || 2);
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Target className="h-5 w-5 text-primary" />
          Recomendações Prioritárias
          <Badge variant="secondary" className="ml-2">{recommendations.length}</Badge>
        </CardTitle>
        <p className="text-sm text-zinc-500 font-normal">
          Ações recomendadas ordenadas por prioridade e impacto
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {sortedRecommendations.map((rec, index) => {
          const parsed = parseDescription(rec.description || '');
          const temDiagnostico = parsed.diagnostico || rec.diagnostico;
          const temCura = parsed.cura || rec.cura;
          const temScript = parsed.script || rec.script_sugerido;

          return (
            <div
              key={rec.id || index}
              className="border-2 rounded-lg p-5 space-y-4 hover:shadow-md transition-shadow bg-white"
            >
              {/* Header da recomendação */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h4 className="font-semibold text-lg text-zinc-900 mb-2">
                    Erro: {rec.title || 'Recomendação'}
                  </h4>
                  <div className="flex flex-wrap items-center gap-2">
                    {getPriorityBadge(rec.priority)}
                    {rec.impact && getImpactBadge(rec.impact)}
                    {rec.category && getCategoryBadge(rec.category)}
                  </div>
                </div>
              </div>

              {/* DIAGNÓSTICO */}
              {temDiagnostico && (
                <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
                  <Stethoscope className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-semibold text-red-800 mb-2">DIAGNÓSTICO:</div>
                    <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">
                      {parsed.diagnostico || rec.diagnostico}
                    </p>
                  </div>
                </div>
              )}

              {/* CURA */}
              {temCura && (
                <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                  <Pill className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-semibold text-green-800 mb-2">CURA:</div>
                    <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">
                      {parsed.cura || rec.cura}
                    </p>
                  </div>
                </div>
              )}

              {/* SCRIPT SUGERIDO */}
              {temScript && (
                <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <MessageSquareQuote className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-semibold text-blue-800 mb-2">SCRIPT SUGERIDO:</div>
                    <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed italic">
                      {parsed.script || rec.script_sugerido}
                    </p>
                  </div>
                </div>
              )}

              {/* Se não conseguiu parsear e não tem campos separados, mostrar descrição original */}
              {!temDiagnostico && !temCura && !temScript && rec.description && (
                <div className="text-sm text-zinc-600 whitespace-pre-wrap leading-relaxed p-3 bg-zinc-50 rounded border border-zinc-200">
                  {rec.description}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
