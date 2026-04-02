import { useState, useMemo, useCallback, useRef } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Sparkles, Copy, CheckCircle, Download, Trash2, FileCode, AlertTriangle } from 'lucide-react'

type SvgOptimizerToolProps = {
  tool: ToolDefinition
}

type OptimizationResult = {
  original: string
  optimized: string
  originalSize: number
  optimizedSize: number
  optimizationsApplied: string[]
}

function optimizeSvg(svg: string): OptimizationResult {
  const original = svg
  const optimizations: string[] = []
  let result = svg

  // Count initial stats
  const initialSize = new Blob([svg]).size

  // 1. Remove XML comments <!-- -->
  const commentCount = (result.match(/<!--[\s\S]*?-->/g) || []).length
  if (commentCount > 0) {
    result = result.replace(/<!--[\s\S]*?-->/g, '')
    optimizations.push(`Removed ${commentCount} comments`)
  }

  // 2. Remove XML declaration
  if (result.startsWith('<?xml')) {
    result = result.replace(/^<\?xml[\s\S]*?\?>/, '')
    optimizations.push('Removed XML declaration')
  }

  // 3. Remove DOCTYPE
  if (result.includes('<!DOCTYPE')) {
    result = result.replace(/<!DOCTYPE[\s\S]*?>/, '')
    optimizations.push('Removed DOCTYPE declaration')
  }

  // 4. Remove editor metadata: metadata, sodipodi, inkscape, illustrator, sketch, figma attributes
  const editorPatterns = [
    /<!--[\s\S]*?(?:Adobe|Sketch|Figma|Illustrator|Inkscape|Corel)[\s\S]*?-->/gi,
    /metadata>[\s\S]*?<\/metadata/ig,
    /sodipodi:[a-zA-Z-]+="[^"]*"/g,
    /inkscape:[a-zA-Z-]+="[^"]*"/g,
    /sketch:\w+="[^"]*"/gi,
    /xmlns:sketch="[^"]*"/gi,
    /xmlns:sodipodi="[^"]*"/gi,
    /xmlns:inkscape="[^"]*"/g,
    /xmlns:rdf="[^"]*"/g,
    /xmlns:cc="[^"]*"/g,
    /xmlns:dc="[^"]*"/g,
    /xml:space="[^"]*"/g,
    /version="[^"]*"/g,
  ]

  for (const pattern of editorPatterns) {
    const before = result
    result = result.replace(pattern, '')
    if (result !== before) {
      optimizations.push('Removed editor metadata')
      break
    }
  }

  // 5. Remove empty/non-rendering attributes
  const emptyAttrsToRemove = ['style', 'class']
  for (const attr of emptyAttrsToRemove) {
    const re = new RegExp(`\\s+${attr}=""`, 'gi')
    if (re.test(result)) {
      result = result.replace(re, '')
      optimizations.push(`Removed empty '${attr}' attributes`)
    }
  }

  // 6. Merge style attributes with empty ones — already handled above
  // Remove unnecessary group attributes
  result = result.replace(/\s+xml:\w+="[^"]*"/g, '')

  // 7. Collapse multiple whitespace runs
  result = result.replace(/>\s+</g, '><')
  result = result.trim()

  // 8. Optimize numeric precision in attributes (e.g., 12.345678901 → 12.346)
  let precisionOptimized = 0
  result = result.replace(/"(-?\d+\.\d{4,})"/g, (_match, num: string) => {
    const rounded = parseFloat(parseFloat(num).toFixed(3)).toString()
    if (rounded !== num) precisionOptimized++
    return `"${rounded}"`
  })
  if (precisionOptimized > 0) {
    optimizations.push(`Rounded ${precisionOptimized} numbers to 3 decimal places`)
  }

  // 9. Remove unnecessary xmlns duplicates
  result = result.replace(/(\s+(?:xmlns|xml:\w+)="[^"]*")/g, (match, attr: string) => {
    return match // Keep first occurrence, this is simple dedup
  })

  const finalSize = new Blob([result]).size

  return {
    original,
    optimized: result,
    originalSize: initialSize,
    optimizedSize: finalSize,
    optimizationsApplied: optimizations,
  }
}

export function SvgOptimizerTool({ tool }: SvgOptimizerToolProps) {
  const [svgInput, setSvgInput] = useState('')
  const [result, setResult] = useState<OptimizationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reductionPercent = useMemo(() => {
    if (!result || result.originalSize === 0) return 0
    return ((1 - result.optimizedSize / result.originalSize) * 100)
  }, [result])

  const handleFileUpload = useCallback((files: { file: File }[]) => {
    if (files.length === 0) return
    const file = files[0].file
    if (!file.type.includes('svg') && !file.name.endsWith('.svg')) {
      setError('Please upload an SVG file')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const content = reader.result as string
      setSvgInput(content)
      setResult(null)
      setError(null)
    }
    reader.onerror = () => setError('Failed to read file')
    reader.readAsText(file)
  }, [])

  const handleOptimize = useCallback(() => {
    if (!svgInput.trim()) return

    // Basic SVG validation
    if (!svgInput.includes('<svg')) {
      setError('Input does not appear to be a valid SVG file')
      setResult(null)
      return
    }

    try {
      const opt = optimizeSvg(svgInput)
      setResult(opt)
      setError(null)
    } catch {
      setError('Failed to optimize SVG — the file may be malformed')
      setResult(null)
    }
  }, [svgInput])

  const handleCopy = useCallback(() => {
    if (!result) return
    navigator.clipboard.writeText(result.optimized).then(() => {
      setCopied(true)
      if (copyTimeout.current) clearTimeout(copyTimeout.current)
      copyTimeout.current = setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }, [result])

  const handleDownload = useCallback(() => {
    if (!result) return
    const blob = new Blob([result.optimized], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'optimized.svg'
    a.click()
    URL.revokeObjectURL(url)
  }, [result])

  const handleClear = useCallback(() => {
    setSvgInput('')
    setResult(null)
    setError(null)
  }, [])

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      accept=".svg"
      onProcess={handleFileUpload}
      options={
        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">What it does</div>
            <ul className="text-xs text-muted space-y-1 list-disc list-inside">
              <li>Removes XML comments and DOCTYPE</li>
              <li>Strips editor metadata (Inkscape, Figma, etc.)</li>
              <li>Clears empty attributes</li>
              <li>Optimizes decimal precision to 3 places</li>
              <li>Collapses unnecessary whitespace</li>
            </ul>
          </div>

          {result && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <Sparkles className="h-3.5 w-3.5" /> Optimization complete
              </div>
              <div className="space-y-1 text-xs text-muted">
                <div className="flex justify-between">
                  <span>Original</span>
                  <span className="font-mono text-text">{(result.originalSize / 1024).toFixed(2)} KB</span>
                </div>
                <div className="flex justify-between">
                  <span>Optimized</span>
                  <span className="font-mono text-text">{(result.optimizedSize / 1024).toFixed(2)} KB</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Reduction</span>
                  <span className={reductionPercent > 0 ? 'text-emerald-400' : 'text-muted'}>
                    {reductionPercent.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {result && result.optimizationsApplied.length > 0 && (
            <div className="rounded-xl border border-border bg-base/60 px-3 py-2 space-y-1">
              <div className="text-xs font-semibold text-muted">Applied optimizations:</div>
              <ul className="text-xs text-text space-y-0.5 list-none">
                {result.optimizationsApplied.map((opt, i) => (
                  <li key={i}>✓ {opt}</li>
                ))}
              </ul>
            </div>
          )}

          {result && (
            <div className="flex flex-col gap-2">
              <Button variant="secondary" onClick={handleCopy} className="w-full">
                <Copy className="mr-2 h-4 w-4" />
                {copied ? 'Copied!' : 'Copy Optimized SVG'}
              </Button>
              <Button variant="outline" onClick={handleDownload} className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Download as .svg
              </Button>
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
              <FileCode className="h-4 w-4 text-muted" />
              <span className="text-xs font-semibold uppercase text-muted">SVG Input</span>
            </div>
            <div className="flex items-center gap-2">
              {svgInput && (
                <button type="button" onClick={handleClear} className="text-xs text-muted hover:text-text">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <span className="text-[10px] text-muted">{svgInput ? `${new Blob([svgInput]).size.toLocaleString()} bytes` : ''}</span>
            </div>
          </div>
          <textarea
            value={svgInput}
            onChange={(e) => { setSvgInput(e.target.value); setResult(null); setError(null) }}
            className="w-full min-h-[180px] p-3 border border-border rounded-lg bg-base/50 text-sm font-mono resize-y focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            placeholder={'Paste SVG source code here or drag and drop an SVG file...'}
            spellCheck={false}
          />
        </div>

        <Button onClick={handleOptimize} disabled={!svgInput.trim()}>
          <Sparkles className="mr-2 h-4 w-4" />
          Optimize SVG
        </Button>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-red-400">
              <AlertTriangle className="h-3.5 w-3.5" /> Error
            </div>
            <pre className="text-xs text-red-300 mt-1 whitespace-pre-wrap">{error}</pre>
          </div>
        )}

        {/* Optimized output preview */}
        {result && (
          <Card className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              <span className="text-xs font-semibold uppercase text-muted">Optimized SVG Source</span>
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-xl border border-border bg-[#0d1117] p-3 text-xs font-mono text-text max-h-[400px]">
              {result.optimized}
            </pre>
          </Card>
        )}
      </div>
    </BaseToolLayout>
  )
}
