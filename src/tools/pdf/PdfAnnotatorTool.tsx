import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { PDFDocument, rgb } from 'pdf-lib'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { ToolFile } from '@/components/tools/BaseToolLayout'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { FileDown } from 'lucide-react'

type PdfAnnotatorToolProps = {
  tool: ToolDefinition
}

type AnnotationType = 'text' | 'highlight'

enum FontFamily {
  Helvetica = 'Helvetica',
  TimesRoman = 'TimesRoman',
  Courier = 'Courier',
}

export function PdfAnnotatorTool({ tool }: PdfAnnotatorToolProps) {
  const [annotationType, setAnnotationType] = useState<AnnotationType>('text')
  const [annotationText, setAnnotationText] = useState('')
  const [pageNumber, setPageNumber] = useState(1)
  const [fontSize, setFontSize] = useState(16)
  const [fontFamily, setFontFamily] = useState<FontFamily>(FontFamily.Helvetica)
  const [opacity, setOpacity] = useState(0.75)
  const [colorHex, setColorHex] = useState('#ffff00')
  const [useCustomColor, setUseCustomColor] = useState(false)
  const [pageRangeType, setPageRangeType] = useState<'all' | 'specific'>('all')
  const [specificPages, setSpecificPages] = useState('')
  const [textX, setTextX] = useState(50)
  const [textY, setTextY] = useState(50)
  const [highlightY, setHighlightY] = useState(50)

  // Track blob URLs for cleanup on unmount
  const [resultBlobUrls, setResultBlobUrls] = useState<string[]>([])

  useEffect(() => {
    return () => {
      resultBlobUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [resultBlobUrls])

  const highlightColors: Record<string, { hex: string; label: string }> = {
    yellow: { hex: '#ffff00', label: 'Yellow' },
    green: { hex: '#00ff00', label: 'Green' },
    blue: { hex: '#0080ff', label: 'Blue' },
    red: { hex: '#ff0000', label: 'Red' },
  }

  const isHighlightMode = annotationType === 'highlight'

  const parsePageNumbers = useCallback((input: string, maxPages: number): number[] => {
    const indices: number[] = []
    const parts = input.split(',').map((s) => s.trim()).filter(Boolean)
    for (const part of parts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(Number)
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = start; i <= end; i++) {
            if (i >= 1 && i <= maxPages) indices.push(i)
          }
        }
      } else {
        const num = Number(part)
        if (!isNaN(num) && num >= 1 && num <= maxPages) indices.push(num)
      }
    }
    return [...new Set(indices)].sort((a, b) => a - b)
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

  const handleProcess = async (
    files: ToolFile[],
    context: {
      setProgress: (value: number) => void
      setResult: (result: ReactNode | null) => void
      setError: (message: string | null) => void
    },
  ) => {
    try {
      if (!annotationText.trim()) {
        throw new Error('Enter annotation text to continue.')
      }

      context.setProgress(5)

      const results: { name: string; blobUrl: string; byteSize: number }[] = []
      let processedCount = 0

      for (const toolFile of files) {
        try {
          const arrayBuffer = await toolFile.file.arrayBuffer()
          const pdfDoc = await PDFDocument.load(arrayBuffer)
          const pages = pdfDoc.getPages()

          if (pages.length === 0) continue

          // Reset textY for each file to avoid accumulation across files
          let currentTextY = textY

          let targetIndices: number[]
          if (pageRangeType === 'specific') {
            const parsed = parsePageNumbers(specificPages, pages.length)
            targetIndices = parsed.map((p) => p - 1)
            if (targetIndices.length === 0) {
              targetIndices = [pageNumber - 1]
            }
          } else {
            targetIndices = pages.map((_, i) => i)
          }

          const { r, g, b } = hexToRgb(colorHex)

          for (const idx of targetIndices) {
            const page = pages[idx]
            const { height } = page.getSize()

            if (isHighlightMode) {
              const y = height - highlightY - fontSize
              const x = textX
              const textWidth = annotationText.length * fontSize * 0.6

              page.drawRectangle({
                x: x - 2,
                y: y - 2,
                width: textWidth + 4,
                height: fontSize + 4,
                color: rgb(r, g, b),
                opacity,
              })

              page.drawText(annotationText, {
                x,
                y,
                size: fontSize,
                color: rgb(0, 0, 0),
                font: await pdfDoc.embedFont(
                  fontFamily === FontFamily.Helvetica
                    ? FontFamily.Helvetica
                    : fontFamily === FontFamily.TimesRoman
                      ? FontFamily.TimesRoman
                      : FontFamily.Courier,
                ),
              })
            } else {
              const x = textX
              const y = height - currentTextY

              const font = await pdfDoc.embedFont(
                fontFamily === FontFamily.Helvetica
                  ? FontFamily.Helvetica
                  : fontFamily === FontFamily.TimesRoman
                    ? FontFamily.TimesRoman
                    : FontFamily.Courier,
              )

              const lines = annotationText.split('\n')
              for (const line of lines) {
                page.drawText(line, {
                  x,
                  y: height - currentTextY,
                  size: fontSize,
                  font,
                  color: rgb(r, g, b),
                  opacity,
                })
                currentTextY -= fontSize + 4
              }
            }
          }

          const pdfBytes = await pdfDoc.save()
          const blob = new Blob([pdfBytes.buffer as BlobPart], { type: 'application/pdf' })
          const blobUrl = URL.createObjectURL(blob)

          results.push({
            name: toolFile.name.replace(/\.pdf$/i, '') + '_annotated.pdf',
            blobUrl,
            byteSize: blob.size,
          })
          processedCount++
        } catch (err) {
          console.error(`Failed to process ${toolFile.name}:`, err)
        }
      }

      context.setProgress(100)

      if (results.length === 0) {
        throw new Error('No files were processed successfully.')
      }

      // Track blob URLs for cleanup
      setResultBlobUrls(results.map((r) => r.blobUrl))

      context.setResult(
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">
            {processedCount} PDF(s) annotated.
          </p>
          {results.map((r) => (
            <div key={r.name} className="flex items-center gap-2">
              <span className="text-xs text-muted flex-1 truncate">{r.name}</span>
              <a
                href={r.blobUrl}
                download={r.name}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs hover:bg-base/80"
                onClick={(e) => {
                  e.preventDefault()
                  revokeAndDownload(r.blobUrl, r.name)
                }}
                role="button"
                aria-label={`Download ${r.name}`}
              >
                <FileDown className="h-4 w-4" /> Download
              </a>
            </div>
          ))}
        </div>,
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Annotation failed.'
      context.setError(message)
      context.setResult(null)
    }
  }

  // Revoke each URL after download with a delay
  const revokeAndDownload = useCallback((url: string, filename: string) => {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }, [])

  return (
    <BaseToolLayout title={tool.name} description={tool.description} onProcess={handleProcess} accept=".pdf">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="annotationType" className="text-xs font-semibold text-foreground">Annotation Type</label>
            <Select
              id="annotationType"
              value={annotationType}
              onChange={(e) => setAnnotationType(e.target.value as AnnotationType)}
            >
              <option value="text">Text Annotation</option>
              <option value="highlight">Highlight</option>
            </Select>
          </div>
          <div>
            <label htmlFor="fontFamily" className="text-xs font-semibold text-foreground">Font</label>
            <Select
              id="fontFamily"
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value as FontFamily)}
              disabled={isHighlightMode}
            >
              {Object.values(FontFamily).map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <label htmlFor="annotationText" className="text-xs font-semibold text-foreground">Annotation Text</label>
          <textarea
            id="annotationText"
            className="w-full rounded-xl border border-border bg-base/70 px-3 py-2 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y"
            value={annotationText}
            onChange={(e) => setAnnotationText(e.target.value)}
            placeholder="Enter annotation text..."
            rows={3}
            aria-label="Annotation text"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="fontSize" className="text-xs font-semibold text-foreground">Font Size</label>
            <Input
              id="fontSize"
              type="number"
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              min={8}
              max={72}
              aria-label="Font size"
            />
          </div>
          <div>
            <label htmlFor="opacity" className="text-xs font-semibold text-foreground">Opacity</label>
            <Input
              id="opacity"
              type="number"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              min={0.1}
              max={1}
              step={0.05}
              aria-label="Opacity"
            />
          </div>
          <div>
            <label htmlFor="color" className="text-xs font-semibold text-foreground">Color</label>
            <Select
              id="color"
              value={useCustomColor ? 'custom' : colorHex === '#ffff00' && annotationType === 'highlight' ? 'yellow' : 'default'}
              onChange={(e) => {
                const v = e.target.value
                if (v === 'custom') {
                  setUseCustomColor(true)
                } else if (v === 'default') {
                  setUseCustomColor(false)
                  setColorHex('#ffffff')
                  setOpacity(0.75)
                } else if (highlightColors[v]) {
                  setUseCustomColor(false)
                  setColorHex(highlightColors[v].hex)
                }
              }}
            >
              <option value="default">{annotationType === 'highlight' ? 'Highlight' : 'Default'}</option>
              {Object.entries(highlightColors).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
              <option value="custom">Custom</option>
            </Select>
          </div>
        </div>

        {useCustomColor && (
          <div>
            <label htmlFor="customColorHex" className="text-xs font-semibold text-foreground">Custom Color Hex</label>
            <Input
              id="customColorHex"
              value={colorHex}
              onChange={(e) => setColorHex(e.target.value)}
              placeholder="#ffffff"
              aria-label="Custom color hex"
            />
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="textX" className="text-xs font-semibold text-foreground">X Position</label>
            <Input
              id="textX"
              type="number"
              value={textX}
              onChange={(e) => setTextX(Number(e.target.value))}
              min={0}
              aria-label="X position"
            />
          </div>
          {isHighlightMode ? (
            <div>
              <label htmlFor="highlightY" className="text-xs font-semibold text-foreground">Y Position (from top)</label>
              <Input
                id="highlightY"
                type="number"
                value={highlightY}
                onChange={(e) => setHighlightY(Number(e.target.value))}
                min={0}
                aria-label="Y position from top"
              />
            </div>
          ) : (
            <div>
              <label htmlFor="textY" className="text-xs font-semibold text-foreground">Y Position (from bottom)</label>
              <Input
              id="textY"
              type="number"
              value={textY}
              onChange={(e) => setTextY(Number(e.target.value))}
              min={0}
              aria-label="Y position from bottom"
            />
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pageRange" className="text-xs font-semibold text-foreground">Page Range</label>
            <Select
              id="pageRange"
              value={pageRangeType}
              onChange={(e) => setPageRangeType(e.target.value as 'all' | 'specific')}
            >
              <option value="all">All Pages</option>
              <option value="specific">Specific Pages</option>
            </Select>
          </div>
          {pageRangeType === 'specific' && (
            <div>
              <label htmlFor="specificPages" className="text-xs font-semibold text-foreground">Pages (e.g., 1-3,5)</label>
              <Input
                id="specificPages"
                value={specificPages}
                onChange={(e) => setSpecificPages(e.target.value)}
                placeholder="1-3,5,8"
                aria-label="Specific pages"
              />
            </div>
          )}
        </div>

        <Badge className="text-xs">
          Tip: Upload one or more PDF files. Annotations will be applied to the selected page range.
        </Badge>
      </div>
    </BaseToolLayout>
  )
}
