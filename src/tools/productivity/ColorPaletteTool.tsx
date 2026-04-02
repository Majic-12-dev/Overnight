import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Copy, CheckCircle, RefreshCw, Lock, Unlock } from 'lucide-react'

type ColorPaletteToolProps = {
  tool: ToolDefinition
}

type PaletteMode = 'random' | 'complementary' | 'analogous' | 'triadic' | 'split-complementary'

type ColorInfo = {
  hex: string
  rgb: { r: number; g: number; b: number }
  hsl: { h: number; s: number; l: number }
}

type SwatchState = {
  color: ColorInfo
  locked: boolean
}

// --- HSL/RGB/HEX conversion helpers ---

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  s /= 100
  l /= 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return {
    r: Math.round(255 * f(0)),
    g: Math.round(255 * f(8)),
    b: Math.round(255 * f(4)),
  }
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((x) => {
        const hex = x.toString(16)
        return hex.length === 1 ? '0' + hex : hex
      })
      .join('')
  )
}

function hslToColor(h: number, s: number, l: number): ColorInfo {
  const rgb = hslToRgb(h, s, l)
  return {
    hex: rgbToHex(rgb.r, rgb.g, rgb.b),
    rgb,
    hsl: { h: Math.round(h), s: Math.round(s), l: Math.round(l) },
  }
}

// --- Crypto-safe random hue ---

function secureRandomHue(): number {
  const array = new Float64Array(1)
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  array[0] = buf[0] / (0xffffffff + 1)
  return array[0] * 360
}

function generatePalette(mode: PaletteMode, locks: boolean[]): ColorInfo[] {
  const hue = secureRandomHue()
  const s = 65 + (secureRandomHue() % 20) // 65-84%
  const l = 50 + (secureRandomHue() % 15) // 50-64%

  const rawHues: number[] = []

  switch (mode) {
    case 'random': {
      for (let i = 0; i < 6; i++) {
        rawHues.push(hue + (secureRandomHue() * 60 - 30) + i * 10)
      }
      break
    }
    case 'complementary': {
      for (let i = 0; i < 6; i++) {
        const offset = i * 60
        rawHues.push(hue + offset)
      }
      break
    }
    case 'analogous': {
      for (let i = 0; i < 6; i++) {
        rawHues.push(hue + (i - 2.5) * 25)
      }
      break
    }
    case 'triadic': {
      const base = hue
      for (let i = 0; i < 6; i++) {
        const angle = (i % 3) * 120 + ((i < 3 ? 0 : 10))
        rawHues.push(base + angle)
      }
      break
    }
    case 'split-complementary': {
      for (let i = 0; i < 6; i++) {
        const offset = i < 2 ? 0 : i < 4 ? 150 : 210
        rawHues.push(hue + offset + (i % 2) * 15)
      }
      break
    }
  }

  return rawHues.map((h) => {
    const normHue = ((h % 360) + 360) % 360
    return hslToColor(normHue, s, l)
  })
}

// --- Clipboard helper ---

function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const a = [r, g, b].map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)))
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]
}

function textColorFor(hex: string): 'white' | 'dark' {
  return luminance(hex) > 0.4 ? 'dark' : 'white'
}

export function ColorPaletteTool({ tool }: ColorPaletteToolProps) {
  const [mode, setMode] = useState<PaletteMode>('complementary')
  const [swatches, setSwatches] = useState<SwatchState[]>([])
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const copiedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleGenerate = useCallback(() => {
    setSwatches((prev) => {
      const locks = prev.map((s) => s.locked)
      const fresh = generatePalette(mode, locks)
      return fresh.map((color, i) => ({
        color: locks[i] && prev[i] ? prev[i].color : color,
        locked: locks[i] || false,
      }))
    })
  }, [mode])

  // Generate initial palette
  useEffect(() => {
    handleGenerate()
  }, [handleGenerate])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (copiedTimeout.current) clearTimeout(copiedTimeout.current)
    }
  }, [])

  const handleCopy = useCallback(
    async (hex: string, index: number) => {
      try {
        await navigator.clipboard.writeText(hex)
        setCopiedIndex(index)
        if (copiedTimeout.current) clearTimeout(copiedTimeout.current)
        copiedTimeout.current = setTimeout(() => setCopiedIndex(null), 2000)
      } catch {
        // clipboard unavailable
      }
    },
    [],
  )

  const handleToggleLock = useCallback((index: number) => {
    setSwatches((prev) =>
      prev.map((s, i) => (i === index ? { ...s, locked: !s.locked } : s)),
    )
  }, [])

  const lockedCount = useMemo(() => swatches.filter((s) => s.locked).length, [swatches])

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Palette Mode</div>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as PaletteMode)}
              className="h-10 w-full rounded-xl border border-border bg-base/70 px-3 text-sm text-text shadow-inner focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="complementary">Complementary (6-color spread)</option>
              <option value="analogous">Analogous (adjacent hues)</option>
              <option value="triadic">Triadic</option>
              <option value="split-complementary">Split-Complementary</option>
              <option value="random">Random</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={handleGenerate} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Generate Palette
            </Button>
          </div>
          {lockedCount > 0 && (
            <div className="rounded-xl border border-accent/20 bg-accent/10 px-3 py-2 text-xs text-accent">
              {lockedCount} swatch{lockedCount > 1 ? 'es' : ''} locked — only unlocked swatches will change.
            </div>
          )}
          <div className="rounded-xl border border-border bg-base/60 px-3 py-2 text-xs text-muted">
            Click any swatch to copy its HEX value.
          </div>
        </div>
      }
    >
      {swatches.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {swatches.map((swatch, idx) => {
            const isDark = textColorFor(swatch.color.hex) === 'dark'
            const textColor = isDark ? 'text-gray-900' : 'text-white'
            const isCopied = copiedIndex === idx
            return (
              <Card
                key={idx}
                className="p-0 overflow-hidden group relative cursor-pointer transition-all"
                style={{
                  backgroundColor: swatch.color.hex,
                }}
                onClick={() => handleCopy(swatch.color.hex, idx)}
              >
                <div className="p-3">
                  <div className={`font-mono text-sm font-bold ${textColor}`}>
                    {swatch.color.hex.toUpperCase()}
                  </div>
                  <div className={`mt-1 text-[10px] ${textColor} opacity-70`}>
                    {swatch.color.rgb.r}, {swatch.color.rgb.g}, {swatch.color.rgb.b}
                  </div>
                  <div className={`text-[10px] ${textColor} opacity-70`}>
                    {swatch.color.hsl.h}° {swatch.color.hsl.s}% {swatch.color.hsl.l}%
                  </div>
                </div>

                {/* Action buttons overlay */}
                <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    type="button"
                    title={swatch.locked ? 'Unlock' : 'Lock'}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggleLock(idx)
                    }}
                    className={`rounded p-1 ${isDark ? 'hover:bg-black/20 text-gray-900' : 'hover:bg-white/30 text-white'}`}
                  >
                    {swatch.locked ? (
                      <Lock className="h-3 w-3" />
                    ) : (
                      <Unlock className="h-3 w-3" />
                    )}
                  </button>
                </div>

                {/* Lock indicator badge */}
                {swatch.locked && (
                  <div
                    className={`absolute bottom-1 left-2 text-[9px] font-bold flex items-center gap-0.5 ${textColor} opacity-70`}
                  >
                    <Lock className="h-2.5 w-2.5" /> Locked
                  </div>
                )}

                {/* Copied feedback */}
                {isCopied && (
                  <div
                    className={`absolute inset-0 flex items-center justify-center ${isDark ? 'bg-black/30' : 'bg-white/30'}`}
                  >
                    <CheckCircle className={`h-6 w-6 ${textColor}`} />
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </BaseToolLayout>
  )
}
