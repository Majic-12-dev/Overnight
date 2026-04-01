import { useState, useMemo, useCallback, useRef } from 'react'
import type { ReactNode } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import type { ToolFile } from '@/components/tools/BaseToolLayout'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useAppStore } from '@/store/useAppStore'

type DuplicateFinderToolProps = {
  tool: ToolDefinition
}

type FileEntry = {
  file: File
  path: string
  size: number
  hash?: string
}

type DuplicateGroup = {
  hash: string
  files: FileEntry[]
}

export function DuplicateFinderTool({ tool }: DuplicateFinderToolProps) {
  const { preferences, setDefaultOutputDir } = useAppStore()
  const [files, setFiles] = useState<FileEntry[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([])
  const [progress, setProgress] = useState(0)
  const [currentFile, setCurrentFile] = useState<string>('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)

  // Refs to retain BaseToolLayout context callbacks after handleScan completes
  const progressContextRef = useRef<{ setProgress: (value: number) => void } | null>(null)
  const resultContextRef = useRef<{ setResult: (result: ReactNode) => void } | null>(null)
  const errorContextRef = useRef<{ setError: (message: string | null) => void } | null>(null)

  const outputDirLabel = useMemo(
    () => preferences.defaultOutputDir || 'Not set yet',
    [preferences.defaultOutputDir]
  )

  const handleChooseFolder = async () => {
    const selected = await window.api.selectOutputDir()
    if (selected) setDefaultOutputDir(selected)
  }

  const handleFileSelect = useCallback((selectedFiles: FileList | null) => {
    if (!selectedFiles) return
    const newEntries: FileEntry[] = []
    for (const file of Array.from(selectedFiles)) {
      newEntries.push({
        file,
        path: file.name,
        size: file.size,
      })
    }
    setFiles((prev) => [...prev, ...newEntries])
  }, [])

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const clearFiles = () => {
    setFiles([])
    setDuplicates([])
  }

  const openDeleteConfirmation = () => setShowDeleteConfirmation(true)
  const closeDeleteConfirmation = () => setShowDeleteConfirmation(false)

  // Simple hash using Web Crypto API
  const hashFile = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  const performDeleteDuplicates = async () => {
    if (!window.api?.deleteFiles) {
      errorContextRef.current?.setError('File deletion is not available in this build.')
      setShowDeleteConfirmation(false)
      return
    }

    const totalDuplicates = duplicates.reduce((sum, group) => sum + group.files.length - 1, 0)
    if (totalDuplicates === 0) {
      errorContextRef.current?.setError('No duplicates to delete.')
      setShowDeleteConfirmation(false)
      return
    }

    setIsDeleting(true)
    progressContextRef.current?.setProgress(0)

    try {
      // Build list of files to delete: all but the first in each group
      const toDelete = duplicates.flatMap(g => g.files.slice(1).map(f => ({ sourcePath: f.path })))

      const result = await window.api.deleteFiles({ items: toDelete })
      const results = result?.results || []

      const successCount = results.filter(r => r.success).length
      const errorList = results.filter(r => !r.success).map(r => ({
        sourcePath: r.sourcePath,
        error: r.error || 'Unknown error'
      }))

      // Collect successfully deleted paths
      const deletedPaths = new Set(results.filter(r => r.success).map(r => r.sourcePath))

      // Update files state: remove deleted entries
      setFiles(prev => prev.filter(f => !deletedPaths.has(f.path)))

      // Update duplicates: filter out deleted files, keep groups with >1 file remaining
      setDuplicates(prev => {
        const updated = prev.map(group => ({
          ...group,
          files: group.files.filter(f => !deletedPaths.has(f.path))
        })).filter(group => group.files.length > 1)
        return updated
      })

      // Build result card
      const resultCard: ReactNode = (
        <Card className="space-y-3 border-border bg-base/60 p-4">
          <h3 className="text-sm font-semibold text-text">
            Deletion Complete
          </h3>
          <div className="text-sm">
            Successfully deleted {successCount} file{successCount !== 1 ? 's' : ''}.
          </div>
          {errorList.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-red-500">Errors</div>
              <ul className="space-y-1">
                {errorList.map((err, idx) => (
                  <li key={idx} className="text-xs text-red-500">
                    <span className="font-mono">{err.sourcePath}</span>: {err.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )

      resultContextRef.current?.setResult(resultCard)
      progressContextRef.current?.setProgress(100)
    } catch (error) {
      console.error('Error deleting duplicates:', error)
      errorContextRef.current?.setError(error instanceof Error ? error.message : 'Failed to delete files.')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirmation(false)
    }
  }

  const handleScan = async (scannedFiles: ToolFile[], context: { setProgress: (value: number) => void; setResult: (result: ReactNode) => void; setError: (message: string | null) => void }) => {
    // Store context callbacks for later use (e.g., deletion)
    progressContextRef.current = { setProgress: context.setProgress }
    resultContextRef.current = { setResult: context.setResult }
    errorContextRef.current = { setError: context.setError }

    // Use the scannedFiles from BaseToolLayout instead of component state
    if (scannedFiles.length === 0) {
      context.setError('Please select files to scan for duplicates.')
      return
    }

    setProgress(0)
    setDuplicates([])

    try {
      // Convert ToolFile to FileEntry
      const fileEntries: FileEntry[] = scannedFiles.map(f => ({
        file: f.file,
        path: f.path || f.name,
        size: f.size,
      }))

      // Group by size first (fast filter)
      const bySize = fileEntries.reduce<Map<number, FileEntry[]>>((acc, entry) => {
        const list = acc.get(entry.size) || []
        list.push(entry)
        acc.set(entry.size, list)
        return acc
      }, new Map())

      // Only hash files with same size (>1)
      const candidateGroups = Array.from(bySize.values()).filter((group) => group.length > 1)

      context.setProgress(10)

      // Hash each candidate
      const hashedGroups: DuplicateGroup[] = []
      let processed = 0
      const total = candidateGroups.reduce((sum, group) => sum + group.length, 0)

      for (const group of candidateGroups) {
        const hashPromises = group.map(async (entry) => {
          const hash = await hashFile(entry.file)
          return { ...entry, hash }
        })
        const hashedEntries = await Promise.all(hashPromises)
        hashedGroups.push({ hash: hashedEntries[0].hash!, files: hashedEntries })
        processed += group.length
        context.setProgress(10 + Math.round((processed / total) * 80))
      }

      // Group by hash
      const byHash = hashedGroups.reduce<Map<string, FileEntry[]>>((acc, group) => {
        const existing = acc.get(group.hash) || []
        acc.set(group.hash, [...existing, ...group.files])
        return acc
      }, new Map())

      const duplicateGroups: DuplicateGroup[] = []
      for (const [hash, entries] of byHash.entries()) {
        if (entries.length > 1) {
          duplicateGroups.push({ hash, files: entries })
        }
      }

      setDuplicates(duplicateGroups)
      context.setProgress(100)

      // Set result
      if (duplicateGroups.length > 0) {
        context.setResult(
          <Card className="space-y-3 border-border bg-base/60 p-4">
            <h3 className="text-sm font-semibold text-text">
              Found {duplicateGroups.length} duplicate group(s)
            </h3>
            <div className="space-y-3">
              {duplicateGroups.map((group, idx) => (
                <div key={idx} className="rounded-lg border border-border bg-base/40 p-3">
                  <div className="text-xs font-mono text-muted mb-2">
                    Hash: {group.hash.substring(0, 16)}...
                  </div>
                  <div className="space-y-1">
                    {group.files.map((file, fidx) => (
                      <div key={fidx} className="flex items-center justify-between text-xs">
                        <span className="font-mono text-text truncate">{file.path}</span>
                        <span className="text-muted">{formatBytes(file.size)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-2">
              <Button variant="secondary" onClick={openDeleteConfirmation} disabled={isDeleting}>
                Delete Duplicates (Keep First)
              </Button>
            </div>
          </Card>,
        )
      } else {
        context.setResult(
          <Badge className="border-0 bg-accent/15 text-accent">No duplicates found.</Badge>
        )
      }
    } catch (error) {
      console.error('Error scanning duplicates:', error)
      context.setError(error instanceof Error ? error.message : 'Failed to scan files.')
    }
  }

  return (
    <div className="relative">
      <BaseToolLayout
        title={tool.name}
        description={tool.description}
        onProcess={handleScan}
        options={
          <div className="space-y-4 text-sm">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase text-muted">Select Files</div>
              <input
                type="file"
                multiple
                onChange={(e) => handleFileSelect(e.target.files)}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 cursor-pointer"
              />
            </div>

            {files.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase text-muted">
                  Selected Files ({files.length})
                </div>
                <div className="max-h-40 overflow-y-auto rounded-xl border border-border bg-base/60">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="px-3 py-2 text-left font-medium text-muted">File Name</th>
                        <th className="px-3 py-2 text-right font-medium text-muted">Size</th>
                        <th className="px-3 py-2 text-center font-medium text-muted">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {files.map((entry, idx) => (
                        <tr key={idx} className="border-t border-border">
                          <td className="px-3 py-2 font-mono text-text truncate" title={entry.path}>
                            {entry.path}
                          </td>
                          <td className="px-3 py-2 text-right text-muted">
                            {formatBytes(entry.size)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Button
                              variant="ghost"
                              onClick={() => removeFile(idx)}
                              className="text-red-500 hover:text-red-700"
                            >
                              ✕
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button variant="outline" onClick={clearFiles} className="w-full text-xs">
                  Clear All
                </Button>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-muted">
              <span>⚠️ Scanning may take a while for large files.</span>
            </div>
          </div>
        }
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto p-4 space-y-4">
            <h2 className="text-lg font-bold">Confirm Deletion</h2>
            <div className="text-sm text-muted">
              The following duplicate groups will be processed. The first file in each group will be kept, the others deleted.
            </div>
            <div className="space-y-3">
              {duplicates.map((group, idx) => (
                <div key={idx} className="rounded-lg border border-border bg-base/40 p-3">
                  <div className="text-xs font-mono text-muted mb-2">
                    Hash: {group.hash.substring(0, 16)}...
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-start text-xs">
                      <span className="font-semibold text-green-500 min-w-24">Keep:</span>
                      <span className="font-mono text-text truncate">{group.files[0]?.path}</span>
                      <span className="ml-auto text-muted">{formatBytes(group.files[0]?.size || 0)}</span>
                    </div>
                    {group.files.slice(1).map((file, fidx) => (
                      <div key={fidx} className="flex items-start text-xs">
                        <span className="font-semibold text-red-500 min-w-24">Delete:</span>
                        <span className="font-mono text-text truncate">{file.path}</span>
                        <span className="ml-auto text-muted">{formatBytes(file.size)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="text-sm font-semibold">
              Total files to delete: {duplicates.reduce((sum, group) => sum + group.files.length - 1, 0)}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeDeleteConfirmation} disabled={isDeleting}>
                Cancel
              </Button>
              <Button variant="primary" onClick={performDeleteDuplicates} disabled={isDeleting}>
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </Button>
            </div>
            {isDeleting && (
              <div className="text-xs text-muted flex items-center">
                <span>Deleting files, please wait...</span>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}
