import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Archive,
  BadgeCheck,
  Combine,
  FileArchive,
  FileDigit,
  FileImage,
  FileInput,
  FileKey,
  FileMinus,
  FileSearch,
  FileText,
  FileType,
  Folder,
  Image,
  ImageDown,
  ImageMinus,
  ImageUp,
  Layers,
  PencilRuler,
  ScanText,
  Shield,
  Sparkles,
  SplitSquareVertical,
  TextCursorInput,
  Wand2,
} from 'lucide-react'
import { PdfMergeTool } from '@/tools/pdf/PdfMergeTool'
import { PdfSplitTool } from '@/tools/pdf/PdfSplitTool'
import { PdfRotateTool } from '@/tools/pdf/PdfRotateTool'
import { PdfWatermarkTool } from '@/tools/pdf/PdfWatermarkTool'
import { PdfMetadataTool } from '@/tools/pdf/PdfMetadataTool'
import { PdfUnlockTool } from '@/tools/pdf/PdfUnlockTool'
import { CompressPdfTool } from '@/tools/pdf/CompressPdfTool'
import { PlaceholderTool } from '@/tools/PlaceholderTool'
import { ArchiveZipTool } from '@/tools/archive/ArchiveZipTool'
import { ImageConvertTool } from '@/tools/image/ImageConvertTool'
import { ImageResizeTool } from '@/tools/image/ImageResizeTool'
import { ImageCompressTool } from '@/tools/image/ImageCompressTool'
import { ImageToPdfTool } from '@/tools/image/ImageToPdfTool'
import { ImageExifTool } from '@/tools/image/ImageExifTool'
import { ImageRenameTool } from '@/tools/image/ImageRenameTool'
import { ColorFilterTool } from '@/tools/image/ColorFilterTool'
import { TextMergeTool } from '@/tools/text/TextMergeTool'
import { BulkRenamerTool } from '@/tools/file/BulkRenamerTool'
import { EmptyFolderTool } from '@/tools/file/EmptyFolderTool'
import { LargeFileScoutTool } from '@/tools/file/LargeFileScoutTool'
import { ChecksumTool } from '@/tools/security/ChecksumTool'
import { FileOrganizerTool } from '@/tools/file/FileOrganizerTool'
import DashboardTool from '@/tools/productivity/DashboardTool'

export type ToolCategory = {
  id: string
  label: string
  description: string
  icon: LucideIcon
}

export type ToolDefinition = {
  id: string
  name: string
  description: string
  categoryId: string
  icon: LucideIcon
  component: ComponentType<{ tool: ToolDefinition }>
}

export const categories: ToolCategory[] = [
  {
    id: 'pdf',
    label: 'PDF',
    description: 'Merge, split, compress, and secure documents.',
    icon: FileText,
  },
  {
    id: 'image',
    label: 'Image',
    description: 'Batch edit and convert images at speed.',
    icon: Image,
  },
  {
    id: 'text',
    label: 'Text',
    description: 'Extract, merge, and convert text assets.',
    icon: TextCursorInput,
  },
  {
    id: 'file',
    label: 'File',
    description: 'Organize, rename, and audit your folders.',
    icon: Folder,
  },
  {
    id: 'archive',
    label: 'Archive',
    description: 'Compress, extract, and validate archives.',
    icon: Archive,
  },
  {
    id: 'security',
    label: 'Security',
    description: 'Encrypt, checksum, and protect files.',
    icon: Shield,
  },
  {
    id: 'productivity',
    label: 'Productivity',
    description: 'Quick actions and multi-tool workflows.',
    icon: Sparkles,
  },
]

export const tools: ToolDefinition[] = [
  {
    id: 'pdf-merge',
    name: 'PDF Merge',
    description: 'Combine multiple PDFs into one file.',
    categoryId: 'pdf',
    icon: Layers,
    component: PdfMergeTool,
  },
  {
    id: 'pdf-split',
    name: 'PDF Split',
    description: 'Split PDFs by page ranges or extract pages.',
    categoryId: 'pdf',
    icon: SplitSquareVertical,
    component: PdfSplitTool,
  },
  {
    id: 'pdf-compress',
    name: 'PDF Compress',
    description: 'Reduce file size while preserving quality.',
    categoryId: 'pdf',
    icon: FileMinus,
    component: CompressPdfTool,
  },
  {
    id: 'pdf-ocr',
    name: 'PDF to Text (OCR)',
    description: 'Extract text from scanned PDFs offline.',
    categoryId: 'pdf',
    icon: ScanText,
    component: PlaceholderTool,
  },
  {
    id: 'pdf-watermark',
    name: 'PDF Watermark',
    description: 'Apply text or image watermarks in batch.',
    categoryId: 'pdf',
    icon: PencilRuler,
    component: PdfWatermarkTool,
  },
  {
    id: 'pdf-rotate',
    name: 'PDF Rotate',
    description: 'Rotate pages with visual previews.',
    categoryId: 'pdf',
    icon: Wand2,
    component: PdfRotateTool,
  },
  {
    id: 'pdf-metadata',
    name: 'PDF Metadata Editor',
    description: 'View and edit PDF metadata fields.',
    categoryId: 'pdf',
    icon: FileDigit,
    component: PdfMetadataTool,
  },
  {
    id: 'pdf-password',
    name: 'PDF Password',
    description: 'Encrypt PDFs with strong passwords.',
    categoryId: 'pdf',
    icon: FileKey,
    component: PlaceholderTool,
  },
  {
    id: 'pdf-unlock',
    name: 'PDF Unlock',
    description: 'Remove restrictions with a known password.',
    categoryId: 'pdf',
    icon: BadgeCheck,
    component: PdfUnlockTool,
  },
  {
    id: 'pdf-repair',
    name: 'PDF Repair',
    description: 'Attempt recovery of corrupted PDFs.',
    categoryId: 'pdf',
    icon: FileSearch,
    component: PlaceholderTool,
  },
  {
    id: 'image-convert',
    name: 'Image Converter',
    description: 'Convert between JPG, PNG, WEBP, TIFF, and more.',
    categoryId: 'image',
    icon: ImageDown,
    component: ImageConvertTool,
  },
  {
    id: 'image-resize',
    name: 'Batch Resize',
    description: 'Resize images by width, height, or percent.',
    categoryId: 'image',
    icon: ImageUp,
    component: ImageResizeTool,
  },
  {
    id: 'image-compress',
    name: 'Image Compress',
    description: 'Optimize images with a visual quality slider.',
    categoryId: 'image',
    icon: ImageMinus,
    component: ImageCompressTool,
  },
  {
    id: 'image-to-pdf',
    name: 'Image to PDF',
    description: 'Turn image batches into single PDFs.',
    categoryId: 'image',
    icon: FileImage,
    component: ImageToPdfTool,
  },
  {
    id: 'image-exif',
    name: 'Privacy Stripper',
    description: 'Remove EXIF metadata instantly.',
    categoryId: 'image',
    icon: Wand2,
    component: ImageExifTool,
  },
  {
    id: 'image-rename',
    name: 'Batch Rename Images',
    description: 'Rename by sequence or capture date.',
    categoryId: 'image',
    icon: FileInput,
    component: ImageRenameTool,
  },
  {
    id: 'image-filter',
    name: 'Color Filter Batch',
    description: 'Apply grayscale, sepia, or invert filters.',
    categoryId: 'image',
    icon: Wand2,
    component: ColorFilterTool,
  },
  {
    id: 'image-background',
    name: 'Background Remover',
    description: 'Remove backgrounds locally in browser.',
    categoryId: 'image',
    icon: Sparkles,
    component: PlaceholderTool,
  },
  {
    id: 'text-merge',
    name: 'Text File Merge',
    description: 'Combine multiple text files into one.',
    categoryId: 'text',
    icon: Combine,
    component: TextMergeTool,
  },
  {
    id: 'text-markdown',
    name: 'Markdown to HTML/PDF',
    description: 'Preview and convert Markdown files.',
    categoryId: 'text',
    icon: FileType,
    component: PlaceholderTool,
  },
  {
    id: 'file-duplicates',
    name: 'Duplicate File Finder',
    description: 'Find duplicates by size and hash.',
    categoryId: 'file',
    icon: FileSearch,
    component: PlaceholderTool,
  },
  {
    id: 'file-renamer',
    name: 'Bulk Renamer',
    description: 'Rename files with regex and previews.',
    categoryId: 'file',
    icon: FileDigit,
    component: BulkRenamerTool,
  },
  {
    id: 'file-empty',
    name: 'Empty Folder Killer',
    description: 'Remove empty folders safely.',
    categoryId: 'file',
    icon: Folder,
    component: EmptyFolderTool,
  },
  {
    id: 'file-organize',
    name: 'File Sorter',
    description: 'Organize files by extension or date.',
    categoryId: 'file',
    icon: FileArchive,
    component: FileOrganizerTool,
  },
  {
    id: 'file-scout',
    name: 'Large File Scout',
    description: 'Visualize large files quickly.',
    categoryId: 'file',
    icon: FileSearch,
    component: LargeFileScoutTool,
  },
  {
    id: 'archive-zip',
    name: 'Zip / Unzip',
    description: 'Compress and extract archives.',
    categoryId: 'archive',
    icon: Archive,
    component: ArchiveZipTool,
  },
  {
    id: 'security-encrypt',
    name: 'File Encrypt / Decrypt',
    description: 'Encrypt files with a secure password.',
    categoryId: 'security',
    icon: Shield,
    component: PlaceholderTool,
  },
  {
    id: 'security-checksum',
    name: 'Checksum Validator',
    description: 'Compute and verify file hashes.',
    categoryId: 'security',
    icon: BadgeCheck,
    component: ChecksumTool,
  },
  {
    id: 'productivity-dashboard',
    name: 'Quick Actions',
    description: 'Launch your most-used utilities.',
    categoryId: 'productivity',
    icon: Sparkles,
    component: DashboardTool,
  },
]

export const toolsByCategory = tools.reduce<Record<string, ToolDefinition[]>>((acc, tool) => {
  acc[tool.categoryId] = acc[tool.categoryId] ?? []
  acc[tool.categoryId].push(tool)
  return acc
}, {})

export const getToolById = (id: string) => tools.find((tool) => tool.id === id)

export const getCategoryById = (id: string) => categories.find((category) => category.id === id)
