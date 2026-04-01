import { useMemo, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAppStore } from '@/store/useAppStore'

type PdfPasswordToolProps = {
  tool: ToolDefinition
}

export function PdfPasswordTool({ tool }: PdfPasswordToolProps) {
  const { preferences, setDefaultOutputDir } = useAppStore()
  const [userPassword, setUserPassword] = useState('')
  const [ownerPassword, setOwnerPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [permissions, setPermissions] = useState({
    print: true,
    modify: true,
    copy: true,
    annotate: true,
    form: true,
  })

  const outputDirLabel = useMemo(
    () => preferences.defaultOutputDir || 'Not set yet',
    [preferences.defaultOutputDir],
  )

  const handleChooseFolder = async () => {
    if (!window.api?.selectOutputDir) return
    const selected = await window.api.selectOutputDir()
    if (selected) setDefaultOutputDir(selected)
  }

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      accept=".pdf,application/pdf"
      onProcess={async (files, context) => {
        if (!window.api?.encryptPdf) {
          throw new Error('The PDF encryption engine is not available in this build.')
        }

        if (userPassword !== confirmPassword) {
          throw new Error('Passwords do not match.')
        }

        const inputPaths = files.map((file) => file.path).filter(Boolean) as string[]

        const outputDir =
          preferences.defaultOutputDir || (await window.api.getDefaultOutputDir())

        if (!preferences.defaultOutputDir) {
          setDefaultOutputDir(outputDir)
        }

        context.setProgress(15)
        const result = await window.api.encryptPdf({
          inputPaths,
          outputDir,
          userPassword: userPassword || undefined,
          ownerPassword: ownerPassword || undefined,
          permissions,
        })

        context.setProgress(90)
        context.setResult(
          <>
            <Badge className="border-0 bg-accent/15 text-accent">Success</Badge>
            <div className="mt-3 space-y-1 text-sm text-muted">
              <div>Encrypted {result.outputs.length} file(s).</div>
              <div className="text-xs text-muted">Output: {outputDir}</div>
              <div className="pt-2">
                <Button
                  variant="secondary"
                  onClick={() => window.api.revealInFolder(outputDir)}
                >
                  Open Output Folder
                </Button>
              </div>
            </div>
          </>,
        )
      }}
      options={
        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">User Password (Required for opening)</div>
            <Input type="password" value={userPassword} onChange={(e) => setUserPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Confirm Password</div>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Owner Password (Required for changing permissions)</div>
            <Input type="password" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Permissions</div>
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={permissions.print}
                  onChange={(e) => setPermissions(p => ({ ...p, print: e.target.checked }))}
                />
                Allow Printing
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={permissions.modify}
                  onChange={(e) => setPermissions(p => ({ ...p, modify: e.target.checked }))}
                />
                Allow Modification
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={permissions.copy}
                  onChange={(e) => setPermissions(p => ({ ...p, copy: e.target.checked }))}
                />
                Allow Copying
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={permissions.annotate}
                  onChange={(e) => setPermissions(p => ({ ...p, annotate: e.target.checked }))}
                />
                Allow Annotating
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={permissions.form}
                  onChange={(e) => setPermissions(p => ({ ...p, form: e.target.checked }))}
                />
                Allow Form Filling
              </label>
            </div>
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
        </div>
      }
    />
  )
}
