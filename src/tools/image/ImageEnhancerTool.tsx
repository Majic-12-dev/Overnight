import { useState, useRef, useCallback, useEffect } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import type { ToolFile } from '@/components/tools/BaseToolLayout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Slider } from '@/components/ui/Slider'
import { Download, Eye, RefreshCw } from 'lucide-react'

type ImageEnhancerToolProps = {
  tool: ToolDefinition
}

type EnhanceSettings = {
  brightness: number
  contrast: number
  saturation: number
  sharpness: number
}

const DEFAULTS: EnhanceSettings = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  sharpness: 0,
}

export function ImageEnhancerTool({ tool }: ImageEnhancerToolProps) {
  const [settings, setSettings] = useState<EnhanceSettings>({ ...DEFAULTS })
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageName, setImageName] = useState<string>('')
  const [holdingOriginal, setHoldingOriginal] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sourceImageRef = useRef<HTMLImageElement | null>(null)

  const updateSetting = useCallback(
    (key: keyof EnhanceSettings, value: number) => {
      setSettings((prev) => ({ ...prev, [key]: value }))
    },
    [],
  )

  const resetSettings = useCallback(() => {
    setSettings({ ...DEFAULTS })
  }, [])

  const drawToCanvas = useCallback(
    (showOriginal: boolean = false) => {
      const canvas = canvasRef.current
      const img = sourceImageRef.current
      if (!canvas || !img) return

      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (showOriginal) {
        ctx.drawImage(img, 0, 0)
        return
      }

      const filter = `brightness(${settings.brightness}%) contrast(${settings.contrast}%) saturate(${settings.saturation}%)`
      ctx.filter = filter
      ctx.drawImage(img, 0, 0)
      ctx.filter = 'none'

      if (settings.sharpness > 0) {
        applySharpnessConvolution(ctx, canvas.width, canvas.height, settings.sharpness)
      }
    },
    [settings],
  )

  const applySharpnessConvolution = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    sharpness: number,
  ) => {
    const imageData = ctx.getImageData(0, 0, w, h)
    const src = imageData.data
    const output = new Uint8ClampedArray(src)
    const mix = Math.min(sharpness / 100, 1)

    const k = [-1, -1, -1, -1, 9, -1, -1, -1, -1]

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        for (let c = 0; c < 3; c++) {
          let conv = 0
          for (let ky = 0; ky < 3; ky++) {
            for (let kx = 0; kx < 3; kx++) {
              const idx = ((y - 1 + ky) * w + (x - 1 + kx)) * 4 + c
              conv += src[idx] * k[ky * 3 + kx]
            }
          }
          const idx = (y * w + x) * 4 + c
          output[idx] = src[idx] + (conv - src[idx]) * mix
        }
      }
    }

    imageData.data.set(output)
    ctx.putImageData(imageData, 0, 0)
  }

  useEffect(() => {
    if (imageLoaded && !holdingOriginal) {
      const id = requestAnimationFrame(() => drawToCanvas())
      return () => cancelAnimationFrame(id)
    }
  }, [settings, imageLoaded, holdingOriginal, drawToCanvas])

  const loadImage = useCallback(
    async (file: File): Promise<void> => {
      return new Promise<void>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          const img = new Image()
          img.onload = () => {
            sourceImageRef.current = img
            setImageName(file.name)
            setSettings({ ...DEFAULTS })
            setImageLoaded(true)
            requestAnimationFrame(() => drawToCanvas())
            resolve()
          }
          img.onerror = () => reject(new Error('Failed to decode image. The file may be corrupted or unsupported.'))
          img.src = e.target?.result as string
        }
        reader.onerror = () => reject(new Error('Failed to read the image file.'))
        reader.readAsDataURL(file)
      })
    },
    [drawToCanvas],
  )

  const handleExport = useCallback(
    (format: 'png' | 'jpeg') => {
      const canvas = canvasRef.current
      if (!canvas || !imageLoaded) return

      const mime = format === 'png' ? 'image/png' : 'image/jpeg'
      const ext = format === 'png' ? 'png' : 'jpg'

      canvas.toBlob(
        (blob) => {
          if (!blob) return
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          const base = imageName.replace(/\.[^.]+$/, '')
          a.href = url
          a.download = `${base}_enhanced.${ext}`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
        },
        mime,
        format === 'jpeg' ? 0.92 : undefined,
      )
    },
    [imageLoaded, imageName],
  )

  const onProcess = useCallback(
    async (
      files: ToolFile[],
      context: {
        setProgress: (v: number) => void
        setResult: (r: React.ReactNode | null) => void
        setError: (e: string | null) => void
      },
    ): Promise<void> => {
      if (files.length === 0) {
        context.setError('Please add at least one image file.')
        return
      }

      context.setProgress(10)

      const firstFile = files[0]
      try {
        // Reset to force reinitialization
        sourceImageRef.current = null
        setImageLoaded(false)
        await loadImage(firstFile.file)
        context.setProgress(100)
        context.setResult(
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge className="border-0 bg-accent/15 text-accent">{imageName}</Badge>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onMouseDown={() => {
                    setHoldingOriginal(true)
                    drawToCanvas(true)
                  }}
                  onMouseUp={() => {
                    setHoldingOriginal(false)
                    drawToCanvas(false)
                  }}
                  onMouseLeave={() => {
                    if (holdingOriginal) {
                      setHoldingOriginal(false)
                      drawToCanvas(false)
                    }
                  }}
                  onTouchStart={() => {
                    setHoldingOriginal(true)
                    drawToCanvas(true)
                  }}
                  onTouchEnd={() => {
                    setHoldingOriginal(false)
                    drawToCanvas(false)
                  }}
                >
                  {holdingOriginal ? (
                    <>
                      <Eye className="h-4 w-4" />
                      Hold for enhanced
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4" />
                      Hold for original
                    </>
                  )}
                </Button>
                <Button variant="ghost" size="sm" onClick={resetSettings}>
                  <RefreshCw className="h-4 w-4" />
                  Reset
                </Button>
              </div>
            </div>
            <canvas
              ref={canvasRef}
              className="w-full rounded-xl border border-border bg-base/40"
              style={{ maxHeight: '500px', objectFit: 'contain' }}
            />
            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => handleExport('png')}
                disabled={!imageLoaded}
              >
                <Download className="h-4 w-4" />
                PNG
              </Button>
              <Button
                variant="primary"
                onClick={() => handleExport('jpeg')}
                disabled={!imageLoaded}
              >
                <Download className="h-4 w-4" />
                JPEG
              </Button>
            </div>
          </div>
        )
      } catch (err) {
        context.setError(err instanceof Error ? err.message : 'Unexpected loading error.')
      }
    },
    [drawToCanvas, handleExport, holdingOriginal, imageName, imageLoaded, loadImage, resetSettings],
  )

  const optionsPanel = (
    <div className="space-y-4 text-sm">
      <Slider
        label="Brightness"
        min={0}
        max={200}
        value={settings.brightness}
        onChange={(e) => updateSetting('brightness', Number(e.target.value))}
        unit="%"
      />
      <Slider
        label="Contrast"
        min={0}
        max={200}
        value={settings.contrast}
        onChange={(e) => updateSetting('contrast', Number(e.target.value))}
        unit="%"
      />
      <Slider
        label="Saturation"
        min={0}
        max={300}
        value={settings.saturation}
        onChange={(e) => updateSetting('saturation', Number(e.target.value))}
        unit="%"
      />
      <Slider
        label="Sharpness"
        min={0}
        max={100}
        value={settings.sharpness}
        onChange={(e) => updateSetting('sharpness', Number(e.target.value))}
      />

      <Badge className="border-0 bg-accent/15 text-accent">Offline • Client-side only</Badge>
    </div>
  )

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      accept="image/*"
      instructions="Drop an image here or click to browse. Enhance it with brightness, contrast, saturation, and sharpness controls."
      maxFiles={1}
      onProcess={onProcess}
      options={optionsPanel}
    />
  )
}
