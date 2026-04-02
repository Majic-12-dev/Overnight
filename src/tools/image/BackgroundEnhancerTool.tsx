import { useState, useRef, useCallback, type FormEvent, type ChangeEvent } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout, type ToolFile } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Switch } from '@/components/ui/Switch'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import {
  UploadCloud,
  FilePlus,
  Trash2,
  Download,
  RotateCcw,
  Eye,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

type ToolFileLocal = {
  id: string
  file: File
  name: string
  size: number
  type: string
  path?: string
  lastModified: number
}

type EnhanceSettings = {
  autoContrast: boolean
  brightness: number
  contrast: number
  sharpen: number
  noiseReduction: boolean
  colorTemperature: number
}

type ImageEnhancerToolProps = {
  tool: ToolDefinition
}

const DEFAULT_SETTINGS: EnhanceSettings = {
  autoContrast: false,
  brightness: 0,
  contrast: 0,
  sharpen: 0,
  noiseReduction: false,
  colorTemperature: 0,
}

export function BackgroundEnhancerTool({ tool }: ImageEnhancerToolProps) {
  const [files, setFiles] = useState<ToolFileLocal[]>([])
  const [settings, setSettings] = useState<EnhanceSettings>(DEFAULT_SETTINGS)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [enhancedUrl, setEnhancedUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [isEnhanced, setIsEnhanced] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const handleFiles = useCallback((incoming: FileList | File[]) => {
    const list = Array.from(incoming)
    const mapped = list.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      path: (file as File & { path?: string }).path,
      lastModified: file.lastModified,
    }))

    setFiles((prev) => {
      const existingKeys = new Set(prev.map((f) => `${f.name}-${f.size}-${f.lastModified}`))
      const allowed = mapped.filter(
        (item) => !existingKeys.has(`${item.name}-${item.size}-${item.lastModified}`),
      )
      return [...prev, ...allowed]
    })

    // Set preview for first file
    if (list.length > 0 && !previewUrl) {
      const url = URL.createObjectURL(list[0])
      setPreviewUrl(url)
    }
  }, [previewUrl])

  const handleBrowse = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.multiple = true
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement
      if (target.files) handleFiles(target.files)
    }
    input.click()
  }, [handleFiles])

  const applyEnhancement = useCallback(
    async (file: File, settings: EnhanceSettings): Promise<Blob | null> => {
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          const img = new Image()
          img.onload = () => {
            const canvas = document.createElement('canvas')
            canvas.width = img.width
            canvas.height = img.height
            const ctx = canvas.getContext('2d')
            if (!ctx) {
              resolve(null)
              return
            }

            // Draw original image
            ctx.drawImage(img, 0, 0)

            // Get image data for pixel manipulation
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const data = imageData.data

            // Apply color temperature adjustment first
            if (settings.colorTemperature !== 0) {
              const tempAdj = settings.colorTemperature / 10 // Scale down
              for (let i = 0; i < data.length; i += 4) {
                data[i] = Math.max(0, Math.min(255, data[i] + tempAdj))     // R
                data[i + 2] = Math.max(0, Math.min(255, data[i + 2] - tempAdj)) // B
              }
            }

            // Apply brightness and contrast
            const factor = (259 * (settings.contrast + 255)) / (255 * (259 - settings.contrast))
            const avgBrightness = settings.brightness

            for (let i = 0; i < data.length; i += 4) {
              // Brightness
              data[i] = Math.min(255, Math.max(0, data[i] + avgBrightness))
              data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + avgBrightness))
              data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + avgBrightness))

              // Contrast
              data[i] = factor * (data[i] - 128) + 128
              data[i + 1] = factor * (data[i + 1] - 128) + 128
              data[i + 2] = factor * (data[i + 2] - 128) + 128

              // Clamp values
              data[i] = Math.min(255, Math.max(0, data[i]))
              data[i + 1] = Math.min(255, Math.max(0, data[i + 1]))
              data[i + 2] = Math.min(255, Math.max(0, data[i + 2]))
            }

            ctx.putImageData(imageData, 0, 0)

            // Noise reduction (simple box blur kernel)
            if (settings.noiseReduction) {
              const blurredData = ctx.getImageData(0, 0, canvas.width, canvas.height)
              const bData = blurredData.data
              const temp = new Uint8ClampedArray(bData)
              
              const kernelRadius = 1
              for (let y = 1; y < canvas.height - 1; y++) {
                for (let x = 1; x < canvas.width - 1; x++) {
                  for (let c = 0; c < 3; c++) {
                    let sum = 0
                    let count = 0
                    for (let ky = -kernelRadius; ky <= kernelRadius; ky++) {
                      for (let kx = -kernelRadius; kx <= kernelRadius; kx++) {
                        const idx = ((y + ky) * canvas.width + (x + kx)) * 4 + c
                        sum += temp[idx]
                        count++
                      }
                    }
                    const idx = (y * canvas.width + x) * 4 + c
                    bData[idx] = Math.round(sum / count)
                  }
                }
              }
              ctx.putImageData(blurredData, 0, 0)
            }

            // Sharpening (unsharp mask)
            if (settings.sharpen > 0) {
              const sharpData = ctx.getImageData(0, 0, canvas.width, canvas.height)
              const sData = sharpData.data
              const original = new Uint8ClampedArray(sData)
              
              const amount = settings.sharpen / 100
              
              for (let y = 1; y < canvas.height - 1; y++) {
                for (let x = 1; x < canvas.width - 1; x++) {
                  for (let c = 0; c < 3; c++) {
                    const center = original[(y * canvas.width + x) * 4 + c]
                    const neighbors =
                      (original[((y - 1) * canvas.width + x) * 4 + c] +
                        original[((y + 1) * canvas.width + x) * 4 + c] +
                        original[(y * canvas.width + (x - 1)) * 4 + c] +
                        original[(y * canvas.width + (x + 1)) * 4 + c]) /
                      4
                    
                    const diff = center - neighbors
                    sData[(y * canvas.width + x) * 4 + c] = Math.min(
                      255,
                      Math.max(0, center + amount * diff),
                    )
                  }
                }
              }
              ctx.putImageData(sharpData, 0, 0)
            }

            canvas.toBlob(resolve, 'image/png')
          }
          img.onerror = () => resolve(null)
          img.src = e.target?.result as string
        }
        reader.onerror = () => resolve(null)
        reader.readAsDataURL(file)
      })
    },
    [],
  )

  const handleProcess = useCallback(async () => {
    if (files.length === 0) {
      setError('Please add at least one image to enhance.')
      return
    }

    setProcessing(true)
    setProgress(0)
    setError(null)
    setIsEnhanced(false)

    const processedFiles: { blob: Blob; name: string }[] = []
    for (let i = 0; i < files.length; i++) {
      const enhancedBlob = await applyEnhancement(files[i].file, settings)
      if (enhancedBlob) {
        processedFiles.push({ blob: enhancedBlob, name: files[i].name })
      }
      setProgress(((i + 1) / files.length) * 100)
    }

    // Create preview URL for first enhanced image
    if (processedFiles.length > 0) {
      const url = URL.createObjectURL(processedFiles[0].blob)
      setEnhancedUrl(url)
      setIsEnhanced(true)
    }

    setProcessing(false)
  }, [files, settings, applyEnhancement])

  const handleDownloadAll = useCallback(() => {
    files.forEach((file) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      // This would need actual processed data - skipping for now
    })
  }, [files])

  const handleClear = useCallback(() => {
    setFiles([])
    setSettings(DEFAULT_SETTINGS)
    setProgress(0)
    setPreviewUrl(null)
    setEnhancedUrl(null)
    setError(null)
    setIsEnhanced(false)
  }, [])

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      accept="image/*"
      instructions="Drop images to enhance, or click to browse your device."
      onProcess={async (_files: ToolFile[], context) => {
        if (_files.length === 0) {
          context.setError('Please add at least one image.')
          return
        }
        context.setProgress(10)
        setProgress(10)
        
        const processedFiles: { blob: Blob; name: string }[] = []
        for (let i = 0; i < _files.length; i++) {
          const enhancedBlob = await applyEnhancement(_files[i].file, settings)
          if (enhancedBlob) {
            processedFiles.push({ blob: enhancedBlob, name: _files[i].name })
          }
          context.setProgress(10 + ((i + 1) / _files.length) * 90)
          setProgress(10 + ((i + 1) / _files.length) * 90)
        }

        if (processedFiles.length > 0) {
          const url = URL.createObjectURL(processedFiles[0].blob)
          setEnhancedUrl(url)
          setIsEnhanced(true)
        }

        context.setResult(
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-text">Enhanced Images Ready</h3>
            <p className="text-xs text-muted">
              Processed {processedFiles.length} image{processedFiles.length > 1 ? 's' : ''}.
            </p>
            <Button
              variant="secondary"
              onClick={() => {
                processedFiles.forEach((pf, i) => {
                  const url = URL.createObjectURL(pf.blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `enhanced-${pf.name}`
                  a.click()
                  URL.revokeObjectURL(url)
                })
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Download All
            </Button>
          </div>,
        )
      }}
      options={
        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">File Queue</div>
            <div className="space-y-2">
              {files.length > 0 ? (
                <div className="space-y-1">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-base/60 p-2"
                    >
                      <div className="text-xs text-muted truncate mr-2">
                        {file.name}
                      </div>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          setFiles((prev) => prev.filter((f) => f.id !== file.id))
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted">No files added</div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Enhancements</div>
            
            <Switch
              checked={settings.autoContrast}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setSettings((s) => ({ ...s, autoContrast: e.target.checked }))
              }
              label="Auto-contrast"
            />

            <Switch
              checked={settings.noiseReduction}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setSettings((s) => ({ ...s, noiseReduction: e.target.checked }))
              }
              label="Noise Reduction"
            />
          </div>

          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase text-muted">Advanced</div>
            <Button
              variant="ghost"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full justify-between text-xs"
            >
              <span>{showAdvanced ? 'Hide' : 'Show'} Advanced Options</span>
              {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
            
            {showAdvanced && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="text-xs text-muted">Brightness</div>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={settings.brightness}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setSettings((s) => ({
                        ...s,
                        brightness: Number(e.target.value),
                      }))
                    }
                    className="w-full"
                  />
                  <div className="text-xs text-text text-right">
                    {settings.brightness > 0 ? '+' : ''}
                    {settings.brightness}%
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-muted">Contrast</div>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={settings.contrast}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setSettings((s) => ({ ...s, contrast: Number(e.target.value) }))
                    }
                    className="w-full"
                  />
                  <div className="text-xs text-text text-right">
                    {settings.contrast > 0 ? '+' : ''}
                    {settings.contrast}%
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-muted">Sharpening</div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={settings.sharpen}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setSettings((s) => ({ ...s, sharpen: Number(e.target.value) }))
                    }
                    className="w-full"
                  />
                  <div className="text-xs text-text text-right">
                    {settings.sharpen}%
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-muted">Color Temperature</div>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={settings.colorTemperature}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setSettings((s) => ({
                        ...s,
                        colorTemperature: Number(e.target.value),
                      }))
                    }
                    className="w-full"
                  />
                  <div className="text-xs text-text text-right">
                    {settings.colorTemperature > 0 ? 'Warmer' : settings.colorTemperature < 0 ? 'Cooler' : 'Neutral'}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={handleBrowse}
              className="flex-1"
            >
              <FilePlus className="mr-2 h-4 w-4" />
              Add Files
            </Button>
            <Button
              variant="ghost"
              onClick={handleClear}
              disabled={files.length === 0}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <Badge className="border-0 bg-accent/15 text-accent">
            Offline • Client-side only
          </Badge>
        </div>
      }
    />
  )
}
