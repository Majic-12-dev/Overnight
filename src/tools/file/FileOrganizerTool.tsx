import { useMemo, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { useAppStore } from '@/store/useAppStore'

type FileOrganizerToolProps = {
  tool: ToolDefinition
}

export function FileOrganizerTool({ tool }: FileOrganizerToolProps) {
  const { preferences, setDefaultOutputDir } = useAppStore()
  const [rule, setRule] = useState<'extension' | 'date'>('extension')

  const outputDirLabel = useMemo(
    () => preferences.defaultOutputDir || 'Not set yet',
    [preferences.defaultOutputDir],
  )

  const handleChooseFolder = async () => {
    const selected = await window.api.selectOutputDir()
    if (selected) setDefaultOutputDir(selected)
  }

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      onProcess={async (files, context) => {
        if (!window.api?.organizeFiles) {
          throw new Error('The file organizer is not available in this build.')
        }

        const outputDir =
          preferences.defaultOutputDir || (await window.api.getDefaultOutputDir())

        if (!preferences.defaultOutputDir) {
          setDefaultOutputDir(outputDir)
        }

        context.setProgress(20)
        const result = await window.api.organizeFiles({
          inputPaths: files.map((f) => f.path).filter((p): p is string => !!p),
          outputDir,
          rule,
        })

        context.setProgress(100)
        context.setResult(
          <>
            <Badge className='border-0 bg-accent/15 text-accent'>Organization complete</Badge>
            <div className='mt-3 space-y-1 text-sm text-muted'>
              <div>Organized {result.count} file(s).</div>
              <div className='text-xs text-muted'>Files moved to: {outputDir}</div>
              <div className='pt-2'>
                <Button
                  variant='secondary'
                  onClick={() => window.api.revealInFolder(outputDir)}
                >
                  Open Folder
                </Button>
              </div>
            </div>
          </>,
        )
      }}
      options={
        <div className='space-y-4 text-sm'>
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Organization Rule</div>
            <Select value={rule} onChange={(event) => setRule(event.target.value as 'extension' | 'date')}>
              <option value='extension'>By File Extension</option>
              <option value='date'>By Date (Year/Month)</option>
            </Select>
          </div>

          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Output Folder</div>
            <div className='rounded-xl border border-border bg-base/60 p-3 text-xs text-muted'>
              {outputDirLabel}
            </div>
            <Button variant='outline' onClick={handleChooseFolder}>
              Change Folder
            </Button>
          </div>
        </div>
      }
    />
  )
}
