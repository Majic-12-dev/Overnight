import { useMemo, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Select } from '@/components/ui/Select'

type AspectRatioToolProps = {
  tool: ToolDefinition
}

type Mode = 'width-to-height' | 'height-to-width' | 'diagonal' | 'megapixels' | 'scaled-width' | 'scaled-height'

// Common resolution reference table
const COMMON_RESOLUTIONS: { label: string; width: number; height: number; usage: string }[] = [
  { label: 'HD', width: 1280, height: 720, usage: 'Streaming video' },
  { label: 'Full HD (1080p)', width: 1920, height: 1080, usage: 'Standard displays, video' },
  { label: 'QHD (1440p)', width: 2560, height: 1440, usage: 'Gaming monitors' },
  { label: '4K UHD', width: 3840, height: 2160, usage: 'TV, high-res video' },
  { label: '5K', width: 5120, height: 2880, usage: 'Professional displays' },
  { label: '8K UHD', width: 7680, height: 4320, usage: 'Ultra high-def video' },
  { label: 'VGA', width: 640, height: 480, usage: 'Legacy displays' },
  { label: 'WXGA', width: 1280, height: 800, usage: 'Laptop screens' },
  { label: 'A4 @ 300dpi', width: 2480, height: 3508, usage: 'Print (210×297mm)' },
  { label: 'A4 @ 72dpi', width: 595, height: 842, usage: 'Screen (210×297mm)' },
  { label: 'Instagram Post', width: 1080, height: 1080, usage: 'Social media (1:1)' },
  { label: 'Instagram Story', width: 1080, height: 1920, usage: 'Social media (9:16)' },
  { label: 'YouTube Thumbnail', width: 1280, height: 720, usage: 'Video thumbnail (16:9)' },
  { label: 'Facebook Cover', width: 820, height: 312, usage: 'Social media cover' },
  { label: 'Twitter Header', width: 1500, height: 500, usage: 'Social media header' },
]

// Common aspect ratios
const COMMON_RATIOS: { label: string; w: number; h: number }[] = [
  { label: '16:9', w: 16, h: 9 },
  { label: '4:3', w: 4, h: 3 },
  { label: '1:1', w: 1, h: 1 },
  { label: '3:2', w: 3, h: 2 },
  { label: '21:9', w: 21, h: 9 },
  { label: '9:16', w: 9, h: 16 },
]

export function AspectRatioTool({ tool }: AspectRatioToolProps) {
  const [mode, setMode] = useState<Mode>('width-to-height')
  const [width, setWidth] = useState(1920)
  const [height, setHeight] = useState(1080)
  const [ratioW, setRatioW] = useState(16)
  const [ratioH, setRatioH] = useState(9)

  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))

  const simplified = useMemo(() => {
    if (ratioW === 0 || ratioH === 0) return { w: 0, h: 0 }
    const d = gcd(ratioW, ratioH)
    return { w: ratioW / d, h: ratioH / d }
  }, [ratioW, ratioH])

  const results = useMemo(() => {
    if (mode === 'width-to-height' && height > 0) {
      return { value: width / height, label: `${width} ÷ ${height}`, unit: ':1' }
    }
    if (mode === 'height-to-width' && width > 0) {
      return { value: height / width, label: `${height} ÷ ${width}`, unit: ':1' }
    }
    if (mode === 'diagonal' && width > 0 && height > 0) {
      const diagPx = Math.sqrt(width ** 2 + height ** 2)
      return { value: diagPx, label: `${Math.round(diagPx)} px`, unit: '' }
    }
    if (mode === 'megapixels' && width > 0 && height > 0) {
      const mp = (width * height) / 1e6
      return { value: mp, label: `${mp.toFixed(2)} MP`, unit: '' }
    }
    return null
  }, [mode, width, height])

  const scaledDimensions = useMemo(() => {
    if (ratioH === 0) return null
    const ratio = ratioW / ratioH
    return [
      { label: 'For 100px height', w: Math.round(100 * ratio), h: 100 },
      { label: 'For 720px height', w: Math.round(720 * ratio), h: 720 },
      { label: 'For 1080px height', w: Math.round(1080 * ratio), h: 1080 },
      { label: 'For 2160px height', w: Math.round(2160 * ratio), h: 2160 },
    ]
  }, [ratioW, ratioH])

  const resolutionTable = useMemo(
    () => (
      <div className="space-y-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="pb-2 text-left font-medium text-muted">Name</th>
              <th className="pb-2 text-right font-medium text-muted">Resolution</th>
              <th className="pb-2 text-left font-medium text-muted">Usage</th>
            </tr>
          </thead>
          <tbody>
            {COMMON_RESOLUTIONS.map((r, i) => (
              <tr key={i} className="border-b border-border/50 last:border-0">
                <td className="py-1.5 font-medium text-text">{r.label}</td>
                <td className="py-1.5 text-right font-mono text-accent">{r.width} × {r.height}</td>
                <td className="py-1.5 text-xs text-muted">{r.usage}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
    [],
  )

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <label className="text-xs font-medium">Calculation Mode</label>
            <Select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
              <option value="width-to-height">Width ÷ Height (Aspect)</option>
              <option value="height-to-width">Height ÷ Width (Inverse)</option>
              <option value="diagonal">Diagonal (pixels)</option>
              <option value="megapixels">Megapixels</option>
            </Select>
          </div>

          {(mode === 'width-to-height' || mode === 'height-to-width' || mode === 'diagonal' || mode === 'megapixels') && (
            <div className="space-y-2">
              <label className="text-xs font-medium">Width (px)</label>
              <input
                type="number"
                min={1}
                value={width}
                onChange={(e) => setWidth(Number(e.target.value) || 0)}
                className="w-full rounded border border-border bg-base p-2 text-sm"
              />
            </div>
          )}

          {(mode === 'width-to-height' || mode === 'height-to-width' || mode === 'diagonal' || mode === 'megapixels') && (
            <div className="space-y-2">
              <label className="text-xs font-medium">Height (px)</label>
              <input
                type="number"
                min={1}
                value={height}
                onChange={(e) => setHeight(Number(e.target.value) || 0)}
                className="w-full rounded border border-border bg-base p-2 text-sm"
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-medium">Reference Ratio (W:H)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={ratioW}
                onChange={(e) => setRatioW(Number(e.target.value) || 1)}
                className="w-16 rounded border border-border bg-base p-2 text-sm"
              />
              <span className="text-muted">:</span>
              <input
                type="number"
                min={1}
                value={ratioH}
                onChange={(e) => setRatioH(Number(e.target.value) || 1)}
                className="w-16 rounded border border-border bg-base p-2 text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium">Quick Ratios</label>
            <div className="flex flex-wrap gap-1">
              {COMMON_RATIOS.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setRatioW(r.w)
                    setRatioH(r.h)
                  }}
                  className="rounded border border-border bg-base px-2 py-0.5 text-xs text-muted hover:border-accent hover:text-accent"
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {results && (
            <div className="rounded-xl border border-border bg-base/60 p-3 text-center">
              <div className="text-xs text-muted">Result</div>
              <div className="text-2xl font-semibold text-accent">{results.label}</div>
              <div className="mt-1 text-xs text-muted">
                Simplified: {simplified.w}:{simplified.h}
              </div>
              {mode === 'diagonal' || mode === 'megapixels' ? null : (
                <div className="text-xs text-muted">
                  Decimal: {results.value.toFixed(4)}
                  {results.unit}
                </div>
              )}
            </div>
          )}

          {scaledDimensions && (
            <div className="space-y-1">
              <div className="text-xs font-medium">Scaled for {simplified.w}:{simplified.h}</div>
              {scaledDimensions.map((s, i) => (
                <div
                  key={i}
                  className="flex justify-between rounded border border-border/50 bg-base/30 px-2 py-1 text-xs"
                >
                  <span className="text-muted">{s.label}</span>
                  <span className="font-mono text-text">{s.w} × {s.h}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      }
    >
      {resolutionTable}
    </BaseToolLayout>
  )
}
