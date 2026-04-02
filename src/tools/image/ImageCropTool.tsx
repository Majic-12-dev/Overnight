import { useState } from 'react'
import type { ReactNode } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

type ImageCropToolProps = {
  tool: ToolDefinition
}

type CropPreset = 'free' | '1:1' | '4:3' | '16:9' | '3:2' | 'custom'

export function ImageCropTool({ tool }: ImageCropToolProps) {
  const [preset, setPreset] = useState<CropPreset>('free')
  const [customW, setCustomW] = useState(1)
  const [customH, setCustomH] = useState(1)
  const [isProcessing, setIsProcessing] = useState(false)

  const getAspect = (): number | null => {
    if (preset === 'free') return null
    if (preset === 'custom') return customH > 0 ? customW / customH : null
    const [w, h] = preset.split(':').map(Number)
    return w / h
  }

  const handleProcess = async (
    files: Array<{ file: File; name: string }>,
    context: { setProgress: (v: number) => void; setResult: (r: ReactNode | null) => void; setError: (m: string | null) => void }
  ) => {
    if (!files.length) {
      context.setError('No files selected.')
      return
    }

    setIsProcessing(true)
    context.setProgress(0)

    const aspect = getAspect()
    if (aspect === null) {
      context.setError('No crop aspect ratio selected. Choose a preset or custom ratio.')
      setIsProcessing(false)
      return
    }

    try {
      const total = files.length
      let completed = 0
      const errors: Array<{ name: string; message: string }> = []
      const blobs: { name: string; blob: Blob }[] = []

      for (const toolFile of files) {
        try {
          const blob = await cropImage(toolFile.file, aspect)
          const outName = toolFile.name.replace(/\.[^.]+$/, '') + '_cropped.png'
          blobs.push({ name: outName, blob })
          completed++
        } catch (err) {
          errors.push({ name: toolFile.name, message: err instanceof Error ? err.message : String(err) })
        }
        context.setProgress(Math.round((completed / total) * 90))
      }

      context.setProgress(100)

      const resultCard: ReactNode = (
        <Card className="space-y-3 border-border bg-base/60 p-4">
          <h3 className="text-sm font-semibold text-text">Crop Complete</h3>
          <Badge className="border-0 bg-accent/15 text-accent">
            {completed} file(s) cropped
          </Badge>
          {errors.length > 0 && (
            <span className="ml-2 text-sm text-red-500">{errors.length} failed</span>
          )}
          <div className="space-y-1">
            {blobs.map((b, i) => (
              <Button key={i} variant="secondary" onClick={() => downloadBlob(b.blob, b.name)}>
                {b.name}
              </Button>
            ))}
          </div>
          {errors.length > 0 && (
            <div className="text-xs text-red-500">
              {errors.map((e, i) => (
                <div key={i}>{e.name}: {e.message}</div>
              ))}
            </div>
          )}
        </Card>
      )

      context.setResult(resultCard)
    } catch (err) {
      context.setError(err instanceof Error ? err.message : 'Crop operation failed.')
    } finally {
      setIsProcessing(false)
    }
  }

  const cropImage = async (file: File, aspect: number): Promise<Blob> => {
    const imgUrl = URL.createObjectURL(file)
    try {
      const img = await loadImage(imgUrl)
      const imgAspect = img.width / img.height
      let cropW: number, cropH: number
      if (imgAspect > aspect) {
        cropH = img.height
        cropW = img.height * aspect
      } else {
        cropW = img.width
        cropH = img.width / aspect
      }
      const sx = (img.width - cropW) / 2
      const sy = (img.height - cropH) / 2
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(cropW)
      canvas.height = Math.round(cropH)
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Failed to get canvas 2D context.')
      ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, cropW, cropH)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('Failed to create cropped image blob.')
      return blob
    } finally {
      URL.revokeObjectURL(imgUrl)
    }
  }

  const loadImage = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        resolve(img)
      }
      img.onerror = () => reject(new Error('Failed to load image.'))
      img.src = src
    })

  const downloadBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      accept="image/*"
      onProcess={handleProcess}
      loading={isProcessing}
      options={
        <div className="space-y-4 text-sm">
          <p className="text-xs text-muted">Crop all uploaded images to center region with the chosen aspect ratio.</p>
          <div>
            <label className="text-xs font-medium">Aspect Ratio</label>
            <select value={preset} onChange={(e) => setPreset(e.target.value as CropPreset)} className="w-full rounded-lg border border-border bg-base p-2 text-sm text-text">
              <option value="1:1">1:1 Square</option>
              <option value="4:3">4:3 Standard</option>
              <option value="16:9">16:9 Widescreen</option>
              <option value="3:2">3:2 Photo</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          {preset === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="number" min={1} value={customW} onChange={(e) => setCustomW(Number(e.target.value))} className="w-16 rounded border border-border bg-base p-1 text-sm text-text" />
              <span className="text-muted">:</span>
              <input type="number" min={1} value={customH} onChange={(e) => setCustomH(Number(e.target.value))} className="w-16 rounded border border-border bg-base p-1 text-sm text-text" />
              <span className="text-xs text-muted">(W:H)</span>
            </div>
          )}
        </div>
      }
    />
  )
}
