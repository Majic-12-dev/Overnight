import { useCallback, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Copy, CheckCircle, KeyRound, ShieldCheck, Clock, XCircle, AlertTriangle } from 'lucide-react'

type ToolProps = {
  tool: ToolDefinition
}

type DecodedHeader = Record<string, unknown>
type DecodedPayload = Record<string, unknown>

type JwtState = {
  header: DecodedHeader | null
  payload: DecodedPayload | null
  rawHeader: string | null
  rawPayload: string | null
  rawSignature: string | null
  valid: boolean
  error: string | null
  expiryInfo: {
    present: boolean
    expired: boolean
    expiresAt: Date | null
    issuedAt: Date | null
    timeRemaining: string | null
  } | null
}

/**
 * Decode base64url to a string. Adds padding if necessary.
 */
function base64UrlDecode(input: string): string {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4 !== 0) {
    base64 += '='
  }
  try {
    return decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    )
  } catch {
    // Fallback for non-URL-safe characters
    return atob(base64)
  }
}

function parseJwt(token: string): JwtState {
  const trimmed = token.trim()
  const parts = trimmed.split('.')

  if (parts.length !== 3) {
    return {
      header: null,
      payload: null,
      rawHeader: null,
      rawPayload: null,
      rawSignature: null,
      valid: false,
      error: `Invalid JWT structure: expected 3 dot-separated parts, got ${parts.length}.`,
      expiryInfo: null,
    }
  }

  const [rawHeader, rawPayload, rawSignature] = parts

  let header: DecodedHeader
  let payload: DecodedPayload

  try {
    header = JSON.parse(base64UrlDecode(rawHeader))
  } catch {
    return {
      header: null,
      payload: null,
      rawHeader,
      rawPayload,
      rawSignature,
      valid: false,
      error: 'Failed to decode JWT header — malformed base64url or invalid JSON.',
      expiryInfo: null,
    }
  }

  try {
    payload = JSON.parse(base64UrlDecode(rawPayload))
  } catch {
    return {
      header,
      payload: null,
      rawHeader,
      rawPayload,
      rawSignature,
      valid: false,
      error: 'Failed to decode JWT payload — malformed base64url or invalid JSON.',
      expiryInfo: null,
    }
  }

  // Expiry analysis
  const exp = payload.exp
  const iat = payload.iat
  const now = Date.now()

  let expiryInfo: JwtState['expiryInfo'] = null
  if (exp !== undefined || iat !== undefined) {
    const expNum = typeof exp === 'number' ? exp : undefined
    const iatNum = typeof iat === 'number' ? iat : undefined
    const expiresAt = expNum !== undefined ? new Date(expNum * 1000) : null
    const issuedAt = iatNum !== undefined ? new Date(iatNum * 1000) : null
    const expired = expiresAt !== null && expNum !== undefined ? now > expNum * 1000 : false

    let timeRemaining: string | null = null
    if (expiresAt !== null && !expired && expNum !== undefined) {
      const diff = expNum * 1000 - now
      if (diff > 0) {
        const days = Math.floor(diff / 86400000)
        const hours = Math.floor((diff % 86400000) / 3600000)
        const mins = Math.floor((diff % 3600000) / 60000)
        const secs = Math.floor((diff % 60000) / 1000)
        const parts: string[] = []
        if (days > 0) parts.push(`${days}d`)
        if (hours > 0) parts.push(`${hours}h`)
        if (mins > 0) parts.push(`${mins}m`)
        parts.push(`${secs}s`)
        timeRemaining = parts.join(' ')
      }
    }

    expiryInfo = {
      present: exp !== undefined || iat !== undefined,
      expired,
      expiresAt,
      issuedAt,
      timeRemaining,
    }
  }

  return {
    header,
    payload,
    rawHeader,
    rawPayload,
    rawSignature,
    valid: true,
    error: null,
    expiryInfo,
  }
}

function formatValue(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

function CopyableCodeBlock({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [value])

  return (
    <div className='space-y-1.5'>
      <div className='flex items-center justify-between'>
        <span className='text-xs font-semibold uppercase tracking-wide text-muted'>{label}</span>
        <Button variant='ghost' className='h-6 text-[10px]' onClick={handleCopy}>
          {copied ? (
            <CheckCircle className='mr-1 h-3 w-3 text-green-400' />
          ) : (
            <Copy className='mr-1 h-3 w-3' />
          )}
          Copy
        </Button>
      </div>
      <pre className='max-h-48 overflow-auto rounded-lg bg-base/80 p-3 text-xs font-mono text-text whitespace-pre-wrap break-all border border-border'>
        {value}
      </pre>
    </div>
  )
}

export function JwtInspectorTool({ tool }: ToolProps) {
  const [input, setInput] = useState('')
  const [decoded, setDecoded] = useState<JwtState | null>(null)

  const handleInspect = useCallback(() => {
    if (!input.trim()) {
      setDecoded({
        header: null,
        payload: null,
        rawHeader: null,
        rawPayload: null,
        rawSignature: null,
        valid: false,
        error: 'Please paste a JWT token to inspect.',
        expiryInfo: null,
      })
      return
    }
    setDecoded(parseJwt(input))
  }, [input])

  const handleClear = useCallback(() => {
    setInput('')
    setDecoded(null)
  }, [])

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className='space-y-4 text-sm'>
          <Badge className='border-0 bg-accent/15 text-accent'>Offline • Client-side only</Badge>
          <div className='rounded-lg bg-base/60 p-3 text-xs text-muted space-y-1'>
            <p className='font-medium text-text'>How it works</p>
            <p>Paste a JSON Web Token to decode its header and payload. No keys are required — this tool only reads the publicly visible claims.</p>
          </div>
          <Button onClick={handleInspect} className='w-full'>
            <KeyRound className='mr-2 h-4 w-4' />
            Inspect Token
          </Button>
        </div>
      }
    >
      <div className='space-y-4'>
        <div className='space-y-2'>
          <label htmlFor='jwt-input' className='text-sm font-medium text-text'>
            JWT Token
          </label>
          <textarea
            id='jwt-input'
            rows={4}
            placeholder='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className='w-full rounded-xl border border-border bg-base/70 px-3 py-2 text-sm font-mono text-text placeholder:text-muted/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y'
          />
        </div>

        {decoded === null && (
          <div className='rounded-xl border border-border bg-base/60 px-4 py-6 text-center text-sm text-muted'>
            Paste a JWT token and click Inspect.
          </div>
        )}

        {decoded !== null && !decoded.valid && decoded.error && (
          <Card className='flex items-start gap-3 border border-red-500/50 bg-red-500/10'>
            <XCircle className='mt-0.5 h-5 w-5 flex-shrink-0 text-red-400' />
            <div className='text-sm text-red-200'>{decoded.error}</div>
          </Card>
        )}

        {decoded !== null && decoded.valid && (
          <div className='space-y-6'>
            {/* Validity banner */}
            <Card className='flex items-center gap-3 border border-green-500/30 bg-green-500/10'>
              <ShieldCheck className='h-5 w-5 flex-shrink-0 text-green-400' />
              <div>
                <div className='text-sm font-medium text-green-200'>Valid JWT Structure</div>
                <div className='text-xs text-muted'>Header and payload decoded successfully.</div>
              </div>
            </Card>

            {/* Algorithm badge */}
            {decoded.header && typeof decoded.header.alg === 'string' && (
              <div className='flex gap-2'>
                <Badge className='bg-blue-500/15 text-blue-300 border-0'>
                  Algorithm: {decoded.header.alg}
                </Badge>
                {typeof decoded.header.typ === 'string' && (
                  <Badge className='bg-amber-500/15 text-amber-300 border-0'>
                    Type: {decoded.header.typ}
                  </Badge>
                )}
              </div>
            )}

            {/* Expiry info */}
            {decoded.expiryInfo && decoded.expiryInfo.present && (
              <Card className='space-y-3'>
                <div className='flex items-center gap-2 text-sm font-semibold text-text'>
                  <Clock className='h-4 w-4' />
                  Token Timeline
                </div>
                {decoded.expiryInfo.issuedAt && (
                  <div className='flex items-center justify-between text-xs'>
                    <span className='text-muted'>Issued At</span>
                    <span className='font-mono text-text'>
                      {decoded.expiryInfo.issuedAt.toLocaleString()}
                    </span>
                  </div>
                )}
                {decoded.expiryInfo.expiresAt && (
                  <div className='flex items-center justify-between text-xs'>
                    <span className='text-muted'>Expires At</span>
                    <span className='font-mono text-text'>
                      {decoded.expiryInfo.expiresAt.toLocaleString()}
                    </span>
                  </div>
                )}
                {decoded.expiryInfo.expired ? (
                  <div className='flex items-center gap-2 rounded-lg bg-red-500/10 p-2 text-xs'>
                    <AlertTriangle className='h-3.5 w-3.5 text-red-400' />
                    <span className='text-red-300 font-medium'>Token has expired</span>
                  </div>
                ) : decoded.expiryInfo.timeRemaining ? (
                  <div className='flex items-center gap-2 rounded-lg bg-green-500/10 p-2 text-xs'>
                    <Clock className='h-3.5 w-3.5 text-green-400' />
                    <span className='text-green-300 font-medium'>
                      Expires in {decoded.expiryInfo.timeRemaining}
                    </span>
                  </div>
                ) : null}
              </Card>
            )}

            {/* Header */}
            <CopyableCodeBlock
              label='Header'
              value={formatValue(decoded.header)}
            />

            {/* Payload */}
            {decoded.payload && (
              <CopyableCodeBlock
                label='Payload'
                value={formatValue(decoded.payload)}
              />
            )}
          </div>
        )}
      </div>
    </BaseToolLayout>
  )
}
