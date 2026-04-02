import { useState, useMemo, useCallback, useRef } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { FileKey, Clock, AlertTriangle, CheckCircle2, Copy, ShieldCheck, Eye, Trash2 } from 'lucide-react'

type JwtInspectorToolProps = {
  tool: ToolDefinition
}

type JwtStatus = 'valid' | 'expired' | 'not-yet-valid' | 'invalid' | 'empty'

type DecodedPayload = Record<string, unknown>
type DecodedHeader = Record<string, unknown>

function decodeBase64Url(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4 !== 0) base64 += '='
  return atob(base64)
}

function parseJwt(token: string): {
  header: DecodedHeader | null
  payload: DecodedPayload | null
  signature: string | null
  error: string | null
} {
  const parts = token.trim().split('.')
  if (parts.length !== 3) {
    return { header: null, payload: null, signature: null, error: 'JWT must have 3 parts (header.payload.signature)' }
  }

  try {
    const header = JSON.parse(decodeBase64Url(parts[0])) as DecodedHeader
    return { header, payload: null, signature: null, error: null }
  } catch {
    return { header: null, payload: null, signature: null, error: 'Invalid header encoding (not base64url JSON)' }
  }
}

function parsePayload(token: string): {
  payload: DecodedPayload | null
  error: string | null
} {
  const parts = token.trim().split('.')
  try {
    const payload = JSON.parse(decodeBase64Url(parts[1])) as DecodedPayload
    return { payload, error: null }
  } catch {
    return { payload: null, error: 'Invalid payload encoding (not base64url JSON)' }
  }
}

function getJwtStatus(payload: DecodedPayload | null): JwtStatus {
  if (!payload) return 'empty'

  const now = Math.floor(Date.now() / 1000)
  const nbf = typeof payload.nbf === 'number' ? payload.nbf : null
  const exp = typeof payload.exp === 'number' ? payload.exp : null

  if (nbf !== null && now < nbf) return 'not-yet-valid'
  if (exp !== null && now >= exp) return 'expired'
  return 'valid'
}

function formatTimestamp(ts: number | undefined): string {
  if (ts === undefined) return '—'
  return new Date(ts * 1000).toISOString()
}

function syntaxHighlight(json: string): string {
  return json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"([^"]+)":/g, '<span style="color:#7ee787">"$1"</span>:')
    .replace(/"([^"]*)"/g, '<span style="color:#a5d6ff">"$1"</span>')
    .replace(/\b(true|false)\b/g, '<span style="color:#ff7b72">$1</span>')
    .replace(/\b(null)\b/g, '<span style="color:#ffa657">$1</span>')
    .replace(/\b(\d+\.?\d*|0x[0-9a-fA-F]+)\b/g, '<span style="color:#ffa657">$1</span>')
}

export function JwtInspectorTool({ tool }: JwtInspectorToolProps) {
  const [jwt, setJwt] = useState('')
  const [copied, setCopied] = useState(false)
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { header, payload, signature, error } = useMemo(() => parseJwt(jwt), [jwt])
  const { payload: parsedPayload, error: payloadError } = useMemo(() => parsePayload(jwt), [jwt])

  const status = useMemo(() => getJwtStatus(parsedPayload), [parsedPayload])

  const headerJson = header ? JSON.stringify(header, null, 2) : ''
  const payloadJson = parsedPayload ? JSON.stringify(parsedPayload, null, 2) : ''

  const hasTimeClaims = parsedPayload !== null && (parsedPayload.exp !== undefined || parsedPayload.nbf !== undefined || parsedPayload.iat !== undefined)

  const handleCopy = useCallback(() => {
    if (!jwt.trim()) return
    navigator.clipboard.writeText(jwt.trim()).then(() => {
      setCopied(true)
      if (copyTimeout.current) clearTimeout(copyTimeout.current)
      copyTimeout.current = setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }, [jwt])

  const handleClear = useCallback(() => {
    setJwt('')
  }, [])

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">How to use</div>
            <ul className="text-xs text-muted space-y-1 list-disc list-inside">
              <li>Paste a JWT token (header.payload.signature)</li>
              <li>Sections are decoded and displayed automatically</li>
              <li>Time claims (exp, nbf, iat) are converted to human-readable dates</li>
              <li>Token validity is checked automatically</li>
            </ul>
          </div>

          {status !== 'empty' && (
            <div className={`rounded-xl border p-3 space-y-1 ${
              status === 'valid' ? 'border-emerald-500/20 bg-emerald-500/10' :
              status === 'expired' ? 'border-red-500/20 bg-red-500/10' :
              status === 'not-yet-valid' ? 'border-yellow-500/20 bg-yellow-500/10' :
              'border-red-500/20 bg-red-500/10'
            }`}>
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                {status === 'valid' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
                {status === 'expired' && <AlertTriangle className="h-3.5 w-3.5 text-red-400" />}
                {status === 'not-yet-valid' && <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" />}
                {status === 'invalid' && <AlertTriangle className="h-3.5 w-3.5 text-red-400" />}
                <span className={
                  status === 'valid' ? 'text-emerald-400' :
                  status === 'expired' ? 'text-red-400' :
                  status === 'not-yet-valid' ? 'text-yellow-400' :
                  'text-red-400'
                }>
                  {status === 'valid' && 'Token is valid'}
                  {status === 'expired' && 'Token has expired'}
                  {status === 'not-yet-valid' && 'Token is not yet valid (nbf)'}
                  {status === 'invalid' && 'Invalid JWT'}
                </span>
              </div>
            </div>
          )}

          {parsedPayload && hasTimeClaims && (
            <div className="rounded-xl border border-border bg-base/60 px-3 py-2 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                <Clock className="h-3 w-3" /> Time Claims
              </div>
              <div className="text-xs font-mono space-y-0.5 text-muted ml-5">
                {parsedPayload.exp !== undefined && (
                  <div className="flex justify-between">
                    <span>exp:</span>
                    <span className={status === 'expired' ? 'text-red-300' : 'text-text'}>{formatTimestamp(parsedPayload.exp as number)}</span>
                  </div>
                )}
                {parsedPayload.nbf !== undefined && (
                  <div className="flex justify-between">
                    <span>nbf:</span>
                    <span className="text-text">{formatTimestamp(parsedPayload.nbf as number)}</span>
                  </div>
                )}
                {parsedPayload.iat !== undefined && (
                  <div className="flex justify-between">
                    <span>iat:</span>
                    <span className="text-text">{formatTimestamp(parsedPayload.iat as number)}</span>
                  </div>
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
              <FileKey className="h-4 w-4 text-muted" />
              <span className="text-xs font-semibold uppercase text-muted">JWT Token</span>
            </div>
            <div className="flex items-center gap-2">
              {jwt && (
                <button type="button" onClick={handleClear} className="text-xs text-muted hover:text-text">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              {jwt && (
                <button type="button" onClick={handleCopy} className="text-xs text-accent hover:text-accent/80">
                  <Copy className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          <input
            type="text"
            value={jwt}
            onChange={(e) => setJwt(e.target.value)}
            placeholder="Paste JWT here (header.payload.signature)"
            className="w-full h-10 rounded-xl border border-border bg-[#0d1117] px-3 text-sm font-mono text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            spellCheck={false}
          />
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-red-400">
              <AlertTriangle className="h-3.5 w-3.5" /> Error
            </div>
            <pre className="text-xs text-red-300 mt-1 whitespace-pre-wrap">{error}</pre>
          </div>
        )}

        {/* Header Section */}
        {headerJson && (
          <Card className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-accent">
              <ShieldCheck className="h-3.5 w-3.5" /> Header (decoded)
            </div>
            <div
              className="rounded-lg border border-border bg-[#0d1117] p-3 text-sm font-mono max-h-[200px] overflow-auto"
              dangerouslySetInnerHTML={{ __html: syntaxHighlight(headerJson) }}
            />
          </Card>
        )}

        {/* Payload Section */}
        {payloadJson && (
          <Card className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
              <Eye className="h-3.5 w-3.5" /> Payload (decoded)
            </div>
            <div
              className="rounded-lg border border-border bg-[#0d1117] p-3 text-sm font-mono max-h-[300px] overflow-auto"
              dangerouslySetInnerHTML={{ __html: syntaxHighlight(payloadJson) }}
            />
          </Card>
        )}

        {/* Signature Section */}
        {signature && jwt.trim().split('.').length === 3 && (
          <Card className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted">
              <FileKey className="h-3.5 w-3.5" /> Signature
            </div>
            <div className="rounded-lg border border-border bg-[#0d1117] p-3 text-xs font-mono text-red-300 max-h-[100px] overflow-auto break-all">
              {jwt.trim().split('.')[2]}
            </div>
            <p className="text-[11px] text-muted">
              The signature is not decoded — it proves the token hasn't been tampered with.
              You need the server's secret key to verify it.
            </p>
          </Card>
        )}
      </div>
    </BaseToolLayout>
  )
}
