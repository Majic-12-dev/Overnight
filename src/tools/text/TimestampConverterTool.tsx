import { useCallback, useEffect, useRef, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Copy, CheckCircle, Clock } from 'lucide-react'

type ToolProps = {
  tool: ToolDefinition
}

// --- Format helpers ---

function formatDate(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  })
}

function formatISO(ts: number): string {
  return new Date(ts).toISOString()
}

function isMsTimestamp(value: number): boolean {
  // Heuristic: if value > 1 trillion, it's milliseconds
  return value > 1e12
}

function toSeconds(ts: number): number {
  return isMsTimestamp(ts) ? ts / 1000 : ts
}

export function TimestampConverterTool({ tool }: ToolProps) {
  const [now, setNow] = useState(() => Date.now())
  const [inputValue, setInputValue] = useState('')

  // Conversion results
  const [tsResult, setTsResult] = useState<{ local: string; iso: string } | null>(null)
  const [dateResult, setDateResult] = useState<string | null>(null) // formatted ts

  // Copy states
  const [copiedTsLocal, setCopiedTsLocal] = useState(false)
  const [copiedIso, setCopiedIso] = useState(false)
  const [copiedDateTs, setCopiedDateTs] = useState(false)

  const copiedTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Live clock: update every second
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      copiedTimeouts.current.forEach((id) => clearTimeout(id))
      copiedTimeouts.current.clear()
    }
  }, [])

  // --- Copy helpers ---
  const handleCopy = useCallback(
    (text: string, key: 'local' | 'iso' | 'date-ts') => {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          const setter =
            key === 'local'
              ? setCopiedTsLocal
              : key === 'iso'
                ? setCopiedIso
                : setCopiedDateTs
          setter(true)
          const prev = copiedTimeouts.current.get(key)
          if (prev) clearTimeout(prev)
          const id = setTimeout(() => setter(false), 2000)
          copiedTimeouts.current.set(key, id)
        })
        .catch(() => {
          // ignore
        })
    },
    [],
  )

  // --- Convert timestamp to date ---
  const handleConvertTimestamp = useCallback((raw: string) => {
    if (!raw.trim()) {
      setTsResult(null)
      return
    }

    const numeric = parseFloat(raw.trim())
    if (Number.isNaN(numeric)) {
      setTsResult(null)
      return
    }

    const seconds = toSeconds(numeric)
    const local = formatDate(seconds * 1000)
    const iso = formatISO(seconds * 1000)

    setTsResult({ local, iso })
    setDateResult(null)
    setInputValue(raw)
  }, [])

  // --- Convert date string to timestamp ---
  const handleConvertDate = useCallback((raw: string) => {
    if (!raw.trim()) {
      setDateResult(null)
      return
    }

    const parsed = new Date(raw)
    if (isNaN(parsed.getTime())) {
      setDateResult('Invalid date')
      return
    }

    const ts = Math.floor(parsed.getTime() / 1000)
    setDateResult(ts.toString())
    setTsResult(null)
    setInputValue(raw)
  }, [])

  // --- Fill current time ---
  const handleCurrentTime = useCallback(() => {
    const ts = Math.floor(Date.now() / 1000).toString()
    setInputValue(ts)
    const local = formatDate(Date.now())
    const iso = formatISO(Date.now())
    setTsResult({ local, iso })
    setDateResult(null)
  }, [])

  // Detect input type on Enter
  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        const isNumeric = /^\d+$/.test(inputValue.trim())
        if (isNumeric) {
          handleConvertTimestamp(inputValue)
        } else {
          handleConvertDate(inputValue)
        }
      }
    },
    [inputValue, handleConvertTimestamp, handleConvertDate],
  )

  // Now display values
  const nowSeconds = Math.floor(now / 1000)

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Current Unix Time</div>
            <div className="font-mono text-lg text-emerald-300">{nowSeconds}</div>
            <div className="text-xs text-muted">{new Date(now).toISOString()}</div>
          </div>
          <Button onClick={handleCurrentTime} className="w-full">
            <Clock className="mr-2 h-4 w-4" />
            Use Current Time
          </Button>

          {/* Timestamp → Date result */}
          {tsResult && (
            <div className="space-y-2">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                <div className="text-xs font-semibold text-emerald-400 mb-2">Local Date/Time</div>
                <div className="font-mono text-sm text-emerald-300">{tsResult.local}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-muted">
                    {isMsTimestamp(parseFloat(inputValue)) ? '(ms detected)' : '(seconds)'}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      className="h-6 text-[10px]"
                      onClick={() => handleCopy(tsResult.local, 'local')}
                    >
                      {copiedTsLocal ? (
                        <CheckCircle className="mr-1 h-3 w-3 text-green-400" />
                      ) : (
                        <Copy className="mr-1 h-3 w-3" />
                      )}
                      Copy
                    </Button>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-blue-500/10 bg-blue-500/5 p-3">
                <div className="text-xs font-semibold text-blue-400 mb-2">ISO 8601</div>
                <div className="font-mono text-sm text-blue-300">{tsResult.iso}</div>
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    className="h-6 text-[10px]"
                    onClick={() => handleCopy(tsResult.iso, 'iso')}
                  >
                    {copiedIso ? (
                      <CheckCircle className="mr-1 h-3 w-3 text-green-400" />
                    ) : (
                      <Copy className="mr-1 h-3 w-3" />
                    )}
                    Copy
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Date → Timestamp result */}
          {dateResult && (
            <div className="rounded-xl border border-purple-500/20 bg-purple-500/10 p-3">
              <div className="text-xs font-semibold text-purple-400 mb-2">Unix Timestamp</div>
              <div className="font-mono text-lg text-purple-300">
                {dateResult === 'Invalid date' ? dateResult : dateResult}
              </div>
              {dateResult !== 'Invalid date' && (
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    className="h-6 text-[10px]"
                    onClick={() => handleCopy(dateResult, 'date-ts')}
                  >
                    {copiedDateTs ? (
                      <CheckCircle className="mr-1 h-3 w-3 text-green-400" />
                    ) : (
                      <Copy className="mr-1 h-3 w-3" />
                    )}
                    Copy
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4">
          {/* Input section */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase text-muted">
              Enter a Unix timestamp or date/time string
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value)
                  setTsResult(null)
                  setDateResult(null)
                }}
                onKeyDown={handleInputKeyDown}
                placeholder="e.g. 1700000000 or 2024-06-15T12:00:00Z"
                className="w-full h-10 rounded-xl border border-border bg-base/70 px-3 text-sm font-mono text-text shadow-inner focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  const isNumeric = /^\d+$/.test(inputValue.trim())
                  if (isNumeric) {
                    handleConvertTimestamp(inputValue)
                  } else {
                    handleConvertDate(inputValue)
                  }
                }}
                disabled={!inputValue.trim()}
              >
                Convert
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setInputValue('')
                  setTsResult(null)
                  setDateResult(null)
                }}
              >
                Clear
              </Button>
            </div>
          </div>

          {/* Examples */}
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Examples</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setInputValue('1700000000')
                  handleConvertTimestamp('1700000000')
                }}
                className="text-left rounded-lg border border-border bg-base/50 px-3 py-2 hover:bg-panel text-muted hover:text-text"
              >
                <span className="font-mono">1700000000</span> →{' '}
                {(() => {
                  const d = new Date(1700000000 * 1000)
                  return d.toLocaleDateString()
                })()}
              </button>
              <button
                type="button"
                onClick={() => {
                  setInputValue('2025-01-01T00:00:00Z')
                  handleConvertDate('2025-01-01T00:00:00Z')
                }}
                className="text-left rounded-lg border border-border bg-base/50 px-3 py-2 hover:bg-panel text-muted hover:text-text"
              >
                <span className="font-mono">2025-01-01</span> →{' '}
                {Math.floor(new Date('2025-01-01T00:00:00Z').getTime() / 1000)}
              </button>
            </div>
          </div>
        </div>
      </div>
    </BaseToolLayout>
  )
}
