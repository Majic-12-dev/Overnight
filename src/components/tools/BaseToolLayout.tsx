import type { DragEvent, ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { FilePlus, GripVertical, Loader2, Trash2, UploadCloud } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Progress } from '@/components/ui/Progress'
import { cn } from '@/lib/cn'
import { clamp, formatBytes } from '@/lib/format'

export type ToolFile = {
  id: string
  file: File
  name: string
  size: number
  type: string
  path?: string
  lastModified: number
}

type ProcessContext = {
  setProgress: (value: number) => void
  setResult: (result: ReactNode | null) => void
  setError: (message: string | null) => void
}

type BaseToolLayoutProps = {
  title: string
  description?: string
  accept?: string
  instructions?: string
  maxFiles?: number
  maxFileSize?: number
  reorderable?: boolean
  onProcess?: (files: ToolFile[], context: ProcessContext) => Promise<void> | void
  options?: ReactNode
  children?: ReactNode
  loading?: boolean
  result?: ReactNode
}

const FILE_LIMIT_SOFT = 200

export function BaseToolLayout({
  title,
  description,
  accept,
  instructions = 'Drop files here or click to browse your device.',
  maxFiles = Infinity,
  maxFileSize = 500 * 1024 * 1024, // 500 MB default
  reorderable = false,
  onProcess,
  options,
  children,
  loading,
  result: externalResult,
}: BaseToolLayoutProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [files, setFiles] = useState<ToolFile[]>([])
  const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState(0)
  const [internalResult, setInternalResult] = useState<ReactNode | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('docflow:files', { detail: files }))
  }, [files])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const isProcessing = loading || status === 'processing'
  const canProcess = !!onProcess && files.length > 0 && !isProcessing && files.length <= maxFiles
  const warning =
    files.length > maxFiles
      ? `Limit reached. Reduce to ${maxFiles} files to continue.`
      : files.length > FILE_LIMIT_SOFT
        ? 'Large batch detected. Consider splitting for faster results.'
        : ''

  const handleFiles = (incoming: FileList | File[]) => {
    const list = Array.from(incoming)
    const mapped = list.map((file) => ({
      id: createId(),
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      path: (file as File & { path?: string }).path,
      lastModified: file.lastModified,
    }))
    // Filter out files exceeding maxFileSize
    const allowed: typeof mapped = []
    const rejected: typeof mapped = []
    mapped.forEach((item) => {
      if (item.file.size <= maxFileSize) {
        allowed.push(item)
      } else {
        rejected.push(item)
      }
    })
    if (rejected.length > 0) {
      const names = rejected.map(r => r.name).join(', ')
      const limit = formatBytes(maxFileSize)
      setError(`${rejected.length} file(s) exceed the size limit of ${limit} and were rejected: ${names}`)
    }
    setFiles((prev) => {
      const existingKeys = new Set(prev.map(toKey))
      const merged = [...prev]
      allowed.forEach((item) => {
        const key = toKey(item)
        if (!existingKeys.has(key)) {
          merged.push(item)
          existingKeys.add(key)
        }
      })
      return merged
    })
  }

  const handleBrowse = () => inputRef.current?.click()

  const handleClear = () => {
    setFiles([])
    setStatus('idle')
    setInternalResult(null)
    setError(null)
    setProgress(0)
  }

  const handleProcess = async () => {
    if (!canProcess) return
    setStatus('processing')
    setProgress(4)
    setError(null)
    setInternalResult(null)
    try {
      await onProcess(files, {
        setProgress: (value) => setProgress(clamp(value, 0, 100)),
        setResult: setInternalResult,
        setError,
      })
      setProgress(100)
      setStatus('done')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected processing error.'
      setError(message)
      setStatus('error')
      setProgress(0)
    }
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    if (event.dataTransfer.files?.length) {
      handleFiles(event.dataTransfer.files)
    }
  }

  const items = useMemo(() => files.map((file) => file.id), [files])

  const fileList = (
    <div className='space-y-2'>
      {files.map((file) => (
        <FileRow
          key={file.id}
          file={file}
          onRemove={() => setFiles((prev) => prev.filter((item) => item.id !== file.id))}
          reorderable={reorderable}
        />
      ))}
    </div>
  )

  return (
    <div className='flex flex-col gap-6'>
      <header className='space-y-2'>
        <h1 className='text-2xl font-semibold text-text'>{title}</h1>
        <p className='max-w-2xl text-sm text-muted'>{description}</p>
      </header>

      <div className='grid grid-cols-[minmax(0,1fr)_280px] gap-6'>
        <div className='space-y-4'>
          {children}

          <Card
            className={cn(
              'border-dashed border-2 px-6 py-8 text-center transition',
              isDragging ? 'border-accent bg-accent/10' : 'border-border',
            )}
            onDragOver={(event) => {
              event.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <input
              ref={inputRef}
              type='file'
              multiple
              accept={accept}
              onChange={(event) => event.target.files && handleFiles(event.target.files)}
              className='hidden'
            />
            <div className='mx-auto flex max-w-md flex-col items-center gap-3'>
              <div className='flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent'>
                <UploadCloud className='h-6 w-6' />
              </div>
              <div className='text-sm font-medium text-text'>{instructions}</div>
              <p className='text-xs text-muted'>Supports drag and drop or manual browsing.</p>
              <Button variant='secondary' onClick={handleBrowse}>
                <FilePlus className='h-4 w-4' />
                Browse Files
              </Button>
            </div>
          </Card>

          <Card className='space-y-4'>
            <div className='flex items-center justify-between'>
              <div>
                <h2 className='text-sm font-semibold text-text'>File Queue</h2>
                <p className='text-xs text-muted'>
                  {files.length} file{files.length === 1 ? '' : 's'} ready
                </p>
              </div>
              <Button variant='ghost' onClick={handleClear} disabled={files.length === 0}>
                <Trash2 className='h-4 w-4' />
                Clear All
              </Button>
            </div>

            {files.length === 0 ? (
              <div className='rounded-xl border border-border bg-base/60 px-4 py-6 text-center text-sm text-muted'>
                Add files to start processing.
              </div>
            ) : reorderable ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={({ active, over }) => {
                  if (!over || active.id === over.id) return
                  setFiles((items) => {
                    const oldIndex = items.findIndex((item) => item.id === active.id)
                    const newIndex = items.findIndex((item) => item.id === over.id)
                    return arrayMove(items, oldIndex, newIndex)
                  })
                }}
              >
                <SortableContext items={items} strategy={verticalListSortingStrategy}>
                  {fileList}
                </SortableContext>
              </DndContext>
            ) : (
              fileList
            )}
          </Card>

          {children}

          {externalResult !== undefined ? externalResult : status === 'done' && internalResult ? (
            <Card className='space-y-3'>
              <h3 className='text-sm font-semibold text-text'>Results</h3>
              <div className='text-sm text-muted'>{internalResult}</div>
            </Card>
          ) : null}

          {error ? (
            <Card className='border border-red-500/50 bg-red-500/10 text-sm text-red-200'>
              {error}
            </Card>
          ) : null}
        </div>

        <Card className='space-y-4'>
          <h3 className='text-sm font-semibold text-text'>Options</h3>
          {options ?? (
            <p className='text-xs text-muted'>Select a tool to see its settings.</p>
          )}
        </Card>
      </div>

      <div className='sticky bottom-6 z-10'>
        <Card className='flex flex-col gap-3'>
          <div className='flex flex-wrap items-center justify-between gap-4'>
            <div>
              <h4 className='text-sm font-semibold text-text'>Processing</h4>
              <p className='text-xs text-muted'>
                {status === 'processing'
                  ? 'Working on your files...'
                  : status === 'done'
                    ? 'Processing complete.'
                    : 'Ready when you are.'}
              </p>
            </div>
            <Button onClick={handleProcess} disabled={!canProcess || loading}>
              {(loading || status === 'processing') && (
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              )}
              {loading || status === 'processing' ? 'Processing...' : 'Process'}
            </Button>
          </div>
          <Progress value={progress} />
          {warning ? <p className='text-xs text-muted'>{warning}</p> : null}
        </Card>
      </div>
    </div>
  )
}

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function FileRow({
  file,
  onRemove,
  reorderable,
}: {
  file: ToolFile
  onRemove: () => void
  reorderable: boolean
}) {
  if (!reorderable) {
    return (
      <div className='flex items-center justify-between rounded-xl border border-border bg-base/60 px-3 py-2 text-sm'>
        <div>
          <div className='font-medium text-text'>{file.name}</div>
          <div className='text-xs text-muted'>{formatBytes(file.size)}</div>
        </div>
        <Button variant='ghost' onClick={onRemove}>
          Remove
        </Button>
      </div>
    )
  }

  return <SortableFileRow file={file} onRemove={onRemove} />
}

function SortableFileRow({ file, onRemove }: { file: ToolFile; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: file.id,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center justify-between rounded-xl border border-border bg-base/60 px-3 py-2 text-sm',
        isDragging && 'border-accent bg-accent/10',
      )}
    >
      <div className='flex items-center gap-3'>
        <button
          type='button'
          className='text-muted hover:text-text'
          {...attributes}
          {...listeners}
        >
          <GripVertical className='h-4 w-4' />
        </button>
        <div>
          <div className='font-medium text-text'>{file.name}</div>
          <div className='text-xs text-muted'>{formatBytes(file.size)}</div>
        </div>
      </div>
      <Button variant='ghost' onClick={onRemove}>
        Remove
      </Button>
    </div>
  )
}

function toKey(file: ToolFile) {
  return file.path || `${file.name}-${file.size}-${file.lastModified}`
}