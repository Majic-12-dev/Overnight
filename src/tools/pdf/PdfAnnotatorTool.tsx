import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { PDFDocument, rgb } from 'pdf-lib'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import type { ToolFile } from '@/components/tools/BaseToolLayout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
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
              const textWidth = annotationText.length * fontSize * 0.6
              y = height - highlightY - fontSize
              const x = textX

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
                y: y,
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
              const y = height - textY

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
                  y: height - textY,
                  size: fontSize,
                  font,
                  color: rgb(r, g, b),
                  opacity,
                })
                textY -= fontSize + 4
              }
            }
          }

          const pdfBytes = await pdfDoc.save()
          const blob = new Blob([pdfBytes], { type: 'application/pdf' })
          const blobUrl = URL.createObjectURL(blob)

          results.push({
            name: