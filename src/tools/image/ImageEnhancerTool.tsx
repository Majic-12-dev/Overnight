import { useState, useRef, useCallback, useEffect } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Slider } from '@/components/ui/Slider'
import { Download, Eye, ImageOff, RefreshCw } from 'lucide-react'

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
  const [error, setError] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sourceImageRef = useRef<HTMLImageElement | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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

      // Apply brightness, contrast, saturation via CSS filter
      const filter = `brightness(${settings.brightness}%) contrast(${settings.contrast}%) saturate(${settings.saturation}%)`
      ctx.filter = filter
      ctx.drawImage(img, 0, 0)
      ctx.filter = 'none'

      // Apply sharpness kernel convolution if sharpness > 0
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

    // 3x3 sharpen kernel: center=9, neighbors=-1
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

  // Re-render when settings change (but not while holding original)
  useEffect(() => {
    if (imageLoaded && !holdingOriginal) {
      const id = requestAnimationFrame(() => drawToCanvas())
      return () => cancelAnimationFrame(id)
    }
  }, [settings, imageLoaded, holdingOriginal, drawToCanvas])

  const loadImage = useCallback(
    (file: File) => {
      setError(null)
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          sourceImageRef.current = img
          setImageLoaded(true)
          setImageName(file.name)
          setSettings({ ...DEFAULTS })
          requestAnimationFrame(() => drawToCanvas())
        }
        img.onerror = () => {
          setError('Failed to decode image. The file may be corrupted or unsupported.')
        }
        img.src = e.target?.result as string
      }
      reader.onerror = () => setError('Failed to read the image file.')
      reader.readAsDataURL(file)
    },
    [drawToCanvas],
  )

  const handleBrowse = () => inputRef.current?.click()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) loadImage(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) loadImage(file)
  }

  const handleDragOver = (e: React.DragEvent) => e.preventDefault()

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

  return (
    <div className='flex flex-col gap-6'>
      <header className='space-y-2'>
        <h1 className='text-2xl font-semibold text-text'>{tool.name}</h1>
        <p className='max-w-2xl text-sm text-muted'>{tool.description}</p>
      </header>

      <div className='grid grid-cols-[minmax(0,1fr)_280px] gap-6'>
        {/* Main Content */}
        <div className='space-y-4'>
          {/* Canvas Preview */}
          <Card className='relative overflow-hidden'>
            {imageLoaded ? (
              <div className='space-y-3'>
                <div className='flex items-center justify-between'>
                  <Badge className='border-0 bg-accent/15 text-accent'>
                    {imageName}
                  </Badge>
                  <div className='flex items-center gap-2'>
                    <Button
                      variant='ghost'
                      size='sm'
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
                          <Eye className='h-4 w-4' />
                          Hold for enhanced
                        </>
                      ) : (
                        <>
                          <Eye className='h-4 w-4' />
                          Hold for original
                        </>
                      )}
                    </Button>
                    <Button variant='ghost' size='sm' onClick={resetSettings}>
                      <RefreshCw className='h-4 w-4' />
                      Reset
                    </Button>
                  </div>
                </div>
                <canvas
                  ref={canvasRef}
                  className='w-full rounded-xl border border-border bg-base/40'
                  style={{ maxHeight: '500px', objectFit: 'contain' }}
                />
              </div>
            ) : (
              <div
                className='flex min-h-[300px] items-center justify-center rounded-xl border-2 border-dashed border-border'
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                <div className='flex flex-col items-center gap-4'>
                  <ImageOff className='h-12 w-12 text-muted/50' />
                  <p className='text-sm text-muted'>
                    Drag an image here or upload below to start.
                  </p>
                </div>
              </div>
            )}
          </Card>

          {/* File Upload */}
          <Card>
            <div className='flex items-center justify-between'>
              <div>
                <h2 className='text-sm font-semibold text-text'>Image</h2>
                <p className='text-xs text-muted'>
                  {imageLoaded ? imageName : 'No image loaded'}
                </p>
              </div>
              <input
                ref={inputRef}
                type='file'
                accept='image/*'
                onChange={handleFileChange}
                className='hidden'
              />
              <Button variant='outline' onClick={handleBrowse}>
                Choose Image
              </Button>
            </div>
          </Card>

          {/* Export */}
          <Card>
            <div className='flex items-center justify-between'>
              <div>
                <h2 className='text-sm font-semibold text-text'>Export</h2>
                <p className='text-xs text-muted'>Save the enhanced image</p>
              </div>
              <div className='flex items-center gap-2'>
                <Button
                  variant='outline'
                  onClick={() => handleExport('png')}
                  disabled={!imageLoaded}
                >
                  <Download className='h-4 w-4' />
                  PNG
                </Button>
                <Button
                  variant='primary'
                  onClick={() => handleExport('jpeg')}
                  disabled={!imageLoaded}
                >
                  <Download className='h-4 w-4' />
                  JPEG
                </Button>
              </div>
            </div>
          </Card>

          {error && (
            <Card className='border border-red-500/50 bg-red-500/10 text-sm text-red-200'>
              {error}
            </Card>
          )}
        </div>

        {/* Options Sidebar */}
        <Card className='space-y-4'>
          <h3 className='text-sm font-semibold text-text'>Enhancements</h3>
          <Slider
            label='Brightness'
            min={0}
            max={200}
            value={settings.brightness}
            onChange={(e) => updateSetting('brightness', Number(e.target.value))}
            unit='%'
          />
          <Slider
            label='Contrast'
            min={0}
            max={200}
            value={settings.contrast}
            onChange={(e) => updateSetting('contrast', Number(e.target.value))}
            unit='%'
          />
          <Slider
            label='Saturation'
            min={0}
            max={300}
            value={settings.saturation}
            onChange={(e) => updateSetting('saturation', Number(e.target.value))}
            unit='%'
          />
          <Slider
            label='Sharpness'
            min={0}
            max={100}
            value={settings.sharpness}
            onChange={(e) => updateSetting('sharpness', Number(e.target.value))}
          />
        </Card>
      </div>
    </div>
  )
}
