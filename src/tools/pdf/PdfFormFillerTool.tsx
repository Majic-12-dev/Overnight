import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { PDFDocument } from 'pdf-lib'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import type { ToolFile } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { FileDown, FileEdit } from 'lucide-react'

type PdfFormFillerToolProps = {
  tool: ToolDefinition
}

type FormField = {
  name: string
  type: 'text' | 'checkbox' | 'radio'
  currentValue: string | boolean
}

export function PdfFormFillerTool({ tool }: PdfFormFillerToolProps) {
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null)
  const [fields, setFields] = useState<FormField[]>([])
  const [fieldValues, setFieldValues] = useState<Record<string, string | boolean>>({})
  const [pdfFileName, setPdfFileName] = useState('')

  const handleFileSelect = useCallback(
    async (file: File) => {
      try {
        const arrayBuffer = await file.arrayBuffer()
        const bytes = new Uint8Array(arrayBuffer)
        setPdfBytes(bytes)
        setPdfFileName(file.name)

        // Detect form fields
        const pdfDoc = await PDFDocument.load(bytes)
        const form = pdfDoc.getForm()
        const pdfFields = form.getFields()

        const detected: FormField[] = pdfFields.map((field) => {
          const name = field.getName()
          try {
            if (field.constructor.name.includes('CheckBox')) {
              return { name, type: 'checkbox' as const, currentValue: false }
            }
            if (field.constructor.name.includes('Radio')) {
              return { name, type: 'radio' as const, currentValue: '' }
            }
            return { name, type: 'text' as const, currentValue: '' }
          } catch {
            return { name, type: 'text' as const, currentValue: '' }
          }
        })

        setFields(detected)
        const initialValues: Record<string, string | boolean> = {}
        detected.forEach((f) => {
          initialValues[f.name] = f.type === 'checkbox' ? false : ''
        })
        setFieldValues(initialValues)
      } catch (err) {
        console.error('Failed to detect form fields:', err)
      }
    },
    [],
  )

  // Load first selected file
  useEffect(() => {
    // This will be triggered when files are dropped/selected on BaseToolLayout
  }, [])

  const handleProcess = useCallback(
    async (
      files: ToolFile[],
      context: {
        setProgress: (value: number) => void
        setResult: (result: ReactNode | null) => void
        setError: (message: string | null) => void
      },
    ) => {
      try {
        if (!pdfBytes) {
          throw new Error('Select a PDF with form fields first.')
        }

        context.setProgress(20)

        const pdfDoc = await PDFDocument.load(pdfBytes)
        const form = pdfDoc.getForm()

        context.setProgress(50)

        // Fill each field
        for (const [fieldName, value] of Object.entries(fieldValues)) {
          try {
            if (typeof value === 'boolean') {
              const checkbox = form.getCheckBox(fieldName)
              if (value) {
                checkbox.check()
              } else {
                checkbox.uncheck()
              }
            } else if (typeof value === 'string') {
              const textField = form.getTextField(fieldName)
              textField.setText(value)
            }
          } catch (err) {
            console.warn(`Could not fill field ${fieldName}:`, err)
          }
        }

        context.setProgress(80)

        form.flatten()
        const outputBytes = await pdfDoc.save()
        const blob = new Blob([outputBytes.buffer as BlobPart], { type: 'application/pdf' })
        const blobUrl = URL.createObjectURL(blob)

                context.setProgress(100)

        // Auto-revoke blob URL after 5 minutes
        const timer = setTimeout(() => URL.revokeObjectURL(blobUrl), 5 * 60 * 1000)

        context.setResult(
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">
              Form fields filled successfully.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted flex-1 truncate">
                {pdfFileName.replace(/\.pdf$/i, '')}_filled.pdf
              </span>
              <a href={blobUrl} download={pdfFileName.replace(/\.pdf$/i, '') + '_filled.pdf'}>
                <Button variant="ghost" size="sm" className="gap-1">
                  <FileDown className="h-4 w-4" /> Download
                </Button>
              </a>
            </div>
          </div>,
        )
      } catch (err) {
        context.setError(err instanceof Error ? err.message : 'Form filling failed.')
        context.setResult(null)
      }
    },
    [pdfBytes, fieldValues, pdfFileName],
  )

  if (fields.length === 0) {
 return (
    <BaseToolLayout title={tool.name} description={tool.description} onProcess={handleProcess} accept=".pdf" maxFiles={1}>
      <div className="space-y-4 text-center py-6">
        <FileEdit className="h-12 w-12 mx-auto text-muted opacity-40" />
        <p className="text-sm text-muted">
          Select a PDF with form fields to detect and fill them.
        </p>
      </div>
    </BaseToolLayout>
  )
}

  return (
    <BaseToolLayout title={tool.name} description={tool.description} onProcess={handleProcess} accept=".pdf" maxFiles={1}>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge>{fields.length} field(s) detected</Badge>
          <span className="text-xs text-muted truncate">{pdfFileName}</span>
        </div>

        {fields.map((field) => (
          <div key={field.name} className="p-3 rounded-lg border border-border space-y-1">
            <label className="text-xs font-medium text-foreground break-all">
              {field.name}
            </label>
            <Badge className="text-xs lowercase">
              {field.type}
            </Badge>
            {field.type === 'checkbox' ? (
              <label className="flex items-center gap-2 mt-1">
                <input
                  type="checkbox"
                  checked={!!fieldValues[field.name]}
                  onChange={(e) =>
                    setFieldValues((prev) => ({ ...prev, [field.name]: e.target.checked }))
                  }
                  className="h-4 w-4 rounded"
                />
                <span className="text-xs text-muted">
                  {fieldValues[field.name] ? 'Checked' : 'Unchecked'}
                </span>
              </label>
            ) : (
              <Input
                value={fieldValues[field.name] as string}
                onChange={(e) =>
                  setFieldValues((prev) => ({ ...prev, [field.name]: e.target.value }))
                }
                placeholder={field.currentValue as string || 'Enter value...'}
                className="mt-1"
              />
            )}
          </div>
        ))}
      </div>
    </BaseToolLayout>
  )
}
