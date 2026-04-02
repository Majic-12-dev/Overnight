import { useCallback, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Copy, CheckCircle, ArrowLeftRight, Link2, XCircle } from 'lucide-react'

type ToolProps = {
  tool: ToolDefinition
}

type EncodeComponent = {
  original: string
  encoded: string
  label: string
}

function getEncodeOptions(): { label: string; value: string }[] {
  return [
    { label: 'encodeURIComponent', value: 'uri' },
    { label: 'encodeURI', value: 'uriFull' },
  ]
}

function encodeText(input: string, mode: string): string {
  try {
    if (mode === 'uriFull') return encodeURI(input)
    return encodeURIComponent(input)
  } catch {
    return input
  }
}

function decodeText(input: string, mode: string): string {
  try {
    if (mode === 'uriFull') return decodeURI(input)
    return decodeURIComponent(input)
  } catch {
    // Handle partial encoded strings
    return decodeURIComponent(input.replace(/%(?![0-9a-fA-F]{2})/g, '%25'))
  }
}

export function UrlEncoderTool({ tool }: ToolProps) {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [mode, setMode] = useState<'uri' | 'decode'>('uri')
  const [encodeSubMode, setEncodeSubMode] = useState<'uri' | 'uriFull'>('uri')
  const [decodeSubMode, setDecodeSubMode] = useState<'uri' | 'uriFull'>('uri')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleProcess = useCallback(() => {
    setError(null)
    if (!input) {
      setOutput('')
      return
    }

    try {
      if (mode === 'uri') {
        setOutput(encodeText(input, encodeSubMode))
      } else {
        setOutput(decodeText(input, decodeSubMode))
      }
    } catch (e) {
      setError(`Processing error: ${e instanceof Error ? e.message : 'Invalid input'}`)
      setOutput('')
    }
  }, [input, mode, encodeSubMode, decodeSubMode])

  const handleCopy = useCallback(() => {
    if (!output) return
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [output])

  const handleSwap = useCallback(() => {
    setInput(output)
    setOutput(input)
    setMode(mode === 'uri' ? 'decode' : 'uri')
    setError(null)
  }, [input, output, mode])

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className='space-y-4 text-sm'>
          {/* Mode selection */}
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Mode</div>
            <div className='flex gap-2'>
              <button
                type='button'
                onClick={() => {
                  setMode('uri')
                  setError(null)
                }}
                className={`flex-1 rounded-xl border px-3 py-2 text-center text-xs font-medium transition
                  ${mode === 'uri' ? 'border-accent bg-accent/15 text-accent' : 'border-border bg-base/60 text-muted hover:text-text'}`}
              >
                Encode
              </button>
              <button
                type='button'
                onClick={() => {
                  setMode('decode')
                  setError(null)
                }}
                className={`flex-1 rounded-xl border px-3 py-2 text-center text-xs font-medium transition
                  ${mode === 'decode' ? 'border-accent bg-accent/15 text-accent' : 'border-border bg-base/60 text-muted hover:text-text'}`}
              >
                Decode
              </button>
            </div>
          </div>

          {/* Sub-mode selection */}
          {mode === 'uri' && (
            <div className='space-y-2'>
              <div className='text-xs font-semibold uppercase text-muted'>Encoding</div>
              <div className='flex gap-2'>
                <button
                  type='button'
                  onClick={() => setEncodeSubMode('uri')}
                  className={`flex-1 rounded-xl border px-3 py-2 text-center text-xs font-medium transition
                    ${encodeSubMode === 'uri' ? 'border-accent bg-accent/15 text-accent' : 'border-border bg-base/60 text-muted hover:text-text'}`}
                >
                  Strict
                </button>
                <button
                  type='button'
                  onClick={() => setEncodeSubMode('uriFull')}
                  className={`flex-1 rounded-xl border px-3 py-2 text-center text-xs font-medium transition
                    ${encodeSubMode === 'uriFull' ? 'border-accent bg-accent/15 text-accent' : 'border-border bg-base/60 text-muted hover:text-text'}`}
                >
                  Full URL
                </button>
              </div>
            </div>
          )}

          {mode === 'decode' && (
            <div className='space-y-2'>
              <div className='text-xs font-semibold uppercase text-muted'>Decoding</div>
              <div className='flex gap-2'>
                <button
                  type='button'
                  onClick={() => setDecodeSubMode('uri')}
                  className={`flex-1 rounded-xl border px-3 py-2 text-center text-xs font-medium transition
                    ${decodeSubMode === 'uri' ? 'border-accent bg-accent/15 text-accent' : 'border-border bg-base/60 text-muted hover:text-text'}`}
                >
                  Strict
                </button>
                <button
                  type='button'
                  onClick={() => setDecodeSubMode('uriFull')}
                  className={`flex-1 rounded-xl border px-3 py-2 text-center text-xs font-medium transition
                    ${decodeSubMode === 'uriFull' ? 'border-accent bg-accent/15 text-accent' : 'border-border bg-base/60 text-muted hover:text-text'}`}
                >
                  Full URL
                </button>
              </div>
            </div>
          )}

          <div className='space-y-2'>
            <Badge className='border-0 bg-accent/15 text-accent'>Offline • Client-side only</Badge>
          </div>

          <Button onClick={handleProcess} className='w-full'>
            <ArrowLeftRight className='mr-2 h-4 w-4' />
            {mode === 'uri' ? 'Encode' : 'Decode'}
          </Button>
        </div>
      }
    >
      <div className='space-y-4'>
        {/* Input */}
        <div className='space-y-2'>
          <div className='flex items-center justify-between'>
            <label className='text-sm font-medium text-text'>
              {mode === 'uri' ? 'Input Text' : 'Encoded URL'}
            </label>
            {output && (
              <Button variant='ghost' className='h-7 text-[10px]' onClick={handleSwap}>
                <ArrowLeftRight className='mr-1 h-3 w-3' />
                Swap
              </Button>
            )}
          </div>
          <textarea
            rows={4}
            placeholder={mode === 'uri' ? 'https://example.com/path?name=John Doe&city=New York' : 'https%3A%2F%2Fexample.com%2Fpath...'}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              setError(null)
            }}
            className='w-full rounded-xl border border-border bg-base/70 px-3 py-2 text-sm font-mono text-text placeholder:text-muted/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y'
          />
        </div>

        {/* Error display */}
        {error && (
          <Card className='flex items-start gap-3 border border-red-500/50 bg-red-500/10'>
            <XCircle className='mt-0.5 h-5 w-5 flex-shrink-0 text-red-400' />
            <div className='text-sm text-red-200'>{error}</div>
          </Card>
        )}

        {/* Output */}
        {output && !error && (
          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <span className='text-sm font-medium text-text'>
                {mode === 'uri' ? 'Encoded URL' : 'Decoded Text'}
              </span>
              <Button variant='ghost' className='h-7 text-[10px]' onClick={handleCopy}>
                {copied ? (
                  <CheckCircle className='mr-1 h-3 w-3 text-green-400' />
                ) : (
                  <Copy className='mr-1 h-3 w-3' />
                )}
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <Card className='relative'>
              <pre className='max-h-48 overflow-auto rounded-lg bg-base/80 p-3 text-xs font-mono text-text whitespace-pre-wrap break-all'>
                {output}
              </pre>
            </Card>
          </div>
        )}

        {/* Example */}
        {!output && !error && (
          <Card className='rounded-xl border border-border bg-base/60 px-4 py-6 text-center text-sm text-muted'>
            <div className='flex justify-center mb-2'>
              <Link2 className='h-6 w-6 text-accent' />
            </div>
            <p>Enter a URL or text string to encode, or a URL-encoded string to decode.</p>
            <p className='mt-1 text-xs'>Preserves special characters in Full URL mode.</p>
          </Card>
        )}
      </div>
    </BaseToolLayout>
  )
}
