import { useState, useCallback, useEffect } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { FileText, Download, Upload, FileUp } from 'lucide-react'
import { marked } from 'marked'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

export default function MarkdownToPdfTool({ tool }: { tool: ToolDefinition }) {
  const [markdown, setMarkdown] = useState('')
  const [pageSize, setPageSize] = useState<'A4' | 'Letter'>('A4')
  const [margins, setMargins] = useState<'narrow' | 'normal' | 'wide'>('normal')
  const [previewHtml, setPreviewHtml] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (markdown) {
      try {
        const html = marked.parse(markdown) as string
        setPreviewHtml(html)
      } catch {
        setPreviewHtml('')
      }
    } else {
      setPreviewHtml('')
    }
  }, [markdown])

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.md') && !file.name.endsWith('.markdown') && file.type !== 'text/markdown' && file.type !== 'text/plain') {
      setError('Please upload a .md or .markdown file.')
      return
    }
    setError(null)
    const reader = new FileReader()
    reader.onload = (ev) => setMarkdown(ev.target?.result as string)
    reader.readAsText(file)
  }, [])

  const exportPdf = useCallback(async () => {
    if (!markdown.trim()) return
    setGenerating(true)
    setError(null)

    try {
      const isA4 = pageSize === 'A4'
      const pageW = isA4 ? 595.28 : 612
      const pageH = isA4 ? 841.89 : 792

      const marginMap = { narrow: 36, normal: 54, wide: 72 }
      const margin = marginMap[margins]
      const contentW = pageW - 2 * margin

      const tokens = marked.lexer(markdown)

      const pdfDoc = await PDFDocument.create()
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

      let page = pdfDoc.addPage([pageW, pageH])
      let y = pageH - margin

      const fontSizes: Record<string, number> = { h1: 20, h2: 17, h3: 14, h4: 12, body: 10, li: 10, code: 9 }

      function drawTextLine(text: string, size: number, fontRef: any, _x: number, yPos: number): number {
        const words = text.split(' ')
        let line = ''
        let currentY = yPos
        for (const word of words) {
          const testLine = line + (line ? ' ' : '') + word
          const width = fontRef.widthOfTextAtSize(testLine, size)
          if (width > contentW && line) {
            if (currentY - size - 4 < margin) {
              page = pdfDoc.addPage([pageW, pageH])
              currentY = pageH - margin
            }
            page.drawText(line, { x: margin, y: currentY, font: fontRef, size })
            line = word
            currentY -= size + 4
          } else {
            line = testLine
          }
        }
        if (line) {
          if (currentY - size - 4 < margin) {
            page = pdfDoc.addPage([pageW, pageH])
            currentY = pageH - margin
          }
          page.drawText(line, { x: margin, y: currentY, font: fontRef, size })
          currentY -= size + 4
        }
        return currentY
      }

      for (const token of tokens) {
        if (token.type === 'heading') {
          const sizeKey = `h${(token as any).depth}` as keyof typeof fontSizes
          const size = fontSizes[sizeKey] || 14
          y = drawTextLine((token as any).text || '', size, boldFont, margin, y)
          y -= 6
        } else if (token.type === 'paragraph') {
          if ((token as any).text?.startsWith('```')) {
            y = drawTextLine((token as any).text, fontSizes.code, font, margin, y)
          } else {
            y = drawTextLine((token as any).text || '', fontSizes.body, font, margin, y)
          }
          y -= 4
        } else if (token.type === 'list') {
          for (const item of (token as any).items || []) {
            const prefix = (token as any).ordered ? '• ' : '• '
            y = drawTextLine(prefix + (item.text || ''), fontSizes.li, font, margin, y)
            y -= 2
          }
          y -= 4
        } else if (token.type === 'code') {
          y = drawTextLine((token as any).text || '', fontSizes.code, font, margin, y)
          y -= 8
        } else if (token.type === 'blockquote') {
          y = drawTextLine('  ' + ((token as any).text || ''), fontSizes.body, font, margin, y)
          y -= 4
        } else if (token.type === 'hr') {
          if (y - 10 < margin) {
            page = pdfDoc.addPage([pageW, pageH])
            y = pageH - margin
          }
          page.drawLine({
            start: { x: margin, y },
            end: { x: pageW - margin, y },
            thickness: 1,
            color: rgb(0.6, 0.6, 0.6),
          })
          y -= 12
        }

        if (y < margin) {
          page = pdfDoc.addPage([pageW, pageH])
          y = pageH - margin
        }
      }

      const pdfBytes = await pdfDoc.save()
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'document.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      setError('Failed to generate PDF: ' + err.message)
    } finally {
      setGenerating(false)
    }
  }, [markdown, pageSize, margins])

  return (
    <BaseToolLayout title={tool.name} description={tool.description}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <textarea
            className="flex-1 min-h-[200px] px-3 py-2 rounded-lg border border-border bg-input/50 text-base/90 placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/60 font-mono text-sm resize-y"
            placeholder="Enter Markdown here... or upload a .md file"
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
          />
          <div className="flex flex-col gap-2 min-w-[140px]">
            <label className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg border border-border bg-base/60 cursor-pointer hover:bg-base/80 text-sm">
              <FileUp className="w-4 h-4" />
              Upload
              <input
                type="file"
                accept=".md,.markdown"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
            <Button size="sm" variant="outline" onClick={() => setMarkdown('')} disabled={!markdown}>
              Clear
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted">Pages:</label>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(e.target.value as 'A4' | 'Letter')}
              className="px-2 py-1 rounded border border-border bg-input/50 text-sm text-base/90"
            >
              <option value="A4">A4</option>
              <option value="Letter">Letter</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted">Margins:</label>
            <select
              value={margins}
              onChange={(e) => setMargins(e.target.value as 'narrow' | 'normal' | 'wide')}
              className="px-2 py-1 rounded border border-border bg-input/50 text-sm text-base/90"
            >
              <option value="narrow">Narrow</option>
              <option value="normal">Normal</option>
              <option value="wide">Wide</option>
            </select>
          </div>
          <Button size="sm" onClick={exportPdf} disabled={!markdown.trim() || generating}>
            <Download className="w-4 h-4 mr-1" /> {generating ? 'Generating...' : 'Export PDF'}
          </Button>
        </div>

        {error && (
          <Card className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </Card>
        )}

        {previewHtml && (
          <div>
            <p className="text-sm text-muted mb-2">Preview:</p>
            <div
              className="max-h-[400px] overflow-y-auto p-4 rounded-lg border border-border bg-base/30 prose prose-sm prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        )}
      </div>
    </BaseToolLayout>
  )
}
