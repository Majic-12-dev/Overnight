import type { ChangeEvent } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Copy as CopyIcon, CheckCircle, Plus, Trash2 } from 'lucide-react'

type GradientType = 'linear' | 'radial'

type ColorStop = {
  id: string
  color: string
  position: number
}

type Preset = {
  name: string
  type: GradientType
  angle: number
  stops: { color: string; position: number }[]
}

type GradientGeneratorToolProps = {
  tool: ToolDefinition
}

const PRESETS: Preset[] = [
  {
    name: 'Sunset',
    type: 'linear',
    angle: 135,
    stops: [
      { color: '#ff512f', position: 0 },
      { color: '#f09819', position: 100 },
    ],
  },
  {
    name: 'Ocean',
    type: 'linear',
    angle: 180,
    stops: [
      { color: '#667eea', position: 0 },
      { color: '#764ba2', position: 100 },
    ],
  },
  {
    name: 'Flame',
    type: 'linear',
    angle: 90,
    stops: [
      { color: '#f12711', position: 0 },
      { color: '#f5af19', position: 100 },
    ],
  },
  {
    name: 'Forest',
    type: 'linear',
    angle: 160,
    stops: [
      { color: '#134e5e', position: 0 },
      { color: '#71b280', position: 100 },
    ],
  },
  {
    name: 'Purple Dream',
    type: 'linear',
    angle: 225,
    stops: [
      { color: '#a18cd1', position: 0 },
      { color: '#fbc2eb', position: 100 },
    ],
  },
  {
    name: 'Aurora',
    type: 'radial',
    angle: 0,
    stops: [
      { color: '#43e97b', position: 0 },
      { color: '#38f9d7', position: 50 },
      { color: '#fa709a', position: 100 },
    ],
  },
  {
    name: 'Cosmic',
    type: 'linear',
    angle: 45,
    stops: [
      { color: '#0f0c29', position: 0 },
      { color: '#302b63', position: 50 },
      { color: '#24243e', position: 100 },
    ],
  },
  {
    name: 'Cotton Candy',
    type: 'radial',
    angle: 0,
    stops: [
      { color: '#ff6fd8', position: 0 },
      { color: '#3813c2', position: 100 },
    ],
  },
]

let idCounter = 0
function createId(): string {
  return `cs-${Date.now()}-${++idCounter}`
}

function createStop(color: string, position: number): ColorStop {
  return { id: createId(), color, position }
}

function generateGradientCSS(stops: ColorStop[], type: GradientType, angle: number): string {
  if (stops.length === 0) return ''

  const sorted = [...stops].sort((a, b) => a.position - b.position)
  const stopStrings = sorted.map((s) => `${s.color} ${s.position}%`).join(', ')

  if (type === 'radial') {
    return `radial-gradient(circle, ${stopStrings})`
  }

  return `linear-gradient(${angle}deg, ${stopStrings})`
}

function generateFullCSS(stops: ColorStop[], type: GradientType, angle: number): string {
  const value = generateGradientCSS(stops, type, angle)
  if (!value) return ''
  return `background: ${value};`
}

export function GradientGeneratorTool({ tool }: GradientGeneratorToolProps) {
  const [type, setType] = useState<GradientType>('linear')
  const [angle, setAngle] = useState(135)
  const [stops, setStops] = useState<ColorStop[]>([
    createStop('#667eea', 0),
    createStop('#764ba2', 100),
  ])
  const [copied, setCopied] = useState(false)

  // Update angle when type changes
  useEffect(() => {
    if (type === 'radial') {
      setAngle(0)
    }
  }, [type])

  const gradientCSS = useMemo(
    () => generateGradientCSS(stops, type, angle),
    [stops, type, angle],
  )

  const fullCSS = useMemo(
    () => generateFullCSS(stops, type, angle),
    [stops, type, angle],
  )

  const stylePreview = useMemo<React.CSSProperties>(
    () => ({
      background: gradientCSS || '#667eea',
      width: '100%',
      height: '240px',
      borderRadius: '16px',
      border: '1px solid var(--color-border, rgb(255 255 255 / 0.1))',
      boxShadow: '0 1px 3px rgb(0 0 0 / 0.3)',
    }),
    [gradientCSS],
  )

  const handleAddStop = useCallback(() => {
    if (stops.length >= 8) return
    const newPosition = stops.length > 0
      ? Math.round(stops.reduce((sum, s) => sum + s.position, 0) / stops.length)
      : 50
    setStops((prev) => [...prev, createStop('#ffffff', newPosition)].sort((a, b) => a.position - b.position))
  }, [stops])

  const handleRemoveStop = useCallback((id: string) => {
    setStops((prev) => {
      if (prev.length <= 2) return prev
      return prev.filter((s) => s.id !== id)
    })
  }, [])

  const handleColorChange = useCallback((id: string, color: string) => {
    setStops((prev) => prev.map((s) => (s.id === id ? { ...s, color } : s)))
  }, [])

  const handlePositionChange = useCallback((id: string, position: number) => {
    setStops((prev) =>
      prev
        .map((s) => (s.id === id ? { ...s, position: Math.max(0, Math.min(100, position)) } : s))
        .sort((a, b) => a.position - b.position),
    )
  }, [])

  const handleAngleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const val = Math.max(0, Math.min(360, parseInt(e.target.value) || 0))
    setAngle(val)
  }, [])

  const handlePreset = useCallback((preset: Preset) => {
    setType(preset.type)
    setAngle(preset.type === 'linear' ? preset.angle : 0)
    setStops(preset.stops.map((s) => createStop(s.color, s.position)))
  }, [])

  const handleCopy = useCallback(() => {
    if (!fullCSS) return
    navigator.clipboard.writeText(fullCSS).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [fullCSS])

  const optionsPanel = (
    <div className='space-y-4 text-sm'>
      {/* Gradient Type */}
      <div className='space-y-2'>
        <div className='text-xs font-semibold uppercase text-muted'>Type</div>
        <div className='grid grid-cols-2 gap-2'>
          {(['linear', 'radial'] as GradientType[]).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={
                type === t
                  ? 'h-9 rounded-xl bg-accent text-sm font-semibold text-white shadow'
                  : 'h-9 rounded-xl border border-border bg-base/70 text-sm text-muted hover:bg-panel'
              }
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Angle Control (linear only) */}
      {type === 'linear' && (
        <div className='space-y-2'>
          <div className='flex items-center justify-between'>
            <label className='text-xs font-semibold uppercase text-muted'>Angle</label>
            <span className='font-mono text-xs text-accent'>{angle}°</span>
          </div>
          <input
            type='range'
            min={0}
            max={360}
            value={angle}
            onChange={handleAngleChange}
            className='h-2 w-full cursor-pointer appearance-none rounded-lg bg-panel accent-accent'
          />
          <div className='flex justify-between text-[10px] text-muted'>
            <span>0°</span>
            <span>90°</span>
            <span>180°</span>
            <span>270°</span>
            <span>360°</span>
          </div>
        </div>
      )}

      {/* Color Stops */}
      <div className='space-y-2'>
        <div className='flex items-center justify-between'>
          <label className='text-xs font-semibold uppercase text-muted'>Stops</label>
          <Button
            variant='ghost'
            className='h-6 text-[10px] px-2'
            onClick={handleAddStop}
            disabled={stops.length >= 8}
          >
            <Plus className='mr-1 h-3 w-3' /> Add
          </Button>
        </div>
        <div className='space-y-3'>
          {stops.map((stop) => (
            <div key={stop.id} className='flex items-center gap-2'>
              <input
                type='color'
                value={stop.color}
                onChange={(e) => handleColorChange(stop.id, e.target.value)}
                className='h-8 w-8 cursor-pointer rounded-lg border border-border bg-transparent p-0'
                title={stop.color}
              />
              <input
                type='number'
                min={0}
                max={100}
                value={stop.position}
                onChange={(e) => handlePositionChange(stop.id, parseInt(e.target.value) || 0)}
                onBlur={(e) => handlePositionChange(stop.id, parseInt(e.target.value) || 0)}
                className='h-8 w-14 rounded-lg border border-border bg-base/70 px-2 text-center text-xs font-mono text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent'
              />
              <span className='text-[10px] text-muted'>%</span>
              <input
                type='range'
                min={0}
                max={100}
                value={stop.position}
                onChange={(e) => handlePositionChange(stop.id, parseInt(e.target.value) || 0)}
                className='h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-panel accent-accent'
              />
              {stops.length > 2 && (
                <button
                  type='button'
                  onClick={() => handleRemoveStop(stop.id)}
                  className='text-muted hover:text-red-400 transition'
                  title='Remove stop'
                >
                  <Trash2 className='h-3.5 w-3.5' />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Presets */}
      <div className='space-y-2'>
        <div className='text-xs font-semibold uppercase text-muted'>Presets</div>
        <div className='space-y-1.5'>
          {PRESETS.map((preset) => {
            const css = generateGradientCSS(
              preset.stops.map((s) => createStop(s.color, s.position)),
              preset.type,
              preset.angle,
            )
            return (
              <button
                key={preset.name}
                onClick={() => handlePreset(preset)}
                className='group flex w-full items-center gap-2 rounded-xl border border-border bg-base/70 p-2 text-xs hover:border-accent/50 transition'
                title={preset.name}
              >
                <div
                  className='h-6 w-6 flex-shrink-0 rounded-md shadow-sm'
                  style={{ background: css }}
                />
                <span className='text-muted group-hover:text-text transition'>{preset.name}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={optionsPanel}
    >
      <div className='space-y-6'>
        {/* Live Preview */}
        <Card className='space-y-3'>
          <h3 className='text-sm font-semibold text-text'>Live Preview</h3>
          <div style={stylePreview} />
          <div className='text-xs text-muted'>
            {type === 'linear' ? `Linear gradient at ${angle}°` : 'Radial gradient'} with {stops.length} color stops
          </div>
        </Card>

        {/* Generated CSS */}
        {fullCSS && (
          <Card className='space-y-3'>
            <div className='flex items-center justify-between'>
              <h3 className='text-sm font-semibold text-text'>CSS Code</h3>
              <Button
                variant='ghost'
                className='h-6 text-[10px]'
                onClick={handleCopy}
              >
                {copied ? (
                  <CheckCircle className='mr-1.5 h-3.5 w-3.5 text-green-400' />
                ) : (
                  <CopyIcon className='mr-1.5 h-3.5 w-3.5' />
                )}
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <pre className='w-full overflow-x-auto rounded-xl border border-border bg-panel p-4 text-sm font-mono text-accent whitespace-pre-wrap break-all'>
              {fullCSS}
            </pre>
          </Card>
        )}
      </div>

      <div className='flex justify-center mt-6'>
        <Badge className='border-0 bg-accent/15 text-accent'>
          Offline • Client-side only
        </Badge>
      </div>
    </BaseToolLayout>
  )
}
