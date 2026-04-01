import { useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useAppStore } from '@/store/useAppStore'

type EncryptToolProps = {
  tool: ToolDefinition
}

export function EncryptTool({ tool }: EncryptToolProps) {
  const { preferences, setDefaultOutputDir } = useAppStore()
  const [mode, setMode] = useState<'encrypt' | 'decrypt'>('encrypt')
  const [password, setPassword] = useState('')
  const [openAfter, setOpenAfter] = useState(true)

  const outputDirLabel = preferences.defaultOutputDir || 'Not set yet'
  const outputFileName = mode === 'encrypt' ? 'encrypted.dat' : 'decrypted.dat'

  const handleChooseFolder = async () => {
    const selected = await window.api.selectOutputDir()
    if (selected) setDefaultOutputDir(selected)
  }

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      accept='*/*'
      onProcess={async (files, context) => {
        if (!window.api?.processSecurity) {
          throw new Error('The encryption engine is not available in this build.')
        }

        if (files.length !== 1) {
          throw new Error('Please select exactly one file to process.')
        }

        const inputPath = files[0].path
        if (!inputPath) {
          throw new Error('The selected file is missing a valid path. Please remove and re-add it.')
        }

        if (!password) {
          throw new Error('Please enter a password.')
        }

        const outputDir = preferences.defaultOutputDir || (await window.api.getDefaultOutputDir())
        if (!preferences.defaultOutputDir) {
          setDefaultOutputDir(outputDir)
        }

        const outputName = mode === 'encrypt' 
          ? `${files[0].name}.enc` 
          : files[0].name.endsWith('.enc') 
          ? files[0].name.slice(0, -4) 
          : `${files[0].name}.dec`

        const output = outputDir + '/' + outputName

        context.setProgress(10)
        
        try {
          await window.api.processSecurity({
            mode,
            file: inputPath,
            password,
            output,
          })
        } catch (error: any) {
          throw new Error(`Processing failed: ${error.message}`)
        }

        context.setProgress(100)
        context.setResult(
          <Card className="space-y-3 border-border bg-base/60 p-4">
            <h3 className="text-sm font-semibold text-text">
              {mode === 'encrypt' ? 'Encryption' : 'Decryption'} Complete
            </h3>
            <div className="space-y-2 text-sm text-muted">
              <div>Input: {inputPath}</div>
              <div>Output: {output}</div>
            </div>
            <div className="pt-2">
              <Button variant="secondary" onClick={() => window.api.revealInFolder(output)}>
                Show Output File
              </Button>
            </div>
          </Card>
        )

        if (openAfter) {
          await window.api.revealInFolder(output)
        }
      }}
      options={
        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Mode</div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-text">
                <input
                  type="radio"
                  name="mode"
                  value="encrypt"
                  checked={mode === 'encrypt'}
                  onChange={(e) => setMode(e.target.value as 'encrypt')}
                />
                Encrypt
              </label>
              <label className="flex items-center gap-2 text-text">
                <input
                  type="radio"
                  name="mode"
                  value="decrypt"
                  checked={mode === 'decrypt'}
                  onChange={(e) => setMode(e.target.value as 'decrypt')}
                />
                Decrypt
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Password</div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter a strong password"
              className="w-full rounded-lg border border-border bg-base px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Output Folder</div>
            <div className="rounded-xl border border-border bg-base/60 p-3 text-xs text-muted">
              {outputDirLabel}
            </div>
            <Button variant="outline" onClick={handleChooseFolder}>
              Change Folder
            </Button>
          </div>

          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={openAfter}
              onChange={(e) => setOpenAfter(e.target.checked)}
            />
            Open folder after processing
          </label>

          <Badge className="border-0 bg-accent/15 text-accent">
            AES-256-GCM encryption
          </Badge>
        </div>
      }
    />
  )
}
