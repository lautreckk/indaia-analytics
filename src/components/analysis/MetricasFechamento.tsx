'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Target, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricasFechamentoProps {
  metricasFechamento: {
    status_contrato?: boolean;
    tentativa_fechamento?: boolean;
    tecnicas_aplicadas?: string[];
    recomendacoes?: string[];
  };
}

export function MetricasFechamento({ metricasFechamento }: MetricasFechamentoProps) {
  const statusContrato = metricasFechamento.status_contrato ?? false;
  const tentativaFechamento = metricasFechamento.tentativa_fechamento ?? false;
  const tecnicasAplicadas = metricasFechamento.tecnicas_aplicadas || [];
  const recomendacoes = metricasFechamento.recomendacoes || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Target className="h-5 w-5" />
          Métricas de Fechamento
        </CardTitle>
        <p className="text-sm text-zinc-500 font-normal">Status e tentativas de fechamento</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status do Contrato */}
        <div className={cn(
          "flex items-center justify-between p-4 rounded-lg border-2",
          statusContrato 
            ? "bg-green-50 border-green-200" 
            : "bg-red-50 border-red-200"
        )}>
          <div className="flex items-center gap-3">
            {statusContrato ? (
              <CheckCircle className="h-6 w-6 text-green-600" />
            ) : (
              <XCircle className="h-6 w-6 text-red-600" />
            )}
            <div>
              <p className="font-semibold text-zinc-900">Status do Contrato</p>
              <p className="text-sm text-zinc-600">
                {statusContrato ? "Contrato foi fechado" : "Contrato não foi fechado"}
              </p>
            </div>
          </div>
          <Badge 
            variant={statusContrato ? "default" : "destructive"}
            className={statusContrato ? "bg-green-600" : "bg-red-600"}
          >
            {statusContrato ? "Fechado" : "Não Fechado"}
          </Badge>
        </div>

        {/* Tentativa de Fechamento */}
        <div className={cn(
          "flex items-center justify-between p-4 rounded-lg border-2",
          tentativaFechamento 
            ? "bg-blue-50 border-blue-200" 
            : "bg-zinc-50 border-zinc-200"
        )}>
          <div className="flex items-center gap-3">
            {tentativaFechamento ? (
              <CheckCircle className="h-6 w-6 text-blue-600" />
            ) : (
              <XCircle className="h-6 w-6 text-zinc-400" />
            )}
            <div>
              <p className="font-semibold text-zinc-900">Tentativa de Fechamento</p>
              <p className="text-sm text-zinc-600">
                {tentativaFechamento ? "Vendedor tentou fechar" : "Não houve tentativa de fechamento"}
              </p>
            </div>
          </div>
          <Badge 
            variant={tentativaFechamento ? "default" : "secondary"}
            className={tentativaFechamento ? "bg-blue-600" : "bg-zinc-400"}
          >
            {tentativaFechamento ? "Sim" : "Não"}
          </Badge>
        </div>

        {/* Técnicas Aplicadas */}
        {tecnicasAplicadas.length > 0 && (
          <div className="p-4 rounded-lg border border-zinc-200 bg-zinc-50">
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-5 w-5 text-zinc-700" />
              <p className="font-semibold text-zinc-900">Técnicas Aplicadas</p>
            </div>
            <ul className="space-y-2">
              {tecnicasAplicadas.map((tecnica, index) => (
                <li key={index} className="text-sm text-zinc-700 flex items-start gap-2">
                  <span className="text-zinc-400 mt-1">•</span>
                  <span>{tecnica}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recomendações */}
        {recomendacoes.length > 0 && (
          <div className="p-4 rounded-lg border border-amber-200 bg-amber-50">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="h-5 w-5 text-amber-600" />
              <p className="font-semibold text-zinc-900">Recomendações</p>
            </div>
            <div className="space-y-4">
              {recomendacoes.map((recomendacao, index) => {
                // Se for uma string com DIAGNÓSTICO, CURA, SCRIPT, formatar
                if (typeof recomendacao === 'string' && recomendacao.includes('DIAGNÓSTICO:')) {
                  const parts = recomendacao.split(/\n\n/);
                  return (
                    <div key={index} className="space-y-2">
                      {parts.map((part, partIndex) => {
                        if (part.startsWith('DIAGNÓSTICO:')) {
                          return (
                            <div key={partIndex}>
                              <p className="font-semibold text-red-700 mb-1">DIAGNÓSTICO:</p>
                              <p className="text-sm text-zinc-700 whitespace-pre-wrap">{part.replace('DIAGNÓSTICO:', '').trim()}</p>
                            </div>
                          );
                        } else if (part.startsWith('CURA:')) {
                          return (
                            <div key={partIndex}>
                              <p className="font-semibold text-amber-700 mb-1">CURA:</p>
                              <p className="text-sm text-zinc-700 whitespace-pre-wrap">{part.replace('CURA:', '').trim()}</p>
                            </div>
                          );
                        } else if (part.startsWith('SCRIPT:')) {
                          return (
                            <div key={partIndex} className="bg-blue-50 p-3 rounded border border-blue-200">
                              <p className="font-semibold text-blue-700 mb-1">SCRIPT:</p>
                              <p className="text-sm text-zinc-800 font-mono whitespace-pre-wrap">{part.replace('SCRIPT:', '').trim()}</p>
                            </div>
                          );
                        }
                        return <p key={partIndex} className="text-sm text-zinc-700 whitespace-pre-wrap">{part}</p>;
                      })}
                    </div>
                  );
                }
                // Caso contrário, mostrar como está
                return (
                  <div key={index} className="text-sm text-zinc-700 whitespace-pre-wrap bg-white p-3 rounded border border-zinc-200">
                    {recomendacao}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
