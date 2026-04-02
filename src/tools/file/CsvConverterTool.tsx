import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Copy, ArrowLeftRight, Download, FileText, Braces } from 'lucide-react'

type CsvConverterToolProps = {
  tool: ToolDefinition
}

type ParseError = {
  line: number
  message: string
}

type ConversionMode = 'csv-to-json' | 'json-to-csv'

/* ──────────────────────────────────────────────
   CSV Parser (handles quoted fields, newlines in quotes)
   ────────────────────────────────────────────── */

function parseCSV(text: string): { headers: string[]; rows: string[][]; errors: ParseError[] } {
  const errors: ParseError[] = []
  const rows: string[][] = []
  let i = 0
  let currentRow: string[] = []
  let currentField = ''
  let inQuotes = false
  let lineNum = 1

  while (i < text.length) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        // Escaped quote ""
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

    // Outside quotes
    if (ch === '"') {
      inQuotes = true
      i++
      continue
    }
    if (ch === ',') {
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
      lineNum++
      i += 2
      continue
    }
    if (ch === '\n' || ch === '\r') {
      currentRow.push(currentField)
      currentField = ''
      rows.push(currentRow)
      currentRow = []
      lineNum++
      i++
      continue
    }
    currentField += ch
    i++
  }

  // Flush last field/row
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField)
    rows.push(currentRow)
  }

  if (rows.length === 0) {
    errors.push({ line: 1, message: 'Input is empty' })
    return { headers: [], rows: [], errors }
  }

  // Normalize column count
  const colCount = rows[0].length
  if (colCount === 0) {
    errors.push({ line: 1, message: 'No columns found' })
    return { headers: [], rows: [], errors }
  }

  for (let r = 1; r < rows.length; r++) {
    if (rows[r].length !== colCount) {
      errors.push({
        line: r + 1,
        message: `Expected ${colCount} columns but found ${rows[r].length}`,
      })
      while (rows[r].length < colCount) rows[r].push('')
      rows[r].length = colCount
    }
  }

  return { headers: rows[0], rows: rows.slice(1), errors }
}

/* ──────────────────────────────────────────────
   CSV builder
   ────────────────────────────────────────────── */

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

function buildCSV(headers: string[], rows: string[][]): string {
  const lines = [headers.map(csvEscape).join(',')]
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(','))
  }
  return lines.join('\n')
}

/* ──────────────────────────────────────────────
   Component
   ────────────────────────────────────────────── */

export function CsvConverterTool({ tool }: CsvConverterToolProps) {
  const [inputText, setInputText] = useState('')
  const [outputText, setOutputText] = useState('')
  const [mode, setMode] = useState<ConversionMode>('csv-to-json')
  const [parseErrors, setParseErrors] = useState<ParseError[]>([])
  const [copyHint, setCopyHint] = useState('')
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Ensure any pending copy hint timeout is cleaned up on unmount
  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        clearTimeout(copyTimerRef.current)
      }
    }
  }, [])

  const clearCopyTimer = useCallback(() => {
    if (copyTimerRef.current !== null) {
      clearTimeout(copyTimerRef.current)
      copyTimerRef.current = null
    }
  }, [])

  const handleConvert = useCallback(() => {
    setParseErrors([])
    setCopyHint('')
    clearCopyTimer()
    const trimmed = inputText.trim()
    if (!trimmed) {
      setParseErrors([{ line: 0, message: 'Input is empty. Paste CSV or JSON data above.' }])
      setOutputText('')
      return
    }

    if (mode === 'csv-to-json') {
      const { headers, rows, errors } = parseCSV(trimmed)
      setParseErrors(errors)
      const result = rows.map((row) => {
        const obj: Record<string, string> = {}
        headers.forEach((h, i) => {
          obj[h] = row[i] ?? ''
        })
        return obj
      })
      setOutputText(JSON.stringify(result, null, 2))
    } else {
      // json-to-csv
      let data: Array<Record<string, unknown>>
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) {
          if (parsed.length > 0 && !Array.isArray(parsed[0]) && typeof parsed[0] !== 'object') {
            // Flat array — treat as single-column CSV
            data = parsed.map((v) => ({ value: String(v) }))
          } else {
            data = parsed.map((item) =>
              typeof item === 'object' && item !== null && !Array.isArray(item)
                ? (item as Record<string, unknown>)
                : { value: String(item) },
            )
          }
        } else if (typeof parsed === 'object' && parsed !== null) {
          data = [parsed as Record<string, unknown>]
        } else {
          throw new Error('JSON must be an object or array of objects.')
        }
      } catch (e) {
        setParseErrors([
          { line: 0, message: e instanceof Error ? e.message : 'Invalid JSON input.' },
        ])
        setOutputText('')
        return
      }

      const allKeys = new Set<string>()
      for (const row of data) {
        for (const key of Object.keys(row)) {
          allKeys.add(key)
        }
      }
      const headers = Array.from(allKeys)
      const rows = data.map((row) => headers.map((h) => String(row[h] ?? '')))
      setOutputText(buildCSV(headers, rows))
    }
  }, [inputText, mode, clearCopyTimer])

  const handleClear = useCallback(() => {
    setInputText('')
    setOutputText('')
    setParseErrors([])
    setCopyHint('')
    clearCopyTimer()
  }, [clearCopyTimer])

  const handleSwap = useCallback(() => {
    setInputText(outputText)
    setOutputText('')
    setMode((prev) => (prev === 'csv-to-json' ? 'json-to-csv' : 'csv-to-json'))
    setParseErrors([])
    setCopyHint('')
    clearCopyTimer()
  }, [outputText, clearCopyTimer])

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
    const ext = mode === 'csv-to-json' ? 'json' : 'csv'
    const mime = ext === 'json' ? 'application/json' : 'text/csv'
    const blob = new Blob([outputText], { type: mime })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `converted.${ext}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [outputText, mode])

  const errorSummary = useMemo(() => {
    if (parseErrors.length === 0) return ''
    return parseErrors
      .map((e) => (e.line > 0 ? `Line ${e.line}: ${e.message}` : e.message))
      .join('; ')
  }, [parseErrors])

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Conversion Mode</div>
            <Select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value as ConversionMode)
                setOutputText('')
                setParseErrors([])
              }}
            >
              <option value="csv-to-json">CSV → JSON</option>
              <option value="json-to-csv">JSON → CSV</option>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={handleConvert} disabled={!inputText.trim()} className="w-full">
              {mode === 'csv-to-json' ? (
                <Braces className="mr-2 h-4 w-4" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              Convert
            </Button>
            <Button
              variant="outline"
              onClick={handleSwap}
              disabled={!inputText.trim()}
              className="w-full"
            >
              <ArrowLeftRight className="mr-2 h-4 w-4" />
              Swap Direction
            </Button>
          </div>
          {parseErrors.length > 0 && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded p-2">
              {errorSummary}
            </div>
          )}
        </div>
      }
    >
      <div className="grid grid-cols-[1fr_1fr] gap-4">
        {/* Input panel */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-muted">
              Input ({mode === 'csv-to-json' ? 'CSV' : 'JSON'})
            </span>
            <button
              type="button"
              className="text-xs text-accent hover:text-accent/80"
              onClick={handleClear}
            >
              Clear
            </button>
          </div>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full h-64 p-3 border border-border rounded-lg bg-base/50 text-sm font-mono resize-y"
            placeholder={
              mode === 'csv-to-json'
                ? 'Paste CSV data here…\nName,Age,City\nAlice,30,London'
                : 'Paste JSON data here…\n[{"Name":"Alice","Age":"30","City":"London"}]'
            }
          />
        </div>

        {/* Output panel */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-muted">
              Output ({mode === 'csv-to-json' ? 'JSON' : 'CSV'})
            </span>
            {outputText && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="text-xs text-accent hover:text-accent/80 inline-flex items-center gap-1"
                  onClick={handleCopy}
                >
                  <Copy className="h-3 w-3" />
                  {copyHint || 'Copy'}
                </button>
                <button
                  type="button"
                  className="text-xs text-accent hover:text-accent/80 inline-flex items-center gap-1"
                  onClick={handleDownload}
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
            className="w-full h-64 p-3 border border-border rounded-lg bg-base/50 text-sm font-mono resize-y"
            placeholder="Result will appear here…"
          />
        </div>
      </div>
    </BaseToolLayout>
  )
}
