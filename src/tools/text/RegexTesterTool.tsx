import { useState, useMemo, useCallback, useRef } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Card } from '@/components/ui/Card'
import { Copy, Regex, CheckCircle2, AlertTriangle } from 'lucide-react'

type ToolProps = {
  tool: ToolDefinition
}

type MatchInfo = {
  match: string
  index: number
  groups: (string | undefined)[]
  groupNames: Record<string, string | undefined>
}

type RegexResult = {
  valid: boolean
  matches: MatchInfo[]
  error: string | null
  replaceResult: string | null
  replaceError: string | null
}

export function RegexTesterTool({ tool }: ToolProps) {
  const [pattern, setPattern] = useState('')
  const [flags, setFlags] = useState('gi')
  const [testString, setTestString] = useState('')
  const [replacePattern, setReplacePattern] = useState('')
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flagOptions = useMemo(
    () => [
      { value: 'g', label: 'g — Global', checked: flags.includes('g') },
      { value: 'i', label: 'i — Case Insensitive', checked: flags.includes('i') },
      { value: 'm', label: 'm — Multiline', checked: flags.includes('m') },
      { value: 's', label: 's — Dot All', checked: flags.includes('s') },
      { value: 'u', label: 'u — Unicode', checked: flags.includes('u') },
      { value: 'y', label: 'y — Sticky', checked: flags.includes('y') },
    ],
    [flags],
  )

  const handleFlagToggle = useCallback((flag: string) => {
    setFlags((prev) =>
      prev.includes(flag) ? prev.replace(flag, '') : prev + flag,
    )
  }, [])

  const result = useMemo((): RegexResult => {
    if (!pattern || !testString) {
      return { valid: false, matches: [], error: null, replaceResult: null, replaceError: null }
    }

    let regex: RegExp
    try {
      regex = new RegExp(pattern, flags)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Invalid regex pattern'
      return { valid: false, matches: [], error: message, replaceResult: null, replaceError: null }
    }

    const matches: MatchInfo[] = []

    if (flags.includes('g')) {
      // Global search
      let match: RegExpExecArray | null
      let safety = 0
      const maxIterations = 10000
      while ((match = regex.exec(testString)) !== null && safety < maxIterations) {
        safety++
        if (match[0].length === 0) {
          regex.lastIndex++
          continue
        }
        matches.push({
          match: match[0],
          index: match.index,
          groups: Array.from(match).slice(1),
          groupNames: extractGroupNames(match),
        })
      }
    } else {
      // Single match
      const match = regex.exec(testString)
      if (match) {
        matches.push({
          match: match[0],
          index: match.index,
          groups: Array.from(match).slice(1),
          groupNames: extractGroupNames(match),
        })
      }
    }

    // Compute replace result
    let replaceResult: string | null = null
    let replaceError: string | null = null
    if (replacePattern) {
      try {
        // Use a fresh regex for each replace computation
        replaceResult = testString.replace(new RegExp(pattern, flags), replacePattern)
      } catch (e) {
        replaceError = e instanceof Error ? e.message : 'Replace failed'
      }
    }

    return { valid: true, matches, error: null, replaceResult, replaceError }
  }, [pattern, flags, testString, replacePattern])

  const highlightedString = useMemo(() => {
    if (!result.valid || result.matches.length === 0) return null

    // Build a list of non-overlapping segments with markup
    const segments: { text: string; isMatch: boolean }[] = []
    let lastIdx = 0

    for (const m of result.matches) {
      if (m.index > lastIdx) {
        segments.push({ text: testString.slice(lastIdx, m.index), isMatch: false })
      }
      segments.push({ text: m.match, isMatch: true })
      lastIdx = m.index + m.match.length
    }
    if (lastIdx < testString.length) {
      segments.push({ text: testString.slice(lastIdx), isMatch: false })
    }

    return (
      <div className="break-all whitespace-pre-wrap leading-relaxed">
        {segments.map((seg, i) =>
          seg.isMatch ? (
            <mark
              key={i}
              className="bg-emerald-500/30 text-emerald-300 rounded px-0.5 border border-emerald-500/40"
            >
              {seg.text}
            </mark>
          ) : (
            <span key={i} className="text-muted">
              {seg.text}
            </span>
          ),
        )}
      </div>
    )
  }, [result, testString])

  const handleCopy = useCallback((text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field)
      if (copyTimeout.current) clearTimeout(copyTimeout.current)
      copyTimeout.current = setTimeout(() => setCopiedField(null), 2000)
    }).catch(() => {})
  }, [])

  const handleCopyAllMatches = useCallback(() => {
    if (result.matches.length === 0) return
    const text = result.matches.map((m) => m.match).join('\n')
    handleCopy(text, 'all-matches')
  }, [result, handleCopy])

  const handleClear = useCallback(() => {
    setPattern('')
    setTestString('')
    setFlags('gi')
    setReplacePattern('')
  }, [])

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className="space-y-4 text-sm">
          {/* Flags */}
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Flags</div>
            <div className="grid grid-cols-2 gap-1.5">
              {flagOptions.map((f) => (
                <label
                  key={f.value}
                  className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg border transition cursor-pointer ${
                    flags.includes(f.value)
                      ? 'border-accent/50 bg-accent/10 text-accent'
                      : 'border-border/50 bg-base/40 text-muted hover:border-border'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={flags.includes(f.value)}
                    onChange={() => handleFlagToggle(f.value)}
                    className="sr-only"
                  />
                  <span className="font-mono text-xs">{f.value}</span>
                  <span className="text-[10px]">{f.label.split('—')[1]?.trim()}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Match summary */}
          {result.valid && result.matches.length > 0 && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {result.matches.length} match{result.matches.length !== 1 ? 'es' : ''} found
              </div>
              <div className="space-y-1 mt-2 max-h-48 overflow-auto">
                {result.matches.slice(0, 20).map((m, i) => (
                  <div key={i} className="text-xs font-mono">
                    <span className="text-muted">[{i}]</span>{' '}
                    <span className="text-emerald-300">{m.match}</span>{' '}
                    <span className="text-muted">@{m.index}</span>
                  </div>
                ))}
                {result.matches.length > 20 && (
                  <div className="text-xs text-muted">
                    …and {result.matches.length - 20} more
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                onClick={handleCopyAllMatches}
                className="w-full text-xs h-8 mt-2"
              >
                <Copy className="h-3 w-3 mr-2" />
                {copiedField === 'all-matches' ? 'Copied!' : 'Copy All Matches'}
              </Button>
            </div>
          )}

          {result.error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-red-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                Invalid Pattern
              </div>
              <div className="text-xs text-red-300">{result.error}</div>
            </div>
          )}

          {/* Replace result */}
          {result.replaceResult !== null && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase text-muted">Replace Result</div>
                <Button
                  variant="ghost"
                  onClick={() => handleCopy(result.replaceResult ?? '', 'replace')}
                  className="text-xs h-7 px-2"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  {copiedField === 'replace' ? 'Copied!' : 'Copy'}
                </Button>
              </div>
              <div className="rounded-lg border border-border bg-[#0d1117] p-2 text-xs font-mono text-emerald-300 max-h-32 overflow-auto whitespace-pre-wrap break-all">
                {result.replaceResult}
              </div>
            </div>
          )}

          {result.replaceError && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded p-2">
              {result.replaceError}
            </div>
          )}

          <Button variant="outline" onClick={handleClear} className="w-full">
            Clear All
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Pattern input */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Regex className="h-4 w-4 text-muted" />
            <span className="text-xs font-semibold uppercase text-muted">Regex Pattern</span>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1 rounded-xl border border-border bg-[#0d1117]">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm">/</span>
              <input
                type="text"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder="e.g. \\w+@\\w+\\.\\w+"
                className="w-full h-10 bg-transparent border-0 px-6 py-2 text-sm font-mono text-text focus:outline-none"
              />
            </div>
            <div className="flex items-center rounded-xl border border-border bg-[#0d1117] px-2 text-sm font-mono text-accent">
              /{flags || ''}
            </div>
          </div>
        </div>

        {/* Test string */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-muted">Test String</span>
            <button
              type="button"
              className="text-xs text-accent hover:text-accent/80"
              onClick={() => setTestString('')}
            >
              Clear
            </button>
          </div>
          <textarea
            value={testString}
            onChange={(e) => setTestString(e.target.value)}
            className="w-full min-h-[120px] p-3 border border-border rounded-lg bg-base/50 text-sm font-mono resize-y"
            placeholder="Paste text to test against…"
            spellCheck={false}
          />
        </div>

        {/* Highlighted result */}
        {highlightedString && (
          <Card className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-muted">
                Matches (highlighted)
              </span>
              <Button
                variant="ghost"
                onClick={() => handleCopy(testString, 'test-string')}
                className="text-xs h-7 px-2"
              >
                <Copy className="h-3 w-3 mr-1" />
                {copiedField === 'test-string' ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <div className="max-h-[300px] overflow-auto rounded-lg border border-border bg-[#0d1117] p-3 text-sm font-mono leading-relaxed">
              {highlightedString}
            </div>
          </Card>
        )}

        {/* Group details */}
        {result.valid &&
          result.matches.length > 0 &&
          result.matches.some((m) => m.groups.length > 0) && (
            <Card className="space-y-2">
              <span className="text-xs font-semibold uppercase text-muted">Match Groups</span>
              <div className="space-y-3 max-h-[300px] overflow-auto">
                {result.matches.slice(0, 20).map((m, i) => (
                  <div key={i} className="rounded-lg bg-base/40 border border-border/50 p-2 text-xs">
                    <div className="font-mono text-emerald-300 mb-1">
                      Match {i}: "{m.match}" (index {m.index})
                    </div>
                    {m.groups.length > 0 && (
                      <div className="ml-2 space-y-0.5">
                        {m.groups.map((g, gi) => (
                          <div key={gi} className="text-muted font-mono">
                            <span className="text-text">[{gi}]</span>{' '}
                            {g !== undefined ? `"${g}"` : 'undefined'}
                          </div>
                        ))}
                      </div>
                    )}
                    {Object.keys(m.groupNames).length > 0 && (
                      <div className="ml-2 mt-1 space-y-0.5">
                        {Object.entries(m.groupNames).map(([name, val]) => (
                          <div key={name} className="font-mono">
                            <span className="text-accent">{name}</span>
                            {' = '}
                            <span className="text-muted">
                              {val !== undefined ? `"${val}"` : 'undefined'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

        {/* Replace input */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase text-muted">Replace Pattern</span>
            <span className="text-xs text-muted">(optional)</span>
          </div>
          <input
            type="text"
            value={replacePattern}
            onChange={(e) => setReplacePattern(e.target.value)}
            placeholder="e.g. $1@$2 or replacement text"
            className="w-full h-10 rounded-xl border border-border bg-base/70 px-3 text-sm font-mono text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </div>
    </BaseToolLayout>
  )
}

function extractGroupNames(
  match: RegExpExecArray,
): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {}
  if (match.groups) {
    for (const [key, value] of Object.entries(match.groups)) {
      result[key] = value
    }
  }
  return result
}
