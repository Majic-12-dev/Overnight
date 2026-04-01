import { useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'


type LargeFileScoutToolProps = {
  tool: ToolDefinition
}

// Common file size thresholds in MB for quick selection
const QUICK_THRESHOLDS = [10, 50, 100, 500, 1000]

export function LargeFileScoutTool({ tool }: LargeFileScoutToolProps) {
  const [targetPath, setTargetPath] = useState('')
  const [thresholdMB, setThresholdMB] = useState(100)
  const [isScanning, setIsScanning] = useState(false)
  const [results, setResults] = useState<{ path: string; size: number }[]>([])

  const handleChooseFolder = async () => {
    const selected = await window.api.selectOutputDir()
    if (selected) {
      setTargetPath(selected)
    }
  }

  const handleScan = async () => {
    if (!targetPath) {
      throw new Error('Please select a folder to scan.')
    }

    if (!window.api?.scanLargeFiles) {
      throw new Error('The large file scanner is not available in this build.')
    }

    setIsScanning(true)
    try {
      const thresholdBytes = thresholdMB * 1024 * 1024
      const files = await window.api.scanLargeFiles({
        path: targetPath,
        thresholdBytes,
      })
      setResults(files)
    } finally {
      setIsScanning(false)
    }
  }

  const handleOpenFolder = () => {
    if (targetPath) {
      window.api.revealInFolder(targetPath)
    }
  }

  const totalSize = results.reduce((sum, file) => sum + file.size, 0)

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      onProcess={async (_, context) => {
        await handleScan()
        if (results.length > 0) {
          context.setResult(
            <Card className="space-y-3 border-border bg-base/60 p-4">
              <h3 className="text-sm font-semibold text-text">Scan Complete</h3>
              <div className="space-y-2 text-sm text-muted">
                <div>Found {results.length} file{results.length === 1 ? '' : 's'} larger than {thresholdMB} MB</div>
                <div>Total size: {formatBytes(totalSize)}</div>
                <div className="text-xs">Scanned: {targetPath}</div>
              </div>
              <div className="pt-2">
                <Button variant="secondary" onClick={handleOpenFolder}>
                  Open Scanned Folder
                </Button>
              </div>
            </Card>
          )
        } else {
          context.setResult(
            <Badge className="border-0 bg-accent/15 text-accent">
              No files larger than {thresholdMB} MB found.
            </Badge>
          )
        }
        context.setProgress(100)
      }}
      options={
        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Folder to Scan</div>
            <div className="rounded-xl border border-border bg-base/60 p-3 text-xs font-mono text-text">
              {targetPath || 'Not selected'}
            </div>
            <Button variant="outline" onClick={handleChooseFolder} disabled={isScanning}>
              Select Folder
            </Button>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Size Threshold (MB)</div>
            <div className="grid grid-cols-3 gap-2">
              {QUICK_THRESHOLDS.map((mb) => (
                <Button
                  key={mb}
                  variant={thresholdMB === mb ? 'primary' : 'outline'}
                  onClick={() => setThresholdMB(mb)}
                  disabled={isScanning}
                  className="text-xs"
                >
                  {mb >= 1000 ? `${mb / 1000} GB` : `${mb} MB`}
                </Button>
              ))}
            </div>
            <Input
              type="number"
              min={1}
              max={1000000}
              value={thresholdMB}
              onChange={(e) => setThresholdMB(Number(e.target.value))}
              disabled={isScanning}
              className="mt-2"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-muted">
            <span>⚠️ Scanning may take a while for large directories.</span>
          </div>

          {results.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase text-muted">
                Results ({results.length} files, {formatBytes(totalSize)})
              </div>
              <div className="max-h-64 overflow-y-auto rounded-xl border border-border bg-base/60">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 text-left font-medium text-muted">File Name</th>
                      <th className="px-3 py-2 text-right font-medium text-muted">Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((file) => (
                      <tr key={file.path} className="border-t border-border">
                        <td className="px-3 py-2 font-mono text-text truncate" title={file.path}>
                          {file.path}
                        </td>
                        <td className="px-3 py-2 text-right text-muted">
                          {formatBytes(file.size)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      }
    />
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
