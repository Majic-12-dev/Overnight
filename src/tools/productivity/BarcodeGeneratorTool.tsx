import { useCallback, useRef, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Download, RotateCw, Upload, ScanLine } from 'lucide-react'
import bwipjs from 'bwip-js'

// bwip-js types use export = CommonJS pattern, cast for type safety
const { toCanvas } = bwipjs as any
import jsQR from 'jsqr'

type BarcodeGeneratorToolProps = {
  tool: ToolDefinition
}

type BarcodeType = {
  value: string
  label: string
}

const BARCODE_TYPES: BarcodeType[] = [
  { value: 'qrcode', label: 'QR Code' },
  { value: 'code128', label: 'Code 128 (1D)' },
  { value: 'code39', label: 'Code 39 (1D)' },
  { value: 'ean13', label: 'EAN-13' },
  { value: 'ean8', label: 'EAN-8' },
  { value: 'upca', label: 'UPC-A' },
  { value: 'itf14', label: 'ITF-14' },
  { value: 'datamatrix', label: 'Data Matrix (2D)' },
  { value: 'pdf417', label: 'PDF417 (2D)' },
]

export function BarcodeGeneratorTool({ tool }: BarcodeGeneratorToolProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const decodeInputRef = useRef<HTMLInputElement | null>(null)
  const [text, setText] = useState('')
  const [barcodeType, setBarcodeType] = useState('qrcode')
  const [barcodeDataUrl, setBarcodeDataUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [decodeResult, setDecodeResult] = useState<string | null>(null)
  const [decodeError, setDecodeError] = useState<string | null>(null)

  const generateBarcode = useCallback(() => {
    if (!text.trim()) {
      setError('Please enter some text or data.')
      setBarcodeDataUrl(null)
      return
    }

    if (!canvasRef.current) {
      setError('Canvas not available.')
      setBarcodeDataUrl(null)
      return
    }

    try {
      const ctx = canvasRef.current.getContext('2d')
      if (!ctx) {
        setError('Could not get canvas context.')
        setBarcodeDataUrl(null)
        return
      }

      toCanvas(canvasRef.current, {
        bcid: barcodeType,
        text: text.trim(),
        scale: 3,
        height: 10,
        includetext: true,
        textxalign: 'center',
      })

      const dataUrl = canvasRef.current.toDataURL('image/png')
      setBarcodeDataUrl(dataUrl)
      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate barcode.'
      setError(message)
      setBarcodeDataUrl(null)
    }
  }, [text, barcodeType])

  const handleDownload = useCallback(() => {
    if (!barcodeDataUrl) return
    const link = document.createElement('a')
    link.href = barcodeDataUrl
    link.download = `${barcodeType}-${Date.now()}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [barcodeDataUrl, barcodeType])

  const handleDecodeImage = useCallback(async (files: FileList | null) => {
    setDecodeResult(null)
    setDecodeError(null)

    if (!files || files.length === 0) return

    const file = files[0]
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.drawImage(img, 0, 0, img.width, img.height)
        const imageData = ctx.getImageData(0, 0, img.width, img.height)

        const decoded = jsQR(imageData.data, img.width, img.height)
        if (decoded && decoded.data) {
          setDecodeResult(decoded.data)
        } else {
          setDecodeError('No QR code found in the image.')
        }
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  }, [])

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className='space-y-4 text-sm'>
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Barcode Type</div>
            <Select value={barcodeType} onChange={(e) => setBarcodeType(e.target.value)}>
              {BARCODE_TYPES.map((bt) => (
                <option key={bt.value} value={bt.value}>
                  {bt.label}
                </option>
              ))}
            </Select>
          </div>

          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Content</div>
            <Input
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                setError(null)
              }}
              placeholder='Enter text or data...'
              onKeyDown={(e) => e.key === 'Enter' && generateBarcode()}
            />
          </div>

          <Button onClick={generateBarcode} className='w-full'>
            Generate
          </Button>

          <div className='rounded-xl border border-border bg-base/60 p-3 space-y-3'>
            <div className='text-xs font-semibold uppercase text-muted'>Decode QR Code</div>
            <input
              ref={decodeInputRef}
              type='file'
              accept='image/*'
              className='hidden'
              onChange={(e) => handleDecodeImage(e.target.files)}
            />
            <Button
              variant='outline'
              className='w-full text-xs'
              onClick={() => decodeInputRef.current?.click()}
            >
              <Upload className='mr-2 h-3 w-3' />
              Upload image to decode
            </Button>
            {decodeResult && (
              <div className='rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3'>
                <div className='text-xs font-semibold text-emerald-400'>Decoded:</div>
                <div className='mt-1 text-xs text-muted break-all'>{decodeResult}</div>
              </div>
            )}
            {decodeError && (
              <div className='rounded-xl border border-red-500/20 bg-red-500/10 p-3'>
                <div className='text-xs text-red-300'>{decodeError}</div>
              </div>
            )}
          </div>

          <Badge className='border-0 bg-accent/15 text-accent'>Offline • Client-side only</Badge>
        </div>
      }
      result={
        barcodeDataUrl || error ? (
          <Card className='space-y-4'>
            {barcodeDataUrl && (
              <div className='flex flex-col items-center gap-4'>
                <div className='rounded-xl border border-border bg-white p-4'>
                  <img
                    src={barcodeDataUrl}
                    alt='Barcode'
                    className='max-h-64 max-w-full'
                    style={{ imageRendering: 'auto' }}
                  />
                </div>
                <div className='flex gap-2'>
                  <Button variant='secondary' onClick={handleDownload}>
                    <Download className='mr-2 h-4 w-4' />
                    Download PNG
                  </Button>
                  <Button variant='ghost' onClick={generateBarcode}>
                    <RotateCw className='mr-2 h-4 w-4' />
                    Regenerate
                  </Button>
                </div>
              </div>
            )}
            {error && (
              <div className='rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300'>
                {error}
              </div>
            )}
          </Card>
        ) : null
      }
    >
      <canvas ref={canvasRef} className='hidden' />
    </BaseToolLayout>
  )
}
