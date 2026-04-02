import { useState, useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import {
  ChevronDown,
  ChevronRight,
  Download,
  File,
  Folder,
  Loader2,
  PackageOpen,
} from 'lucide-react'

type ArchiveExtractToolProps = {
  tool: ToolDefinition
}

interface ArchiveEntry {
  path: string
  name: string
  size: number
  type: 'file' | 'directory'
  offset: number
  blob?: Blob
}

interface ArchiveView {
  name: string
  size: number
  status: 'listing' | 'ready' | 'error'
  entries: ArchiveEntry[]
  error?: string
  expandedDirs: Set<string>
  allExpanded: boolean
}

export function ArchiveExtractTool({ tool }: ArchiveExtractToolProps) {
  const [archiveViews, setArchiveViews] = useState<Record<string, ArchiveView>>({})

  const handleProcess = useCallback(
    async (
      files: Array<{ file: File; name: string; size: number; path?: string }>,
      context: { setProgress: (value: number) => void; setResult: (result: ReactNode | null) => void; setError: (message: string | null) => void }
    ) => {
      if (files.length === 0) {
        context.setError('No archive files selected.')
        return
      }

      context.setProgress(0)
      const newViews: Record<string, ArchiveView> = {}

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const progress = Math.round(((i + 0.5) / files.length) * 100)
        context.setProgress(progress)

        try {
          const entries = await parseArchive(file.file)

          newViews[file.name] = {
            name: file.name,
            size: file.size,
            status: 'ready',
            entries,
            expandedDirs: new Set(),
            allExpanded: false,
          }
        } catch (err) {
          console.error(`Failed to read archive: ${file.name}`, err)
          newViews[file.name] = {
            name: file.name,
            size: file.size,
            status: 'error',
            entries: [],
            error: err instanceof Error ? err.message : 'Failed to parse archive.',
            expandedDirs: new Set(),
            allExpanded: false,
          }
        }
      }

      setArchiveViews(newViews)
      context.setProgress(100)

      const totalFiles = files.length
      const successCount = Object.values(newViews).filter(v => v.status === 'ready').length
      const errorCount = totalFiles - successCount

      const resultCard: ReactNode = (
        <Card className="space-y-3 border-border bg-base/60 p-4">
          <h3 className="text-sm font-semibold text-text">Archive Analysis Complete</h3>
          <div className="text-sm">
            Processed {successCount} of {totalFiles} archives.
            {errorCount > 0 && ` (${errorCount} failed)`}
          </div>

          {Object.entries(newViews).map(([key, view]) => (
            <ArchiveFileView
              key={key}
              view={view}
              archiveFile={files.find(f => f.name === key)?.file}
              onToggleDir={(dirPath) => {
                setArchiveViews(prev => {
                  const v = { ...prev[key], expandedDirs: new Set(prev[key].expandedDirs) }
                  if (v.expandedDirs.has(dirPath)) {
                    v.expandedDirs.delete(dirPath)
                  } else {
                    v.expandedDirs.add(dirPath)
                  }
                  return { ...prev, [key]: v }
                })
              }}
              onExtract={(path) => extractFile(view.entries, path)}
              onExtractAll={() => extractAll(view)}
              onToggleAllExpand={() => {
                setArchiveViews(prev => {
                  const v = prev[key]
                  const allExpanded = !v.allExpanded
                  const newExpanded = allExpanded
                    ? new Set(v.entries.filter(e => e.type === 'directory').map(e => e.path))
                    : new Set<string>()
                  return { ...prev, [key]: { ...v, expandedDirs: newExpanded, allExpanded } }
                })
              }}
            />
          ))}

          {errorCount > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-red-500">Errors</div>
              <ul className="space-y-1">
                {Object.entries(newViews)
                  .filter(([, v]) => v.status === 'error')
                  .map(([name, v]) => (
                    <li key={name} className="text-xs text-red-500">
                      <span className="font-mono">{name}</span>: {v.error}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </Card>
      )

      context.setResult(resultCard)
    },
    []
  )

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      accept=".tar,.tar.gz,.tgz,.gz"
      instructions="Drop archive files here or click to browse your device."
      options={
        <div className="space-y-4 text-sm">
          <div className="text-xs text-muted">
            Supports TAR and TAR.GZ archives. View contents and extract individual files or everything.
          </div>
          <div className="text-xs text-muted">
            Processing happens locally in your browser -- no files are uploaded.
          </div>
        </div>
      }
      onProcess={handleProcess}
    />
  )
}

// ─── Archive Parsing ────────────────────────────────────────────────────────

async function parseArchive(file: File): Promise<ArchiveEntry[]> {
  const name = file.name.toLowerCase()

  // Decompress if needed, then parse as tar
  let tarData: ArrayBuffer
  if (name.endsWith('.tar.gz') || name.endsWith('.tgz')) {
    tarData = await decompressGzip(file)
  } else if (name.endsWith('.tar.bz2') || name.endsWith('.tbz2')) {
    tarData = await decompressBzip2(file)
  } else if (name.endsWith('.tar.xz') || name.endsWith('.txz')) {
    tarData = await decompressXz(file)
  } else if (name.endsWith('.tar')) {
    tarData = await file.arrayBuffer()
  } else {
    throw new Error(`Unsupported archive format: ${file.name}`)
  }

  return parseTar(tarData)
}

async function decompressGzip(file: File): Promise<ArrayBuffer> {
  const stream = file.stream().pipeThrough(new DecompressionStream('gzip'))
  const reader = stream.getReader()

  const chunks: Uint8Array[] = []
  let totalLength = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    chunks.push(value)
    totalLength += value.length
  }

  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result.buffer
}

// Browser-native bzip2 decompression is not available
// We'll attempt it and fall back with a clear error
async function decompressBzip2(file: File): Promise<ArrayBuffer> {
  throw new Error('BZ2 decompression is not available in the browser. Please decompress to .tar first.')
}

// Browser-native xz decompression is not available in standard APIs
async function decompressXz(file: File): Promise<ArrayBuffer> {
  throw new Error('XZ decompression is not available in the browser. Please decompress to .tar first or use the Extract tool with .tar.gz files.')
}

// ─── TAR Parser ─────────────────────────────────────────────────────────────
// POSIX ustar format: 512-byte headers followed by file content
// Two consecutive zero-filled 512-byte blocks = end of archive

function parseTar(data: ArrayBuffer): ArchiveEntry[] {
  const view = new DataView(data)
  const bytes = new Uint8Array(data)
  const entries: ArchiveEntry[] = []
  const blockSize = 512
  let offset = 0

  while (offset + blockSize <= bytes.length) {
    // Check for end of archive (two consecutive zero blocks)
    if (bytes[offset] === 0) {
      // Check if the next block is also empty (or we're close to end)
      const nextBlockStart = offset + blockSize
      if (nextBlockStart + blockSize > bytes.length || bytes[nextBlockStart] === 0) {
        break // End of archive
      }
      // Single empty block, skip it
      offset += blockSize
      continue
    }

    // Parse the 512-byte header
    const header = parseTarHeader(bytes, offset)
    if (!header) {
      offset += blockSize
      continue
    }

    const typeflag = header.typeflag
    const isDir = typeflag === '5' || (typeflag === '0' && header.name.endsWith('/'))
    const entry: ArchiveEntry = {
      path: header.name,
      name: header.name.split('/').filter(Boolean).pop() || '',
      size: header.size,
      type: isDir ? 'directory' : 'file',
      offset: offset + blockSize,
    }

    // Read file content for files
    if (!isDir && header.size > 0) {
      const contentStart = offset + blockSize
      const contentSize = Math.ceil(header.size / blockSize) * blockSize
      const content = bytes.subarray(contentStart, contentStart + header.size)
      entry.blob = new Blob([content])
    }

    entries.push(entry)

    // Advance past content (padded to 512-byte blocks)
    const contentBlocks = Math.ceil(header.size / blockSize)
    offset += blockSize + contentBlocks * blockSize
  }

  // Build directory structure - for each directory that exists as actual entries, keep them
  // Files' parent directories will be inferred
  return entries
}

interface TarHeader {
  name: string
  size: number
  typeflag: string
}

function parseTarHeader(bytes: Uint8Array, offset: number): TarHeader | null {
  // Basic validation: check magic
  const magic = readString(bytes, offset + 257, 6)
  if (magic.length > 0 && magic !== 'ustar ' && magic !== 'ustar\u0000' && magic !== 'ustar'
      && (bytes[offset] < 0x20 || bytes[offset] > 0x7e)) {
    // Not a valid tar header
    return null
  }

  // If it looks like it could be tar but magic doesn't match, try anyway
  // (some tar files don't have the ustar magic)
  const name = readString(bytes, offset, 100)
  if (name.length === 0) return null

  // Validate typeflag - must be one of known values
  const typeflag = readString(bytes, offset + 156, 1)
  const validTypes = ['0', '1', '2', '3', '4', '5', '6', '7', 'g', 'x', 'D']
  if (typeflag.length > 0 && !validTypes.includes(typeflag) && !validTypes.includes(typeflag + '')) {
    const tc = typeflag.charCodeAt(0)
    if (tc > 0 && tc < 0x20) return null // Likely not a valid header
  }

  const sizeStr = readString(bytes, offset + 124, 12).trim()
  // Handle tar size in octal (with possible leading zeros or spaces)
  const size = sizeStr.length > 0 ? parseInt(sizeStr, 8) : 0
  if (isNaN(size)) return null

  return {
    name: name.endsWith('/') ? name : normalizePath(name),
    size,
    typeflag: typeflag || '0',
  }
}

function normalizePath(name: string): string {
  // Remove leading ./
  return name.replace(/^\.\//, '')
}

function readString(bytes: Uint8Array, offset: number, length: number): string {
  const end = offset + length
  let nullIdx = -1
  for (let i = offset; i < end && i < bytes.length; i++) {
    if (bytes[i] === 0) {
      nullIdx = i
      break
    }
  }

  if (nullIdx === -1) {
    // No null terminator found, read entire length
    return new TextDecoder().decode(bytes.subarray(offset, end))
  }

  return new TextDecoder().decode(bytes.subarray(offset, nullIdx))
}

// ─── UI Components ──────────────────────────────────────────────────────────

function ArchiveFileView({
  view,
  archiveFile,
  onToggleDir,
  onExtract,
  onExtractAll,
  onToggleAllExpand,
}: {
  view: ArchiveView
  archiveFile?: File
  onToggleDir: (dirPath: string) => void
  onExtract: (path: string) => void
  onExtractAll: () => void
  onToggleAllExpand: () => void
}) {
  const [extracting, setExtracting] = useState<Set<string>>(new Set())

  // Build tree structure
  const tree = useMemo(() => {
    if (view.status !== 'ready') return null
    return buildTree(view.entries)
  }, [view.entries, view.status])

  if (view.status === 'error') {
    return (
      <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
        <div className="text-sm font-mono font-medium text-text">{view.name}</div>
        <div className="text-xs text-red-500 mt-1">{view.error}</div>
      </div>
    )
  }

  if (view.status !== 'ready') {
    return (
      <div className="mt-4 flex items-center gap-2 text-xs text-muted">
        <Loader2 className="h-3 w-3 animate-spin" />
        Reading {view.name}...
      </div>
    )
  }

  const fileCount = view.entries.filter(e => e.type === 'file').length
  const dirCount = view.entries.filter(e => e.type === 'directory').length

  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PackageOpen className="h-4 w-4 text-accent" />
          <span className="text-sm font-medium text-text">{view.name}</span>
          <Badge>{fileCount} file{fileCount !== 1 ? 's' : ''}</Badge>
          {dirCount > 0 && <Badge>{dirCount} folder{dirCount !== 1 ? 's' : ''}</Badge>}
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={onToggleAllExpand}>
            {view.allExpanded ? 'Collapse All' : 'Expand All'}
          </Button>
          <Button size="sm" variant="primary" onClick={onExtractAll} disabled={!archiveFile}>
            <Download className="mr-1 h-3 w-3" />
            Extract All
          </Button>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto rounded-lg border border-border bg-base/40">
        {tree && (
          <TreeItem
            node={tree}
            depth={0}
            expandedDirs={view.expandedDirs}
            onToggleDir={onToggleDir}
            onExtract={onExtract}
            extracting={extracting}
            onSetExtracting={setExtracting}
          />
        )}
        {view.entries.length === 0 && (
          <div className="p-3 text-xs text-muted">Empty archive</div>
        )}
      </div>
    </div>
  )
}

interface TreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  size: number
  entry?: ArchiveEntry
  children?: TreeNode[]
}

function buildTree(entries: ArchiveEntry[]): TreeNode {
  const root: TreeNode = { name: '', path: '', type: 'directory', size: 0, children: [] }
  const pathMap = new Map<string, TreeNode>()
  pathMap.set('', root)

  for (const entry of entries) {
    const parts = entry.path.split('/').filter(Boolean)
    let currentPath = ''

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const parentPath = currentPath
      currentPath = currentPath ? `${currentPath}/${part}` : part

      if (!pathMap.has(currentPath)) {
        const isDirectory = i < parts.length - 1 || entry.type === 'directory'
        const node: TreeNode = {
          name: part,
          path: currentPath,
          type: isDirectory ? 'directory' : 'file',
          size: isDirectory ? 0 : entry.size,
          entry: isDirectory ? undefined : entry,
          children: isDirectory ? [] : undefined,
        }
        pathMap.set(currentPath, node)

        const parent = pathMap.get(parentPath)
        if (parent?.children) {
          parent.children.push(node)
        }
      }
    }
  }

  // Sort: directories first, then files, alphabetically
  sortTree(root)
  return root
}

function sortTree(node: TreeNode) {
  if (!node.children) return
  node.children.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1
    }
    return a.name.localeCompare(b.name)
  })
  for (const child of node.children) {
    sortTree(child)
  }
}

function TreeItem({
  node,
  depth,
  expandedDirs,
  onToggleDir,
  onExtract,
  extracting,
  onSetExtracting,
}: {
  node: TreeNode
  depth: number
  expandedDirs: Set<string>
  onToggleDir: (path: string) => void
  onExtract: (path: string) => void
  extracting: Set<string>
  onSetExtracting: React.Dispatch<React.SetStateAction<Set<string>>>
}) {
  const isDir = node.type === 'directory'
  const isExpanded = isDir && expandedDirs.has(node.path)

  return (
    <div>
      <div
        className="flex items-center gap-1 px-2 py-1.5 text-xs hover:bg-base/80 cursor-pointer"
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onClick={() => isDir && onToggleDir(node.path)}
      >
        {isDir ? (
          isExpanded ? (
            <ChevronDown className="h-3 w-3 text-muted shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted shrink-0" />
          )
        ) : (
          <span className="h-3 w-3 shrink-0" />
        )}

        {isDir ? (
          <Folder className="h-3 w-3 text-amber-500 shrink-0" />
        ) : (
          <File className="h-3 w-3 text-muted shrink-0" />
        )}

        <span className="truncate text-text">{node.name}</span>

        {!isDir && node.size > 0 && (
          <span className="ml-auto text-muted shrink-0 tabular-nums">
            {formatBytes(node.size)}
          </span>
        )}

        {!isDir && node.entry && (
          <button
            className="ml-2 shrink-0 rounded text-xs text-accent hover:text-accent/80"
            onClick={async (e) => {
              e.stopPropagation()
              onSetExtracting(prev => new Set(prev).add(node.path))
              try {
                await onExtract(node.path)
              } finally {
                onSetExtracting(prev => {
                  const next = new Set(prev)
                  next.delete(node.path)
                  return next
                })
              }
            }}
            disabled={extracting.has(node.path)}
          >
            {extracting.has(node.path) ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Download className="h-3 w-3" />
            )}
          </button>
        )}
      </div>

      {isDir && isExpanded && node.children && (
        <div>
          {node.children.map(child => (
            <TreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              expandedDirs={expandedDirs}
              onToggleDir={onToggleDir}
              onExtract={onExtract}
              extracting={extracting}
              onSetExtracting={onSetExtracting}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Extraction Helper ──────────────────────────────────────────────────────

async function extractFile(entries: ArchiveEntry[], path: string) {
  const entry = entries.find(e => e.path === path)
  if (!entry?.blob) return

  const url = URL.createObjectURL(entry.blob)
  const a = document.createElement('a')
  a.href = url
  a.download = entry.name || path.split('/').pop() || 'file'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function extractAll(view: ArchiveView) {
  const { entries } = view
  const files = entries.filter(e => e.type === 'file' && e.blob)

  if (files.length === 0) return

  for (let i = 0; i < files.length; i++) {
    const entry = files[i]
    await new Promise(resolve => setTimeout(resolve, 100)) // Small delay to prevent browser throttling
    const url = URL.createObjectURL(entry.blob!)
    const a = document.createElement('a')
    a.href = url
    a.download = entry.name || entry.path.split('/').pop() || 'file'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`
}
