import { useState, useCallback } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Layers, Download, ImageOff, AlertCircle } from 'lucide-react'

export default function ImageDiffTool({ tool }: { tool: ToolDefinition }) {
  const [imageA, setImageA] = useState<string | null>(null)
  const [imageB, setImageB] = useState<string | null>(null)
  const [threshold, setThreshold] = useState(10)
  const [diffPercent, setDiffPercent] = useState<number | null>(null)
  const [diffImageUrl, setDiffImageUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadImage = (file: File, setter: (v: string) => void) => {
    const reader = new FileReader()
    reader.onload = (e) => setter(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  const compareImages = useCallback(() => {
    if (!imageA || !imageB) return
    setError(null)
    const imgA = new Image()
    const imgB = new Image()
    let loaded = 0
    const onLoad = () => {
      loaded++
      if (loaded < 2) return

      const w = Math.min(imgA.width, imgB.width)
      const h = Math.min(imgA.height, imgB.height)

      if (w === 0 || h === 0) {
        setError('One or both images have zero dimensions.')
        return
      }

      const drawToCanvas = (img: HTMLImageElement) => {
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        const ctx = c.getContext('2d')!
        ctx.drawImage(img, 0, 0, w, h)
        return ctx.getImageData(0, 0, w, h).data
      }

      const dataA = drawToCanvas(imgA)
      const dataB = drawToCanvas(imgB)

      const diffCanvas = document.createElement('canvas')
      diffCanvas.width = w
      diffCanvas.height = h
      const diffCtx = diffCanvas.getContext('2d')!
      const diffData = diffCtx.createImageData(w, h)

      let diffPixels = 0
      const totalPixels = w * h

      for (let i = 0; i < dataA.length; i += 4) {
        const dr = Math.abs(dataA[i] - dataB[i])
        const dg = Math.abs(dataA[i + 1] - dataB[i + 1])
        const db = Math.abs(dataA[i + 2] - dataB[i + 2])
        const diff = Math.sqrt(dr * dr + dg * dg + db * db)

        if (diff > threshold) {
          diffPixels++
          diffData.data[i] = 255
          diffData.data[i + 1] = 0
          diffData.data[i + 2] = 128
          diffData.data[i + 3] = 180
        } else {
          diffData.data[i] = dataA[i] * 0.5
          diffData.data[i + 1] = dataA[i + 1] * 0.5
          diffData.data[i + 2] = dataA[i + 2] * 0.5
          diffData.data[i + 3] = 255
        }
      }

      diffCtx.putImageData(diffData, 0, 0)
      const url = diffCanvas.toDataURL('image/png')
      setDiffImageUrl(url)
      setDiffPercent((diffPixels / totalPixels) * 100)
    }

    imgA.onload = onLoad
    imgB.onload = onLoad
    imgA.src = imageA
    imgB.src = imageB
  }, [imageA, imageB, threshold])

  const downloadDiff = () => {
    if (!diffImageUrl) return
    const a = document.createElement('a')
    a.href = diffImageUrl
    a.download = 'image-diff.png'
    a.click()
  }

  const handleReset = () => {
    setImageA(null)
    setImageB(null)
    setDiffImageUrl(null)
    setDiffPercent(null)
    setError(null)
  }

  return (
    <BaseToolLayout title={tool.name} description={tool.description}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted mb-1">Image A</p>
            {imageA ? (
              <img src={imageA} alt="A" className="w-full rounded-lg border border-border" />
            ) : (
              <label className="flex flex-col items-center justify-center h-40 rounded-lg border-2 border-dashed border-border/50 cursor-pointer hover:border-accent/50">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && loadImage(e.target.files[0], setImageA)}
                />
                <ImageOff className="w-8 h-8 text-muted mb-1" />
                <span className="text-sm text-muted">Click to upload</span>
              </label>
            )}
          </div>
          <div>
            <p className="text-sm text-muted mb-1">Image B</p>
            {imageB ? (
              <img src={imageB} alt="B" className="w-full rounded-lg border border-border" />
            ) : (
              <label className="flex flex-col items-center justify-center h-40 rounded-lg border-2 border-dashed border-border/50 cursor-pointer hover:border-accent/50">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && loadImage(e.target.files[0], setImageB)}
                />
                <ImageOff className="w-8 h-8 text-muted mb-1" />
                <span className="text-sm text-muted">Click to upload</span>
              </label>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Button size="sm" onClick={compareImages} disabled={!imageA || !imageB}>
            <Layers className="w-4 h-4 mr-1" /> Compare
          </Button>
          <Button size="sm" variant="outline" onClick={handleReset}>
            Reset
          </Button>
          <div className="flex items-center gap-2 ml-auto">
            <label className="text-xs text-muted">Threshold:</label>
            <input
              type="range"
              min="0"
              max="255"
              value={threshold}
              onChange={(e) => setThreshold(parseInt(e.target.value))}
              className="w-24"
            />
            <span className="text-xs text-muted">{threshold}</span>
          </div>
        </div>

        {error && (
          <Card className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="w-4 h-4 inline mr-1" /> {error}
          </Card>
        )}

        {diffPercent !== null && (
          <Badge
            className={
              diffPercent < 1
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : diffPercent < 10
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  : 'bg-red-500/15 text-red-400 border-red-500/30'
            }
          >
            {diffPercent.toFixed(2)}% pixels differ
          </Badge>
        )}

        {diffImageUrl && (
          <div>
            <p className="text-sm text-muted mb-2">Difference Overlay</p>
            <img src={diffImageUrl} alt="Diff" className="w-full rounded-lg border border-border" />
            <Button size="sm" variant="outline" className="mt-2" onClick={downloadDiff}>
              <Download className="w-4 h-4 mr-1" /> Download Diff
            </Button>
          </div>
        )}
      </div>
    </BaseToolLayout>
  )
}
