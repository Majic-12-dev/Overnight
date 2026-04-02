import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Copy, Download, RefreshCw, Trash2, ArrowLeftRight } from 'lucide-react'

/* ──────────────────────────────────────────────────────────────
   Tool Type
   ────────────────────────────────────────────────────────────── */

type DataConverterToolProps = {
  tool: ToolDefinition
}

/* ──────────────────────────────────────────────────────────────
   Helpers — CSV / TSV Parsing
   ────────────────────────────────────────────────────────────── */

function detectDelimiter(text: string): ',' | '\t' | null {
  const firstLine = text.split(/\r?\n/)[0] ?? ''
  const commas = (firstLine.match(/,/g) ?? []).length
  const tabs = (firstLine.match(/\t/g) ?? []).length
  if (tabs > commas) return '\t'
  if (commas > 0) return ','
  return null
}

function parseDelimited(text: string, delimiter: ',' | '\t'): { headers: string[]; rows: string[][]; errors: string[] } {
  const errors: string[] = []
  const rows: string[][] = []
  let i = 0
  let currentRow: string[] = []
  let currentField = ''
  let inQuotes = false

  while (i < text.length) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          currentField += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      currentField += ch
      i++
      continue
    }

    if (ch === '"') {
      inQuotes = true
      i++
      continue
    }
    if (ch === delimiter) {
      currentRow.push(currentField)
      currentField = ''
      i++
      continue
    }
    if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') {
      currentRow.push(currentField)
      currentField = ''
      rows.push(currentRow)
      currentRow = []
      i += 2
      continue
    }
    if (ch === '\n' || ch === '\r') {
      currentRow.push(currentField)
      currentField = ''
      rows.push(currentRow)
      currentRow = []
      i++
      continue
    }
    currentField += ch
    i++
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField)
    rows.push(currentRow)
  }

  if (rows.length === 0) {
    errors.push('Input is empty or contains only whitespace.')
    return { headers: [], rows: [], errors }
  }

  const colCount = rows[0].length
  if (colCount === 0) {
    errors.push('No columns found.')
    return { headers: [], rows: [], errors }
  }

  for (let r = 1; r < rows.length; r++) {
    if (rows[r].length !== colCount) {
      errors.push(`Line ${r + 1}: expected ${colCount} columns, found ${rows[r].length}. Padding/truncating to match.`)
      while (rows[r].length < colCount) rows[r].push('')
      rows[r].length = colCount
    }
  }

  return { headers: rows[0], rows: rows.slice(1), errors }
}

function csvEscape(value: string, delimiter: ',' | '\t'): string {
  const mustQuote = value.includes(delimiter) || value.includes('"') || value.includes('\n') || value.includes('\r')
  if (mustQuote) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

function buildDelimited(headers: string[], rows: string[][], delimiter: ',' | '\t'): string {
  const lines = [headers.map(h => csvEscape(h, delimiter)).join(delimiter)]
  for (const row of rows) {
    lines.push(row.map(v => csvEscape(v, delimiter)).join(delimiter))
  }
  return lines.join('\n')
}

/* ──────────────────────────────────────────────────────────────
   Helpers — JSON conversions
   ────────────────────────────────────────────────────────────── */

function delimitedToJson(headers: string[], rows: string[][]): Record<string, string>[] {
  return rows.map(row => {
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h] = row[i] ?? '' })
    return obj
  })
}

function jsonToDelimited(data: Array<Record<string, unknown>>, delimiter: ',' | '\t'): string {
  if (data.length === 0) return ''

  const allKeys = new Set<string>()
  for (const row of data) {
    for (const key of Object.keys(row)) allKeys.add(key)
  }
  const headers = Array.from(allKeys)
  const rows = data.map(row => headers.map(h => String(row[h] ?? '')))
  return buildDelimited(headers, rows, delimiter)
}

/* ──────────────────────────────────────────────────────────────
   Helpers — XML conversions
   ────────────────────────────────────────────────────────────── */

function sanitizeXmlTag(text: string): string {
  const cleaned = text.replace(/[^a-zA-Z0-9_\-\.\u00C0-\u024F]/g, '_')
  if (cleaned.length === 0 || /^[^a-zA-Z_\u00C0-\u024F]/.test(cleaned)) {
    return '_' + cleaned
  }
  return cleaned
}

function xmlEscape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function objectToXml(obj: unknown, tagName: string, indent: number): string {
  const pad = '  '.repeat(indent)
  const tag = sanitizeXmlTag(tagName)

  if (obj === null || obj === undefined) {
    return `${pad}<${tag}/>`
  }

  if (typeof obj !== 'object') {
    return `${pad}<${tag}>${xmlEscape(String(obj))}</${tag}>`
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) return `${pad}<${tag}/>`
    const itemTag = tag.endsWith('s') ? tag.slice(0, -1) : 'item'
    const items = obj.map(item => objectToXml(item, itemTag, indent + 1)).join('\n')
    return `${pad}<${tag}>\n${items}\n${pad}</${tag}>`
  }

  const record = obj as Record<string, unknown>
  const keys = Object.keys(record)
  if (keys.length === 0) return `${pad}<${tag}/>`

  const children = keys
    .map(key => objectToXml(record[key], key, indent + 1))
    .join('\n')
  return `${pad}<${tag}>\n${children}\n${pad}</${tag}>`
}

function jsonToXml(json: Record<string, unknown> | Array<Record<string, unknown>> | unknown[]): string {
  const xmlBody = objectToXml(json, 'root', 0)
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + xmlBody
}

function delimitedToXml(headers: string[], rows: string[][]): string {
  const items = rows.map(row => {
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h] = row[i] ?? '' })
    return obj
  })
  return jsonToXml(items as Record<string, unknown>[])
}

/* ──────────────────────────────────────────────────────────────
   Helpers — XML to JSON (basic)
   ────────────────────────────────────────────────────────────── */

function xmlToJson(xml: string): Record<string, unknown> | null {
  const trimmed = xml.trim()
  if (!trimmed.startsWith('<')) return null

  // Strip XML declaration
  const body = trimmed.replace(/^<\?xml[^?]*\?>\s*/, '')
  const parser = new DOMParser()
  const doc = parser.parseFromString(body, 'text/xml')

  if (doc.querySelector('parsererror')) {
    return null
  }

  function parseElement(el: Element): unknown {
    const children = Array.from(el.children)
    const text = el.textContent?.trim() ?? ''

    if (children.length === 0) {
      return text === '' ? null : text
    }

    const hasMixedContent = children.length > 0 && text !== ''

    // Group by tag name
    const grouped: Record<string, unknown[]> = {}
    for (const child of children) {
      const name = child.tagName
      if (!grouped[name]) grouped[name] = []
      grouped[name].push(parseElement(child))
    }

    const result: Record<string, unknown> = {}
    for (const [key, values] of Object.entries(grouped)) {
      result[key] = values.length === 1 ? values[0] : values
    }

    if (hasMixedContent && text) {
      result['_text'] = text
    }

    return result
  }

  const root = doc.documentElement
  const name = root.tagName
  const content = parseElement(root)
  return { [name]: content }
}

/* ──────────────────────────────────────────────────────────────
   Conversion Matrix
   Source → { Target: fn }
   ────────────────────────────────────────────────────────────── */

type Format = 'csv' | 'tsv' | 'json' | 'xml'
type ConversionKey = `${Format}-to-${Format}`

const FORMAT_LABELS: Record<Format, string> = {
  csv: 'CSV (Comma-Separated)',
  tsv: 'TSV (Tab-Separated)',
  json: 'JSON',
  xml: 'XML',
}

interface ConversionPair {
  source: Format
  target: Format
  key: ConversionKey
}

function generateConversionPairs(): ConversionPair[] {
  const formats: Format[] = ['csv', 'tsv', 'json', 'xml']
  const pairs: ConversionPair[] = []
  for (const source of formats) {
    for (const target of formats) {
      if (source !== target) {
        pairs.push({ source, target, key: `${source}-to-${target}` })
      }
    }
  }
  return pairs
}

const ALL_CONVERSIONS = generateConversionPairs()

type ConversionResult = {
  output: string | null
  errors: string[]
}

function executeConversion(
  source: Format,
  target: Format,
  input: string,
): ConversionResult {
  const errors: string[] = []
  const trimmed = input.trim()

  if (!trimmed) {
    return { output: null, errors: ['Input is empty. Paste data above.'] }
  }

  let intermediate: Record<string, unknown>[] | Record<string, unknown> | null = null

  /* ── Parse source into JSON-able structure ── */

  try {
    if (source === 'json') {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        if (parsed.length > 0 && typeof parsed[0] !== 'object') {
          intermediate = parsed.map(v => ({ value: String(v) }))
        } else {
          intermediate = parsed.map(item =>
            typeof item === 'object' && item !== null && !Array.isArray(item)
              ? item as Record<string, unknown>
              : { value: String(item) }
          )
        }
      } else if (typeof parsed === 'object' && parsed !== null) {
        intermediate = parsed as Record<string, unknown>
      } else {
        errors.push('JSON must be an object or array.')
        return { output: null, errors }
      }
    } else if (source === 'xml') {
      intermediate = xmlToJson(trimmed)
      if (intermediate === null) {
        errors.push('Failed to parse XML input. Check for well-formed markup.')
        return { output: null, errors }
      }
    } else if (source === 'csv' || source === 'tsv') {
      const delimiter = source === 'csv' ? ',' : '\t'
      const { headers, rows, errors: parseErrors } = parseDelimited(trimmed, delimiter)
      errors.push(...parseErrors)
      if (headers.length === 0) return { output: null, errors }
      intermediate = delimitedToJson(headers, rows)
    }
  } catch (e) {
    errors.push(`Parse error: ${e instanceof Error ? e.message : 'Invalid input.'}`)
    return { output: null, errors }
  }

  if (!intermediate) {
    if (errors.length === 0) errors.push('No data could be parsed from the input.')
    return { output: null, errors }
  }

  /* ── Convert intermediate to target format ── */

  try {
    if (target === 'json') {
      return { output: JSON.stringify(intermediate, null, 2), errors }
    }
    if (target === 'xml') {
      return { output: jsonToXml(intermediate as Record<string, unknown> | Array<Record<string, unknown>> | unknown[]), errors }
    }
    if (target === 'csv') {
      const items = Array.isArray(intermediate)
        ? intermediate
        : [intermediate]
      return { output: jsonToDelimited(items as Array<Record<string, unknown>>, ','), errors }
    }
    if (target === 'tsv') {
      const items = Array.isArray(intermediate)
        ? intermediate
        : [intermediate]
      return { output: jsonToDelimited(items as Array<Record<string, unknown>>, '\t'), errors }
    }
  } catch (e) {
    errors.push(`Conversion error: ${e instanceof Error ? e.message : 'Unknown error.'}`)
    return { output: null, errors }
  }

  return { output: null, errors: ['Unsupported conversion.'] }
}

type ConversionResultInfo = {
  success: boolean
  output: string
  errors: string[]
}

/* ──────────────────────────────────────────────────────────────
   Component
   ────────────────────────────────────────────────────────────── */

export function DataConverterTool({ tool }: DataConverterToolProps) {
  const [inputText, setInputText] = useState('')
  const [outputText, setOutputText] = useState('')
  const [sourceFormat, setSourceFormat] = useState<Format>('json')
  const [targetFormat, setTargetFormat] = useState<Format>('csv')
  const [conversionResult, setConversionResult] = useState<ConversionResultInfo | null>(null)
  const [copyHint, setCopyHint] = useState('')
  const [downloadName, setDownloadName] = useState('converted')
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        clearTimeout(copyTimerRef.current)
      }
    }
  }, [])

  // Filter conversion pairs
  const availableTargets = ALL_CONVERSIONS
    .filter(p => p.source === sourceFormat)
    .map(p => p.target)

  useEffect(() => {
    if (!availableTargets.includes(targetFormat)) {
      setTargetFormat(availableTargets[0] as Format)
    }
  }, [sourceFormat, targetFormat, availableTargets])

  // Auto-generate filename
  useEffect(() => {
    const now = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const ext = targetFormat === 'json' ? 'json' : targetFormat === 'xml' ? 'xml' : targetFormat
    setDownloadName(`converted-${sourceFormat}-to-${targetFormat}-${now}`)
  }, [sourceFormat, targetFormat])

  const clearCopyTimer = useCallback(() => {
    if (copyTimerRef.current !== null) {
      clearTimeout(copyTimerRef.current)
      copyTimerRef.current = null
    }
  }, [])

  const handleConvert = useCallback(() => {
    clearCopyTimer()
    setCopyHint('')
    setOutputText('')
    setConversionResult(null)

    const result = executeConversion(sourceFormat, targetFormat, inputText)

    if (result.errors.length > 0 && !result.output) {
      setConversionResult({ success: false, output: '', errors: result.errors })
      return
    }

    setOutputText(result.output ?? '')
    setConversionResult({
      success: true,
      output: result.output ?? '',
      errors: result.errors.filter(e => !e.startsWith('Line')), // keep warnings separate
    })
  }, [sourceFormat, targetFormat, inputText, clearCopyTimer])

  const handleClear = useCallback(() => {
    setInputText('')
    setOutputText('')
    setConversionResult(null)
    setCopyHint('')
    clearCopyTimer()
  }, [clearCopyTimer])

  const handleSwap = useCallback(() => {
    if (!conversionResult?.success || !outputText) return
    setInputText(outputText)
    setOutputText('')
    setConversionResult(null)
    setSourceFormat(targetFormat)
    // target will update via useEffect
    setCopyHint('')
    clearCopyTimer()
  }, [conversionResult, outputText, targetFormat, clearCopyTimer])

  const handleCopy = useCallback(() => {
    if (!outputText) return
    clearCopyTimer()
    navigator.clipboard.writeText(outputText).then(
      () => {
        setCopyHint('Copied!')
        copyTimerRef.current = setTimeout(() => {
          setCopyHint('')
          copyTimerRef.current = null
        }, 2000)
      },
      () => {
        setCopyHint('Copy failed.')
      },
    )
  }, [outputText, clearCopyTimer])

  const handleDownload = useCallback(() => {
    if (!outputText) return
    const ext = targetFormat === 'json' ? 'json' : targetFormat === 'xml' ? 'xml' : targetFormat
    const mimeMap: Record<string, string> = {
      json: 'application/json',
      xml: 'application/xml',
      csv: 'text/csv',
      tsv: 'text/tab-separated-values',
    }
    const blob = new Blob([outputText], { type: mimeMap[targetFormat] ?? 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${downloadName}.${ext}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [outputText, targetFormat, downloadName])

  const inputPlaceholder = useMemo(() => {
    switch (sourceFormat) {
      case 'csv': return 'Paste CSV data here…\nName,Age,City\nAlice,30,London\nBob,25,Paris'
      case 'tsv': return 'Paste TSV data here…\nName\tAge\tCity\nAlice\t30\tLondon\nBob\t25\tParis'
      case 'json': return 'Paste JSON data here…\n[\n  {"Name": "Alice", "Age": 30, "City": "London"},\n  {"Name": "Bob", "Age": 25, "City": "Paris"}\n]'
      case 'xml': return 'Paste XML data here…\n<root>\n  <item>\n    <Name>Alice</Name>\n    <Age>30</Age>\n    <City>London</City>\n  </item>\n</root>'
    }
  }, [sourceFormat])

  const conversionLabel = `${sourceFormat.toUpperCase()} → ${targetFormat.toUpperCase()}`

  // Available target options
  const targetOptions = ALL_CONVERSIONS
    .filter(p => p.source === sourceFormat)
    .map(p => (
      <option key={p.key} value={p.target}>{FORMAT_LABELS[p.target]}</option>
    ))

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className="space-y-4">
          {/* Source Format */}
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Source Format</div>
            <Select
              value={sourceFormat}
              onChange={(e) => {
                setSourceFormat(e.target.value as Format)
                setOutputText('')
                setConversionResult(null)
              }}
            >
              {(['csv', 'tsv', 'json', 'xml'] as Format[]).map(f => (
                <option key={f} value={f}>{FORMAT_LABELS[f]}</option>
              ))}
            </Select>
          </div>

          {/* Target Format */}
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Target Format</div>
            <Select
              value={targetFormat}
              onChange={(e) => {
                setTargetFormat(e.target.value as Format)
                setOutputText('')
                setConversionResult(null)
              }}
            >
              {targetOptions}
            </Select>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <Button
              onClick={handleConvert}
              disabled={!inputText.trim()}
              className="w-full"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Convert
            </Button>
            <Button
              variant="outline"
              onClick={handleSwap}
              disabled={!conversionResult?.success || !outputText}
              className="w-full"
              title="Swap: use current output as new input and reverse formats"
            >
              <ArrowLeftRight className="mr-2 h-4 w-4" />
              Swap &amp; Re-convert
            </Button>
            <Button
              variant="ghost"
              onClick={handleClear}
              disabled={!inputText && !outputText}
              className="w-full"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Clear All
            </Button>
          </div>

          {/* Warnings */}
          {conversionResult && conversionResult.errors.length > 0 && (
            <div className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2 space-y-1">
              <div className="font-semibold">Warnings</div>
              {conversionResult.errors.map((err, i) => (
                <div key={i} className="break-words">• {err}</div>
              ))}
            </div>
          )}

          {/* Errors */}
          {conversionResult && !conversionResult.success && conversionResult.errors.length > 0 && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2 space-y-1">
              <div className="font-semibold">Errors</div>
              {conversionResult.errors.map((err, i) => (
                <div key={i} className="break-words">• {err}</div>
              ))}
            </div>
          )}

          {/* Conversion info */}
          {conversionResult?.success && conversionResult.output && (
            <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg p-2">
              ✓ Converted successfully ({new Blob([conversionResult.output]).size.toLocaleString()} bytes)
            </div>
          )}
        </div>
      }
    >
      <div className="grid grid-cols-[1fr_1fr] gap-4">
        {/* Input Panel */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-muted">
              Input ({sourceFormat.toUpperCase()})
            </span>
            {inputText && (
              <button
                type="button"
                className="text-xs text-accent hover:text-accent/80 inline-flex items-center gap-1"
                onClick={handleClear}
              >
                <Trash2 className="h-3 w-3" />
                Clear
              </button>
            )}
          </div>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full h-72 p-3 border border-border rounded-lg bg-base/50 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50"
            placeholder={inputPlaceholder}
            spellCheck={false}
          />
          {inputText.trim() && (
            <div className="text-xs text-muted">
              {inputText.length.toLocaleString()} characters
            </div>
          )}
        </div>

        {/* Output Panel */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-muted">
              Output ({targetFormat.toUpperCase()})
            </span>
            {outputText && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="text-xs text-accent hover:text-accent/80 inline-flex items-center gap-1"
                  onClick={handleCopy}
                  title="Copy to clipboard"
                >
                  <Copy className="h-3 w-3" />
                  {copyHint || 'Copy'}
                </button>
                <button
                  type="button"
                  className="text-xs text-accent hover:text-accent/80 inline-flex items-center gap-1"
                  onClick={handleDownload}
                  title="Download as file"
                >
                  <Download className="h-3 w-3" />
                  Download
                </button>
              </div>
            )}
          </div>
          <textarea
            value={outputText}
            readOnly
            className="w-full h-72 p-3 border border-border rounded-lg bg-base/50 text-sm font-mono resize-y"
            placeholder={`Result will appear here after converting ${conversionLabel}…`}
            spellCheck={false}
          />
          {outputText && (
            <div className="text-xs text-muted">
              {outputText.length.toLocaleString()} characters
            </div>
          )}
        </div>
      </div>
    </BaseToolLayout>
  )
}
