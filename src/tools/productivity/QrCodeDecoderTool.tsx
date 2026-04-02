import { useCallback, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import type { ToolFile } from '@/components/tools/BaseToolLayout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Clipboard, ClipboardCheck, ExternalLink } from 'lucide-react'
import jsQR from 'jsqr'

type QrCodeDecoderToolProps = {
  tool: ToolDefinition
}

type DecodeResult = {
  text: string
  isUrl: boolean
  imageSrc: string
  fileName: string
}

function checkIsUrl(s: string): boolean {
  try {
    const url = new URL(s)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function decodeImage(file: File): Promise<DecodeResult | null> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(null)
          return
        }
        ctx.drawImage(img, 0, 0)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        })
        if (code) {
          resolve({
            text: code.data,
            isUrl: checkIsUrl(code.data),
            imageSrc: reader.result as string,
            fileName: file.name,
          })
        } else {
          resolve(null)
        }
      }
      img.onerror = () => resolve(null)
      img.src = reader.result as string
    }
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(file)
  })
}

export function QrCodeDecoderTool({ tool }: QrCodeDecoderToolProps) {
  const [results, setResults] = useState<DecodeResult[]>([])

  const onProcess = useCallback(
    async (
      files: ToolFile[],
      context: {
        setProgress: (v: number) => void
        setResult: (r: React.ReactNode | null) => void
        setError: (e: string | null) => void
      },
    ): Promise<void> => {
      if (files.length === 0) {
        context.setError('Please add at least one image file.')
        return
      }

      context.setProgress(10)

      const decoded: DecodeResult[] = []
      const failures: string[] = []

      for (let i = 0; i < files.length; i++) {
        try {
          const result = await decodeImage(files[i].file)
          if (result) {
            decoded.push(result)
          } else {
            failures.push(files[i].name)
          }
        } catch {
          failures.push(files[i].name)
        }
        context.setProgress(10 + ((i + 1) / files.length) * 85)
      }

      context.setProgress(95)

      if (decoded.length === 0) {
        context.setError(
          failures.length > 0
            ? `No QR code found in: ${failures.join(', ')}`
            : 'No QR codes found in the uploaded images.',
        )
        setResults([])
        return
      }

      setResults(decoded)
      context.setError(null)

      context.setResult(
        <div className='space-y-3'>
          {decoded.map((r, i) => (
            <ResultCard key={i} result={r} />
          ))}
        </div>,
      )
    },
    [],
  )

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      accept='image/*'
      instructions='Drop a QR code image here or click to browse.'
      maxFiles={50}
      maxFileSize={20 * 1024 * 1024}
      onProcess={onProcess}
      options={
        <div className='space-y-4 text-sm'>
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>About</div>
            <p className='text-xs text-muted leading-relaxed'>
              Upload images containing QR codes to decode their content. Supports URLs, plain text,
              phone numbers, and any encoded data.
            </p>
          </div>
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Supported Formats</div>
            <div className='flex flex-wrap gap-1.5'>
              {['JPG', 'PNG', 'WEBP', 'BMP', 'GIF'].map((fmt) => (
                <Badge key={fmt} className='border-0 bg-accent/10 text-accent text-[11px]'>
                  {fmt}
                </Badge>
              ))}
            </div>
          </div>
          <Badge className='border-0 bg-accent/15 text-accent'>Offline • Client-side only</Badge>

          {results.length > 0 && (
            <div className='space-y-2'>
              <div className='text-xs font-semibold uppercase text-muted'>
                Results Summary
              </div>
              {results.map((r, i) => (
                <div key={i} className='rounded-lg bg-base/60 px-2 py-1.5'>
                  <div className='text-xs text-muted truncate'>
                    {r.fileName}
                  </div>
                  <div className='text-xs text-text font-mono truncate mt-0.5'>
                    {r.text.slice(0, 50)}
                    {r.text.length > 50 ? '…' : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      }
    />
  )
}

function ResultCard({ result }: { result: DecodeResult }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(result.text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [result.text])

  const handleOpenUrl = useCallback(() => {
    if (result.isUrl) {
      window.open(result.text, '_blank', 'noopener,noreferrer')
    }
  }, [result.text, result.isUrl])

  return (
    <div className='rounded-xl border border-border bg-base/60 px-4 py-3 space-y-3'>
      <div className='flex gap-3'>
        <img
          src={result.imageSrc}
          alt={result.fileName}
          className='h-16 w-16 rounded-lg object-cover border border-border flex-shrink-0'
        />
        <div className='min-w-0 flex-1 space-y-1'>
          <p className='text-xs text-muted truncate'>{result.fileName}</p>
          <p className='text-sm text-text break-all font-mono bg-base/80 rounded-lg px-2 py-1.5 max-h-20 overflow-y-auto'>
            {result.text}
          </p>
        </div>
      </div>
      <div className='flex gap-2'>
        <Button variant='secondary' onClick={handleCopy} className='h-8 px-3 text-xs'>
          {copied ? (
            <>
              <ClipboardCheck className='mr-1.5 h-3.5 w-3.5' />
              Copied
            </>
          ) : (
            <>
              <Clipboard className='mr-1.5 h-3.5 w-3.5' />
              Copy
            </>
          )}
        </Button>
        {result.isUrl && (
          <Button variant='ghost' onClick={handleOpenUrl} className='h-8 px-3 text-xs'>
            <ExternalLink className='mr-1.5 h-3.5 w-3.5' />
            Open URL
          </Button>
        )}
      </div>
    </div>
  )
}