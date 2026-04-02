import { useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { ShieldCheck, AlertTriangle } from 'lucide-react'

type FileShredderToolProps = {
  tool: ToolDefinition
}

type ShredOptions = {
  passes: 3 | 7 | 35
  verify: boolean
}

export function FileShredderTool({ tool }: FileShredderToolProps) {
  const [options, setOptions] = useState<ShredOptions>({
    passes: 3,
    verify: true,
  })

  const getPassesLabel = (passes: number) => {
    switch (passes) {
      case 3:
        return 'DoD 5220.22-M (3 passes)'
      case 7:
        return 'DoD 5220.22-M ECE (7 passes)'
      case 35:
        return 'Gutmann (35 passes)'
      default:
        return `${passes} passes`
    }
  }

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      accept="*/*"
      instructions="Drop files or folders here for secure shredding."
      onProcess={async (files, context) => {
        const api = (window as any).api
        if (!api?.shredFiles) {
          throw new Error('The file shredder is not available in this build.')
        }

        const inputPaths = files.map((file) => file.path).filter((p): p is string => !!p)
        if (inputPaths.length !== files.length) {
          throw new Error('Some files are missing paths. Remove and re-add them.')
        }

        context.setProgress(10)

        const result = await api.shredFiles({
          inputPaths,
          passes: options.passes,
          verify: options.verify,
        })

        context.setProgress(100)

        if (result.errors && result.errors.length > 0) {
          context.setError(result.errors.join('\n'))
        }

        context.setResult(
          <Card className="space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-green-400" />
              <h3 className="text-sm font-semibold text-text">
                Secure Deletion Complete
              </h3>
            </div>
            <div className="space-y-2 text-sm text-muted">
              <div>Files processed: {result.filesProcessed}</div>
              <div>Bytes overwritten: {result.bytesOverwritten?.toLocaleString() ?? 'N/A'}</div>
              {result.verificationPassed && (
                <div className="text-green-400">Verification passed</div>
              )}
            </div>
          </Card>,
        )
      }}
      options={
        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Shred Standard</div>
            <Select
              value={options.passes}
              onChange={(e) =>
                setOptions((p) => ({
                  ...p,
                  passes: Number(e.target.value) as 3 | 7 | 35,
                }))
              }
            >
              <option value={3}>DoD 5220.22-M (3 passes)</option>
              <option value={7}>DoD 5220.22-M ECE (7 passes)</option>
              <option value={35}>Gutmann (35 passes)</option>
            </Select>
          </div>

          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={options.verify}
              onChange={(e) => setOptions((p) => ({ ...p, verify: e.target.checked }))}
            />
            Verify deletion after shredding
          </label>

          <div className="rounded-xl border border-yellow-600/40 bg-yellow-600/10 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
              <div className="text-xs text-yellow-200">
                <div className="font-medium mb-1">Irreversible Operation</div>
                <div>
                  Files shredded with {getPassesLabel(options.passes)} will be
                  permanently unrecoverable. This cannot be undone.
                </div>
              </div>
            </div>
          </div>

          <Badge className="border-0 bg-red-500/20 text-red-200">
            Secure Deletion Tool
          </Badge>
        </div>
      }
    />
  )
}
