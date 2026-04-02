import { useMemo, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { CheckCircle2, XCircle } from 'lucide-react'

type ColorContrastCheckerToolProps = {
  tool: ToolDefinition
}

type WCAGResult = {
  label: string
  required: number
  passes: boolean
}

// --- WCAG luminance and contrast helpers ---

function parseHex(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return { r: 0, g: 0, b: 0 }
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  }
}

function srgbToLinear(channel: number): number {
  const sRGB = channel / 255
  return sRGB <= 0.03928
    ? sRGB / 12.92
    : Math.pow((sRGB + 0.055) / 1.055, 2.4)
}

function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex)
  return (
    0.2126 * srgbToLinear(r) +
    0.7152 * srgbToLinear(g) +
    0.0722 * srgbToLinear(b)
  )
}

function contrastRatio(hex1: string, hex2: string): number {
  const L1 = relativeLuminance(hex1)
  const L2 = relativeLuminance(hex2)
  return L1 > L2
    ? (L1 + 0.05) / (L2 + 0.05)
    : (L2 + 0.05) / (L1 + 0.05)
}

function isValidHex(hex: string): boolean {
  return /^#?([0-9a-fA-F]{6})$/.test(hex)
}

function normalizeHex(hex: string): string {
  if (hex.startsWith('#')) return hex
  return `#${hex}`
}

export function ColorContrastCheckerTool({ tool }: ColorContrastCheckerToolProps) {
  const [foreground, setForeground] = useState('#1a1a2e')
  const [background, setBackground] = useState('#ffffff')

  const fg = isValidHex(foreground) ? normalizeHex(foreground) : '#000000'
  const bg = isValidHex(background) ? normalizeHex(background) : '#ffffff'

  const ratio = useMemo(() => contrastRatio(fg, bg), [fg, bg])
  const fgLuminance = useMemo(() => relativeLuminance(fg), [fg])
  const bgLuminance = useMemo(() => relativeLuminance(bg), [bg])

  const results: WCAGResult[] = useMemo(
    () => [
      { label: 'AA (Normal text)', required: 4.5, passes: ratio >= 4.5 },
      { label: 'AA (Large text)', required: 3.0, passes: ratio >= 3.0 },
      { label: 'AAA (Normal text)', required: 7.0, passes: ratio >= 7.0 },
      { label: 'AAA (Large text)', required: 4.5, passes: ratio >= 4.5 },
    ],
    [ratio],
  )

  const rating =
    ratio >= 7
      ? 'AAA'
      : ratio >= 4.5
        ? 'AA'
        : ratio >= 3
          ? 'Partial'
          : 'Fail'

  const ratingLabel =
    ratio >= 7
      ? 'Passes AAA'
      : ratio >= 4.5
        ? 'Passes AA'
        : ratio >= 3
          ? 'Passes AA Large Only'
          : 'Insufficient Contrast'

  const optionsContent = (
    <div className="space-y-4 text-sm">
      <div className="space-y-2">
        <label htmlFor="foreground-color" className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted">
          <span
            className="inline-block h-3 w-3 rounded-full border border-border"
            style={{ backgroundColor: fg }}
          />
          Foreground
        </label>
        <div className="flex gap-2">
          <input
            id="foreground-color"
            type="color"
            value={fg}
            onChange={(e) => setForeground(e.target.value)}
            className="h-10 w-10 cursor-pointer rounded-lg border border-border bg-base/70 p-0.5"
            aria-label="Choose foreground color"
          />
          <input
            type="text"
            value={fg.toUpperCase()}
            onChange={(e) => setForeground(e.target.value)}
            className="h-10 w-full rounded-xl border border-border bg-base/70 px-3 font-mono text-sm text-text shadow-inner focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent uppercase"
            maxLength={7}
            aria-label="Foreground hex value"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="background-color" className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted">
          <span
            className="inline-block h-3 w-3 rounded-full border border-border"
            style={{ backgroundColor: bg }}
          />
          Background
        </label>
        <div className="flex gap-2">
          <input
            id="background-color"
            type="color"
            value={bg}
            onChange={(e) => setBackground(e.target.value)}
            className="h-10 w-10 cursor-pointer rounded-lg border border-border bg-base/70 p-0.5"
            aria-label="Choose background color"
          />
          <input
            type="text"
            value={bg.toUpperCase()}
            onChange={(e) => setBackground(e.target.value)}
            className="h-10 w-full rounded-xl border border-border bg-base/70 px-3 font-mono text-sm text-text shadow-inner focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent uppercase"
            maxLength={7}
            aria-label="Background hex value"
          />
        </div>
      </div>

      <div className="rounded-xl border-accent/20 bg-accent/10 px-3 py-2 text-xs text-accent">
        Luminance: FG {fgLuminance.toFixed(4)} · BG {bgLuminance.toFixed(4)}
      </div>
    </div>
  )

  const resultsContent = (
    <div className="space-y-4">
      {/* Ratio display */}
      <div
        className="rounded-2xl p-6 text-center"
        style={{ backgroundColor: fg, color: bg }}
      >
        <div className="text-5xl font-bold tabular-nums">{ratio.toFixed(2)}:1</div>
        <div className="mt-1 text-sm font-medium opacity-90">{ratingLabel}</div>
        <div className="mt-2 flex justify-center">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              rating === 'AAA'
                ? 'bg-green-500/30 text-green-100'
                : rating === 'AA'
                  ? 'bg-yellow-500/30 text-yellow-100'
                  : rating === 'Partial'
                    ? 'bg-orange-500/30 text-orange-100'
                    : 'bg-red-500/30 text-red-100'
            }`}
          >
            {rating}
          </span>
        </div>
      </div>

      {/* WCAG compliance table */}
      <div className="rounded-xl border border-border bg-base/60">
        <div className="px-4 pt-3 pb-2 text-xs font-semibold uppercase text-muted">
          WCAG 2.1 Compliance
        </div>
        <div className="divide-y divide-border">
          {results.map((r) => (
            <div
              key={r.label}
              className="flex items-center justify-between px-4 py-2.5"
              aria-label={`${r.label}: ${r.passes ? 'Pass' : 'Fail'} (requires ${r.required}:1, actual ${ratio.toFixed(2)}:1)`}
            >
              <span className="text-sm text-text">{r.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs tabular-nums text-muted">{r.required}:1</span>
                {r.passes ? (
                  <CheckCircle2
                    className="h-5 w-5 text-green-400"
                    aria-hidden="true"
                  />
                ) : (
                  <XCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live preview: white text on foreground */}
      <div className="rounded-xl border border-border bg-base/60 p-4 space-y-3">
        <div className="text-xs font-semibold uppercase text-muted">Live Previews</div>

        {/* Foreground with white text */}
        <div
          className="flex items-center justify-between rounded-xl px-4 py-3"
          style={{ backgroundColor: fg }}
        >
          <div>
            <span className="text-sm font-semibold text-white">White text on FG</span>
            <span className="ml-2 text-sm/none opacity-80 text-white">
              (preview)
            </span>
          </div>
          <span className="font-mono text-xs text-white/70">{fg.toUpperCase()}</span>
        </div>
        <div
          className="rounded-xl px-4 py-3"
          style={{ backgroundColor: fg, color: '#fff' }}
        >
          <p className="text-xs">
            Normal text preview — The quick brown fox jumps over the lazy dog
          </p>
          <p className="mt-1 text-sm font-medium">
            Large text preview — 18pt+ / 14pt+ bold
          </p>
        </div>

        {/* Combined preview */}
        <div
          className="flex items-center justify-between rounded-xl px-4 py-3"
          style={{ backgroundColor: bg, color: fg }}
        >
          <span className="text-sm font-semibold">FG on BG preview</span>
          <span className="font-mono text-xs opacity-70">{bg.toUpperCase()}</span>
        </div>

        {/* Combined text sample */}
        <div
          className="rounded-xl px-4 py-3"
          style={{ backgroundColor: bg, color: fg }}
        >
          <p className="text-xs">
            Normal text preview — The quick brown fox jumps over the lazy dog
          </p>
          <p className="mt-1 text-sm font-medium">
            Large text preview — 18pt+ / 14pt+ bold
          </p>
        </div>
      </div>
    </div>
  )

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={optionsContent}
      result={resultsContent}
    />
  )
}
