import { useState, useRef } from 'react'
import type { ReactNode } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { createWorker } from 'tesseract.js'
import { PDFDocument, rgb } from 'pdf-lib'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

// Set worker source for pdfjs using CDN (use absolute HTTPS)
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

type PdfOcrToolProps = {
  tool: ToolDefinition
}

// Supported languages for OCR
const LANGUAGES = [
  { code: 'eng', name: 'English' },
  { code: 'spa', name: 'Spanish' },
  { code: 'fra', name: 'French' },
  { code: 'deu', name: 'German' },
  { code: 'ita', name: 'Italian' },
  { code: 'por', name: 'Portuguese' },
  { code: 'nld', name: 'Dutch' },
  { code: 'chi_sim', name: 'Chinese (Simplified)' },
  { code: 'jpn', name: 'Japanese' },
  { code: 'kor', name: 'Korean' },
] as const

// Render scale for page rendering (higher = better quality but slower)
const RENDER_SCALE = 1.5

// Page-level OCR data with bounding boxes and image for searchable PDF generation
interface PageOcrPage {
  pageNumber: number
  text: string
  origWidth: number
  origHeight: number
  renderedWidth: number
  renderedHeight: number
  lines: Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }>
  imageBlob: Blob
}

// Result from processing a single PDF file (internal)
interface ProcessSinglePdfResult {
  text: string
  pages?: PageOcrPage[]
}

// State entry for processed files
interface ProcessedFileEntry {
  name: string
  text: string
  pdfBlobUrl?: string
}

export function PdfOcrTool({ tool }: PdfOcrToolProps) {
  const [resultText, setResultText] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['eng'])
  const [generateSearchablePdf, setGenerateSearchablePdf] = useState(false)
  const [processedFiles, setProcessedFiles] = useState<ProcessedFileEntry[]>([])
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
    // Revoke any existing object URLs from previous results
    processedFiles.forEach(entry => {
      if (entry.pdfBlobUrl) URL.revokeObjectURL(entry.pdfBlobUrl)
    })
    setProcessedFiles([])
    context.setProgress(0)
    setStatusMessage('Starting batch OCR...')

    try {
      const totalFiles = files.length
      const errors: Array<{ name: string; message: string }> = []
      const allProcessed: ProcessedFileEntry[] = []
      // Ensure at least one language is selected
      const effectiveLanguages = selectedLanguages.length > 0 ? selectedLanguages : ['eng']

      // Pre-check: verify language data files exist
      const checkLanguageExists = async (lang: string) => {
        try {
          const res = await fetch(`/tesseract/languages/${lang}.traineddata`, { method: 'HEAD' })
          return res.ok
        } catch {
          return false
        }
      }
      const existenceChecks = await Promise.all(effectiveLanguages.map(checkLanguageExists))
      const missingLangs = effectiveLanguages.filter((_ln, i) => !existenceChecks[i])
      if (missingLangs.length > 0) {
        context.setError(`Missing language data for: ${missingLangs.join(', ')}. Please install the required language packs.`)
        setIsProcessing(false)
        setStatusMessage('')
        return
      }

      for (let fileIndex = 0; fileIndex < totalFiles; fileIndex++) {
        const toolFile = files[fileIndex]

        setStatusMessage(`Processing file ${fileIndex + 1} of ${totalFiles}: ${toolFile.name}`)

        try {
          // Determine if we need to capture page details (for searchable PDF)
          const shouldCapture = generateSearchablePdf
          const fileResult = await processSinglePdf(toolFile, effectiveLanguages, (fileProgress) => {
            const perFileWeight = 1 / totalFiles
            const base = (fileIndex / totalFiles) * 100
            const increment = fileProgress * perFileWeight * 100
            context.setProgress(Math.round(base + increment))
          }, shouldCapture)

          if (shouldCapture && fileResult.pages) {
            try {
              const blob = await createSearchablePdfForFile({ pages: fileResult.pages })
              const pdfBlobUrl = URL.createObjectURL(blob)
              // Keep only text and pdfBlobUrl, discard pages to free memory
              allProcessed.push({ name: toolFile.name, text: fileResult.text, pdfBlobUrl })
            } catch (pdfErr) {
              console.error('PDF generation failed for', toolFile.name, pdfErr)
              errors.push({ 
                name: toolFile.name, 
                message: `OCR succeeded but PDF generation failed: ${pdfErr instanceof Error ? pdfErr.message : String(pdfErr)}` 
              })
              // Still add text result without PDF
              allProcessed.push({ name: toolFile.name, text: fileResult.text })
            }
          } else {
            allProcessed.push({ name: toolFile.name, text: fileResult.text })
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          errors.push({ name: toolFile.name, message })
        }
      }

      // Combine text for display
      const combinedText = allProcessed.map(f => `=== ${f.name} ===\n\n${f.text}\n\n`).join('')
      setResultText(combinedText)
      setProcessedFiles(allProcessed)

      const resultCard: ReactNode = (
        <Card className="space-y-3 border-border bg-base/60 p-4">
          <h3 className="text-sm font-semibold text-text">OCR Complete</h3>
          <div className="text-sm">
            Successfully processed {allProcessed.length} of {totalFiles} files.
            {errors.length > 0 && ` (${errors.length} failed)`}
          </div>
          {combinedText && (
            <div className="max-h-96 overflow-y-auto rounded border border-border bg-base/40 p-3 text-sm font-mono text-text whitespace-pre-wrap">
              {combinedText}
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
          {/* Download buttons */}
          <div className="space-y-2">
            <Button onClick={downloadText} className="w-full">
              Download Text (.txt)
            </Button>
            {generateSearchablePdf && allProcessed.length > 0 && (
              <Button onClick={() => downloadSearchablePdf(allProcessed)} className="w-full">
                Download Searchable PDF
              </Button>
            )}
          </div>
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
    languages: string[],
    onFileProgress: (progress: number) => void,
    captureDetails: boolean
  ): Promise<ProcessSinglePdfResult> => {
    const { file } = toolFile
    setStatusMessage(`Loading PDF: ${file.name}`)

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const numPages = pdf.numPages

    let currentPage = 0
    const worker = await createWorker(
      languages,
      1,
      {
        langPath: '/tesseract/languages/',
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            const fileProgress = (currentPage - 1 + m.progress) / numPages
            onFileProgress(fileProgress)
          }
        },
      }
    )

    // We'll collect full text, and optionally detailed page data
    let fullText = ''
    const pages: PageOcrPage[] = []

    try {
      for (let i = 1; i <= numPages; i++) {
        currentPage = i
        setStatusMessage(`Processing ${file.name}: page ${i}/${numPages}`)
        const page = await pdf.getPage(i)

        // Get original dimensions (scale 1)
        const originalViewport = page.getViewport({ scale: 1 })
        const origWidth = originalViewport.width
        const origHeight = originalViewport.height

        // Render at higher scale for better OCR quality
        const viewport = page.getViewport({ scale: RENDER_SCALE })
        const renderedWidth = viewport.width
        const renderedHeight = viewport.height

        const canvas = canvasRef.current
        if (!canvas) break
        canvas.width = renderedWidth
        canvas.height = renderedHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) continue

        await page.render({ canvasContext: ctx, viewport }).promise

        // Get text from OCR
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8)
        const result: any = await worker.recognize(imageDataUrl)
        const text = result.data.text
        const lines = result.data.lines

        fullText += text + (i < numPages ? '\n' : '')

        if (captureDetails) {
          // Create a blob for the page image (high-quality JPEG)
          const blob = await new Promise<Blob>((resolve) => {
            canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.8)
          })

          // Map Tesseract lines to our typed structure
          const ocrLines: Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }> = (lines || []).map((line: any) => ({
            text: line.text,
            bbox: {
              x0: line.bbox.x0,
              y0: line.bbox.y0,
              x1: line.bbox.x1,
              y1: line.bbox.y1,
            },
          }))

          pages.push({
            pageNumber: i,
            text,
            origWidth,
            origHeight,
            renderedWidth,
            renderedHeight,
            lines: ocrLines,
            imageBlob: blob,
          })
        }
      }
    } finally {
      await worker.terminate()
    }

    return captureDetails ? { text: fullText, pages } : { text: fullText }
  }

  const downloadText = () => {
    if (!resultText) return
    const blob = new Blob([resultText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'ocr-results.txt'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const downloadSearchablePdf = async (files: ProcessedFileEntry[]) => {
    if (!files.length) return

    setIsGeneratingPdf(true)
    setStatusMessage('Generating searchable PDF...')

    try {
      const urls = files.map(f => f.pdfBlobUrl).filter((url): url is string => url !== undefined)
      if (urls.length === 0) {
        setStatusMessage('No searchable PDFs available to download.')
        setIsGeneratingPdf(false)
        return
      }

      let finalBlob: Blob
      if (urls.length === 1) {
        const response = await fetch(urls[0])
        finalBlob = await response.blob()
      } else {
        finalBlob = await mergePdfs(urls)
      }

      // Download the final blob
      const downloadUrl = URL.createObjectURL(finalBlob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = 'ocr-results-searchable.pdf'
      a.click()
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)

      // Revoke the source object URLs
      urls.forEach(url => URL.revokeObjectURL(url))

      setStatusMessage('Searchable PDF generated.')
    } catch (error) {
      console.error('PDF generation failed:', error)
      setStatusMessage('Failed to generate PDF. See console for details.')
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  const createSearchablePdfForFile = async (fileResult: { pages: PageOcrPage[] }): Promise<Blob> => {
    const pdfDoc = await PDFDocument.create()

    for (const page of fileResult.pages) {
      const pdfPage = pdfDoc.addPage([page.origWidth, page.origHeight])

      // Embed the page image (JPEG from canvas)
      const imageBuffer = await page.imageBlob.arrayBuffer() as ArrayBuffer
      const jpegImage = await pdfDoc.embedJpg(new Uint8Array(imageBuffer))
      pdfPage.drawImage(jpegImage, {
        x: 0,
        y: 0,
        width: page.origWidth,
        height: page.origHeight,
      })

      // Compute scale to map rendered coordinates back to original
      const scale = page.renderedWidth / page.origWidth

      // Add invisible text layer for searchability
      for (const line of page.lines) {
        const x = line.bbox.x0 / scale
        const y = page.origHeight - (line.bbox.y1 / scale)
        const lineHeight = (line.bbox.y1 - line.bbox.y0) / scale

        pdfPage.drawText(line.text, {
          x,
          y,
          size: lineHeight,
          opacity: 0,
          color: rgb(0, 0, 0),
        })
      }
    }

    const pdfBytes = await pdfDoc.save()
    return new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' })
  }

  const mergePdfs = async (blobUrls: string[]): Promise<Blob> => {
    const pdfDoc = await PDFDocument.create()

    for (const url of blobUrls) {
      const response = await fetch(url)
      const blob = await response.blob()
      const arrayBuffer = await blob.arrayBuffer()
      const srcPdf = await PDFDocument.load(arrayBuffer)
      const copiedPages = await pdfDoc.copyPages(srcPdf, srcPdf.getPageIndices())
      copiedPages.forEach(p => pdfDoc.addPage(p))
    }

    const mergedBytes = await pdfDoc.save()
    return new Blob([mergedBytes.buffer as ArrayBuffer], { type: 'application/pdf' })
  }

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      accept=".pdf,application/pdf"
      options={
        <div className="space-y-4 text-sm">
          <div className="text-xs text-muted">
            Upload one or more PDF files. OCR will extract text from each page. Larger files take longer.
          </div>

          {/* Language Selection (Accessible checkboxes) */}
          <div>
            <label className="block text-xs font-medium mb-2">OCR Languages</label>
            <div className="grid grid-cols-2 gap-2">
              {LANGUAGES.map(lang => (
                <label key={lang.code} className="flex items-center space-x-2 text-xs">
                  <input
                    type="checkbox"
                    checked={selectedLanguages.includes(lang.code)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedLanguages(prev => [...prev, lang.code])
                      } else {
                        setSelectedLanguages(prev => prev.filter(c => c !== lang.code))
                      }
                    }}
                    className="rounded"
                  />
                  <span>{lang.name}</span>
                </label>
              ))}
            </div>
            <div className="text-xs text-muted mt-1">
              {selectedLanguages.length} language{selectedLanguages.length !== 1 ? 's' : ''} selected.
            </div>
          </div>

          {/* Searchable PDF Option */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="generatePdf"
              checked={generateSearchablePdf}
              onChange={(e) => setGenerateSearchablePdf(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="generatePdf" className="text-xs cursor-pointer">
              Generate searchable PDF (image + invisible text layer)
            </label>
          </div>

          {statusMessage && (
            <div className="text-xs text-muted">
              Status: {statusMessage}
            </div>
          )}

          {resultText && !isProcessing && !isGeneratingPdf && (
            <div className="text-xs text-muted">
              Processing complete. Use the buttons below to download results.
            </div>
          )}
        </div>
      }
      onProcess={handleProcess}
      loading={isProcessing || isGeneratingPdf}
    >
      <canvas ref={canvasRef} className="hidden" />
    </BaseToolLayout>
  )
}
