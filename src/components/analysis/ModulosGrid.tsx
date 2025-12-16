'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, CheckCircle, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface ModuloResult {
  nota: number;
  estrelas: string;
  comentario: string;
  pontos_fortes: string[];
  pontos_melhoria: string[];
}

interface ModulosGridProps {
  modulos: Record<string, ModuloResult>;
}

const MODULO_INFO: Record<string, { name: string; icon: string; color: string }> = {
  consultor: { name: 'Análise do Consultor', icon: '👤', color: 'blue' },
  cliente: { name: 'Descoberta do Cliente', icon: '🎯', color: 'green' },
  indaia: { name: 'Apresentação Indaiá', icon: '🏛️', color: 'purple' },
  produtos: { name: 'Produtos e Serviços', icon: '📦', color: 'orange' },
  pos_vendas: { name: 'Pós-Vendas', icon: '🤝', color: 'teal' },
  negociacao: { name: 'Negociação', icon: '💰', color: 'red' },
};

export function ModulosGrid({ modulos }: ModulosGridProps) {
  const [expandedModulo, setExpandedModulo] = useState<string | null>(null);

  const getScoreColor = (nota: number) => {
    if (nota >= 75) return 'text-green-600';
    if (nota >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getProgressColor = (nota: number) => {
    if (nota >= 75) return 'bg-green-500';
    if (nota >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Ordenar módulos: negociacao por último (é o mais importante)
  const sortedModulos = Object.entries(modulos).sort(([keyA], [keyB]) => {
    if (keyA === 'negociacao') return 1;
    if (keyB === 'negociacao') return -1;
    return 0;
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Análise por Módulo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sortedModulos.map(([key, modulo]) => {
          const info = MODULO_INFO[key] || { name: key, icon: '📊', color: 'zinc' };
          const isExpanded = expandedModulo === key;
          const isNegociacao = key === 'negociacao';

          return (
            <div
              key={key}
              className={cn(
                "border rounded-lg overflow-hidden transition-all",
                isNegociacao && "border-2 border-amber-300 bg-amber-50/50",
                !isNegociacao && "border-zinc-200"
              )}
            >
              {/* Header do módulo - clicável */}
              <button
                onClick={() => setExpandedModulo(isExpanded ? null : key)}
                className="w-full p-3 flex items-center justify-between hover:bg-zinc-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{info.icon}</span>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{info.name}</span>
                      {isNegociacao && (
                        <Badge variant="outline" className="text-xs bg-amber-100 border-amber-300 text-amber-700">
                          Peso 50%
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-zinc-500">{modulo.estrelas}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className={cn("text-xl font-bold", getScoreColor(modulo.nota))}>
                      {modulo.nota}
                    </span>
                    <span className="text-zinc-400 text-sm">/100</span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-zinc-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-zinc-400" />
                  )}
                </div>
              </button>

              {/* Barra de progresso */}
              <div className="px-3 pb-2">
                <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full transition-all duration-500", getProgressColor(modulo.nota))}
                    style={{ width: `${modulo.nota}%` }}
                  />
                </div>
              </div>

              {/* Conteúdo expandido */}
              {isExpanded && (
                <div className="px-3 pb-3 pt-1 border-t border-zinc-100 space-y-3">
                  {/* Comentário */}
                  <p className="text-sm text-zinc-600">{modulo.comentario}</p>

                  {/* Pontos fortes */}
                  {modulo.pontos_fortes?.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1 text-xs font-medium text-green-700 mb-1">
                        <CheckCircle className="h-3 w-3" />
                        Pontos Fortes
                      </div>
                      <ul className="space-y-1">
                        {modulo.pontos_fortes.map((ponto, i) => (
                          <li key={i} className="text-xs text-zinc-600 flex items-start gap-1">
                            <span className="text-green-500">•</span>
                            {ponto}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Pontos de melhoria */}
                  {modulo.pontos_melhoria?.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1 text-xs font-medium text-amber-700 mb-1">
                        <AlertTriangle className="h-3 w-3" />
                        Pontos de Melhoria
                      </div>
                      <ul className="space-y-1">
                        {modulo.pontos_melhoria.map((ponto, i) => (
                          <li key={i} className="text-xs text-zinc-600 flex items-start gap-1">
                            <span className="text-amber-500">•</span>
                            {ponto}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
