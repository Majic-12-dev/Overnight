import { useState, useCallback, useMemo, useRef, type ReactNode } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { Copy, CheckCircle2, AlertTriangle } from 'lucide-react'

type YamlToJsonToolProps = {
  tool: ToolDefinition
}

type Direction = 'yaml-to-json' | 'json-to-yaml'

// Minimal YAML to JSON parser (handles common cases: scalars, objects, arrays)
function yamlToJson(yamlStr: string): unknown {
  const lines = yamlStr.split('\n')
  const result = parseBlock(lines, { index: 0 }, -1)
  if (Array.isArray(result) && result.length === 1) return result[0]
  return result
}

function detectIndent(line: string): number {
  const match = line.match(/^( *)\S/)
  return match ? match[1].length : 0
}

function parseValue(val: string): unknown {
  const trimmed = val.trim()
  if (trimmed === '' || trimmed === '~' || trimmed === 'null') return null
  if (trimmed === 'true' || trimmed === 'True' || trimmed === 'TRUE') return true
  if (trimmed === 'false' || trimmed === 'False' || trimmed === 'FALSE') return false
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) return trimmed.slice(1, -1)
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) return parseFlowArray(trimmed)
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return parseFlowObject(trimmed)
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return trimmed.includes('.') ? parseFloat(trimmed) : parseInt(trimmed, 10)
  return trimmed
}

function parseFlowArray(s: string): unknown[] {
  const inner = s.slice(1, -1).trim()
  if (!inner) return []
  return inner.split(',').map(x => parseValue(x.trim()))
}

function parseFlowObject(s: string): Record<string, unknown> {
  const inner = s.slice(1, -1).trim()
  if (!inner) return {}
  const obj: Record<string, unknown> = {}
  for (const kv of inner.split(',')) {
    const colonIdx = kv.indexOf(':')
    if (colonIdx === -1) continue
    obj[kv.slice(0, colonIdx).trim().replace(/^["']|["']$/g, '')] = parseValue(kv.slice(colonIdx + 1).trim())
  }
  return obj
}

function parseBlock(lines: string[], ctx: { index: number }, parentIndent: number): Record<string, unknown> | unknown[] {
  let lookAhead = ctx.index
  while (lookAhead < lines.length && (lines[lookAhead].trim() === '' || lines[lookAhead].trimStart().startsWith('#'))) lookAhead++
  if (lookAhead < lines.length && lines[lookAhead].trimStart().startsWith('- ')) return parseArrayBlock(lines, ctx, parentIndent)

  const obj: Record<string, unknown> = {}
  while (ctx.index < lines.length) {
    const line = lines[ctx.index]
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) { ctx.index++; continue }
    const indentLevel = detectIndent(line)
    if (indentLevel <= parentIndent && ctx.index > 0) break

    const kvMatch = trimmed.match(/^([^:]+?):\s*(.*)/)
    if (!kvMatch) { ctx.index++; continue }

    const key = kvMatch[1].trim().replace(/^["']|["']$/g, '')
    const valueStr = kvMatch[2].trim()

    if (valueStr === '' || valueStr.startsWith('#')) {
      ctx.index++
      if (ctx.index < lines.length) {
        const nextLine = lines[ctx.index]
        const nextTrimmed = nextLine.trim()
        if (nextTrimmed !== '' && !nextTrimmed.startsWith('#')) {
          const nextIndent = detectIndent(nextLine)
          if (nextTrimmed.startsWith('- ')) { obj[key] = parseArrayBlock(lines, ctx, indentLevel); continue }
          if (nextIndent > indentLevel) { obj[key] = parseBlock(lines, ctx, indentLevel); continue }
        }
      }
      obj[key] = null
    } else if (valueStr.startsWith('|') || valueStr.startsWith('>')) {
      ctx.index++
      const blockLines: string[] = []
      let bi = indentLevel + 2
      let peek = ctx.index
      while (peek < lines.length) { if (lines[peek].trim() !== '') { bi = detectIndent(lines[peek]); break } peek++ }
      while (ctx.index < lines.length) {
        const bLine = lines[ctx.index]
        if (bLine.trim() === '') { blockLines.push(''); ctx.index++; continue }
        if (detectIndent(bLine) <= indentLevel) break
        blockLines.push(bLine.slice(bi))
        ctx.index++
      }
      obj[key] = valueStr.startsWith('>') ? blockLines.join(' ').trimEnd() : blockLines.join('\n').trimEnd()
    } else {
      obj[key] = parseValue(valueStr)
      ctx.index++
    }
  }
  return obj
}

function parseArrayBlock(lines: string[], ctx: { index: number }, _parentIndent: number): unknown[] {
  const arr: unknown[] = []
  while (ctx.index < lines.length) {
    const line = lines[ctx.index]
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) { ctx.index++; continue }
    if (!trimmed.startsWith('- ')) break

    const itemContent = trimmed.slice(2).trim()
    const itemIndent = detectIndent(line)
    if (itemContent.includes(':')) {
      const obj: Record<string, unknown> = {}
      const kvMatch = itemContent.match(/^([^:]+?):\s*(.*)/)
      if (kvMatch) {
        const cleanKey = kvMatch[1].trim().replace(/^["']|["']$/g, '')
        const val = kvMatch[2].trim()
        if (val === '' || val.startsWith('#')) {
          ctx.index++
          obj[cleanKey] = parseBlock(lines, ctx, itemIndent + 2)
        } else {
          obj[cleanKey] = parseValue(val)
          ctx.index++
        }
      } else { ctx.index++; }
      while (ctx.index < lines.length) {
        const nLine = lines[ctx.index]
        const nTrimmed = nLine.trim()
        if (nTrimmed === '' || nTrimmed.startsWith('#')) { ctx.index++; continue }
        if (nTrimmed.startsWith('- ')) break
        const nIndent = detectIndent(nLine)
        if (nIndent <= itemIndent) break
        const nKvMatch = nTrimmed.match(/^([^:]+?):\s*(.*)/)
        if (nKvMatch) {
          const nKey = nKvMatch[1].trim().replace(/^["']|["']$/g, '')
          const nVal = nKvMatch[2].trim()
          if (nVal === '' || nVal.startsWith('#')) { ctx.index++; obj[nKey] = parseBlock(lines, ctx, nIndent + 2) }
          else { obj[nKey] = parseValue(nVal); ctx.index++ }
        } else { break }
      }
      arr.push(obj)
    } else if (itemContent.startsWith('[') && itemContent.endsWith(']')) {
      arr.push(parseFlowArray(itemContent))
      ctx.index++
    } else {
      arr.push(parseValue(itemContent))
      ctx.index++
    }
  }
  return arr
}

// JSON to YAML converter
function jsonToYaml(obj: unknown, indent = 0): string {
  const pad = '  '.repeat(indent)
  if (obj === null || obj === undefined) return 'null'
  if (typeof obj === 'boolean') return obj ? 'true' : 'false'
  if (typeof obj === 'number') return String(obj)
  if (typeof obj === 'string') {
    if (obj.includes('\n')) {
      return `|\n${obj.split('\n').map(l => pad + '  ' + l).join('\n')}`
    }
    const needsQuote = !/^[a-zA-Z0-9_\-\/\.$]+$/.test(obj) || /^(true|false|null|yes|no)$/i.test(obj)
    return needsQuote ? `"${obj.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : obj
  }
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]'
    return obj.map((item, i) => {
      if (item !== null && typeof item === 'object') {
        const entries = Object.entries(item as Record<string, unknown>)
        if (entries.length === 0) return `${pad}- {}`
        const lines: string[] = []
        entries.forEach(([k, v], vi) => {
          if (vi === 0) {
            if (v === null || typeof v !== 'object') {
              lines.push(`${pad}- ${k}: ${v === null ? 'null' : jsonToYaml(v, 0)}`)
            } else {
              lines.push(`${pad}- ${k}:`)
              lines.push(jsonToYaml(v, indent + 1))
            }
          } else {
            if (v === null || typeof v !== 'object') {
              lines.push(`${pad}  ${k}: ${v === null ? 'null' : jsonToYaml(v, 0)}`)
            } else {
              lines.push(`${pad}  ${k}:`)
              lines.push(jsonToYaml(v, indent + 2))
            }
          }
        })
        return lines.join('\n')
      }
      return `${pad}- ${jsonToYaml(item, indent + 1)}`
    }).join('\n')
  }
  if (typeof obj === 'object') {
    const entries = Object.entries(obj as Record<string, unknown>)
    if (entries.length === 0) return '{}'
    return entries.map(([k, v]) => {
      if (v === null || typeof v !== 'object') return `${pad}${k}: ${v === null ? 'null' : jsonToYaml(v, 0)}`
      return `${pad}${k}:\n${jsonToYaml(v, indent + 1)}`
    }).join('\n')
  }
  return String(obj)
}

export function YamlToJsonTool({ tool }: YamlToJsonToolProps) {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [direction, setDirection] = useState<Direction>('yaml-to-json')
  const [prettyPrint, setPrettyPrint] = useState(true)
  const [copied, setCopied] = useState(false)
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isValid = useMemo(() => {
    if (!input.trim()) return true
    try {
      if (direction === 'yaml-to-json') {
        yamlToJson(input)
      } else {
        JSON.parse(input)
      }
      return true
    } catch { return false }
  }, [input, direction])

  const convert = useCallback(() => {
    if (!input.trim()) { setOutput(''); setError(null); return }
    setError(null)
    try {
      if (direction === 'yaml-to-json') {
        const parsed = yamlToJson(input)
        setOutput(prettyPrint ? JSON.stringify(parsed, null, 2) : JSON.stringify(parsed))
      } else {
        const parsed = JSON.parse(input)
        setOutput(jsonToYaml(parsed))
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Conversion failed.')
      setOutput('')
    }
  }, [input, direction, prettyPrint])

  const handleProcess = useCallback(async (
    files: Array<{ file: File; name: string; size: number }>,
    context: { setProgress: (v: number) => void; setResult: (r: ReactNode | null) => void; setError: (m: string | null) => void }
  ) => {
    if (!files.length) { context.setError('No files selected.'); return }
    context.setProgress(10)
    try {
      const combined = (await Promise.all(files.map(f => f.file.text()))).join('\n\n')
      setInput(combined)
      if (direction === 'yaml-to-json') {
        const parsed = yamlToJson(combined)
        setOutput(prettyPrint ? JSON.stringify(parsed, null, 2) : JSON.stringify(parsed))
      } else {
        const parsed = JSON.parse(combined)
        setOutput(jsonToYaml(parsed))
      }
      context.setProgress(100)
      context.setResult(
        <Card className="space-y-3 border-border bg-base/60 p-4">
          <Badge className="border-0 bg-accent/15 text-accent">Conversion complete</Badge>
          <div className="text-xs text-muted">Processed {files.length} file(s). Results shown in output panel.</div>
        </Card>
      )
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Conversion failed.'
      setError(msg)
      context.setError(msg)
    }
  }, [direction, prettyPrint])

  const handleCopy = useCallback(() => {
    if (!output) return
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true)
      if (copyTimeout.current) clearTimeout(copyTimeout.current)
      copyTimeout.current = setTimeout(() => setCopied(false), 2000)
    })
  }, [output])

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      accept={direction === 'yaml-to-json' ? '.yaml,.yml' : '.json'}
      instructions="Upload YAML or JSON files to load content."
      onProcess={handleProcess}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_280px] gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <label className="text-xs font-medium">Direction</label>
              <Select value={direction} onChange={(e) => { setDirection(e.target.value as Direction); setInput(''); setOutput(''); setError(null) }}>
                <option value="yaml-to-json">{`YAML → JSON`}</option>
                <option value="json-to-yaml">{`JSON → YAML`}</option>
              </Select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-xs mt-5">
              <input type="checkbox" checked={prettyPrint} onChange={(e) => setPrettyPrint(e.target.checked)} className="rounded" />
              Pretty print
            </label>
          </div>
          {error && (
            <Card className="border border-red-500/50 bg-red-500/10 p-3 text-sm">
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            </Card>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium">{direction === 'yaml-to-json' ? 'YAML Input' : 'JSON Input'}</label>
              <textarea
                value={input}
                onChange={(e) => { setInput(e.target.value); if (isValid) convert() }}
                placeholder={direction === 'yaml-to-json' ? 'Paste YAML here...' : 'Paste JSON here...'}
                className="h-72 w-full rounded-lg border border-border bg-base p-3 font-mono text-xs text-text placeholder:text-muted resize-none"
                spellCheck={false}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium">{direction === 'yaml-to-json' ? 'JSON Output' : 'YAML Output'}</label>
                {output && (
                  <Button variant="ghost" onClick={handleCopy} className="gap-1">
                    {copied ? <><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
                  </Button>
                )}
              </div>
              <div className={`h-72 overflow-auto rounded-lg border ${isValid && output ? 'border-border' : 'border-border'} bg-base p-3 font-mono text-xs ${isValid && output ? 'text-text' : 'text-muted'} whitespace-pre-wrap`}>
                {output || '(output will appear here)'}
              </div>
            </div>
          </div>
        </div>
        <Card className="space-y-4">
          <h3 className="text-sm font-semibold text-text">Options</h3>
          <p className="text-xs text-muted">
            Convert between YAML and JSON bidirectionally. Supports nested objects, arrays, and scalar types.
          </p>
          <Button className="w-full" onClick={convert}>Convert</Button>
          <Button variant="ghost" className="w-full" onClick={() => { setInput(''); setOutput(''); setError(null) }}>Clear</Button>
          <hr className="border-border" />
          <p className="text-xs text-muted">
            Or upload <code className="text-accent">.yaml</code> / <code className="text-accent">.json</code> files to load content from disk.
          </p>
        </Card>
      </div>
    </BaseToolLayout>
  )
}
