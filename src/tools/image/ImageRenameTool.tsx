import { useMemo, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import type { ToolFile } from '@/components/tools/BaseToolLayout'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Switch } from '@/components/ui/Switch'
import { useAppStore } from '@/store/useAppStore'

type ImageRenameToolProps = {
  tool: ToolDefinition
}

export function ImageRenameTool({ tool }: ImageRenameToolProps) {
  const { preferences, setDefaultOutputDir } = useAppStore()
  const [prefix, setPrefix] = useState('')
  const [suffix, setSuffix] = useState('')
  const [startNumber, setStartNumber] = useState(1)
  const [padding, setPadding] = useState(3)
  const [openAfter, setOpenAfter] = useState(true)

  const outputDirLabel = useMemo(
    () => preferences.defaultOutputDir || 'Not set yet',
    [preferences.defaultOutputDir],
  )

  const handleChooseFolder = async () => {
    const selected = await window.api.selectOutputDir()
    if (selected) setDefaultOutputDir(selected)
  }

  const buildTargetName = (file: ToolFile, index: number) => {
    const { base, ext } = splitName(file.name)
    const start = (startNumber + index).toString().padStart(padding, '0')
    return `${prefix}${base}${suffix}_${start}${ext}`
  }

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      accept='image/*'
      onProcess={async (files, context) => {
        if (!window.api?.renameImages) {
          throw new Error('The image rename engine is not available in this build.')
        }

        const items = files
          .filter((file) => !!file.path)
          .map((file, index) => ({
            sourcePath: file.path as string,
            targetName: buildTargetName(file, index),
          }))

        const outputDir =
          preferences.defaultOutputDir || (await window.api.getDefaultOutputDir())

        if (!preferences.defaultOutputDir) {
          setDefaultOutputDir(outputDir)
        }

        context.setProgress(15)
        const result = await window.api.renameImages({
          outputDir,
          items,
        })

        context.setProgress(90)
        context.setResult(
          <>
            <Badge className='border-0 bg-accent/15 text-accent'>Rename complete</Badge>
            <div className='mt-3 space-y-1 text-sm text-muted'>
              <div>Renamed {result.totalOutputs} image(s).</div>
              <div className='text-xs text-muted'>Output: {result.outputDir}</div>
              <div className='pt-2'>
                <Button
                  variant='secondary'
                  onClick={() => window.api.revealInFolder(result.outputDir)}
                >
                  Open Output Folder
                </Button>
              </div>
            </div>
          </>,
        )

        if (openAfter) {
          await window.api.revealInFolder(result.outputDir)
        }
      }}
      options={
        <div className='space-y-4 text-sm'>
          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-2'>
              <div className='text-xs font-semibold uppercase text-muted'>Prefix</div>
              <Input value={prefix} onChange={(event) => setPrefix(event.target.value)} />
            </div>
            <div className='space-y-2'>
              <div className='text-xs font-semibold uppercase text-muted'>Suffix</div>
              <Input value={suffix} onChange={(event) => setSuffix(event.target.value)} />
            </div>
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-2'>
              <div className='text-xs font-semibold uppercase text-muted'>Start Number</div>
              <Input
                type='number'
                min={0}
                value={startNumber}
                onChange={(event) => setStartNumber(Number(event.target.value))}
              />
            </div>
            <div className='space-y-2'>
              <div className='text-xs font-semibold uppercase text-muted'>Padding</div>
              <Input
                type='number'
                min={1}
                max={6}
                value={padding}
                onChange={(event) => setPadding(Number(event.target.value))}
              />
            </div>
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

          <label className='flex items-center gap-2 text-xs text-muted'>
            <input
              type='checkbox'
              checked={openAfter}
              onChange={(event) => setOpenAfter(event.target.checked)}
            />
            Open folder after processing
          </label>
        </div>
      }
    />
  )
}

function splitName(filename: string) {
  const dot = filename.lastIndexOf('.')
  if (dot > 0) {
    return { base: filename.slice(0, dot), ext: filename.slice(dot) }
  }
  return { base: filename, ext: '' }
}
