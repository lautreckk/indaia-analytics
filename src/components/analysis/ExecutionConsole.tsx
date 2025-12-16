"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, Terminal, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"

interface LogEntry {
  timestamp: string
  level: "info" | "success" | "warning" | "error"
  message: string
  agent?: string
  score?: number
  time_ms?: number
}

interface ExecutionConsoleProps {
  logs: LogEntry[]
  isAdmin?: boolean
  className?: string
}

export function ExecutionConsole({ logs, isAdmin = false, className = "" }: ExecutionConsoleProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  // Só mostra para admin
  if (!isAdmin) return null
  
  // Se não tem logs, não mostra
  if (!logs || logs.length === 0) return null

  const copyLogs = () => {
    const text = logs.map(l => `[${l.timestamp}] ${l.level.toUpperCase()}: ${l.message}`).join("\n")
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case "success": return "text-green-400"
      case "warning": return "text-yellow-400"
      case "error": return "text-red-400"
      default: return "text-zinc-400"
    }
  }

  const getLevelIcon = (level: string) => {
    switch (level) {
      case "success": return "✅"
      case "warning": return "⚠️"
      case "error": return "❌"
      default: return "→"
    }
  }

  return (
    <div className={`bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden ${className}`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-green-500" />
          <span className="text-sm font-mono text-zinc-300">Console de Execução</span>
          <span className="text-xs text-zinc-500">({logs.length} logs)</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              copyLogs()
            }}
            className="h-6 px-2 text-zinc-500 hover:text-zinc-300"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          </Button>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-zinc-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-zinc-500" />
          )}
        </div>
      </button>

      {/* Console Body */}
      {isExpanded && (
        <div className="border-t border-zinc-800 max-h-80 overflow-y-auto">
          <div className="p-4 font-mono text-xs space-y-1">
            {logs.map((log, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="text-zinc-600 shrink-0">{log.timestamp}</span>
                <span className="shrink-0">{getLevelIcon(log.level)}</span>
                <span className={getLevelColor(log.level)}>
                  {log.agent && <span className="text-cyan-400">[{log.agent}]</span>}{" "}
                  {log.message}
                  {log.score !== undefined && (
                    <span className={log.score >= 70 ? "text-green-400" : log.score >= 50 ? "text-yellow-400" : "text-red-400"}>
                      {" "}({log.score}/100)
                    </span>
                  )}
                  {log.time_ms && (
                    <span className="text-zinc-600"> {(log.time_ms / 1000).toFixed(1)}s</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Função helper para parsear logs do banco
export function parseExecutionLogs(rawLogs: any[]): LogEntry[] {
  if (!rawLogs || !Array.isArray(rawLogs)) return []
  
  return rawLogs.map(log => ({
    timestamp: log.timestamp || new Date().toISOString().slice(11, 19),
    level: log.level || "info",
    message: log.message || "",
    agent: log.agent,
    score: log.score,
    time_ms: log.time_ms
  }))
}
