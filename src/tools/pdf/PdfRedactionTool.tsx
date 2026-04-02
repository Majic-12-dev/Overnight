import { useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { PDFDocument, rgb } from 'pdf-lib'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import type { ToolFile } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { FileDown, Plus, Trash2, Info } from 'lucide-react'

type PdfRedactionToolProps = {
  tool: ToolDefinition
}

type RedactionRegion = {
  id: string
  page: number
  x: number
  y: number
  width: number
  height: number
}

let regionIdCounter = 0

export function PdfRedactionTool({ tool }: PdfRedactionToolProps) {
  const [regions, setRegions] = useState<RedactionRegion[]>([
    { id: '0', page: 1, x: 0, y: 0, width: 200, height: 50 },
  ])

  const addRegion = useCallback(() => {
    regionIdCounter++
    setRegions((prev) => [
      ...prev,
      { id: String(regionIdCounter), page: 1, x: 0, y: 0, width: 200, height: 50 },
    ])
  }, [])

  const removeRegion = useCallback((id: string) => {
    setRegions((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const updateRegion = useCallback((id: string, field: keyof RedactionRegion, value: number) => {
    setRegions((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    )
  }, [])

  const handleProcess = useCallback(
    async (
      files: ToolFile[],
      context: {
        setProgress: (value: number) => void
        setResult: (result: ReactNode | null) => void
        setError: (message: string | null) => void
      },
    ) => {
      try {
        if (regions.length === 0) throw new Error('Add at least one redaction region.')

        context.setProgress(10)
        const results: { name: string; blobUrl: string; byteSize: number }[] = []

        for (const toolFile of files) {
          const arrayBuffer = await toolFile.file.arrayBuffer()
          const pdfDoc = await PDFDocument.load(arrayBuffer)
          const pages = pdfDoc.getPages()

          for (const region of regions) {
            const pageIndex = region.page - 1
            if (pageIndex < 0 || pageIndex >= pages.length) continue
            const page = pages[pageIndex]
            const { height: pageHeight } = page.getSize()

            // Convert from top-left origin to pdf-lib's bottom-left origin
            const bottomLeftY = pageHeight - region.y - region.height

            page.drawRectangle({
              x: region.x,
              y: bottomLeftY,
              width: region.width,
              height: region.height,
              color: rgb(0, 0, 0),
              opacity: 1.0,
            })
          }

          const pdfBytes = await pdfDoc.save()
          const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' })
          const blobUrl = URL.createObjectURL(blob)
          results.push({
            name: toolFile.name.replace(/\.pdf$/i, '') + '_redacted.pdf',
            blobUrl,
            byteSize: blob.size,
          })
        }

        context.setProgress(100)
        context.setResult(
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">
              {results.length} PDF(s) redacted successfully.
            </p>
            {results.map((r) => (
              <div key={r.name} className="flex items-center gap-2">
                <span className="text-xs text-muted flex-1 truncate">{r.name}</span>
                <a href={r.blobUrl} download={r.name}>
                  <Button variant="ghost" size="sm" className="gap-1">
                    <FileDown className="h-4 w-4" /> Download
                  </Button>
                </a>
              </div>
            ))}
          </div>,
        )
      } catch (err) {
        context.setError(err instanceof Error ? err.message : 'Redaction failed.')
        context.setResult(null)
      }
    },
    [regions],
  )

  return (
    <BaseToolLayout title={tool.name} description={tool.description} onProcess={handleProcess} accept=".pdf">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge className="text-xs">{regions.length} region(s)</Badge>
          <Badge className="text-xs bg-muted/20">
            <Info className="h-3 w-3 mr-1" />
            Coordinates: origin at top-left, units in points
          </Badge>
        </div>

        {regions.map((region) => (
          <div key={region.id} className="p-3 rounded-lg border border-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">Region</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-destructive"
                onClick={() => removeRegion(region.id)}
                disabled={regions.length <= 1}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <div className="grid grid-cols-5 gap-2">
              <div>
                <label className="text-xs text-muted">Page</label>
                <Input
                  type="number"
                  value={region.page}
                  onChange={(e) => updateRegion(region.id, 'page', Number(e.target.value))}
                  min={1}
                  className="h-7 text-xs"
                />
              </div>
              <div>
                <label className="text-xs text-muted">X</label>
                <Input
                  type="number"
                  value={region.x}
                  onChange={(e) => updateRegion(region.id, 'x', Number(e.target.value))}
                  className="h-7 text-xs"
                />
              </div>
              <div>
                <label className="text-xs text-muted">Y</label>
                <Input
                  type="number"
                  value={region.y}
                  onChange={(e) => updateRegion(region.id, 'y', Number(e.target.value))}
                  className="h-7 text-xs"
                />
              </div>
              <div>
                <label className="text-xs text-muted">Width</label>
                <Input
                  type="number"
                  value={region.width}
                  onChange={(e) => updateRegion(region.id, 'width', Number(e.target.value))}
                  min={1}
                  className="h-7 text-xs"
                />
              </div>
              <div>
                <label className="text-xs text-muted">Height</label>
                <Input
                  type="number"
                  value={region.height}
                  onChange={(e) => updateRegion(region.id, 'height', Number(e.target.value))}
                  min={1}
                  className="h-7 text-xs"
                />
              </div>
            </div>
          </div>
        ))}

        <Button variant="outline" size="sm" onClick={addRegion} className="gap-1">
          <Plus className="h-4 w-4" /> Add Region
        </Button>
      </div>
    </BaseToolLayout>
  )
}
