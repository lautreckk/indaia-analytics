'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, CheckCircle, AlertTriangle, XCircle, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface ChecklistItem {
  item_name?: string;
  transcript_excerpt?: string;
  objective?: string;
  classification?: 'done' | 'warning' | 'not_done';
  suggestion?: string;
  justification?: string;
  correct_script?: string;
  comparative?: string;
}

interface ChecklistModule {
  items: ChecklistItem[];
}

interface ChecklistModulosProps {
  checklistModulos: Record<string, ChecklistModule>;
  modulos?: Record<string, { nota: number; estrelas: string }>;
}

const MODULO_INFO: Record<string, { name: string; icon: string; color: string }> = {
  consultor: { name: 'Consultor', icon: '👤', color: 'blue' },
  cliente: { name: 'Descoberta do Cliente', icon: '🎯', color: 'green' },
  indaia: { name: 'Apresentação Indaiá', icon: '🏛️', color: 'purple' },
  produtos: { name: 'Produtos e Serviços', icon: '📦', color: 'orange' },
  pos_vendas: { name: 'Pós-Vendas', icon: '🤝', color: 'teal' },
  negociacao: { name: 'Negociação', icon: '💰', color: 'red' },
};

export function ChecklistModulos({ checklistModulos, modulos = {} }: ChecklistModulosProps) {
  const [expandedModulo, setExpandedModulo] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [showRecommendation, setShowRecommendation] = useState<Set<string>>(new Set());

  const toggleItem = (moduleKey: string, itemIndex: number) => {
    const key = `${moduleKey}-${itemIndex}`;
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedItems(newExpanded);
  };

  const toggleRecommendation = (moduleKey: string, itemIndex: number) => {
    const key = `${moduleKey}-${itemIndex}`;
    const newShow = new Set(showRecommendation);
    if (newShow.has(key)) {
      newShow.delete(key);
    } else {
      newShow.add(key);
    }
    setShowRecommendation(newShow);
  };

  const getClassificationIcon = (classification?: string) => {
    switch (classification) {
      case 'done':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'not_done':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getClassificationColor = (classification?: string) => {
    switch (classification) {
      case 'done':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'not_done':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-zinc-600 bg-zinc-50 border-zinc-200';
    }
  };

  // Calcular contadores por módulo
  const getModuleStats = (items: ChecklistItem[]) => {
    const done = items.filter(item => item.classification === 'done').length;
    const warning = items.filter(item => item.classification === 'warning').length;
    const notDone = items.filter(item => item.classification === 'not_done').length;
    const total = items.length;
    return { done, warning, notDone, total };
  };

  // Ordenar módulos: negociacao por último (é o mais importante)
  const sortedModulos = Object.entries(checklistModulos).sort(([keyA], [keyB]) => {
    if (keyA === 'negociacao') return 1;
    if (keyB === 'negociacao') return -1;
    return 0;
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <span>📋</span>
          Checklist por Módulo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {sortedModulos.map(([moduleKey, moduleData]) => {
          const info = MODULO_INFO[moduleKey] || { name: moduleKey, icon: '📊', color: 'zinc' };
          const isExpanded = expandedModulo === moduleKey;
          // Items podem estar em 'items' ou 'checklist'
          const items = (moduleData.items || moduleData.checklist || []) as ChecklistItem[];
          const stats = getModuleStats(items);
          const moduloScore = modulos[moduleKey]?.nota || 0;

          return (
            <div
              key={moduleKey}
              className={cn(
                "border rounded-lg overflow-hidden transition-all",
                moduleKey === 'negociacao' && "border-2 border-amber-300 bg-amber-50/50",
                moduleKey !== 'negociacao' && "border-zinc-200"
              )}
            >
              {/* Header do módulo - clicável para expandir/recolher */}
              <button
                onClick={() => setExpandedModulo(isExpanded ? null : moduleKey)}
                className="w-full p-4 flex items-center justify-between hover:bg-zinc-50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-2xl">{info.icon}</span>
                  <div className="text-left flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-lg">{info.name}</span>
                      {moduleKey === 'negociacao' && (
                        <Badge variant="outline" className="text-xs bg-amber-100 border-amber-300 text-amber-700">
                          Peso 50%
                        </Badge>
                      )}
                    </div>
                    {/* Contadores de status */}
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-green-600 font-medium">✅ {stats.done}</span>
                      <span className="text-yellow-600 font-medium">⚠️ {stats.warning}</span>
                      <span className="text-red-600 font-medium">❌ {stats.notDone}</span>
                      <span className="text-zinc-400">/ {stats.total}</span>
                      {moduloScore > 0 && (
                        <span className="text-zinc-600 font-medium ml-2">
                          {moduloScore}/100 {modulos[moduleKey]?.estrelas || ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-zinc-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-zinc-400" />
                  )}
                </div>
              </button>

              {/* Barra de progresso baseada no score */}
              {moduloScore > 0 && (
                <div className="px-4 pb-2">
                  <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full transition-all duration-500",
                        moduloScore >= 75 ? 'bg-green-500' : moduloScore >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                      )}
                      style={{ width: `${moduloScore}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Lista de items do checklist - estilo dropdown */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-2 border-t border-zinc-100 space-y-2">
                  {items.length === 0 ? (
                    <p className="text-sm text-zinc-500 text-center py-4">
                      Nenhum item de checklist disponível para este módulo.
                    </p>
                  ) : (
                    items.map((item, itemIndex) => {
                      const itemKey = `${moduleKey}-${itemIndex}`;
                      const isItemExpanded = expandedItems.has(itemKey);
                      const showRec = showRecommendation.has(itemKey);
                      const hasRecommendation = (item.classification === 'warning' || item.classification === 'not_done') && 
                                               (item.justification || item.suggestion || item.correct_script || item.comparative);

                      return (
                        <div
                          key={itemIndex}
                          className={cn(
                            "border rounded-lg overflow-hidden transition-all",
                            getClassificationColor(item.classification)
                          )}
                        >
                          {/* Header do item - clicável */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleItem(moduleKey, itemIndex);
                            }}
                            className="w-full p-3 flex items-center justify-between hover:opacity-80 transition-opacity"
                          >
                            <div className="flex items-center gap-2 flex-1 text-left">
                              {getClassificationIcon(item.classification)}
                              <span className="font-medium text-sm">
                                {item.item_name || item.objective || `Item ${itemIndex + 1}`}
                              </span>
                            </div>
                            {isItemExpanded ? (
                              <ChevronUp className="h-4 w-4 text-zinc-400 flex-shrink-0" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-zinc-400 flex-shrink-0" />
                            )}
                          </button>

                          {/* Conteúdo expandido do item */}
                          {isItemExpanded && (
                            <div className="px-3 pb-3 pt-2 border-t bg-white/50 space-y-3">
                              {/* Transcript Excerpt */}
                              {item.transcript_excerpt && (
                                <div>
                                  <p className="text-xs font-semibold text-zinc-700 mb-1">Fala exata:</p>
                                  <p className="text-xs text-zinc-600 italic bg-zinc-50 p-2 rounded border border-zinc-200">
                                    {item.transcript_excerpt}
                                  </p>
                                </div>
                              )}

                              {/* Objective */}
                              {item.objective && (
                                <div>
                                  <p className="text-xs font-semibold text-zinc-700 mb-1">Objetivo:</p>
                                  <p className="text-xs text-zinc-600">{item.objective}</p>
                                </div>
                              )}

                              {/* Botão de Recomendação Detalhada (apenas para warning/not_done) */}
                              {hasRecommendation && (
                                <div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleRecommendation(moduleKey, itemIndex);
                                    }}
                                    className="w-full"
                                  >
                                    {showRec ? (
                                      <>
                                        <EyeOff className="h-3 w-3 mr-2" />
                                        Ocultar Recomendação
                                      </>
                                    ) : (
                                      <>
                                        <Eye className="h-3 w-3 mr-2" />
                                        Ver Recomendação Detalhada
                                      </>
                                    )}
                                  </Button>
                                </div>
                              )}

                              {/* Recomendação Detalhada (expandida) */}
                              {showRec && hasRecommendation && (
                                <div className="space-y-3 pt-2 border-t border-zinc-200">
                                  {/* Comparative */}
                                  {item.comparative && (
                                    <div>
                                      <p className="text-xs font-semibold text-zinc-700 mb-1">Comparativo:</p>
                                      <div className="text-xs text-zinc-600 bg-zinc-50 p-2 rounded border border-zinc-200 whitespace-pre-wrap">
                                        {item.comparative}
                                      </div>
                                    </div>
                                  )}

                                  {/* Justification */}
                                  {item.justification && (
                                    <div>
                                      <p className="text-xs font-semibold text-red-700 mb-1 flex items-center gap-1">
                                        <AlertTriangle className="h-3 w-3" />
                                        Justificativa:
                                      </p>
                                      <p className="text-xs text-zinc-600 bg-red-50 p-2 rounded border border-red-200">
                                        {item.justification}
                                      </p>
                                    </div>
                                  )}

                                  {/* Suggestion */}
                                  {item.suggestion && (
                                    <div>
                                      <p className="text-xs font-semibold text-amber-700 mb-1">Pode melhorar:</p>
                                      <p className="text-xs text-zinc-600 bg-amber-50 p-2 rounded border border-amber-200">
                                        {item.suggestion}
                                      </p>
                                    </div>
                                  )}

                                  {/* Correct Script */}
                                  {item.correct_script && (
                                    <div>
                                      <p className="text-xs font-semibold text-blue-700 mb-1 flex items-center gap-1">
                                        <CheckCircle className="h-3 w-3" />
                                        Script Sugerido:
                                      </p>
                                      <div className="text-xs text-zinc-800 bg-blue-50 p-3 rounded border border-blue-200 font-mono whitespace-pre-wrap">
                                        {item.correct_script}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
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
