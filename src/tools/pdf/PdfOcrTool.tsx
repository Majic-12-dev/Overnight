import { useState, useRef } from 'react'
import type { ReactNode } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { createWorker } from 'tesseract.js'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

// Set worker source for pdfjs using CDN (use absolute HTTPS)
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

type PdfOcrToolProps = {
  tool: ToolDefinition
}

export function PdfOcrTool({ tool }: PdfOcrToolProps) {
  const [resultText, setResultText] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string>('')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const handleProcess = async (
    files: Array<{ file: File; name: string; size: number; path?: string }>,
    context: { setProgress: (value: number) => void; setResult: (result: ReactNode | null) => void; setError: (message: string | null) => void }
  ) => {
    if (!files.length) {
      context.setError('No files selected for OCR.')
      return
    }

    setIsProcessing(true)
    setResultText('')
    context.setProgress(0)
    setStatusMessage('Starting batch OCR...')

    try {
      let combinedText = ''
      const totalFiles = files.length
      const errors: Array<{ name: string; message: string }> = []

      for (let fileIndex = 0; fileIndex < totalFiles; fileIndex++) {
        const toolFile = files[fileIndex]
        // File type validation: must be PDF (by MIME type or extension)
        const fileName = toolFile.file.name.toLowerCase()
        const isPdfByMime = toolFile.file.type === 'application/pdf'
        const isPdfByExt = fileName.endsWith('.pdf')
        if (!isPdfByMime && !isPdfByExt) {
          errors.push({ name: toolFile.name, message: 'Not a PDF file (invalid type)' })
          continue
        }

        setStatusMessage(`Processing file ${fileIndex + 1} of ${totalFiles}: ${toolFile.name}`)

        try {
          const fileText = await processSinglePdf(toolFile, (pageProgress) => {
            const perFileWeight = 1 / totalFiles
            const base = (fileIndex / totalFiles) * 100
            const increment = pageProgress * perFileWeight * 100
            context.setProgress(Math.round(base + increment))
          })
          combinedText += `=== ${toolFile.name} ===\n\n${fileText}\n\n`
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          errors.push({ name: toolFile.name, message })
        }

        setResultText(combinedText)
      }

      const resultCard: ReactNode = (
        <Card className="space-y-3 border-border bg-base/60 p-4">
          <h3 className="text-sm font-semibold text-text">OCR Complete</h3>
          <div className="text-sm">
            Successfully processed {totalFiles - errors.length} of {totalFiles} files.
          </div>
          {resultText && (
            <div className="max-h-96 overflow-y-auto rounded border border-border bg-base/40 p-3 text-sm font-mono text-text whitespace-pre-wrap">
              {resultText}
            </div>
          )}
          {errors.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-red-500">Errors</div>
              <ul className="space-y-1">
                {errors.map((e, idx) => (
                  <li key={idx} className="text-xs text-red-500">
                    <span className="font-mono">{e.name}</span>: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )

      context.setResult(resultCard)
      context.setProgress(100)
      setStatusMessage('')
    } catch (error) {
      console.error('Batch OCR failed:', error)
      context.setError(error instanceof Error ? error.message : 'Batch OCR failed.')
    } finally {
      setIsProcessing(false)
    }
  }

  const processSinglePdf = async (
    toolFile: { file: File; name: string },
    onPageProgress: (progress: number) => Promise<void> | void
  ): Promise<string> => {
    const { file } = toolFile
    setStatusMessage(`Loading PDF: ${file.name}`)

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const numPages = pdf.numPages

    const worker = await createWorker('eng', 1, {
      logger: (m: any) => {
        if (m.status === 'recognizing text') {
          onPageProgress(m.progress)
        }
      },
    })

    let fullText = ''

    try {
      for (let i = 1; i <= numPages; i++) {
        setStatusMessage(`Processing ${file.name}: page ${i}/${numPages}`)
        const page = await pdf.getPage(i)
        const viewport = page.getViewport({ scale: 1.5 })
        const canvas = canvasRef.current
        if (!canvas) break
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')
        if (!ctx) continue

        await page.render({ canvasContext: ctx, viewport }).promise
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8)
        const { data: { text: pageText } } = await worker.recognize(imageDataUrl)
        fullText += pageText + '\n'
      }
    } finally {
      await worker.terminate()
    }

    return fullText
  }

  const downloadText = () => {
    if (!resultText) return
    const blob = new Blob([resultText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'ocr-results.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className="space-y-4 text-sm">
          <div className="text-xs text-muted">
            Upload one or more PDF files. OCR will extract text from each page. Larger files take longer.
          </div>
          {statusMessage && (
            <div className="text-xs text-muted">
              Status: {statusMessage}
            </div>
          )}
          {resultText && (
            <Button onClick={downloadText} className="w-full">
              Download Results
            </Button>
          )}
        </div>
      }
      onProcess={handleProcess}
      loading={isProcessing}
    >
      <canvas ref={canvasRef} className="hidden" />
    </BaseToolLayout>
  )
}
