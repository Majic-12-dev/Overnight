import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { PDFDocument, rgb, degrees } from 'pdf-lib'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import type { ToolFile } from '@/components/tools/BaseToolLayout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

import { Eraser, FileDown, ImageUp, Pen, Trash2 } from 'lucide-react'

type PdfSignToolProps = {
  tool: ToolDefinition
}

type SignatureMode = 'text' | 'draw' | 'image'

export function PdfSignTool({ tool }: PdfSignToolProps) {
  const [mode, setMode] = useState<SignatureMode>('draw')
  const [signText, setSignText] = useState('')
  const [fontFamily, setFontFamily] = useState('Helvetica')
  const [fontSize, setFontSize] = useState(36)
  const [opacity, setOpacity] = useState(0.8)
  const [rotation, setRotation] = useState(0)
  const [colorHex, setColorHex] = useState('#000000')
  const [imagePath, setImagePath] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [pageSelection, setPageSelection] = useState<'all' | 'first' | 'last'>('all')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const hasDrawnRef = useRef(false)

  const imageInputRef = useRef<HTMLInputElement>(null)

  // Track blob URLs for cleanup
  const [resultBlobUrls, setResultBlobUrls] = useState<string[]>([])

  // Revoke all blob URLs on unmount or when results change
  useEffect(() => {
    return () => {
      resultBlobUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [resultBlobUrls])

  const revokeAndDownload = useCallback((url: string, filename: string) => {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    // Revoke after a short delay to ensure the download starts
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }, [])

  const hexToRgb = useCallback(
    (hex: string): { r: number; g: number; b: number } => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
      if (!result) return { r: 0, g: 0, b: 0 }
      return {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255,
      }
    },
    [],
  )

  // Canvas drawing handlers
  const getCtx = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return null
    return canvas.getContext('2d')
  }, [])

  const clearCanvas = useCallback(() => {
    const ctx = getCtx()
    const canvas = canvasRef.current
    if (!ctx || !canvas) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    hasDrawnRef.current = false
  }, [getCtx])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * (window.devicePixelRatio || 1)
    canvas.height = rect.height * (window.devicePixelRatio || 1)
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1)
      ctx.strokeStyle = colorHex
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, rect.width, rect.height)
    }
  }, [])

  useEffect(() => {
    const ctx = getCtx()
    if (ctx) {
      ctx.strokeStyle = colorHex
    }
  }, [colorHex, getCtx])

  const getCanvasPos = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current
      if (!canvas) return { x: 0, y: 0 }
      const rect = canvas.getBoundingClientRect()
      return { x: clientX - rect.left, y: clientY - rect.top }
    },
    [],
  )

  const handleDrawStart = useCallback(
    (clientX: number, clientY: number) => {
      const ctx = getCtx()
      if (!ctx) return
      setIsDrawing(true)
      hasDrawnRef.current = true
      const pos = getCanvasPos(clientX, clientY)
      ctx.beginPath()
      ctx.moveTo(pos.x, pos.y)
    },
    [getCtx, getCanvasPos],
  )

  const handleDrawMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDrawing) return
      const ctx = getCtx()
      if (!ctx) return
      const pos = getCanvasPos(clientX, clientY)
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
    },
    [isDrawing, getCtx, getCanvasPos],
  )

  const handleDrawEnd = useCallback(() => {
    setIsDrawing(false)
  }, [])

  // Mouse event handlers (wrap clientX/clientY)
  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    handleDrawStart(e.clientX, e.clientY)
  }, [handleDrawStart])

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    handleDrawMove(e.clientX, e.clientY)
  }, [handleDrawMove])

  // Touch event handlers
  const onTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const touch = e.touches[0]
    if (touch) handleDrawStart(touch.clientX, touch.clientY)
  }, [handleDrawStart])

  const onTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const touch = e.changedTouches[0]
    if (touch) handleDrawMove(touch.clientX, touch.clientY)
  }, [handleDrawMove])

  const onTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    handleDrawEnd()
  }, [handleDrawEnd])

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => {
      setImagePath(ev.target?.result as string)
    }
    reader.readAsDataURL(file)
  }, [])

  const getSignatureImageBytes = useCallback(async (): Promise<{
    bytes: Uint8Array
    isPng: boolean
  } | null> => {
    if (mode === 'text' && signText.trim()) {
      try {
        const c = document.createElement('canvas')
        const ctx = c.getContext('2d')
        if (!ctx) return null

        const font = `${fontSize}px ${fontFamily}`
        ctx.font = font
        const metrics = ctx.measureText(signText)
        const textWidth = metrics.width
        const textHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent

        const padding = 20
        c.width = textWidth + padding * 2
        c.height = textHeight + padding * 2

        ctx.font = font
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, c.width, c.height)
        ctx.fillStyle = colorHex
        ctx.textBaseline = 'top'
        ctx.fillText(signText, padding, padding)

        const blob = await new Promise<Blob | null>((resolve) =>
          c.toBlob((b) => resolve(b), 'image/png'),
        )
        if (!blob) return null
        const buffer = await blob.arrayBuffer()
        return { bytes: new Uint8Array(buffer), isPng: true }
      } catch {
        return null
      }
    }

    if (mode === 'draw') {
      const canvas = canvasRef.current
      if (!canvas || !hasDrawnRef.current) return null
      try {
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((b) => resolve(b), 'image/png'),
        )
        if (!blob) return null
        const buffer = await blob.arrayBuffer()
        return { bytes: new Uint8Array(buffer), isPng: true }
      } catch {
        return null
      }
    }

    if (mode === 'image' && imageFile) {
      try {
        const buffer = await imageFile.arrayBuffer()
        const isPng = imageFile.type === 'image/png'
        return { bytes: new Uint8Array(buffer), isPng }
      } catch {
        return null
      }
    }

    return null
  }, [mode, signText, fontFamily, fontSize, colorHex, imageFile])

  const handleProcess = async (
    files: ToolFile[],
    context: {
      setProgress: (value: number) => void
      setResult: (result: ReactNode | null) => void
      setError: (message: string | null) => void
    },
  ) => {
    try {
      // Validate signature input
      if (mode === 'text' && !signText.trim()) {
        throw new Error('Enter signature text to continue.')
      }
      if (mode === 'draw' && !hasDrawnRef.current) {
        throw new Error('Draw your signature on the canvas before processing.')
      }
      if (mode === 'image' && !imageFile) {
        throw new Error('Upload a signature image to continue.')
      }

      context.setProgress(10)

      const sigData = await getSignatureImageBytes()
      if (!sigData) {
        throw new Error('Could not generate signature image. Try again.')
      }

      context.setProgress(30)

      const results: { name: string; blobUrl: string; byteSize: number }[] = []
      let processedCount = 0

      for (const toolFile of files) {
        try {
          const arrayBuffer = await toolFile.file.arrayBuffer()
          const pdfDoc = await PDFDocument.load(arrayBuffer)
          const pages = pdfDoc.getPages()

          if (pages.length === 0) {
            continue
          }

          let targetIndices = pages.map((_, i) => i)
          if (pageSelection === 'first') targetIndices = [0]
          else if (pageSelection === 'last') targetIndices = [pages.length - 1]

          let sigImage: any
          if (sigData.isPng) {
            sigImage = await pdfDoc.embedPng(sigData.bytes)
          } else {
            sigImage = await pdfDoc.embedJpg(sigData.bytes)
          }

          const sigDims = sigImage.scale(1)
          const sigWidth = fontSize * 3
          const sigHeight = (sigDims.height / sigDims.width) * sigWidth

          for (const idx of targetIndices) {
            const page = pages[idx]
            const { width, height } = page.getSize()

            const x = width / 2 - sigWidth / 2
            const y = height * 0.1

            page.drawImage(sigImage, {
              x,
              y,
              width: sigWidth,
              height: sigHeight,
              opacity,
              rotate: degrees(rotation),
            })
          }

          const pdfBytes = await pdfDoc.save()
          const blob = new Blob([pdfBytes.buffer as BlobPart], { type: 'application/pdf' })
          const blobUrl = URL.createObjectURL(blob)

          results.push({
            name: toolFile.name,
            blobUrl,
            byteSize: pdfBytes.length,
          })
          processedCount++
        } catch (err) {
          console.error(`Failed to sign ${toolFile.name}:`, err)
        }

        context.setProgress(30 + (processedCount / files.length) * 60)
      }

      if (processedCount === 0) {
        throw new Error('No files could be processed.')
      }

      // Track blob URLs for cleanup
      setResultBlobUrls(results.map((r) => r.blobUrl))

      context.setProgress(100)
      context.setResult(
        <div className="space-y-4">
          <Badge className="border-0 bg-accent/15 text-accent">
            Signed {processedCount} file(s)
          </Badge>
          <div className="space-y-2">
            {results.map((r) => (
              <div
                key={r.blobUrl}
                className="flex items-center justify-between rounded-xl border border-border bg-base/60 px-3 py-2 text-sm"
              >
                <div>
                  <div className="font-medium text-text">{r.name}</div>
                  <div className="text-xs text-muted">
                    {(r.byteSize / 1024).toFixed(1)} KB
                  </div>
                </div>
                <a
                  href={r.blobUrl}
                  download={`signed_${r.name}`}
                  className="inline-flex items-center rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
                  onClick={(e) => {
                    e.preventDefault()
                    revokeAndDownload(r.blobUrl, `signed_${r.name}`)
                  }}
                  role="button"
                  aria-label={`Download signed ${r.name}`}
                >
                  <FileDown className="mr-1 h-3 w-3" />
                  Download
                </a>
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              results.forEach((r) => {
                revokeAndDownload(r.blobUrl, `signed_${r.name}`)
              })
            }}
            aria-label="Download all signed files"
          >
            <FileDown className="mr-1 h-3 w-3" />
            Download All
          </Button>
        </div>,
      )
    } catch (err) {
      context.setError(err instanceof Error ? err.message : 'Failed to sign PDF.')
    }
  }

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      accept=".pdf,application/pdf"
      onProcess={handleProcess}
      options={
        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <div id="signatureMode" className="text-xs font-semibold uppercase text-muted">Signature Mode</div>
            <Select value={mode} onChange={(event) => setMode(event.target.value as SignatureMode)} aria-labelledby="signatureMode">
              <option value="draw">Draw</option>
              <option value="text">Text</option>
              <option value="image">Image</option>
            </Select>
          </div>

          {mode === 'text' && (
            <div className="space-y-2">
              <div id="signatureText" className="text-xs font-semibold uppercase text-muted">Signature Text</div>
              <Input
                value={signText}
                onChange={(event) => setSignText(event.target.value)}
                placeholder="Type your signature..."
                aria-labelledby="signatureText"
              />
              <Select
                value={fontFamily}
                onChange={(event) => setFontFamily(event.target.value)}
                aria-label="Font family"
              >
                <option value="Helvetica">Helvetica</option>
                <option value="TimesRoman">Times Roman</option>
                <option value="Courier">Courier</option>
              </Select>
              <div className="space-y-1">
                <label htmlFor="fontSize" className="text-xs text-muted">Font Size: {fontSize}</label>
                <Input
                  id="fontSize"
                  type="number"
                  min={12}
                  max={120}
                  value={fontSize}
                  onChange={(event) => setFontSize(Number(event.target.value))}
                  aria-label="Font size"
                />
              </div>
            </div>
          )}

          {mode === 'draw' && (
            <div className="space-y-2">
              <div id="drawSignature" className="text-xs font-semibold uppercase text-muted">Draw Signature</div>
              <div className="rounded-xl border border-border bg-white">
                <canvas
                  ref={canvasRef}
                  className="h-32 w-full cursor-crosshair touch-none"
                  style={{ display: 'block' }}
                  onMouseDown={onMouseDown}
                  onMouseMove={onMouseMove}
                  onMouseUp={handleDrawEnd}
                  onMouseLeave={handleDrawEnd}
                  onTouchStart={onTouchStart}
                  onTouchMove={onTouchMove}
                  onTouchEnd={onTouchEnd}
                  role="img"
                  aria-labelledby="drawSignature"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={clearCanvas} aria-label="Clear signature canvas">
                  <Eraser className="mr-1 h-3 w-3" />
                  Clear
                </Button>
              </div>
            </div>
          )}

          {mode === 'image' && (
            <div className="space-y-2">
              <div id="uploadSignature" className="text-xs font-semibold uppercase text-muted">Upload Signature</div>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/png,image/jpeg"
                onChange={handleImageUpload}
                className="hidden"
                aria-label="Upload signature image"
              />
              {imagePath ? (
                <div className="space-y-2">
                  <img
                    src={imagePath}
                    alt="Signature preview"
                    className="max-h-24 rounded-xl border border-border bg-white"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setImagePath(null)
                      setImageFile(null)
                    }}
                    aria-label="Remove signature image"
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    Remove
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => imageInputRef.current?.click()}
                  aria-label="Choose signature image file"
                >
                  <ImageUp className="mr-1 h-3 w-3" />
                  Choose Image
                </Button>
              )}
            </div>
          )}

          <div className="space-y-2">
            <div id="appearance" className="text-xs font-semibold uppercase text-muted">Appearance</div>
            <div className="space-y-1">
              <label htmlFor="opacityInput" className="text-xs text-muted">Opacity: {opacity}</label>
              <Input
                id="opacityInput"
                type="number"
                min={0.1}
                max={1}
                step={0.05}
                value={opacity}
                onChange={(event) => setOpacity(Number(event.target.value))}
                aria-label="Opacity"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="rotationInput" className="text-xs text-muted">Rotation: {rotation}°</label>
              <Input
                id="rotationInput"
                type="number"
                min={-180}
                max={180}
                value={rotation}
                onChange={(event) => setRotation(Number(event.target.value))}
                aria-label="Rotation degrees"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="colorInput" className="text-xs text-muted">Color</label>
              <div className="flex items-center gap-2">
                <input
                  id="colorInput"
                  type="color"
                  value={colorHex}
                  onChange={(event) => setColorHex(event.target.value)}
                  className="h-8 w-10 cursor-pointer rounded border border-border"
                  aria-label="Signature color"
                />
                <span className="text-xs text-muted font-mono">{colorHex}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div id="applyTo" className="text-xs font-semibold uppercase text-muted">Apply To</div>
            <Select
              value={pageSelection}
              onChange={(event) => setPageSelection(event.target.value as typeof pageSelection)}
              aria-labelledby="applyTo"
            >
              <option value="all">All Pages</option>
              <option value="first">First Page Only</option>
              <option value="last">Last Page Only</option>
            </Select>
          </div>
        </div>
      }
    />
  )
}
