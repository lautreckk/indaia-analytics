'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Stethoscope, Pill, MessageSquareQuote, FileText } from 'lucide-react';

interface SugestaoFechamentoProps {
  sugestao: string | {
    diagnostico_geral?: string;
    cura_geral?: string;
    scripts?: Array<{ momento?: string; script?: string }>;
    diagnosticos?: Array<{
      numero?: number;
      timestamp?: string;
      diagnostico?: string;
      cura?: string;
      script_sugerido?: string;
    }>;
  } | null | undefined;
}

export function SugestaoFechamento({ sugestao }: SugestaoFechamentoProps) {
  // Se for null/undefined, retornar null
  if (!sugestao) return null;
  
  // Se for string, tentar parsear para extrair diagnósticos
  let diagnosticos: Array<{
    numero: number;
    timestamp?: string;
    diagnostico: string;
    cura?: string;
    script_sugerido?: string;
  }> = [];
  
  let diagnosticoGeral: string | null = null;
  let curaGeral: string | null = null;
  let scriptsGeral: Array<{ momento?: string; script?: string }> = [];

  if (typeof sugestao === 'string') {
    // Tentar parsear string com múltiplos diagnósticos
    // Primeiro, verificar se tem múltiplos diagnósticos numerados
    const diagnosticoRegex = /DIAGNÓSTICO\s*(\d+)[:\-]?\s*(.*?)(?=DIAGNÓSTICO\s*\d+|CURA\s*\d*|SCRIPT|$)/gis;
    
    let match;
    const matches: any[] = [];
    let lastIndex = 0;
    
    while ((match = diagnosticoRegex.exec(sugestao)) !== null) {
      matches.push({
        numero: parseInt(match[1]),
        start: match.index,
        end: match.index + match[0].length,
        diagnostico: match[2]?.trim() || ''
      });
      lastIndex = match.index + match[0].length;
    }
    
    if (matches.length > 0) {
      // Tem múltiplos diagnósticos, processar cada um
      matches.forEach((diagMatch, index) => {
        const startPos = diagMatch.end;
        const nextStart = index < matches.length - 1 ? matches[index + 1].start : sugestao.length;
        const section = sugestao.substring(startPos, nextStart);
        
        const curaMatch = section.match(/(?:CURA\s*\d*|Cura)[:\-]?\s*(.*?)(?=SCRIPT|$)/is);
        const scriptMatch = section.match(/(?:SCRIPT\s*(?:SUGERIDO|sugerido)?\s*\d*|Script)[:\-]?\s*(.*?)$/is);
        
        diagnosticos.push({
          numero: diagMatch.numero,
          diagnostico: diagMatch.diagnostico,
          cura: curaMatch?.[1]?.trim() || undefined,
          script_sugerido: scriptMatch?.[1]?.trim() || undefined
        });
      });
    } else {
      // Não tem múltiplos diagnósticos numerados, tratar como único
      diagnosticoGeral = sugestao;
    }
  } else if (typeof sugestao === 'object') {
    // Se tem array de diagnosticos, usar isso
    if (sugestao.diagnosticos && Array.isArray(sugestao.diagnosticos)) {
      diagnosticos = sugestao.diagnosticos.map((d, index) => ({
        numero: d.numero || index + 1,
        timestamp: d.timestamp,
        diagnostico: d.diagnostico || '',
        cura: d.cura,
        script_sugerido: d.script_sugerido
      }));
    } else {
      // Caso contrário, usar diagnostico_geral, cura_geral, scripts
      diagnosticoGeral = sugestao.diagnostico_geral || null;
      curaGeral = sugestao.cura_geral || null;
      scriptsGeral = sugestao.scripts || [];
    }
  }
  
  // Validar se tem conteúdo
  const temConteudo = diagnosticos.length > 0 || diagnosticoGeral || curaGeral || scriptsGeral.length > 0;
  if (!temConteudo) return null;

  // Se tem diagnósticos múltiplos, renderizar cada um
  // OU se diagnostico_geral tem múltiplos diagnósticos parseáveis
  if (diagnosticos.length > 0 || (diagnosticoGeral && diagnosticoGeral.includes('DIAGNÓSTICO'))) {
    // Se tem diagnostico_geral com múltiplos diagnósticos, tentar parsear
    if (diagnosticos.length === 0 && diagnosticoGeral) {
      const diagMatches = diagnosticoGeral.matchAll(/DIAGNÓSTICO\s*(\d+)[:\-]?\s*([^(]*?)(?:\(([^)]+)\))?(.*?)(?=DIAGNÓSTICO\s*\d+|$)/gis);
      for (const match of diagMatches) {
        const numero = parseInt(match[1] || '1');
        const timestamp = match[3];
        const texto = (match[2] + match[4]).trim();
        
        // Buscar cura e script correspondentes (usar padrões mais simples)
        const curaMatch = (curaGeral || '').match(new RegExp(`CURA\\s*${numero}[:\-]?\\s*(.*?)(?=CURA\\s*\\d+|$)`, 'is'));
        const scriptItem = scriptsGeral.find((s, i) => i === numero - 1);
        
        diagnosticos.push({
          numero,
          timestamp,
          diagnostico: texto,
          cura: curaMatch?.[1]?.trim(),
          script_sugerido: typeof scriptItem === 'string' ? scriptItem : scriptItem?.script
        });
      }
    }
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-primary" />
            Sugestões Práticas para Fechamento
          </CardTitle>
          <p className="text-sm text-zinc-500 font-normal">
            Recomendações específicas para melhorar o fechamento do contrato
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {diagnosticos.map((diag, index) => (
            <div key={index} className="space-y-4">
              {/* Diagnóstico */}
              {diag.diagnostico && (
                <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
                  <Stethoscope className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    {diag.numero && (
                      <div className="font-semibold text-red-800 mb-1">
                        DIAGNÓSTICO {diag.numero}
                        {diag.timestamp && (
                          <span className="text-sm text-red-600 font-normal ml-2">({diag.timestamp})</span>
                        )}
                      </div>
                    )}
                    <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">
                      {diag.diagnostico}
                    </p>
                  </div>
                </div>
              )}

              {/* Cura */}
              {diag.cura && (
                <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                  <Pill className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-semibold text-green-800 mb-1">CURA</div>
                    <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">
                      {diag.cura}
                    </p>
                  </div>
                </div>
              )}

              {/* Script Sugerido */}
              {diag.script_sugerido && (
                <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <MessageSquareQuote className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-semibold text-blue-800 mb-1">Script Sugerido</div>
                    <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed italic">
                      {diag.script_sugerido}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  // Formato simples: diagnostico_geral, cura_geral, scripts
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5 text-primary" />
          Sugestões Práticas para Fechamento
        </CardTitle>
        <p className="text-sm text-zinc-500 font-normal">
          Recomendações específicas para melhorar o fechamento do contrato
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Diagnóstico Geral */}
        {diagnosticoGeral && (
          <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
            <Stethoscope className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-semibold text-red-800 mb-2">DIAGNÓSTICO</div>
              <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">
                {diagnosticoGeral}
              </p>
            </div>
          </div>
        )}

        {/* Cura Geral */}
        {curaGeral && (
          <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
            <Pill className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-semibold text-green-800 mb-2">CURA</div>
              <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">
                {curaGeral}
              </p>
            </div>
          </div>
        )}

        {/* Scripts Gerais */}
        {scriptsGeral.length > 0 && (
          <div className="space-y-3">
            {scriptsGeral.map((scriptItem, index) => (
              <div key={index} className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <MessageSquareQuote className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="font-semibold text-blue-800 mb-2">
                    Script Sugerido
                    {scriptItem.momento && (
                      <span className="text-sm text-blue-600 font-normal ml-2">({scriptItem.momento})</span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed italic">
                    {scriptItem.script || scriptItem}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
