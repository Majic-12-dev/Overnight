import { useCallback, useEffect, useRef, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import {
  CheckCircle,
  Copy,
  Droplets,
  Eye,
  Palette,
} from 'lucide-react'

type ColorPickerToolProps = {
  tool: ToolDefinition
}

type RGB = { r: number; g: number; b: number }
type HSL = { h: number; s: number; l: number }

type ColorFormats = {
  hex: string
  rgb: RGB
  hsl: HSL
}

type CopyState = 'hex' | 'rgb' | 'hsl' | null

const MAX_HISTORY = 8

// --- Conversion helpers ---

function normalizeHex(hex: string): string {
  const cleaned = hex.replace('#', '').toUpperCase()
  if (cleaned.length === 3) {
    return '#' + cleaned.split('').map((c) => c + c).join('')
  }
  return '#' + cleaned.slice(0, 6)
}

function hexToRgb(hex: string): RGB {
  const cleaned = hex.replace('#', '')
  return {
    r: parseInt(cleaned.slice(0, 2), 16),
    g: parseInt(cleaned.slice(2, 4), 16),
    b: parseInt(cleaned.slice(4, 6), 16),
  }
}

function rgbToHex({ r, g, b }: RGB): string {
  return (
    '#' +
    [r, g, b]
      .map((x) => {
        const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16)
        return hex.length === 1 ? '0' + hex : hex
      })
      .join('')
  )
}

function rgbToHsl({ r, g, b }: RGB): HSL {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  }
}

function hslToRgb({ h, s, l }: HSL): RGB {
  s /= 100
  l /= 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return {
    r: Math.round(255 * f(0)),
    g: Math.round(255 * f(8)),
    b: Math.round(255 * f(4)),
  }
}

function hslToHex(hsl: HSL): string {
  return rgbToHex(hslToRgb(hsl))
}

function hexToHsl(hex: string): HSL {
  return rgbToHsl(hexToRgb(hex))
}

function computeFormats(hex: string): ColorFormats {
  const normalized = normalizeHex(hex)
  const rgb = hexToRgb(normalized)
  const hsl = rgbToHsl(rgb)
  return { hex: normalized, rgb, hsl }
}

// --- Contrast / luminance ---

function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  const vals = [r, g, b].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * vals[0] + 0.7152 * vals[1] + 0.0722 * vals[2]
}

function textColor(hex: string): 'text-white' | 'text-gray-900' {
  return luminance(hex) > 0.4 ? 'text-gray-900' : 'text-white'
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = luminance(hex1)
  const l2 = luminance(hex2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

function wcagLevel(ratio: number): { level: string; passes: boolean } {
  if (ratio >= 7) return { level: 'AAA', passes: true }
  if (ratio >= 4.5) return { level: 'AA', passes: true }
  return { level: 'Fail', passes: false }
}

export function ColorPickerTool({ tool }: ColorPickerToolProps) {
  const [hex, setHex] = useState('#3B82F6')
  const [history, setHistory] = useState<string[]>(['#3B82F6'])
  const [copied, setCopied] = useState<CopyState>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [hasEyeDropper, setHasEyeDropper] = useState(false)
  const copiedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const statusTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setHasEyeDropper(typeof window !== 'undefined' && 'EyeDropper' in window)
    return () => {
      if (copiedTimeout.current) clearTimeout(copiedTimeout.current)
      if (statusTimeout.current) clearTimeout(statusTimeout.current)
    }
  }, [])

  const formats = computeFormats(hex)

  const addToHistory = useCallback((newHex: string) => {
    const normalized = normalizeHex(newHex)
    setHistory((prev) => {
      const filtered = prev.filter((h) => h !== normalized)
      return [normalized, ...filtered].slice(0, MAX_HISTORY)
    })
  }, [])

  const handleNativePicker = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newHex = e.target.value
      setHex(newHex)
      addToHistory(newHex)
    },
    [addToHistory],
  )

  const handleEyeDropper = useCallback(async () => {
    try {
      if (!hasEyeDropper || !('EyeDropper' in window)) {
        setStatus('EyeDropper API is not available in this browser.')
        return
      }
      const dropper = new (window as any).EyeDropper()
      const result = await dropper.open()
      const newHex = result.sRGBHex
      setHex(newHex)
      addToHistory(newHex)
      setStatus(`Picked color: ${newHex.toUpperCase()}`)
    } catch {
      setStatus('Color picking was cancelled.')
    }
  }, [hasEyeDropper, addToHistory])

  const handleCopy = useCallback(
    async (format: CopyState) => {
      if (!format) return
      try {
        let text = ''
        switch (format) {
          case 'hex':
            text = formats.hex.toUpperCase()
            break
          case 'rgb':
            text = `rgb(${formats.rgb.r}, ${formats.rgb.g}, ${formats.rgb.b})`
            break
          case 'hsl':
            text = `hsl(${formats.hsl.h}, ${formats.hsl.s}%, ${formats.hsl.l}%)`
            break
        }
        await navigator.clipboard.writeText(text)
        setCopied(format)
        setStatus(`Copied ${text} to clipboard.`)
        if (copiedTimeout.current) clearTimeout(copiedTimeout.current)
        copiedTimeout.current = setTimeout(() => setCopied(null), 2000)
      } catch {
        setStatus('Failed to copy. Clipboard may be unavailable.')
      } finally {
        if (statusTimeout.current) clearTimeout(statusTimeout.current)
        statusTimeout.current = setTimeout(() => setStatus(null), 3000)
      }
    },
    [formats],
  )

  const handleHistoryPick = useCallback(
    (histHex: string) => {
      setHex(histHex)
    },
    [],
  )

  const bgWhite = '#FFFFFF'
  const bgDark = '#18181B'
  const ratioWhite = contrastRatio(formats.hex, bgWhite)
  const ratioDark = contrastRatio(formats.hex, bgDark)
  const levelWhite = wcagLevel(ratioWhite)
  const levelDark = wcagLevel(ratioDark)

  return (
    <BaseToolLayout title={tool.name} description={tool.description}>
      {/* Status bar */}
      {status && (
        <div className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-2 text-sm text-accent">
          {status}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        {/* Main picker area */}
        <div className="space-y-6">
          {/* Color picker + preview */}
          <Card className="p-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-center">
              {/* Native color input */}
              <div className="flex flex-col items-center gap-3">
                <label
                  htmlFor="color-native"
                  className="relative aspect-square w-36 cursor-pointer overflow-hidden rounded-2xl border-2 border-border shadow-lg transition hover:border-accent"
                  style={{ backgroundColor: formats.hex }}
                >
                  <input
                    id="color-native"
                    type="color"
                    value={formats.hex}
                    onChange={handleNativePicker}
                    className="pointer-events-none absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100" />
                </label>
                <div className="text-center">
                  <div className="font-mono text-lg font-bold text-text">
                    {formats.hex.toUpperCase()}
                  </div>
                </div>
              </div>

              {/* EyeDropper */}
              {hasEyeDropper && (
                <Button onClick={handleEyeDropper} variant="secondary" className="md:self-start">
                  <Eye className="mr-2 h-4 w-4" />
                  Pick from Screen
                </Button>
              )}
            </div>
          </Card>

          {/* Format display with copy */}
          <Card className="space-y-3 p-6">
            <h3 className="text-sm font-semibold text-text">Color Formats</h3>
            <div className="space-y-2">
              {([
                {
                  label: 'HEX',
                  value: formats.hex.toUpperCase(),
                  key: 'hex' as CopyState,
                },
                {
                  label: 'RGB',
                  value: `rgb(${formats.rgb.r}, ${formats.rgb.g}, ${formats.rgb.b})`,
                  key: 'rgb' as CopyState,
                },
                {
                  label: 'HSL',
                  value: `hsl(${formats.hsl.h}, ${formats.hsl.s}%, ${formats.hsl.l}%)`,
                  key: 'hsl' as CopyState,
                },
              ] as const).map((fmt) => (
                <div
                  key={fmt.key}
                  className="flex items-center justify-between rounded-xl border border-border bg-base/60 px-4 py-3"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium uppercase text-muted">{fmt.label}</span>
                    <span className="font-mono text-sm text-text">{fmt.value}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(fmt.key)}
                    className="shrink-0"
                  >
                    {copied === fmt.key ? (
                      <CheckCircle className="h-4 w-4 text-accent" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    {copied === fmt.key ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              ))}
            </div>
          </Card>

          {/* Contrast preview */}
          <Card className="space-y-3 p-6">
            <h3 className="text-sm font-semibold text-text">Contrast Preview</h3>
            <div className="grid grid-cols-2 gap-4">
              {/* White background */}
              <div
                className="flex flex-col items-center justify-center rounded-xl border border-border p-6"
                style={{ backgroundColor: bgWhite }}
              >
                <span
                  className={`text-xl font-bold ${textColor(bgWhite)}`}
                  style={{ color: formats.hex }}
                >
                  Sample Text
                </span>
                <span className="mt-2 text-xs text-muted">White background</span>
                <span className="mt-1 font-mono text-xs text-muted">{ratioWhite.toFixed(2)}:1</span>
                <span
                  className={`mt-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${levelWhite.passes ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                >
                  {levelWhite.level}
                </span>
              </div>
              {/* Dark background */}
              <div
                className="flex flex-col items-center justify-center rounded-xl border border-border p-6"
                style={{ backgroundColor: bgDark }}
              >
                <span
                  className={`text-xl font-bold ${textColor(bgDark)}`}
                  style={{ color: formats.hex }}
                >
                  Sample Text
                </span>
                <span className="mt-2 text-xs text-muted">Dark background</span>
                <span className="mt-1 font-mono text-xs text-muted">{ratioDark.toFixed(2)}:1</span>
                <span
                  className={`mt-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${levelDark.passes ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                >
                  {levelDark.level}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar: History */}
        <div className="space-y-4">
          <Card className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-accent" />
              <h3 className="text-sm font-semibold text-text">Recent Colors</h3>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {history.map((h) => {
                const isActive = h === formats.hex.toUpperCase()
                return (
                  <button
                    key={h}
                    type="button"
                    title={h}
                    onClick={() => handleHistoryPick(h)}
                    className={`relative aspect-square rounded-lg border-2 transition hover:scale-105 ${
                      isActive
                        ? 'border-accent ring-2 ring-accent/40'
                        : 'border-transparent hover:border-border'
                    }`}
                    style={{ backgroundColor: h }}
                  >
                    <span className="sr-only">{h}</span>
                  </button>
                )
              })}
              {Array.from({ length: Math.max(0, MAX_HISTORY - history.length) }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="aspect-square rounded-lg border border-dashed border-border"
                />
              ))}
            </div>
          </Card>

          {/* Harmonized swatches */}
          <Card className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-accent" />
              <h3 className="text-sm font-semibold text-text">Variations</h3>
            </div>
            <div className="space-y-2">
              {(() => {
                const hsl = { ...formats.hsl }
                const variations: { label: string; hex: string }[] = [
                  { label: 'Lighter', hex: normalizeHex(hslToHex({ ...hsl, l: Math.min(hsl.l + 20, 95) })) },
                  { label: 'Darker', hex: normalizeHex(hslToHex({ ...hsl, l: Math.max(hsl.l - 20, 5) })) },
                  { label: 'Saturated', hex: normalizeHex(hslToHex({ ...hsl, s: Math.min(hsl.s + 20, 100) })) },
                  { label: 'Muted', hex: normalizeHex(hslToHex({ ...hsl, s: Math.max(hsl.s - 20, 0) })) },
                ]
                return variations.map((v) => {
                  const fg = textColor(v.hex) === 'text-white' ? '#fff' : '#111'
                  return (
                    <div
                      key={v.label}
                      className="flex items-center gap-3 rounded-xl border border-border px-3 py-2"
                    >
                      <div
                        className="h-8 w-8 shrink-0 rounded-md border border-border"
                        style={{ backgroundColor: v.hex }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-muted">{v.label}</div>
                        <div className="font-mono text-xs text-text">{v.hex.toUpperCase()}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(v.hex.toUpperCase())
                            setStatus(`Copied ${v.hex.toUpperCase()} to clipboard.`)
                          } catch {
                            setStatus('Failed to copy.')
                          } finally {
                            if (statusTimeout.current) clearTimeout(statusTimeout.current)
                            statusTimeout.current = setTimeout(() => setStatus(null), 3000)
                          }
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  )
                })
              })()}
            </div>
          </Card>
        </div>
      </div>
    </BaseToolLayout>
  )
}
