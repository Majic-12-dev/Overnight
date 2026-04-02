import { useState } from 'react'
import type { ReactNode } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'

type ImageRotateFlipToolProps = {
  tool: ToolDefinition
}

type TransformMode = 'rotate-90' | 'rotate-180' | 'rotate-270' | 'flip-h' | 'flip-v'

export function ImageRotateFlipTool({ tool }: ImageRotateFlipToolProps) {
  const [mode, setMode] = useState<TransformMode>('rotate-90')
  const [isProcessing, setIsProcessing] = useState(false)

  const loadImage = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        URL.revokeObjectURL(src)
        resolve(img)
      }
      img.onerror = () => reject(new Error('Failed to load image.'))
      img.src = src
    })

  const applyTransform = async (file: File, mode: TransformMode): Promise<Blob> => {
    const imgUrl = URL.createObjectURL(file)
    try {
      const img = await loadImage(imgUrl)
      const needsSwap = mode === 'rotate-90' || mode === 'rotate-270'
      const canvas = document.createElement('canvas')
      canvas.width = needsSwap ? img.height : img.width
      canvas.height = needsSwap ? img.width : img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas 2D context unavailable')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()

      if (mode === 'rotate-90') {
        ctx.translate(canvas.width, 0)
        ctx.rotate(Math.PI / 2)
      } else if (mode === 'rotate-180') {
        ctx.translate(canvas.width, canvas.height)
        ctx.rotate(Math.PI)
      } else if (mode === 'rotate-270') {
        ctx.translate(0, canvas.height)
        ctx.rotate(-Math.PI / 2)
      } else if (mode === 'flip-h') {
        ctx.translate(img.width, 0)
        ctx.scale(-1, 1)
      } else if (mode === 'flip-v') {
        ctx.translate(0, img.height)
        ctx.scale(1, -1)
      }

      ctx.drawImage(img, 0, 0)
      ctx.restore()
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('Failed to create transformed image blob.')
      return blob
    } finally {
      URL.revokeObjectURL(imgUrl)
    }
  }

  const downloadBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
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

    try {
      const total = files.length
      let completed = 0
      const errors: Array<{ name: string; message: string }> = []
      const blobs: { name: string; blob: Blob }[] = []

      for (const toolFile of files) {
        try {
          const resultBlob = await applyTransform(toolFile.file, mode)
          const outName = toolFile.name.replace(/\.[^.]+$/, '') + '_' + mode + '.png'
          blobs.push({ name: outName, blob: resultBlob })
          completed++
        } catch (err) {
          errors.push({ name: toolFile.name, message: err instanceof Error ? err.message : String(err) })
        }
        context.setProgress(Math.round((completed / total) * 90))
      }

      context.setProgress(100)

      const resultCard: ReactNode = (
        <Card className="space-y-3 border-border bg-base/60 p-4">
          <h3 className="text-sm font-semibold text-text">Transform Complete</h3>
          <Badge className="border-0 bg-accent/15 text-accent">{completed} file(s) processed</Badge>
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
      context.setError(err instanceof Error ? err.message : 'Transform failed.')
    } finally {
      setIsProcessing(false)
    }
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
          <p className="text-xs text-muted">Select the rotation or flip to apply to all images.</p>
          <div>
            <label className="text-xs font-medium">Transform</label>
            <Select value={mode} onChange={(e) => setMode(e.target.value as TransformMode)}>
              <option value="rotate-90">Rotate 90° CW</option>
              <option value="rotate-180">Rotate 180°</option>
              <option value="rotate-270">Rotate 270° CW (90° CCW)</option>
              <option value="flip-h">Flip Horizontal</option>
              <option value="flip-v">Flip Vertical</option>
            </Select>
          </div>
        </div>
      }
    />
  )
}
