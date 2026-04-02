import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ShieldCheck, AlertTriangle, CheckCircle2, XCircle, Eye, EyeOff } from 'lucide-react'

type PasswordAuditorToolProps = {
  tool: ToolDefinition
}

type AuditResult = {
  password: string
  score: number
  label: 'Very Weak' | 'Weak' | 'Fair' | 'Strong' | 'Very Strong'
  entropy: number
  length: number
  hasLower: boolean
  hasUpper: boolean
  hasDigit: boolean
  hasSymbol: boolean
  hasRepeat: boolean
  hasCommonWord: boolean
  crackedTime: string
  suggestions: string[]
}

const COMMON_PATTERNS = [
  'password', '123456', '12345678', 'qwerty', 'abc123', 'monkey', 'master',
  'dragon', '111111', 'baseball', 'iloveyou', 'trustno1', 'sunshine',
  'letmein', 'football', 'shadow', 'michael', 'access', 'hello', 'charlie',
  'donald', 'admin', 'welcome', 'login', 'princess', 'starwars', 'solo',
  'passw0rd', 'hunter2', 'changeme', 'computer', 'internet', 'service',
  'default', 'test', 'guest', 'root', 'pass', 'secret',
  '000000', '11111111', '1234567890', 'qwerty123', 'password1',
  'Password1', 'Passw0rd', 'Admin123',
]

const KEYBOARD_PATTERNS = ['qwerty', 'asdf', 'zxcv', '1234', 'abcdef', 'qazwsx']

function getCharsetSize(pw: string): number {
  let size = 0
  if (/[a-z]/.test(pw)) size += 26
  if (/[A-Z]/.test(pw)) size += 26
  if (/\d/.test(pw)) size += 10
  if (/[^a-zA-Z0-9]/.test(pw)) size += 32
  return size || 1
}

function estimateEntropy(pw: string): number {
  const charset = getCharsetSize(pw)
  return Math.floor(pw.length * Math.log2(charset))
}

function estimateCrackTime(entropy: number): string {
  const guessesPerSecond = 1e11
  const totalGuesses = 2 ** entropy
  const seconds = totalGuesses / guessesPerSecond
  if (seconds < 1) return 'Instantly'
  if (seconds < 60) return `${Math.round(seconds)} seconds`
  if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`
  if (seconds < 86400) return `${Math.round(seconds / 3600)} hours`
  if (seconds < 31536000) return `${Math.round(seconds / 86400)} days`
  if (seconds < 31536000 * 1e3) return `${Math.round(seconds / 31536000)} years`
  if (seconds < 31536000 * 1e6) return `${Math.round(seconds / 31536000 / 1e3)}K years`
  return 'Centuries+'
}

function auditPassword(password: string): AuditResult {
  const suggestions: string[] = []
  const hasLower = /[a-z]/.test(password)
  const hasUpper = /[A-Z]/.test(password)
  const hasDigit = /\d/.test(password)
  const hasSymbol = /[^a-zA-Z0-9]/.test(password)
  const length = password.length
  const hasRepeat = /(.)\1{2,}/.test(password)
  const hasCommonWord = COMMON_PATTERNS.some(p => password.toLowerCase().includes(p))
  const hasKeyboard = KEYBOARD_PATTERNS.some(p => password.toLowerCase().includes(p))

  let score = 0
  score += Math.min(length * 6, 30)
  if (hasLower) score += 5
  if (hasUpper) score += 10
  if (hasDigit) score += 10
  if (hasSymbol) score += 15
  const charTypes = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length
  score += charTypes * 5
  const entropy = estimateEntropy(password)
  score += Math.min(entropy / 4, 15)
  if (hasCommonWord) score -= 30
  if (hasKeyboard) score -= 15
  if (hasRepeat) score -= 10
  if (length < 8) score -= 15
  else if (length < 12) score -= 5
  score = Math.max(0, Math.min(100, Math.round(score)))

  let label: AuditResult['label']
  if (score < 20) label = 'Very Weak'
  else if (score < 40) label = 'Weak'
  else if (score < 60) label = 'Fair'
  else if (score < 80) label = 'Strong'
  else label = 'Very Strong'

  if (length < 12) suggestions.push('Use at least 12 characters for better security.')
  if (!hasUpper) suggestions.push('Add uppercase letters.')
  if (!hasLower) suggestions.push('Add lowercase letters.')
  if (!hasDigit) suggestions.push('Add numbers.')
  if (!hasSymbol) suggestions.push('Add special characters (!@#$%, etc.).')
  if (hasCommonWord) suggestions.push('Avoid common passwords or personal info.')
  if (hasKeyboard) suggestions.push('Avoid keyboard patterns like qwerty.')
  if (hasRepeat) suggestions.push('Avoid repetitive character patterns.')
  if (suggestions.length === 0) suggestions.push('Great password! Consider using a passphrase for extra length.')

  return {
    password, length, score, label, entropy,
    hasLower, hasUpper, hasDigit, hasSymbol, hasRepeat, hasCommonWord,
    crackedTime: estimateCrackTime(entropy),
    suggestions,
  }
}

const SCORE_COLOR: Record<string, string> = {
  'Very Weak': 'bg-red-500/15 text-red-600',
  'Weak': 'bg-orange-500/15 text-orange-600',
  'Fair': 'bg-yellow-500/15 text-yellow-600',
  'Strong': 'bg-blue-500/15 text-blue-600',
  'Very Strong': 'bg-green-500/15 text-green-600',
}

export function PasswordAuditorTool({ tool }: PasswordAuditorToolProps) {
  const [passwords, setPasswords] = useState<string[]>([''])
  const [results, setResults] = useState<AuditResult[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [showPasswords, setShowPasswords] = useState<Record<number, boolean>>({})

  const handlePasswordChange = useCallback((index: number, value: string) => {
    setPasswords(prev => { const next = [...prev]; next[index] = value; return next })
  }, [])

  const addPasswordInput = useCallback(() => setPasswords(prev => [...prev, '']), [])

  const removePasswordInput = useCallback((index: number) => {
    setPasswords(prev => prev.filter((_, i) => i !== index))
  }, [])

  const togglePasswordVisibility = useCallback((index: number) => {
    setShowPasswords(prev => ({ ...prev, [index]: !prev[index] }))
  }, [])

  const runAudit = useCallback(() => {
    const nonEmpty = passwords.filter(p => p.trim())
    setResults(nonEmpty.map(auditPassword))
  }, [passwords])

  const handleProcess = useCallback(async (
    files: Array<{ file: File; name: string; size: number }>,
    context: { setProgress: (v: number) => void; setResult: (r: ReactNode | null) => void; setError: (m: string | null) => void }
  ) => {
    if (!files.length) { context.setError('No files selected.'); return }
    setIsProcessing(true)
    try {
      const contents = (await Promise.all(files.map(f => f.file.text()))).join('\n')
      const lines = contents.split('\n').map(l => l.trim()).filter(Boolean)
      setPasswords(lines)
      setResults(lines.map(auditPassword))
      context.setProgress(100)
      context.setResult(
        <Card className="space-y-3 border-border bg-base/60 p-4">
          <Badge className="border-0 bg-accent/15 text-accent">Audit complete</Badge>
          <div className="text-xs text-muted">Processed {lines.length} password(s) from {files.length} file(s).</div>
        </Card>
      )
    } catch (e: unknown) {
      context.setError(e instanceof Error ? e.message : 'Audit failed.')
    } finally {
      setIsProcessing(false)
    }
  }, [])

  const averageScore = useMemo(() => {
    if (results.length === 0) return 0
    return Math.round(results.reduce((a, b) => a + b.score, 0) / results.length)
  }, [results])

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      accept=".txt"
      instructions="Upload a text file with one password per line for batch auditing."
      onProcess={handleProcess}
      loading={isProcessing}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_280px] gap-6">
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text">Passwords to Audit</h3>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={addPasswordInput}>+ Add</Button>
                <Button variant="secondary" onClick={runAudit}>Audit All</Button>
              </div>
            </div>
            {passwords.map((pw, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type={showPasswords[i] ? 'text' : 'password'}
                    value={pw}
                    onChange={(e) => handlePasswordChange(i, e.target.value)}
                    placeholder="Enter password to audit..."
                    className="w-full rounded-lg border border-border bg-base p-2 text-sm font-mono text-text placeholder:text-muted"
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility(i)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-text transition"
                    tabIndex={-1}
                  >
                    {showPasswords[i] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwords.length > 1 && (
                  <Button variant="ghost" onClick={() => removePasswordInput(i)}>
                    <XCircle className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {results.length > 0 && (
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text">Results Summary</h3>
                <Badge className={`border-0 ${SCORE_COLOR[results[0]?.label || 'Weak'] || 'bg-muted/20'}`}>
                  Avg: {averageScore}/100
                </Badge>
              </div>
              <div className="grid gap-2">
                {results.map((r, i) => (
                  <div key={i} className="rounded-lg border border-border bg-base/30 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <code className="text-sm font-mono text-text">{'•'.repeat(Math.min(r.length, 20))}{r.length > 20 ? '…' : ''} ({r.length} chars)</code>
                      <Badge className={`border-0 ${SCORE_COLOR[r.label]}`}>{r.label} ({r.score}/100)</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className={r.length >= 12 ? 'text-green-500' : 'text-red-400'}>
                        {r.length >= 12 ? <CheckCircle2 className="h-3 w-3 inline mr-1" /> : <XCircle className="h-3 w-3 inline mr-1" />}
                        12+ chars
                      </span>
                      <span className={r.hasUpper ? 'text-green-500' : 'text-red-400'}>
                        {r.hasUpper ? <CheckCircle2 className="h-3 w-3 inline mr-1" /> : <XCircle className="h-3 w-3 inline mr-1" />}
                        A-Z
                      </span>
                      <span className={r.hasLower ? 'text-green-500' : 'text-red-400'}>
                        {r.hasLower ? <CheckCircle2 className="h-3 w-3 inline mr-1" /> : <XCircle className="h-3 w-3 inline mr-1" />}
                        a-z
                      </span>
                      <span className={r.hasDigit ? 'text-green-500' : 'text-red-400'}>
                        {r.hasDigit ? <CheckCircle2 className="h-3 w-3 inline mr-1" /> : <XCircle className="h-3 w-3 inline mr-1" />}
                        0-9
                      </span>
                      <span className={r.hasSymbol ? 'text-green-500' : 'text-red-400'}>
                        {r.hasSymbol ? <CheckCircle2 className="h-3 w-3 inline mr-1" /> : <XCircle className="h-3 w-3 inline mr-1" />}
                        Special
                      </span>
                      <span className={!r.hasRepeat ? 'text-green-500' : 'text-red-400'}>
                        {!r.hasRepeat ? <CheckCircle2 className="h-3 w-3 inline mr-1" /> : <XCircle className="h-3 w-3 inline mr-1" />}
                        No repeats
                      </span>
                      {!r.hasCommonWord && (
                        <span className="text-green-500">
                          <ShieldCheck className="h-3 w-3 inline mr-1" />
                          No common patterns
                        </span>
                      )}
                      {r.hasCommonWord && (
                        <span className="text-red-400">
                          <AlertTriangle className="h-3 w-3 inline mr-1" />
                          Contains common pattern
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted">
                      Entropy: <strong className="text-text">{r.entropy} bits</strong>
                      {' · '}Crack time: <strong className="text-red-400">{r.crackedTime}</strong>
                    </div>
                    {r.suggestions.length > 0 && (
                      <div className="text-xs space-y-0.5">
                        {r.suggestions.map((s, si) => (
                          <div key={si} className="flex items-start gap-1 text-muted">
                            <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                            <span>{s}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <Card className="space-y-4">
          <h3 className="text-sm font-semibold text-text">How It Works</h3>
          <div className="space-y-2 text-xs text-muted">
            <p><strong className="text-text">Entropy Analysis</strong> — Measures information density in bits based on character set and length.</p>
            <p><strong className="text-text">Pattern Detection</strong> — Flags common passwords, keyboard patterns, and repetitive sequences.</p>
            <p><strong className="text-text">Crack Time Estimation</strong> — Estimates time to crack at 100B guesses/sec (modern GPU cluster).</p>
            <p><strong className="text-text">Scoring</strong> — 0-100 scale based on length, variety, patterns, and entropy.</p>
          </div>
          <hr className="border-border" />
          <p className="text-xs text-muted">Upload a text file with one password per line for batch auditing.</p>
          <p className="text-xs text-red-400">⚠ Passwords never leave your device. All processing is done in-browser.</p>
        </Card>
      </div>
    </BaseToolLayout>
  )
}
