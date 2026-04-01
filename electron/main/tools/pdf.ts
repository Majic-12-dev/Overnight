import { promises as fs } from 'node:fs'
import path from 'node:path'
import { PDFDocument, degrees, rgb, EncryptOptions } from 'pdf-lib'
import { ensureDir } from '../utils/fs'

const PERMISSION_MAP = {
  print: { allowed: 'print_allowed' as const, denied: 'not_allowed' as const },
  modify: { allowed: 'modify_allowed' as const, denied: 'not_allowed' as const },
  copy: { allowed: 'copy_allowed' as const, denied: 'not_allowed' as const },
  annotate: { allowed: 'annotate_allowed' as const, denied: 'not_allowed' as const },
  form: { allowed: 'form_allowed' as const, denied: 'not_allowed' as const },
} as const;

export type MergePdfPayload = {
  inputPaths: string[]
  outputDir: string
  outputName: string
}

export type SplitPdfPayload = {
  inputPaths: string[]
  outputDir: string
  mode: 'ranges' | 'extract' | 'remove'
  ranges?: string
}

export type RotatePdfPayload = {
  inputPaths: string[]
  outputDir: string
  rotation: number
  ranges?: string | null
}

export type WatermarkPdfPayload = {
  inputPaths: string[]
  outputDir: string
  type: 'text' | 'image'
  text?: string
  imagePath?: string
  opacity: number
  rotation: number
  size: number
  position: string
}

export type MetadataPdfPayload = {
  inputPaths: string[]
  outputDir: string
  metadata: {
    title?: string | null
    author?: string | null
    subject?: string | null
    keywords?: string | null
    creator?: string | null
  }
}

export type UnlockPdfPayload = {
  inputPaths: string[]
  outputDir: string
  password: string
}

export type CompressPdfPayload = {
  inputPaths: string[]
  outputDir: string
  level: 'low' | 'medium' | 'high'
}

export async function mergePdf({ inputPaths, outputDir, outputName }: MergePdfPayload) {
  if (!inputPaths.length) {
    throw new Error('No PDF files provided.')
  }

  const safeName = sanitizeFileName(outputName || 'merged.pdf')
  const outputPath = path.join(outputDir, safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`)

  await ensureDir(outputDir)

  const merged = await PDFDocument.create()
  let totalPages = 0

  for (const filePath of inputPaths) {
    const bytes = await fs.readFile(filePath)
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: false })
    const pages = await merged.copyPages(doc, doc.getPageIndices())
    pages.forEach((page) => merged.addPage(page))
    totalPages += pages.length
  }

  const mergedBytes = await merged.save()
  await fs.writeFile(outputPath, mergedBytes)

  return { outputPath, pageCount: totalPages }
}

export async function splitPdf({ inputPaths, outputDir, mode, ranges }: SplitPdfPayload) {
  if (!inputPaths.length) {
    throw new Error('No PDF files provided.')
  }

  const outputs: string[] = []

  for (const filePath of inputPaths) {
    const bytes = await fs.readFile(filePath)
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: false })
    const pageCount = doc.getPageCount()
    const baseName = path.parse(filePath).name
    const splitDir = path.join(outputDir, `${sanitizeFileName(baseName)}_split`)
    await ensureDir(splitDir)

    if (mode === 'extract') {
      for (let index = 0; index < pageCount; index += 1) {
        const outDoc = await PDFDocument.create()
        const [page] = await outDoc.copyPages(doc, [index])
        outDoc.addPage(page)
        const outputPath = path.join(
          splitDir,
          `${sanitizeFileName(baseName)}_page_${index + 1}.pdf`,
        )
        await fs.writeFile(outputPath, await outDoc.save())
        outputs.push(outputPath)
      }
      continue
    }

    const parsedRanges = parsePageRanges(ranges || '', pageCount)
    if (!parsedRanges.length) {
      throw new Error('No valid page ranges were provided.')
    }

    if (mode === 'remove') {
      const removeSet = new Set<number>()
      parsedRanges.forEach(({ start, end }) => {
        for (let idx = start; idx <= end; idx += 1) removeSet.add(idx)
      })
      const keepIndices = doc
        .getPageIndices()
        .filter((index) => !removeSet.has(index))
      const outDoc = await PDFDocument.create()
      const pages = await outDoc.copyPages(doc, keepIndices)
      pages.forEach((page) => outDoc.addPage(page))
      const outputPath = path.join(splitDir, `${sanitizeFileName(baseName)}_removed.pdf`)
      await fs.writeFile(outputPath, await outDoc.save())
      outputs.push(outputPath)
      continue
    }

    for (const range of parsedRanges) {
      const outDoc = await PDFDocument.create()
      const indices = []
      for (let idx = range.start; idx <= range.end; idx += 1) indices.push(idx)
      const pages = await outDoc.copyPages(doc, indices)
      pages.forEach((page) => outDoc.addPage(page))
      const outputPath = path.join(
        splitDir,
        `${sanitizeFileName(baseName)}_${range.start + 1}-${range.end + 1}.pdf`,
      )
      await fs.writeFile(outputPath, await outDoc.save())
      outputs.push(outputPath)
    }
  }

  return { outputDir, totalOutputs: outputs.length, outputs }
}

export async function rotatePdf({ inputPaths, outputDir, rotation, ranges }: RotatePdfPayload) {
  if (!inputPaths.length) {
    throw new Error('No PDF files provided.')
  }

  const outputs: string[] = []

  for (const filePath of inputPaths) {
    const bytes = await fs.readFile(filePath)
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: false })
    const indices = doc.getPageIndices()
    const pageCount = indices.length
    const allowedRanges = ranges ? parsePageRanges(ranges || '', pageCount) : null
    const target = allowedRanges
      ? new Set(allowedRanges.flatMap((range) => expandRange(range)))
      : new Set(indices)

    indices.forEach((index) => {
      if (!target.has(index)) return
      const page = doc.getPage(index)
      page.setRotation(degrees(rotation))
    })

    const baseName = path.parse(filePath).name
    const outputPath = path.join(outputDir, `${sanitizeFileName(baseName)}_rotated.pdf`)
    await ensureDir(outputDir)
    await fs.writeFile(outputPath, await doc.save())
    outputs.push(outputPath)
  }

  return { outputDir, totalOutputs: outputs.length, outputs }
}

export async function watermarkPdf({
  inputPaths,
  outputDir,
  type,
  text,
  imagePath,
  opacity,
  rotation,
  size,
  position,
}: WatermarkPdfPayload) {
  if (!inputPaths.length) {
    throw new Error('No PDF files provided.')
  }

  const outputs: string[] = []
  let imageBytes: Uint8Array | null = null
  let imageType: 'png' | 'jpg' | null = null

  if (type === 'image') {
    if (!imagePath) throw new Error('No watermark image selected.')
    imageBytes = await fs.readFile(imagePath)
    imageType = imagePath.toLowerCase().endsWith('.png') ? 'png' : 'jpg'
  }

  for (const filePath of inputPaths) {
    const bytes = await fs.readFile(filePath)
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: false })

    let embeddedImage: any = null
    if (type === 'image' && imageBytes && imageType) {
      embeddedImage =
        imageType === 'png' ? await doc.embedPng(imageBytes) : await doc.embedJpg(imageBytes)
    }

    doc.getPages().forEach((page) => {
      const { width, height } = page.getSize()
      if (type === 'text') {
        const { x, y } = getPosition(position, width, height, size, size)
        page.drawText(text || 'WATERMARK', {
          x,
          y,
          size,
          rotate: degrees(rotation),
          opacity: clamp(opacity, 0.05, 1),
          color: rgb(0.35, 0.35, 0.35),
        })
        return
      }

      if (embeddedImage) {
        const scale = clamp(size, 5, 100) / 100
        const imgWidth = embeddedImage.width * scale
        const imgHeight = embeddedImage.height * scale
        const { x, y } = getPosition(position, width, height, imgWidth, imgHeight)
        page.drawImage(embeddedImage, {
          x,
          y,
          width: imgWidth,
          height: imgHeight,
          rotate: degrees(rotation),
          opacity: clamp(opacity, 0.05, 1),
        })
      }
    })

    const baseName = path.parse(filePath).name
    const outputPath = path.join(outputDir, `${sanitizeFileName(baseName)}_watermarked.pdf`)
    await ensureDir(outputDir)
    await fs.writeFile(outputPath, await doc.save())
    outputs.push(outputPath)
  }

  return { outputDir, totalOutputs: outputs.length, outputs }
}

export async function updateMetadata({ inputPaths, outputDir, metadata }: MetadataPdfPayload) {
  if (!inputPaths.length) {
    throw new Error('No PDF files provided.')
  }

  const outputs: string[] = []

  for (const filePath of inputPaths) {
    const bytes = await fs.readFile(filePath)
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: false })

    if (metadata.title) doc.setTitle(metadata.title)
    if (metadata.author) doc.setAuthor(metadata.author)
    if (metadata.subject) doc.setSubject(metadata.subject)
    if (metadata.keywords) doc.setKeywords(metadata.keywords.split(',').map((item) => item.trim()))
    if (metadata.creator) doc.setCreator(metadata.creator)

    const baseName = path.parse(filePath).name
    const outputPath = path.join(outputDir, `${sanitizeFileName(baseName)}_metadata.pdf`)
    await ensureDir(outputDir)
    await fs.writeFile(outputPath, await doc.save())
    outputs.push(outputPath)
  }

  return { outputDir, totalOutputs: outputs.length, outputs }
}

export type EncryptPdfPayload = {
  inputPaths: string[]
  outputDir: string
  userPassword?: string
  ownerPassword?: string
  permissions: {
    print: boolean
    modify: boolean
    copy: boolean
    annotate: boolean
    form: boolean
  }
}

export async function encryptPdf({
  inputPaths,
  outputDir,
  userPassword,
  ownerPassword,
  permissions,
}: EncryptPdfPayload) {
  if (!inputPaths.length) {
    throw new Error('No PDF files provided.')
  }

  const outputs: string[] = []

  for (const filePath of inputPaths) {
    const bytes = await fs.readFile(filePath)
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: false })

    const encryptOptions: EncryptOptions = {
      userPassword: userPassword || undefined,
      ownerPassword: ownerPassword || undefined,
      permissions: {
        print: permissions.print ? PERMISSION_MAP.print.allowed : PERMISSION_MAP.print.denied,
        modify: permissions.modify ? PERMISSION_MAP.modify.allowed : PERMISSION_MAP.modify.denied,
        copy: permissions.copy ? PERMISSION_MAP.copy.allowed : PERMISSION_MAP.copy.denied,
        annotate: permissions.annotate ? PERMISSION_MAP.annotate.allowed : PERMISSION_MAP.annotate.denied,
        form: permissions.form ? PERMISSION_MAP.form.allowed : PERMISSION_MAP.form.denied,
      },
    }

    const baseName = path.parse(filePath).name
    const outputPath = path.join(outputDir, `${sanitizeFileName(baseName)}_encrypted.pdf`)
    await ensureDir(outputDir)
    await fs.writeFile(outputPath, await doc.save({ encrypt: encryptOptions }))
    outputs.push(outputPath)
  }

  return { outputDir, totalOutputs: outputs.length, outputs }
}

export async function compressPdf({ inputPaths, outputDir, level }: CompressPdfPayload) {
  if (!inputPaths.length) {
    throw new Error('No PDF files provided.')
  }

  const outputs: string[] = []
  let totalInputSize = 0
  let totalOutputSize = 0

  for (const filePath of inputPaths) {
    const bytes = await fs.readFile(filePath)
    totalInputSize += bytes.length

    const doc = await PDFDocument.load(bytes, { ignoreEncryption: false })

    const optimizedBytes = await doc.save({
      useObjectStreams: true,
      addDefaultPage: false,
    })

    const baseName = path.parse(filePath).name
    const outputPath = path.join(outputDir, `${sanitizeFileName(baseName)}_compressed.pdf`)
    await ensureDir(outputDir)
    await fs.writeFile(outputPath, optimizedBytes)

    const stats = await fs.stat(outputPath)
    totalOutputSize += stats.size
    outputs.push(outputPath)
  }

  const averageReduction = totalInputSize > 0 ? ((totalInputSize - totalOutputSize) / totalInputSize) * 100 : 0

  return {
    outputDir,
    inputCount: inputPaths.length,
    averageReduction,
    outputs,
  }
}

function sanitizeFileName(name: string) {
  return name.replace(/[<>:"/\\|?*]+/g, '_').trim()
}

function parsePageRanges(input: string, pageCount: number) {
  if (!input) return []
  const ranges: { start: number; end: number }[] = []
  const parts = input.split(',')
  parts.forEach((part) => {
    const trimmed = part.trim()
    if (!trimmed) return
    if (trimmed.includes('-')) {
      const [startRaw, endRaw] = trimmed.split('-')
      const start = clampIndex(Number(startRaw), pageCount)
      const end = clampIndex(Number(endRaw), pageCount)
      if (Number.isNaN(start) || Number.isNaN(end)) return
      ranges.push({ start: Math.min(start, end), end: Math.max(start, end) })
      return
    }
    const single = clampIndex(Number(trimmed), pageCount)
    if (!Number.isNaN(single)) {
      ranges.push({ start: single, end: single })
    }
  })
  return ranges
}

function clampIndex(value: number, pageCount: number) {
  if (!Number.isFinite(value)) return Number.NaN
  const normalized = Math.min(Math.max(Math.floor(value), 1), pageCount)
  return normalized - 1
}

function expandRange(range: { start: number; end: number }) {
  const result: number[] = []
  for (let idx = range.start; idx <= range.end; idx += 1) {
    result.push(idx)
  }
  return result
}

function getPosition(
  position: string,
  pageWidth: number,
  pageHeight: number,
  contentWidth: number,
  contentHeight: number,
) {
  const margin = 32
  const map: Record<string, { x: number; y: number }> = {
    'top-left': { x: margin, y: pageHeight - contentHeight - margin },
    top: { x: (pageWidth - contentWidth) / 2, y: pageHeight - contentHeight - margin },
    'top-right': { x: pageWidth - contentWidth - margin, y: pageHeight - contentHeight - margin },
    left: { x: margin, y: (pageHeight - contentHeight) / 2 },
    center: { x: (pageWidth - contentWidth) / 2, y: (pageHeight - contentHeight) / 2 },
    right: { x: pageWidth - contentWidth - margin, y: (pageHeight - contentHeight) / 2 },
    'bottom-left': { x: margin, y: margin },
    bottom: { x: (pageWidth - contentWidth) / 2, y: margin },
    'bottom-right': { x: pageWidth - contentWidth - margin, y: margin },
  }
  return map[position] || map.center
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
