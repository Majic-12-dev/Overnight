import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Archive,
  BadgeCheck,
  ArrowLeftRight,
  Braces,
  Clock,
  Code2,
  Combine,
  Diff,
  FileArchive,
  FileCode,
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
  ImagePlus,
  ImageUp,
  KeyRound,
  Layers,
  Palette,
  PencilRuler,
  QrCode,
  Regex,
  ScanText,
  Shield,
  Sparkles,
  SplitSquareVertical,
  Table,
  Table2,
  TextCursorInput,
  Wand2,
  Type,
  CaseSensitive,
  Link2,
  Timer,
  Hash,
  ListTodo,
  Code,
  FileUp,
  FileType2,
  BarChart3,
  ShieldCheck,
  Volume2,
  Split,
  Ratio,
  Crop,
  Maximize,
  RotateCw,
  SearchCheck,
  Clipboard,
} from 'lucide-react'
import { PdfToTextTool } from '@/tools/pdf/PdfToTextTool'
import { ImageRotateFlipTool } from '@/tools/image/ImageRotateFlipTool'
import { ImageCropTool } from '@/tools/image/ImageCropTool'
import { AspectRatioTool } from '@/tools/productivity/AspectRatioTool'
import { CsvConverterTool } from '@/tools/file/CsvConverterTool'
import { PdfMergeTool } from '@/tools/pdf/PdfMergeTool'
import { PdfSplitTool } from '@/tools/pdf/PdfSplitTool'
import { PdfRotateTool } from '@/tools/pdf/PdfRotateTool'
import { PdfWatermarkTool } from '@/tools/pdf/PdfWatermarkTool'
import { PdfMetadataTool } from '@/tools/pdf/PdfMetadataTool'
import { PdfUnlockTool } from '@/tools/pdf/PdfUnlockTool'
import { CompressPdfTool } from '@/tools/pdf/CompressPdfTool'
import { RepairPdfTool } from '@/tools/pdf/RepairPdfTool'
import { PdfOcrTool } from '@/tools/pdf/PdfOcrTool'
import { PdfPasswordTool } from '@/tools/pdf/PdfPasswordTool'
import { PdfToImagesTool } from '@/tools/pdf/PdfToImagesTool'
import { PdfExtractImagesTool } from '@/tools/pdf/PdfExtractImagesTool'
import { PdfReorderTool } from '@/tools/pdf/PdfReorderTool'
import { ArchiveZipTool } from '@/tools/archive/ArchiveZipTool'
import { ImageConvertTool } from '@/tools/image/ImageConvertTool'
import { ImageResizeTool } from '@/tools/image/ImageResizeTool'
import { ImageCompressTool } from '@/tools/image/ImageCompressTool'
import { ImageToPdfTool } from '@/tools/image/ImageToPdfTool'
import { ImageExifTool } from '@/tools/image/ImageExifTool'
import { ImageRenameTool } from '@/tools/image/ImageRenameTool'
import { ColorFilterTool } from '@/tools/image/ColorFilterTool'
import { BackgroundRemoverTool } from '@/tools/image/BackgroundRemoverTool'
import { ImageWatermarkTool } from '@/tools/image/ImageWatermarkTool'
import { TextMergeTool } from '@/tools/text/TextMergeTool'
import { MarkdownTool } from '@/tools/text/MarkdownTool'
import { TextDiffTool } from '@/tools/text/TextDiffTool'
import { JsonFormatterTool } from '@/tools/text/JsonFormatterTool'
import { BulkRenamerTool } from '@/tools/file/BulkRenamerTool'
import { EmptyFolderTool } from '@/tools/file/EmptyFolderTool'
import { LargeFileScoutTool } from '@/tools/file/LargeFileScoutTool'
import { DuplicateFinderTool } from '@/tools/file/DuplicateFinderTool'
import { MimeTypeDetectorTool } from '@/tools/file/MimeTypeDetectorTool'
import { YamlToJsonTool } from '@/tools/text/YamlToJsonTool'
import { SnippetManagerTool } from '@/tools/text/SnippetManagerTool'
import { PasswordAuditorTool } from '@/tools/security/PasswordAuditorTool'
import { ChecksumTool } from '@/tools/security/ChecksumTool'
import { MarkdownTableTool } from '@/tools/text/MarkdownTableTool'
import { EncryptTool } from '@/tools/security/EncryptTool'
import { FileOrganizerTool } from '@/tools/file/FileOrganizerTool'
import DashboardTool from '@/tools/productivity/DashboardTool'
import { QrCodeGeneratorTool } from '@/tools/productivity/QrCodeGeneratorTool'
import { PasswordGeneratorTool } from '@/tools/security/PasswordGeneratorTool'
import { UnitConverterTool } from '@/tools/productivity/UnitConverterTool'
import { ColorPaletteTool } from '@/tools/productivity/ColorPaletteTool'
import { TimestampConverterTool } from '@/tools/text/TimestampConverterTool'
import { RegexTesterTool } from '@/tools/text/RegexTesterTool'
import { Base64EncoderTool } from '@/tools/productivity/Base64EncoderTool'
import { XmlFormatterTool } from '@/tools/text/XmlFormatterTool'
import { ImageCollageTool } from '@/tools/image/ImageCollageTool'
import { WordCounterTool } from '@/tools/text/WordCounterTool'
import { CaseConverterTool } from '@/tools/text/CaseConverterTool'
import { LoremGeneratorTool } from '@/tools/productivity/LoremGeneratorTool'
import { SlugGeneratorTool } from '@/tools/text/SlugGeneratorTool'
import { Base64Tool } from '@/tools/text/Base64Tool'
import { TextHashTool } from '@/tools/security/TextHashTool'
import { TextEncryptTool } from '@/tools/security/TextEncryptTool'
import { PomodoroTool } from '@/tools/productivity/PomodoroTool'
import { ImageToBase64Tool } from '@/tools/image/ImageToBase64Tool'
import { UuidGeneratorTool } from '@/tools/productivity/UuidGeneratorTool'
import { MarkdownPreviewTool } from '@/tools/text/MarkdownPreviewTool'
import { HtmlEntityTool } from '@/tools/text/HtmlEntityTool'
import { TextStatisticsTool } from '@/tools/text/TextStatisticsTool'
import { CipherTool } from '@/tools/text/CipherTool'
import { TextToSpeechTool } from '@/tools/text/TextToSpeechTool'
import { ColorConverterTool } from '@/tools/productivity/ColorConverterTool'
import { CronExpressionTool } from '@/tools/productivity/CronExpressionTool'
import { HtmlCodeTool } from '@/tools/text/HtmlCodeTool'
import { NumberBaseConverterTool } from '@/tools/productivity/NumberBaseConverterTool'
import { TextSplitterTool } from '@/tools/text/TextSplitterTool'
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
    component: PdfOcrTool,
  },
  {
    id: 'pdf-to-text',
    name: 'PDF to Text',
    description: 'Extract text content from PDF files.',
    categoryId: 'pdf',
    icon: FileText,
    component: PdfToTextTool,
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
    component: PdfPasswordTool,
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
    component: RepairPdfTool,
  },
  {
    id: 'pdf-to-images',
    name: 'PDF to Images',
    description: 'Convert PDF pages into PNG or JPG images.',
    categoryId: 'pdf',
    icon: FileImage,
    component: PdfToImagesTool,
  },
  {
    id: 'pdf-extract-images',
    name: 'PDF Image Extractor',
    description: 'Extract embedded images from PDF documents.',
    categoryId: 'pdf',
    icon: FileImage,
    component: PdfExtractImagesTool,
  },
  {
    id: 'pdf-reorder',
    name: 'PDF Page Reorder',
    description: 'Rearrange, remove, and reorder PDF pages with drag and drop.',
    categoryId: 'pdf',
    icon: ArrowLeftRight,
    component: PdfReorderTool,
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
    component: BackgroundRemoverTool,
  },
  {
    id: 'image-watermark',
    name: 'Image Watermark',
    description: 'Add text or image watermarks to photos in batch.',
    categoryId: 'image',
    icon: PencilRuler,
    component: ImageWatermarkTool,
  },
  {
    id: 'image-rotate-flip',
    name: 'Image Rotate & Flip',
    description: 'Rotate or flip images by 90°, 180°, 270°, or mirror horizontally/vertically.',
    categoryId: 'image',
    icon: RotateCw,
    component: ImageRotateFlipTool,
  },
  {
    id: 'image-crop',
    name: 'Image Crop',
    description: 'Crop images to standard aspect ratios or custom dimensions.',
    categoryId: 'image',
    icon: Crop,
    component: ImageCropTool,
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
    component: MarkdownTool,
  },
  {
    id: 'text-diff',
    name: 'Text Diff',
    description: 'Compare two text blocks line-by-line or word-level.',
    categoryId: 'text',
    icon: Diff,
    component: TextDiffTool,
  },
  {
    id: 'json-formatter',
    name: 'JSON Formatter',
    description: 'Validate, pretty-print, and minify JSON data.',
    categoryId: 'text',
    icon: Braces,
    component: JsonFormatterTool,
  },
  {
    id: 'file-duplicates',
    name: 'Duplicate File Finder',
    description: 'Find duplicates by size and hash.',
    categoryId: 'file',
    icon: FileSearch,
    component: DuplicateFinderTool,
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
    component: EncryptTool,
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
  {
    id: 'qr-code-generator',
    name: 'QR Code Generator',
    description: 'Generate QR codes from text or URLs.',
    categoryId: 'productivity',
    icon: QrCode,
    component: QrCodeGeneratorTool,
  },
  {
    id: 'password-generator',
    name: 'Password Generator',
    description: 'Generate secure random passwords.',
    categoryId: 'security',
    icon: KeyRound,
    component: PasswordGeneratorTool,
  },
  {
    id: 'csv-converter',
    name: 'CSV Converter',
    description: 'Convert between CSV and JSON formats with validation.',
    categoryId: 'file',
    icon: Table2,
    component: CsvConverterTool,
  },
  {
    id: 'markdown-table',
    name: 'Markdown Table Generator',
    description: 'Build and export markdown tables with live preview.',
    categoryId: 'text',
    icon: Table,
    component: MarkdownTableTool,
  },
  {
    id: 'unit-converter',
    name: 'Unit Converter',
    description: 'Convert between length, weight, temperature, speed, data, and time units.',
    categoryId: 'productivity',
    icon: ArrowLeftRight,
    component: UnitConverterTool,
  },
  {
    id: 'regex-tester',
    name: 'Regex Tester',
    description: 'Test regular expressions with flags, match highlighting, and replace.',
    categoryId: 'text',
    icon: Regex,
    component: RegexTesterTool,
  },
  {
    id: 'color-palette',
    name: 'Color Palette Generator',
    description: 'Generate harmonious color palettes using complementary, analogous, triadic, and split-complementary modes.',
    categoryId: 'productivity',
    icon: Palette,
    component: ColorPaletteTool,
  },
  {
    id: 'timestamp-converter',
    name: 'Timestamp Converter',
    description: 'Convert Unix timestamps to local date/time and ISO 8601, or convert date strings to timestamps.',
    categoryId: 'text',
    icon: Clock,
    component: TimestampConverterTool,
  },
  {
    id: 'base64-encoder',
    name: 'Base64 Encoder / Decoder',
    description: 'Encode text or files to Base64, decode Base64 back to text or files.',
    categoryId: 'productivity',
    icon: FileCode,
    component: Base64EncoderTool,
  },
  {
    id: 'xml-formatter',
    name: 'XML Formatter / Validator',
    description: 'Pretty-print, minify, and validate XML with detailed error reporting.',
    categoryId: 'text',
    icon: Code2,
    component: XmlFormatterTool,
  },
  {
    id: 'image-collage',
    name: 'Image Collage Maker',
    description: 'Arrange multiple images into a collage with layouts, spacing, and background controls.',
    categoryId: 'image',
    icon: ImagePlus,
    component: ImageCollageTool,
  },
  {
    id: 'word-counter',
    name: 'Word Counter',
    description: 'Live word count, character analysis, and reading time estimation.',
    categoryId: 'text',
    icon: Type,
    component: WordCounterTool,
  },
  {
    id: 'case-converter',
    name: 'Case Converter',
    description: 'Transform text to UPPERCASE, lowercase, camelCase, snake_case, kebab-case, and more.',
    categoryId: 'text',
    icon: CaseSensitive,
    component: CaseConverterTool,
  },
  {
    id: 'lorem-generator',
    name: 'Lorem Ipsum Generator',
    description: 'Generate placeholder text for paragraphs, sentences, or words.',
    categoryId: 'productivity',
    icon: FileCode,
    component: LoremGeneratorTool,
  },
  {
    id: 'slug-generator',
    name: 'Slug Generator',
    description: 'Convert any text into a URL-safe slug with configurable separators.',
    categoryId: 'text',
    icon: Link2,
    component: SlugGeneratorTool,
  },
  {
    id: 'base64-text',
    name: 'Base64 Encode / Decode',
    description: 'Encode text to Base64 and decode Base64 strings back to text.',
    categoryId: 'text',
    icon: FileCode,
    component: Base64Tool,
  },
  {
    id: 'text-hash',
    name: 'Text Hash Generator',
    description: 'Compute SHA-1, SHA-256, SHA-512, and MD5 hashes of any text.',
    categoryId: 'security',
    icon: Hash,
    component: TextHashTool,
  },
  {
    id: 'text-encrypt',
    name: 'Text Encrypt / Decrypt',
    description: 'AES-256-GCM encryption and decryption of text with password protection.',
    categoryId: 'security',
    icon: Shield,
    component: TextEncryptTool,
  },
  {
    id: 'pomodoro',
    name: 'Pomodoro Timer',
    description: 'Stay focused with configurable work/break intervals and session tracking.',
    categoryId: 'productivity',
    icon: Timer,
    component: PomodoroTool,
  },
  {
    id: 'image-to-base64',
    name: 'Image to Base64',
    description: 'Convert images to Base64 data URIs with preview and copy.',
    categoryId: 'image',
    icon: ImagePlus,
    component: ImageToBase64Tool,
  },
  {
    id: 'uuid-generator',
    name: 'UUID Generator',
    description: 'Generate random UUIDs (v4) and time-sortable UUIDs (v7) with batch support.',
    categoryId: 'productivity',
    icon: ListTodo,
    component: UuidGeneratorTool,
  },
  {
    id: 'markdown-preview',
    name: 'Markdown Preview',
    description: 'Live Markdown preview with HTML export, formatting, and syntax reference.',
    categoryId: 'text',
    icon: FileUp,
    component: MarkdownPreviewTool,
  },
  {
    id: 'html-entity',
    name: 'HTML Entity Encoder / Decoder',
    description: 'Encode and decode HTML entities with support for named, decimal, and hex formats.',
    categoryId: 'text',
    icon: FileType2,
    component: HtmlEntityTool,
  },
  {
    id: 'text-statistics',
    name: 'Text Statistics',
    description: 'Comprehensive text analysis including readability scores, word frequency, and time estimates.',
    categoryId: 'text',
    icon: BarChart3,
    component: TextStatisticsTool,
  },
  {
    id: 'cipher',
    name: 'Cipher Encoder / Decoder',
    description: 'Encrypt and decrypt text using Caesar, ROT13, Vigenère, and Atbash ciphers.',
    categoryId: 'text',
    icon: ShieldCheck,
    component: CipherTool,
  },
  {
    id: 'text-to-speech',
    name: 'Text to Speech',
    description: 'Convert text to speech with configurable voice, speed, pitch, and volume using the browser API.',
    categoryId: 'text',
    icon: Volume2,
    component: TextToSpeechTool,
  },
  {
    id: 'color-converter',
    name: 'Color Converter',
    description: 'Convert between HEX, RGB, and HSL color formats with live preview and copy.',
    categoryId: 'productivity',
    icon: Palette,
    component: ColorConverterTool,
  },
  {
    id: 'cron-expression',
    name: 'Cron Expression Helper',
    description: 'Generate and parse cron expressions with human-readable descriptions.',
    categoryId: 'productivity',
    icon: Code2,
    component: CronExpressionTool,
  },
  {
    id: 'html-code-tool',
    name: 'HTML Code Toolkit',
    description: 'Minify, beautify, and convert HTML snippets from other formats.',
    categoryId: 'text',
    icon: Code2,
    component: HtmlCodeTool,
  },
  {
    id: 'number-base-converter',
    name: 'Number Base Converter',
    description: 'Convert between decimal, hexadecimal, octal, and binary number systems.',
    categoryId: 'productivity',
    icon: Hash,
    component: NumberBaseConverterTool,
  },
  {
    id: 'text-splitter',
    name: 'Text Splitter',
    description: 'Split text by line, word, sentence, or custom delimiter with chunking and preview.',
    categoryId: 'text',
    icon: Split,
    component: TextSplitterTool,
  },
  {
    id: 'aspect-ratio',
    name: 'Aspect Ratio Calculator',
    description: 'Calculate aspect ratios, megapixels, and scaled dimensions with a resolution reference table.',
    categoryId: 'productivity',
    icon: Ratio,
    component: AspectRatioTool,
  },
  {
    id: 'file-mime-type',
    name: 'MIME Type Detector',
    description: 'Detect the actual MIME type of files regardless of their extension.',
    categoryId: 'file',
    icon: FileSearch,
    component: MimeTypeDetectorTool,
  },
  {
    id: 'yaml-json',
    name: 'YAML to JSON',
    description: 'Convert YAML documents to JSON format with validation.',
    categoryId: 'text',
    icon: Code2,
    component: YamlToJsonTool,
  },
  {
    id: 'snippet-manager',
    name: 'Snippet Manager',
    description: 'Organize, search, and reuse code snippets across projects.',
    categoryId: 'text',
    icon: Clipboard,
    component: SnippetManagerTool,
  },
  {
    id: 'password-audit',
    name: 'Password Auditor',
    description: 'Audit password strength and detect weak or reused passwords.',
    categoryId: 'security',
    icon: ShieldCheck,
    component: PasswordAuditorTool,
  },
]

export const toolsByCategory = tools.reduce<Record<string, ToolDefinition[]>>((acc, tool) => {
  acc[tool.categoryId] = acc[tool.categoryId] ?? []
  acc[tool.categoryId].push(tool)
  return acc
}, {})

export const getToolById = (id: string) => tools.find((tool) => tool.id === id)

export const getCategoryById = (id: string) => categories.find((category) => category.id === id)
