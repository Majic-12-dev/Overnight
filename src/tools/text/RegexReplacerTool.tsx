import { useState, useMemo, useCallback, useRef } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Search, Copy, CheckCircle, Download, AlertTriangle, ArrowLeftRight } from 'lucide-react'

type RegexReplacerToolProps = {
  tool: ToolDefinition
}

type Flag = 'g' | 'i' | 'm' | 's'

export function RegexReplacerTool({ tool }: RegexReplacerToolProps) {
  const [inputText, setInputText] = useState('')
  const [pattern, setPattern] = useState('')
  const [replacement, setReplacement] = useState('')
  const [flags, setFlags] = useState<Set<Flag>>(new Set(['g']))
  const [output, setOutput] = useState('')
  const [matchCount, setMatchCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const highlightedPreview = useMemo(() => {
    if (!pattern || !inputText) return null
    let regex: RegExp
    try {
      const flagStr = Array.from(flags).join('')
      regex = new RegExp(pattern, flagStr.includes('g') ? flagStr : flagStr + 'g')
    } catch {
      return null
    }

    const segments: React.ReactNode[] = []
    let lastIndex = 0
    let match
    let count = 0

    while ((match = regex.exec(inputText)) !== null && count < 1000) {
      count++
      if (match[0].length === 0) {
        regex.lastIndex++
        continue
      }
      if (match.index > lastIndex) {
        segments.push(
          <span key={`t-${lastIndex}`} className="text-muted">
            {inputText.slice(lastIndex, match.index)}
          </span>
        )
      }
      segments.push(
        <mark
          key={`m-${match.index}`}
          className="bg-emerald-500/30 text-emerald-300 rounded px-0.5 border border-emerald-500/40"
        >
          {match[0]}
        </mark>
      )
      lastIndex = match.index + match[0].length
    }

    if (lastIndex < inputText.length) {
      segments.push(
        <span key={`t-${lastIndex}`} className="text-muted">
          {inputText.slice(lastIndex)}
        </span>
      )
    }

    setMatchCount(count)
    return <div className="break-all whitespace-pre-wrap leading-relaxed">{segments}</div>
  }, [pattern, inputText, flags])

  const handleReplace = useCallback(() => {
    if (!pattern || !inputText) {
      setOutput('')
      setError(null)
      return
    }

    try {
      const flagStr = Array.from(flags).join('')
      const regex = new RegExp(pattern, flagStr.includes('g') ? flagStr : flagStr + 'g')
      const result = inputText.replace(regex, replacement)
      setOutput(result)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid regex pattern or replacement')
      setOutput('')
    }
  }, [pattern, inputText, replacement, flags])

  const flagOptions: { value: Flag; label: string }[] = [
    { value: 'g', label: 'Global' },
    { value: 'i', label: 'Case Insensitive' },
    { value: 'm', label: 'Multiline' },
    { value: 's', label: 'Dot All' },
  ]

  const toggleFlag = useCallback((flag: Flag) => {
    setFlags(prev => {
      const next = new Set(prev)
      if (next.has(flag)) next.delete(flag)
      else next.add(flag)
      return next
    })
  }, [])

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
    const blob = new Blob([output], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'regex-replaced.txt'
    a.click()
    URL.revokeObjectURL(url)
  }, [output])

  const handleClear = useCallback(() => {
    setInputText('')
    setPattern('')
    setReplacement('')
    setOutput('')
    setError(null)
    setMatchCount(0)
  }, [])

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Flags</div>
            <div className="grid grid-cols-2 gap-1.5">
              {flagOptions.map(f => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => toggleFlag(f.value)}
                  className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs transition cursor-pointer ${
                    flags.has(f.value)
                      ? 'border-accent/50 bg-accent/10 text-accent'
                      : 'border-border/50 bg-base/40 text-muted hover:border-border'
                  }`}
                >
                  <span className="font-mono text-sm">{f.value}</span>
                  <span className="text-[10px]">{f.label}</span>
                </button>
              ))}
            </div>
          </div>

          {matchCount > 0 && highlightedPreview && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <CheckCircle className="h-3.5 w-3.5" />
                {matchCount} match{matchCount !== 1 ? 'es' : ''} found
              </div>
              <div className="max-h-40 overflow-auto rounded border border-emerald-500/10 bg-base/30 p-2 text-xs font-mono leading-relaxed">
                {highlightedPreview}
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-red-400">
                <AlertTriangle className="h-3.5 w-3.5" /> Invalid Pattern
              </div>
              <pre className="text-xs text-red-300 whitespace-pre-wrap">{error}</pre>
            </div>
          )}

          <Badge className="border-0 bg-accent/15 text-accent">Offline • Client-side only</Badge>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Pattern and Flags */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted" />
            <span className="text-xs font-semibold uppercase text-muted">Find (Regex)</span>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1 rounded-xl border border-border bg-[#0d1117]">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm">/</span>
              <input
                type="text"
                value={pattern}
                onChange={(e) => { setPattern(e.target.value); setOutput(''); setError(null) }}
                placeholder="e.g. \\b\\w+@\\w+\\.\\w+\\b"
                className="w-full h-10 bg-transparent border-0 px-6 py-2 text-sm font-mono text-text focus:outline-none"
              />
            </div>
            <div className="flex items-center rounded-xl border border-border bg-[#0d1117] px-2 text-sm font-mono text-accent min-w-[60px] justify-center">
              /{Array.from(flags).join('') || ''}
            </div>
          </div>
        </div>

        {/* Replacement */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-muted" />
            <span className="text-xs font-semibold uppercase text-muted">Replace with</span>
          </div>
          <input
            type="text"
            value={replacement}
            onChange={(e) => { setReplacement(e.target.value); setOutput('') }}
            placeholder="e.g. ***HIDDEN*** or $1@$2"
            className="w-full h-10 rounded-xl border border-border bg-base/70 px-3 text-sm font-mono text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <p className="text-[11px] text-muted">
            Use $1, $2 for capture groups, $& for full match
          </p>
        </div>

        {/* Input Text */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-muted">Input Text</span>
            {inputText && (
              <button type="button" onClick={handleClear} className="text-xs text-accent hover:text-accent/80">
                Clear All
              </button>
            )}
          </div>
          <textarea
            value={inputText}
            onChange={(e) => { setInputText(e.target.value); setOutput(''); setError(null) }}
            className="w-full min-h-[120px] p-3 border border-border rounded-lg bg-base/50 text-sm font-mono resize-y focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            placeholder="Paste the text to find and replace in..."
            spellCheck={false}
          />
        </div>

        <Button onClick={handleReplace} disabled={!pattern || !inputText}>
          <ArrowLeftRight className="mr-2 h-4 w-4" />
          Replace All
        </Button>

        {/* Output */}
        {output !== null && (
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-accent" />
                <span className="text-xs font-semibold uppercase text-muted">Result</span>
              </div>
              {output && (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" className="h-7 px-2 text-xs" onClick={handleCopy}>
                    {copied ? <CheckCircle className="mr-1 h-3 w-3 text-emerald-400" /> : <Copy className="mr-1 h-3 w-3" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                  <Button variant="ghost" className="h-7 px-2 text-xs" onClick={handleDownload}>
                    <Download className="mr-1 h-3 w-3" /> Download
                  </Button>
                </div>
              )}
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-xl border border-border bg-[#0d1117] p-3 text-xs font-mono text-text max-h-[400px]">
              {output || '(No changes — zero matches)'}
            </pre>
          </Card>
        )}
      </div>
    </BaseToolLayout>
  )
}
