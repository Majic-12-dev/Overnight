import { useState, useMemo, useCallback, useRef } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Database, Minimize2, AlignLeft, Copy, CheckCircle, Download } from 'lucide-react'

type SqlFormatterToolProps = {
  tool: ToolDefinition
}

type Mode = 'beautify' | 'minify'

const KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET',
  'DELETE', 'CREATE', 'DROP', 'ALTER', 'TABLE', 'INDEX', 'VIEW',
  'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 'CROSS', 'ON',
  'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN', 'EXISTS', 'IS', 'NULL',
  'AS', 'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET',
  'UNION', 'ALL', 'DISTINCT', 'ASC', 'DESC',
  'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'CONSTRAINT',
  'DEFAULT', 'CHECK', 'UNIQUE',
  'TRUNCATE', 'REPLACE', 'MERGE',
  'WITH', 'RECURSIVE',
  'EXPLAIN', 'ANALYZE',
  'GRANT', 'REVOKE',
  'BEGIN', 'COMMIT', 'ROLLBACK', 'TRANSACTION',
  'IF', 'EXISTS', 'CASCADE', 'RESTRICT',
  'TRUE', 'FALSE',
])

function isKeyword(word: string): boolean {
  return KEYWORDS.has(word.toUpperCase())
}

function tokenizeSql(sql: string): string[] {
  const tokens: string[] = []
  let i = 0
  const len = sql.length

  while (i < len) {
    // Whitespace
    if (/\s/.test(sql[i])) {
      tokens.push(' ')
      i++
      continue
    }

    // Single-line comments
    if (sql[i] === '-' && sql[i + 1] === '-') {
      let comment = '--'
      i += 2
      while (i < len && sql[i] !== '\n') {
        comment += sql[i]
        i++
      }
      tokens.push(comment)
      continue
    }

    // Multi-line comments
    if (sql[i] === '/' && sql[i + 1] === '*') {
      let comment = '/*'
      i += 2
      while (i < len && !(sql[i] === '*' && sql[i + 1] === '/')) {
        comment += sql[i]
        i++
      }
      comment += '*/'
      if (i < len) i += 2
      tokens.push(comment)
      continue
    }

    // String literals (single quotes)
    if (sql[i] === "'") {
      let str = "'"
      i++
      while (i < len && sql[i] !== "'") {
        if (sql[i] === "'") {
          str += "''"
          i++
          continue
        }
        str += sql[i]
        i++
      }
      if (i < len) { str += "'"; i++ }
      tokens.push(str)
      continue
    }

    // Numbers
    if (/[0-9]/.test(sql[i]) || (sql[i] === '.' && i + 1 < len && /[0-9]/.test(sql[i + 1]))) {
      let num = ''
      while (i < len && /[0-9.]/.test(sql[i])) {
        num += sql[i]
        i++
      }
      tokens.push(num)
      continue
    }

    // Operators and punctuation
    if (/[()=<>!,;+\-*/%&|^~@#:]/.test(sql[i])) {
      // Check for multi-char operators
      if (sql[i] === '<' && sql[i + 1] === '=') { tokens.push('<='); i += 2; continue }
      if (sql[i] === '>' && sql[i + 1] === '=') { tokens.push('>='); i += 2; continue }
      if (sql[i] === '!' && sql[i + 1] === '=') { tokens.push('!='); i += 2; continue }
      if (sql[i] === '.' && sql[i + 1] === '.') { tokens.push('..'); i += 2; continue }
      tokens.push(sql[i])
      i++
      continue
    }

    // Identifiers and keywords
    let word = ''
    while (i < len && /[a-zA-Z0-9_$]/.test(sql[i])) {
      word += sql[i]
      i++
    }
    if (word) tokens.push(word)
  }

  return tokens
}

function beautifySql(sql: string, indentSize: number = 2): string {
  const indent = ' '.repeat(indentSize)
  const tokens = tokenizeSql(sql)
  const result: string[] = []
  let currentIndent = 0

  const indentKeywords = new Set([
    'SELECT', 'FROM', 'WHERE', 'AND', 'OR',
    'INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS', 'JOIN', 'ON',
    'ORDER', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'UNION',
    'INSERT', 'UPDATE', 'SET', 'VALUES', 'DELETE',
    'CREATE', 'ALTER', 'DROP',
  ])

  // Keywords that open a new logical clause
  const clauseKeywords = new Set([
    'SELECT', 'FROM', 'WHERE',
    'ORDER', 'GROUP', 'HAVING',
    'LIMIT', 'OFFSET', 'UNION',
    'INSERT', 'VALUES',
    'UPDATE', 'SET',
    'DELETE',
    'CREATE', 'ALTER', 'DROP',
    'BEGIN', 'COMMIT', 'ROLLBACK',
  ])

  let i = 0
  len: while (i < tokens.length) {
    const tok = tokens[i]

    // Skip spaces — we control formatting
    if (tok === ' ') { i++; continue }

    // Comments
    if (tok.startsWith('--') || tok.startsWith('/*')) {
      result.push(indent.repeat(currentIndent) + tok)
      result.push('\n')
      i++
      continue
    }

    // SQL keywords
    if (isKeyword(tok)) {
      const upper = tok.toUpperCase()

      if (clauseKeywords.has(upper)) {
        result.push('\n')
        result.push(indent.repeat(currentIndent) + upper)
      } else if (upper === 'AND' || upper === 'OR') {
        result.push('\n' + indent.repeat(currentIndent + 1) + upper)
      } else if (upper === 'ON') {
        result.push('\n' + indent.repeat(currentIndent + (upper === 'ON' && i > 0 && ['JOIN'].includes(tokens[i - 1]?.toUpperCase() ?? '') ? 1 : 1)) + upper)
      } else if (upper === 'INNER' || upper === 'LEFT' || upper === 'RIGHT' || upper === 'FULL' || upper === 'CROSS') {
        // Check if followed by JOIN
        const nextNonSpace = tokens.slice(i + 1).find(t => t !== ' ')
        if (nextNonSpace && nextNonSpace.toUpperCase() === 'JOIN') {
          result.push('\n' + indent.repeat(currentIndent) + upper)
        } else {
          result.push(' ' + upper)
        }
      } else if (upper === 'UNION') {
        const nextNonSpace = tokens.slice(i + 1).find(t => t !== ' ')
        if (nextNonSpace && nextNonSpace.toUpperCase() === 'ALL') {
          result.push('\n\n' + indent.repeat(currentIndent) + 'UNION ALL')
          i++ // skip ALL
        } else {
          result.push('\n\n' + indent.repeat(currentIndent) + upper)
        }
      } else if (upper === 'SET') {
        result.push('\n' + indent.repeat(currentIndent + 1) + upper)
      } else if (upper === 'VALUES') {
        result.push('\n' + indent.repeat(currentIndent + 1) + upper)
      } else if (upper === 'JOIN') {
        result.push(' ' + upper)
      } else if (upper === 'CASE') {
        currentIndent++
        result.push(upper + ' ')
      } else if (upper === 'END') {
        currentIndent = Math.max(0, currentIndent - 1)
        result.push(upper)
      } else {
        result.push(' ' + upper)
      }

      i++
      continue
    }

    // Punctuation
    if (tok === '(') {
      result.push('(')
      i++
      continue
    }

    if (tok === ')') {
      result.push(')')
      i++
      continue
    }

    if (tok === ',') {
      result.push(',')
      i++
      continue
    }

    if (tok === ';') {
      result.push(';\n')
      i++
      continue
    }

    if (tok === '.') {
      result.push('.')
      i++
      continue
    }

    // Everything else (identifiers, strings, numbers)
    result.push(tok)
    i++
  }

  // Clean up
  let output = result.join('')
  // Remove leading newline
  output = output.replace(/^\n+/, '')
  // Collapse multiple blank lines
  output = output.replace(/\n{3,}/g, '\n\n')
  // Remove trailing whitespace per line
  output = output.split('\n').map(l => l.trimEnd()).join('\n')
  // Ensure trailing newline only if there's content
  return output.trimEnd()
}

function minifySql(sql: string): string {
  const tokens = tokenizeSql(sql)
  let result = ''
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]
    if (tok === ' ') {
      // Collapse whitespace
      const prev = result.slice(-1)
      const next = tokens[i + 1]
      if (prev && next && next !== ',' && next !== ';' && prev !== ',' && next !== '(') {
        result += ' '
      }
      continue
    }
    result += tok
  }
  return result.replace(/\s+/g, ' ').replace(/\s*(,|;)\s*/g, '$1 ').trim()
}

export function SqlFormatterTool({ tool }: SqlFormatterToolProps) {
  const [raw, setRaw] = useState('')
  const [mode, setMode] = useState<Mode>('beautify')
  const [output, setOutput] = useState('')
  const [copied, setCopied] = useState(false)
  const [keywordSize, setKeywordSize] = useState(2)
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stats = useMemo(() => {
    if (!output) return null
    return {
      originalLen: raw.length,
      outputLen: output.length,
      ratio: raw.length > 0 ? (((raw.length - output.length) / raw.length) * 100).toFixed(1) : '0',
    }
  }, [raw, output])

  const handleFormat = useCallback(() => {
    if (!raw.trim()) { setOutput(''); return }
    const result = mode === 'beautify' ? beautifySql(raw, keywordSize) : minifySql(raw)
    setOutput(result)
  }, [raw, mode, keywordSize])

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
    a.download = mode === 'beautify' ? 'formatted.sql' : 'minified.sql'
    a.click()
    URL.revokeObjectURL(url)
  }, [output, mode])

  const handleClear = useCallback(() => {
    setRaw('')
    setOutput('')
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
                {mode === 'beautify' ? 'Formatted' : 'Minified'} successfully
              </div>
              <div className="text-xs text-muted">
                {stats.originalLen.toLocaleString()} → {stats.outputLen.toLocaleString()} chars
                {mode === 'minify' && (
                  <span className="text-emerald-300 ml-1">
                    ({Math.abs(parseFloat(stats.ratio)).toFixed(1)}% {parseFloat(stats.ratio) >= 0 ? 'reduction' : 'increase'})
                  </span>
                )}
              </div>
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
              <Database className="h-4 w-4 text-muted" />
              <span className="text-xs font-semibold uppercase text-muted">SQL Input</span>
            </div>
            {raw && (
              <button type="button" onClick={handleClear} className="text-xs text-accent hover:text-accent/80">
                Clear
              </button>
            )}
          </div>
          <textarea
            value={raw}
            onChange={(e) => { setRaw(e.target.value); setOutput('') }}
            className="w-full min-h-[180px] p-3 border border-border rounded-lg bg-base/50 text-sm font-mono resize-y focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            placeholder={"SELECT id, name FROM users WHERE status = 'active' ORDER BY name ASC"}
            spellCheck={false}
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <Button onClick={handleFormat} disabled={!raw.trim()}>
            {mode === 'beautify' ? <><AlignLeft className="mr-2 h-4 w-4" /> Beautify SQL</> : <><Minimize2 className="mr-2 h-4 w-4" /> Minify SQL</>}
          </Button>
        </div>

        {output && (
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-accent" />
                <span className="text-xs font-semibold uppercase text-muted">{mode === 'beautify' ? 'Formatted' : 'Minified'} SQL</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" className="h-7 px-2 text-xs" onClick={handleCopy}>
                  {copied ? <CheckCircle className="mr-1 h-3 w-3 text-emerald-400" /> : <Copy className="mr-1 h-3 w-3" />}
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
                <Button variant="ghost" className="h-7 px-2 text-xs" onClick={handleDownload}>
                  <Download className="mr-1 h-3 w-3" /> Download
                </Button>
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
