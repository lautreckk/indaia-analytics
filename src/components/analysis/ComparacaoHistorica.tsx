'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ComparacaoHistoricaProps {
  comparacaoHistorica: {
    score_atual: number;
    media_historica: number;
    diferenca: number;
    tendencia: 'acima' | 'abaixo' | 'igual';
    total_reunioes: number;
    ultimas_5_scores: number[];
  };
}

export function ComparacaoHistorica({ comparacaoHistorica }: ComparacaoHistoricaProps) {
  if (!comparacaoHistorica) return null;

  const { score_atual, media_historica, diferenca, tendencia, total_reunioes, ultimas_5_scores } = comparacaoHistorica;
  
  const maxScore = Math.max(score_atual, media_historica, ...ultimas_5_scores, 100);
  const minScore = Math.min(score_atual, media_historica, ...ultimas_5_scores, 0);

  const getTrendIcon = () => {
    if (tendencia === 'acima') {
      return <TrendingUp className="h-5 w-5 text-green-600" />;
    } else if (tendencia === 'abaixo') {
      return <TrendingDown className="h-5 w-5 text-red-600" />;
    }
    return <Minus className="h-5 w-5 text-zinc-400" />;
  };

  const getTrendColor = () => {
    if (tendencia === 'acima') return 'text-green-600';
    if (tendencia === 'abaixo') return 'text-red-600';
    return 'text-zinc-600';
  };

  const getBarWidth = (value: number) => {
    const range = maxScore - minScore || 100;
    return ((value - minScore) / range) * 100;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart3 className="h-5 w-5" />
          Comparação Histórica
        </CardTitle>
        <p className="text-sm text-zinc-500 font-normal">
          Performance desta reunião comparada com seu histórico
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Score Atual vs Média Histórica */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Score Atual */}
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-zinc-600 mb-1">Score Atual</p>
              <p className="text-3xl font-bold text-blue-600">{score_atual.toFixed(1)}</p>
            </div>

            {/* Média Histórica */}
            <div className="p-4 bg-zinc-50 rounded-lg border border-zinc-200">
              <p className="text-sm text-zinc-600 mb-1">Média Histórica</p>
              <p className="text-3xl font-bold text-zinc-700">{media_historica.toFixed(1)}</p>
            </div>
          </div>

          {/* Diferença */}
          <div className={cn(
            "flex items-center gap-2 p-3 rounded-lg",
            tendencia === 'acima' ? 'bg-green-50 border border-green-200' :
            tendencia === 'abaixo' ? 'bg-red-50 border border-red-200' :
            'bg-zinc-50 border border-zinc-200'
          )}>
            {getTrendIcon()}
            <span className={cn("font-semibold", getTrendColor())}>
              {diferenca > 0 ? '+' : ''}{diferenca.toFixed(1)} pontos {tendencia === 'acima' ? 'acima' : tendencia === 'abaixo' ? 'abaixo' : 'igual'} da média
            </span>
          </div>
        </div>

        {/* Gráfico de Comparação - Barra Horizontal */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-zinc-700">Comparação Visual</p>
          <div className="space-y-3">
            {/* Score Atual */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-zinc-600">Score Atual</span>
                <span className="text-xs font-semibold text-blue-600">{score_atual.toFixed(1)}</span>
              </div>
              <div className="h-6 bg-zinc-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${getBarWidth(score_atual)}%` }}
                />
              </div>
            </div>

            {/* Média Histórica */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-zinc-600">Média Histórica</span>
                <span className="text-xs font-semibold text-zinc-700">{media_historica.toFixed(1)}</span>
              </div>
              <div className="h-6 bg-zinc-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-zinc-400 rounded-full transition-all"
                  style={{ width: `${getBarWidth(media_historica)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Últimas 5 Reuniões */}
        {ultimas_5_scores.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-zinc-700">
              Últimas {ultimas_5_scores.length} Reuniões
            </p>
            <div className="flex items-end gap-2 h-32">
              {ultimas_5_scores.map((score, index) => (
                <div key={index} className="flex-1 flex flex-col items-center gap-1">
                  <div 
                    className={cn(
                      "w-full rounded-t transition-all min-h-[20px]",
                      index === 0 ? 'bg-blue-500' : 'bg-zinc-300'
                    )}
                    style={{ height: `${getBarWidth(score)}%` }}
                    title={`${score.toFixed(1)}/100`}
                  />
                  <span className="text-xs text-zinc-600">{score.toFixed(0)}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-500 rounded" />
                <span>Atual</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-zinc-300 rounded" />
                <span>Histórico</span>
              </div>
            </div>
          </div>
        )}

        {/* Total de Reuniões */}
        <div className="pt-3 border-t border-zinc-200">
          <p className="text-sm text-zinc-600">
            Total de <span className="font-semibold">{total_reunioes}</span> reuniões analisadas
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
