import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import * as exifr from 'exifr'
import piexif from 'piexifjs'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import type { ToolFile } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { FileDown, Image as ImageIcon, X, Trash2 } from 'lucide-react'

type ImageMetadataToolProps = {
  tool: ToolDefinition
}

type MetadataSection = {
  label: string
  entries: { key: string; value: string }[]
}

export function ImageMetadataTool({ tool }: ImageMetadataToolProps) {
  const [metadata, setMetadata] = useState<MetadataSection[]>([])
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editCopyright, setEditCopyright] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [resultName, setResultName] = useState('')

  const handleProcess = useCallback(
    async (
      files: ToolFile[],
      context: {
        setProgress: (v: number) => void
        setResult: (r: ReactNode | null) => void
        setError: (m: string | null) => void
      },
    ) => {
      if (!editMode) {
        // View mode: just parse and display metadata
        try {
          if (files.length === 0) {
            throw new Error('Select an image file to view metadata.')
          }
          context.setProgress(10)

          const file = files[0]
          const img = file.file
          if (imageUrl) URL.revokeObjectURL(imageUrl)
          const previewUrl = URL.createObjectURL(img)
          setImageUrl(previewUrl)

          const parsed = await exifr.parse(img, {
            tiff: true,
            gps: true,
            iptc: true,
            jfif: true,
            icc: true,
            ifd1: true,
            xmp: true,
          } as any)

          context.setProgress(80)

          const sections: MetadataSection[] = []

          if (parsed?.ifd0 || parsed?.ifd1) {
            const basic: { key: string; value: string }[] = []
            const ifd0 = { ...(parsed.ifd0 || {}), ...(parsed.ifd1 || {}) }
            const basicKeys = ['ImageWidth', 'ImageHeight', 'Orientation', 'XResolution', 'YResolution', 'ResolutionUnit', 'ColorSpace', 'Software', 'DateTime', 'Make', 'Model']
            for (const k of basicKeys) {
              if (ifd0[k] !== undefined) {
                basic.push({ key: k, value: String(ifd0[k]) })
              }
            }
            if (basic.length > 0) sections.push({ label: 'Basic EXIF', entries: basic })
          }

          if (parsed?.tiff) {
            const entries: { key: string; value: string }[] = []
            const skip = new Set(['ImageWidth', 'ImageHeight', 'Orientation', 'XResolution', 'YResolution', 'ResolutionUnit', 'ColorSpace', 'Software', 'DateTime', 'Make', 'Model'])
            for (const [k, v] of Object.entries(parsed.tiff)) {
              if (!skip.has(k) && k !== 'tagValues') {
                entries.push({ key: k, value: v != null ? String(v) : '—' })
              }
            }
            if (entries.length > 0) sections.push({ label: 'EXIF Data', entries })
          }

          if (parsed?.gps) {
            const entries: { key: string; value: string }[] = []
            for (const [k, v] of Object.entries(parsed.gps)) {
              entries.push({ key: k, value: v != null ? String(v) : '—' })
            }
            if (entries.length > 0) sections.push({ label: 'GPS', entries })
          }

          if (parsed?.iptc) {
            const entries: { key: string; value: string }[] = []
            for (const [k, v] of Object.entries(parsed.iptc)) {
              entries.push({ key: k, value: Array.isArray(v) ? v.join(', ') : String(v) })
            }
            if (entries.length > 0) sections.push({ label: 'IPTC', entries })
          }

          if (parsed?.jfif) {
            const entries: { key: string; value: string }[] = []
            for (const [k, v] of Object.entries(parsed.jfif)) {
              if (k !== 'tagValues') entries.push({ key: k, value: String(v) })
            }
            if (entries.length > 0) sections.push({ label: 'JFIF', entries })
          }

          // Extract editable fields
          const title = (parsed?.ifd0 as any)?.ImageDescription || ''
          const copyright = (parsed?.ifd0 as any)?.Copyright || ''
          setEditTitle(title)
          setEditCopyright(copyright)
          setEditDescription('')

          context.setProgress(100)
          setMetadata(sections)
          context.setResult(null)
        } catch (err) {
          context.setError(err instanceof Error ? err.message : 'Failed to parse image metadata.')
          setMetadata([])
        }
      } else {
        // Edit mode: modify EXIF and save
        try {
          if (!imageUrl) {
            throw new Error('Select an image first.')
          }
          context.setProgress(10)

          const file = files[0]
          const reader = new FileReader()
          const imgData = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(file.file)
          })

          const exifObj = piexif.load(imgData)
          const zeroth: Record<string, any> = {}

          if (editTitle.trim()) {
            zeroth[piexif.ImageIFD.ImageDescription] = editTitle.trim()
          }
          if (editCopyright.trim()) {
            zeroth[piexif.ImageIFD.Copyright] = editCopyright.trim()
          }
          if (editDescription.trim()) {
            zeroth[piexif.ImageIFD.ImageDescription] = editDescription.trim()
          }

          exifObj['0th'] = zeroth
          const exifBytes = piexif.dump(exifObj)
          const newImgData = piexif.insert(exifBytes, imgData)

          // Convert data URL to Blob
          const byteString = atob(newImgData.split(',')[1])
          const mimeMatch = newImgData.match(/data:([^;]+)/)
          const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg'
          const ab = new ArrayBuffer(byteString.length)
          const ia = new Uint8Array(ab)
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i)
          }
          const blob = new Blob([ab], { type: mime })
          const url = URL.createObjectURL(blob)

          // Revoke old result URL
          if (resultUrl) URL.revokeObjectURL(resultUrl)

          context.setProgress(100)
          setResultUrl(url)
          setResultName(file.name.replace(/\.[^.]+$/, '') + '_edited' + file.name.match(/\.[^.]+$/)![0])
          context.setResult(null)
        } catch (err) {
          context.setError(err instanceof Error ? err.message : 'Failed to update metadata.')
        }
      }
    },
    [editMode, imageUrl, editTitle, editCopyright, editDescription],
  )

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      onProcess={handleProcess}
      accept="image/*"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge className={editMode ? 'bg-amber-500/20' : 'bg-emerald-500/20'}>
            {editMode ? 'Edit Mode' : 'View Mode'}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => {
              setEditMode(!editMode)
              setMetadata([])
            }}
          >
            {editMode ? 'Switch to View' : 'Switch to Edit'}
          </Button>
        </div>

        {!editMode && metadata.length > 0 && (
          <>
            {imageUrl && (
              <div className="flex justify-center">
                <img src={imageUrl} alt="Preview" className="max-h-48 rounded-lg" />
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              {metadata.map((section) => (
                <Card key={section.label} className="p-3 space-y-2">
                  <h3 className="text-xs font-semibold text-foreground">{section.label}</h3>
                  <div className="space-y-1">
                    {section.entries.map((e) => (
                      <div key={e.key} className="flex justify-between text-xs">
                        <span className="text-muted">{e.key}</span>
                        <span className="text-foreground truncate ml-2 max-w-[200px]">{e.value}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
            {metadata.length === 0 && (
              <div className="text-center py-8">
                <ImageIcon className="h-10 w-10 mx-auto text-muted opacity-40" />
                <p className="text-sm text-muted mt-2">No metadata found in this image.</p>
              </div>
            )}
          </>
        )}

        {editMode && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-foreground">Image Title / Description</label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Enter image title..."
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">Copyright</label>
              <Input
                value={editCopyright}
                onChange={(e) => setEditCopyright(e.target.value)}
                placeholder="e.g., © 2024 John Doe"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">Description</label>
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Enter image description..."
              />
            </div>
            {resultUrl && (
              <div className="flex items-center gap-2 p-2 rounded bg-accent/10">
                <span className="text-xs text-muted flex-1 truncate">{resultName}</span>
                <a href={resultUrl} download={resultName}>
                  <Button variant="ghost" size="sm" className="gap-1">
                    <FileDown className="h-4 w-4" /> Download
                  </Button>
                </a>
              </div>
            )}
          </div>
        )}

        {!editMode && metadata.length === 0 && (
          <div className="text-center py-8">
            <ImageIcon className="h-10 w-10 mx-auto text-muted opacity-40" />
            <p className="text-sm text-muted mt-2">Select an image to view its EXIF/IPTC metadata.</p>
          </div>
        )}
      </div>
    </BaseToolLayout>
  )
}
