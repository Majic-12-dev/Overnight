import { useState, useMemo, useCallback, useRef } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Paintbrush, Minimize2, AlignLeft, Copy, CheckCircle, Download, AlertTriangle } from 'lucide-react'

type CssBeautifierToolProps = {
  tool: ToolDefinition
}

type Mode = 'minify' | 'beautify'

function minifyCss(input: string): string {
  let result = input
  // Remove multi-line comments
  result = result.replace(/\/\*[\s\S]*?\*\//g, '')
  // Remove single-line comments (// ...)
  result = result.replace(/(?:^|[^:])\/\/[^\n]*/gm, '$1')
  // Collapse whitespace
  result = result.replace(/\s+/g, ' ')
  // Remove spaces around punctuation
  result = result.replace(/\s*\{\s*/g, '{')
  result = result.replace(/\s*\}\s*/g, '}')
  result = result.replace(/\s*:\s*/g, ':')
  result = result.replace(/\s*;\s*/g, ';')
  result = result.replace(/\s*,\s*/g, ',')
  // Remove trailing semicolons before closing braces
  result = result.replace(/;}/g, '}')
  // Remove empty rules
  result = result.replace(/\{\s*\}/g, '')
  // Trim
  result = result.replace(/^\s+|\s+$/g, '')
  return result
}

function beautifyCss(input: string, indentSize: number = 2): string {
  const pad = (n: number) => ' '.repeat(n * indentSize)
  let depth = 0
  let result = ''

  // Remove comments first
  let cleaned = input.replace(/\/\*[\s\S]*?\*\//g, '')
  cleaned = cleaned.replace(/(?:^|[^:])\/\/[^\n]*/gm, '$1')

  // Character-by-character parsing for reliability
  let i = 0
  const len = cleaned.length
  let selector = ''
  const inString: Array<string> = []

  while (i < len) {
    const ch = cleaned[i]

    // Handle string literals
    if ((ch === "'" || ch === '"') && (inString.length === 0 || inString[inString.length - 1] !== ch)) {
      if (inString.length === 0) {
        inString.push(ch)
      }
      selector += ch
      i++
      continue
    }
    if (inString.length > 0 && cleaned[i] === '\\') {
      selector += cleaned.slice(i, i + 2)
      i += 2
      continue
    }
    if (inString.length > 0) {
      if (ch === inString[inString.length - 1]) {
        inString.pop()
      }
      selector += ch
      i++
      continue
    }

    // Opening brace
    if (ch === '{') {
      result += pad(depth) + selector.trim() + ' {\n'
      selector = ''
      depth++
      i++
      continue
    }

    // Closing brace
    if (ch === '}') {
      depth = Math.max(0, depth - 1)
      const props = selector.trim()
      if (props) {
        result = result.trimEnd()
        if (!result.endsWith('\n')) result += '\n'
        result += pad(depth) + '}\n'
      } else {
        result = result.trimEnd()
        if (!result.endsWith('\n')) result += '\n'
        result += pad(depth) + '}\n'
      }
      selector = ''
      i++
      continue
    }

    // Semicolon (property value separator)
    if (ch === ';') {
      const prop = selector.trim()
      if (prop) {
        result += pad(depth) + prop + ';\n'
      }
      selector = ''
      i++
      continue
    }

    // Skip whitespace
    if (/\s/.test(ch)) {
      i++
      continue
    }

    selector += ch
    i++
  }

  return result.trimEnd()
}

export function CssBeautifierTool({ tool }: CssBeautifierToolProps) {
  const [raw, setRaw] = useState('')
  const [mode, setMode] = useState<Mode>('beautify')
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stats = useMemo(() => {
    if (!output) return null
    const originalSize = new Blob([raw]).size
    const outputSize = new Blob([output]).size
    const saved = originalSize - outputSize
    const ratio = originalSize > 0 ? ((Math.abs(saved) / originalSize) * 100).toFixed(1) : '0.0'
    return { originalSize, outputSize, saved, ratio }
  }, [raw, output])

  const handleProcess = useCallback(() => {
    if (!raw.trim()) { setOutput(''); setError(null); return }
    setError(null)
    try {
      const result = mode === 'minify' ? minifyCss(raw) : beautifyCss(raw)
      setOutput(result)
    } catch {
      setError('Failed to process CSS — the input may be malformed')
      setOutput('')
    }
  }, [raw, mode])

  const handleCopy = useCallback(() => {
    if (!output) return
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true)
      if (copyTimeout.current) clearTimeout(copyTimeout.current)
      copyTimeout.current = setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }, [output])

  const handleDownload = useCallback(() => {
    if (!output) return
    const blob = new Blob([output], { type: 'text/css' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = mode === 'minify' ? 'minified.css' : 'beautified.css'
    a.click()
    URL.revokeObjectURL(url)
  }, [output, mode])

  const handleClear = useCallback(() => {
    setRaw('')
    setOutput('')
    setError(null)
  }, [])

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Mode</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setMode('beautify'); setOutput('') }}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                  mode === 'beautify'
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-border bg-base/60 text-muted hover:text-text'
                }`}
              >
                <AlignLeft className="h-4 w-4" /> Beautify
              </button>
              <button
                type="button"
                onClick={() => { setMode('minify'); setOutput('') }}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                  mode === 'minify'
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-border bg-base/60 text-muted hover:text-text'
                }`}
              >
                <Minimize2 className="h-4 w-4" /> Minify
              </button>
            </div>
          </div>

          {stats && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <CheckCircle className="h-3.5 w-3.5" />
                {mode === 'beautify' ? 'Beautified' : 'Minified'} successfully
              </div>
              <div className="text-xs text-muted">
                {(stats.originalSize / 1024).toFixed(2)} KB → {(stats.outputSize / 1024).toFixed(2)} KB
              </div>
              {mode === 'minify' && stats.saved > 0 && (
                <div className="text-xs text-emerald-300">
                  −{(stats.saved / 1024).toFixed(2)} KB ({stats.ratio}% reduction)
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-red-400">
                <AlertTriangle className="h-3.5 w-3.5" /> Processing Error
              </div>
              <div className="text-xs text-red-300">{error}</div>
            </div>
          )}

          <Badge className="border-0 bg-accent/15 text-accent">Offline • Client-side only • No dependencies</Badge>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Paintbrush className="h-4 w-4 text-muted" />
              <span className="text-xs font-semibold uppercase text-muted">CSS Input</span>
            </div>
            {raw && (
              <button type="button" onClick={handleClear} className="text-xs text-accent hover:text-accent/80">
                Clear
              </button>
            )}
          </div>
          <textarea
            value={raw}
            onChange={(e) => { setRaw(e.target.value); setOutput(''); setError(null) }}
            className="w-full min-h-[180px] p-3 border border-border rounded-lg bg-base/50 text-sm font-mono resize-y focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            placeholder={'.container {\n  display: flex;\n  align-items: center;\n  /* comment here */\n  gap: 1rem;\n}'}
            spellCheck={false}
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <Button onClick={handleProcess} disabled={!raw.trim()}>
            {mode === 'beautify' ? <><AlignLeft className="mr-2 h-4 w-4" /> Beautify CSS</> : <><Minimize2 className="mr-2 h-4 w-4" /> Minify CSS</>}
          </Button>

          {output && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" className="h-8 px-3 text-xs" onClick={handleCopy}>
                {copied ? <CheckCircle className="mr-1 h-3 w-3 text-emerald-400" /> : <Copy className="mr-1 h-3 w-3" />}
                {copied ? 'Copied!' : 'Copy'}
              </Button>
              <Button variant="ghost" className="h-8 px-3 text-xs" onClick={handleDownload}>
                <Download className="mr-1 h-3 w-3" /> Download
              </Button>
            </div>
          )}
        </div>

        {output && (
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Paintbrush className="h-4 w-4 text-accent" />
                <span className="text-xs font-semibold uppercase text-muted">{mode === 'beautify' ? 'Beautified' : 'Minified'} CSS</span>
              </div>
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-xl border border-border bg-[#0d1117] p-3 text-xs font-mono text-text max-h-[400px]">
              {output}
            </pre>
          </Card>
        )}
      </div>
    </BaseToolLayout>
  )
}
