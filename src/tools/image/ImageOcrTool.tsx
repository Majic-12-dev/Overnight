import { useState, useRef } from 'react'
import type { ReactNode } from 'react'
import { createWorker } from 'tesseract.js'
import { Clipboard, Download, ScanText } from 'lucide-react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

type ImageOcrToolProps = {
  tool: ToolDefinition
}

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

export function ImageOcrTool({ tool }: ImageOcrToolProps) {
  const [resultText, setResultText] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [selectedLanguage, setSelectedLanguage] = useState<string>('eng')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const copyToClipboard = async () => {
    if (!resultText) return
    try {
      await navigator.clipboard.writeText(resultText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      try {
        const textarea = document.createElement('textarea')
        textarea.value = resultText
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {
        setError('Failed to copy to clipboard.')
      }
    }
  }

  const downloadResult = () => {
    if (!resultText) return
    try {
      const blob = new Blob([resultText], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'ocr-results.txt'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      setError('Failed to download results.')
    }
  }

  const handleProcess = async (
    files: Array<{ file: File; name: string; size: number; path?: string }>,
    context: { setProgress: (value: number) => void; setResult: (result: ReactNode | null) => void; setError: (message: string | null) => void }
  ) => {
    if (files.length === 0) {
      context.setError('No files selected for OCR.')
      return
    }

    setIsProcessing(true)
    setResultText('')
    context.setProgress(0)
    setStatusMessage('Starting OCR...')
    setError(null)

    const worker = await createWorker(selectedLanguage, 1, {
      langPath: '/tesseract/languages/',
      logger: (m: any) => {
        if (m.status === 'recognizing text') {
          context.setProgress(Math.round(m.progress * 100))
        }
      },
    })

    try {
      const totalFiles = files.length
      const errors: Array<{ name: string; message: string }> = []
      const results: Array<{ name: string; text: string }> = []

      for (let i = 0; i < totalFiles; i++) {
        const toolFile = files[i]
        setStatusMessage(`Processing ${toolFile.name} (${i + 1}/${totalFiles})`)

        try {
          const imageUrl = URL.createObjectURL(toolFile.file)
          const result: any = await worker.recognize(imageUrl)
          URL.revokeObjectURL(imageUrl)

          const text = result.data?.text ?? ''
          results.push({ name: toolFile.name, text })
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          errors.push({ name: toolFile.name, message })
        }

        // Update progress between files
        context.setProgress(Math.round(((i + 1) / totalFiles) * 100))
      }

      const combinedText = results.map(r => `=== ${r.name} ===\n\n${r.text}`).join('\n\n')
      setResultText(combinedText)

      const resultCard: ReactNode = (
        <Card className="space-y-3 border-border bg-base/60 p-4">
          <h3 className="text-sm font-semibold text-text">OCR Complete</h3>
          <div className="text-sm">
            Successfully processed {results.length} of {totalFiles} images.
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
          <div className="flex gap-2">
            <Button onClick={copyToClipboard} variant="secondary" className="flex-1" disabled={!combinedText}>
              <Clipboard className="mr-2 h-4 w-4" />
              {copied ? 'Copied!' : 'Copy Text'}
            </Button>
            <Button onClick={downloadResult} variant="secondary" className="flex-1" disabled={!combinedText}>
              <Download className="mr-2 h-4 w-4" />
              Download .txt
            </Button>
          </div>
        </Card>
      )

      context.setResult(resultCard)
      context.setProgress(100)
      setStatusMessage('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OCR processing failed.'
      context.setError(message)
      setError(message)
    } finally {
      try {
        await worker.terminate()
      } catch {
        // Worker may already be terminated
      }
      setIsProcessing(false)
    }
  }

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      accept=".png,.jpg,.jpeg,.webp,.bmp"
      options={
        <div className="space-y-4 text-sm">
          <div className="text-xs text-muted">
            Upload image files to extract text using Tesseract.js OCR.
          </div>

          <div>
            <label htmlFor="ocr-language" className="block text-xs font-medium mb-1.5">OCR Language</label>
            <select
              id="ocr-language"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="w-full rounded-md border border-border bg-base/60 px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>

          {statusMessage && (
            <div className="text-xs text-muted">Status: {statusMessage}</div>
          )}
        </div>
      }
      onProcess={handleProcess}
      loading={isProcessing}
    />
  )
}
