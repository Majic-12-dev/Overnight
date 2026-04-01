import { promises as fs } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { ensureDir } from '../utils/fs'

export type ConvertImagesPayload = {
  inputPaths: string[]
  outputDir: string
  format: 'jpg' | 'png' | 'webp'
  quality: number
  keepTimestamps: boolean
}

export type ResizeImagesPayload = {
  inputPaths: string[]
  outputDir: string
  mode: 'percent' | 'width' | 'height' | 'fit'
  percent: number
  width: number
  height: number
  sharpen: boolean
}

export type CompressImagesPayload = {
  inputPaths: string[]
  outputDir: string
  quality: number
  format: 'auto' | 'jpg' | 'png' | 'webp'
}

export type ImagesToPdfPayload = {
  inputPaths: string[]
  outputDir: string
  outputName: string
}

export type StripExifPayload = {
  inputPaths: string[]
  outputDir: string
}

export type FilterImagesPayload = {
  inputPaths: string[]
  outputDir: string
  filter: 'grayscale' | 'sepia' | 'invert'
}

export type RenameImagesPayload = {
  outputDir: string
  items: { sourcePath: string; targetName: string }[]
}

export async function convertImages({
  inputPaths,
  outputDir,
  format,
  quality,
  keepTimestamps,
}: ConvertImagesPayload) {
  if (!inputPaths.length) throw new Error('No images provided.')
  await ensureDir(outputDir)

  const outputs: string[] = []

  for (const filePath of inputPaths) {
    const baseName = path.parse(filePath).name
    const outputPath = await uniquePath(
      path.join(outputDir, `${sanitizeFileName(baseName)}.${format}`),
    )
    let pipeline = sharp(filePath)
    pipeline = applyFormat(pipeline, format, quality)
    await pipeline.toFile(outputPath)
    outputs.push(outputPath)
    if (keepTimestamps) {
      await copyTimestamps(filePath, outputPath)
    }
  }

  return { outputDir, totalOutputs: outputs.length, outputs }
}

export async function resizeImages({
  inputPaths,
  outputDir,
  mode,
  percent,
  width,
  height,
  sharpen,
}: ResizeImagesPayload) {
  if (!inputPaths.length) throw new Error('No images provided.')
  await ensureDir(outputDir)

  const outputs: string[] = []

  for (const filePath of inputPaths) {
    let pipeline = sharp(filePath)
    const metadata = await pipeline.metadata()

    if (mode === 'percent') {
      if (!metadata.width || !metadata.height) {
        throw new Error(`Unable to read dimensions for ${filePath}`)
      }
      const nextWidth = Math.max(1, Math.round(metadata.width * (percent / 100)))
      const nextHeight = Math.max(1, Math.round(metadata.height * (percent / 100)))
      pipeline = pipeline.resize(nextWidth, nextHeight)
    } else if (mode === 'width') {
      pipeline = pipeline.resize({ width: Math.max(1, Math.round(width)) })
    } else if (mode === 'height') {
      pipeline = pipeline.resize({ height: Math.max(1, Math.round(height)) })
    } else if (mode === 'fit') {
      pipeline = pipeline.resize({
        width: Math.max(1, Math.round(width)),
        height: Math.max(1, Math.round(height)),
        fit: 'inside',
      })
    }

    if (sharpen) pipeline = pipeline.sharpen()

    const parsed = path.parse(filePath)
    const outputPath = await uniquePath(
      path.join(outputDir, `${sanitizeFileName(parsed.name)}_resized${parsed.ext}`),
    )
    await pipeline.toFile(outputPath)
    outputs.push(outputPath)
  }

  return { outputDir, totalOutputs: outputs.length, outputs }
}

export async function compressImages({
  inputPaths,
  outputDir,
  quality,
  format,
}: CompressImagesPayload) {
  if (!inputPaths.length) throw new Error('No images provided.')
  await ensureDir(outputDir)

  const outputs: string[] = []

  for (const filePath of inputPaths) {
    const parsed = path.parse(filePath)
    const targetFormat = format === 'auto' ? normalizeFormat(parsed.ext) : format
    const outputPath = await uniquePath(
      path.join(outputDir, `${sanitizeFileName(parsed.name)}_compressed.${targetFormat}`),
    )

    let pipeline = sharp(filePath)
    pipeline = applyFormat(pipeline, targetFormat, quality)
    await pipeline.toFile(outputPath)
    outputs.push(outputPath)
  }

  return { outputDir, totalOutputs: outputs.length, outputs }
}

export async function stripExif({ inputPaths, outputDir }: StripExifPayload) {
  if (!inputPaths.length) throw new Error('No images provided.')
  await ensureDir(outputDir)

  const outputs: string[] = []

  for (const filePath of inputPaths) {
    const parsed = path.parse(filePath)
    const outputPath = await uniquePath(
      path.join(outputDir, `${sanitizeFileName(parsed.name)}_clean${parsed.ext}`),
    )
    await sharp(filePath).toFile(outputPath)
    outputs.push(outputPath)
  }

  return { outputDir, totalOutputs: outputs.length, outputs }
}

export async function filterImages({ inputPaths, outputDir, filter }: FilterImagesPayload) {
  if (!inputPaths.length) throw new Error('No images provided.')
  await ensureDir(outputDir)

  const outputs: string[] = []

  for (const filePath of inputPaths) {
    const parsed = path.parse(filePath)
    const filterSuffix = filter === 'grayscale' ? '_grayscale' : filter === 'sepia' ? '_sepia' : '_inverted'
    const outputPath = await uniquePath(
      path.join(outputDir, `${sanitizeFileName(parsed.name)}${filterSuffix}${parsed.ext}`),
    )

    let pipeline = sharp(filePath)
    switch (filter) {
      case 'grayscale':
        pipeline = pipeline.grayscale()
        break
      case 'sepia':
        pipeline = pipeline.modulate({ brightness: 1.1, saturation: 0.5 }).recomb([
          [0.393, 0.769, 0.189],
          [0.349, 0.686, 0.168],
          [0.272, 0.534, 0.131],
        ])
        break
      case 'invert':
        pipeline = pipeline.negate()
        break
    }
    await pipeline.toFile(outputPath)
    outputs.push(outputPath)
  }

  return { outputDir, totalOutputs: outputs.length, outputs }
}

export async function renameImages({ outputDir, items }: RenameImagesPayload) {
  if (!items.length) throw new Error('No items provided.')
  await ensureDir(outputDir)

  const outputs: string[] = []

  for (const item of items) {
    if (!item.sourcePath) {
      throw new Error('Invalid source path')
    }

    const sourcePath = item.sourcePath
    const targetPath = path.join(outputDir, sanitizeFileName(item.targetName))

    await fs.copyFile(sourcePath, targetPath)
    outputs.push(targetPath)
  }

  return { outputDir, totalOutputs: outputs.length, outputs }
}

export async function imagesToPdf({ inputPaths, outputDir, outputName }: ImagesToPdfPayload) {
  if (!inputPaths.length) throw new Error('No images provided.')
  await ensureDir(outputDir)

  const { PDFDocument } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  let pageCount = 0

  for (const filePath of inputPaths) {
    const ext = path.extname(filePath).toLowerCase()
    let imageBytes: Uint8Array = new Uint8Array(await fs.readFile(filePath))
    let embedType: 'png' | 'jpg' = ext === '.png' ? 'png' : 'jpg'

    if (!['.png', '.jpg', '.jpeg'].includes(ext)) {
      imageBytes = new Uint8Array(await sharp(filePath).png().toBuffer())
      embedType = 'png'
    } else if (ext === '.png') {
      embedType = 'png'
    } else {
      embedType = 'jpg'
    }

    const image =
      embedType === 'png' ? await doc.embedPng(imageBytes) : await doc.embedJpg(imageBytes)

    const page = doc.addPage([image.width, image.height])
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })
    pageCount += 1
  }

  const safeName = sanitizeFileName(outputName || 'images.pdf')
  const outputPath = path.join(outputDir, safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`)
  await fs.writeFile(outputPath, await doc.save())

  return { outputPath, pageCount }
}

function applyFormat(
  pipeline: sharp.Sharp,
  format: 'jpg' | 'png' | 'webp',
  quality: number,
) {
  if (format === 'png') {
    const compressionLevel = Math.min(9, Math.max(0, Math.round((100 - quality) / 10)))
    return pipeline.png({ compressionLevel })
  }
  if (format === 'webp') {
    return pipeline.webp({ quality })
  }
  return pipeline.jpeg({ quality, mozjpeg: true })
}

function normalizeFormat(ext: string) {
  const cleaned = ext.replace('.', '').toLowerCase()
  if (cleaned === 'jpeg') return 'jpg'
  if (cleaned === 'jpg' || cleaned === 'png' || cleaned === 'webp') return cleaned
  return 'jpg'
}

function sanitizeFileName(name: string) {
  return name.replace(/[<>:"/\\|?*]+/g, '_').trim()
}

async function uniquePath(targetPath: string) {
  const parsed = path.parse(targetPath)
  let attempt = 0
  let candidate = targetPath
  while (true) {
    try {
      await fs.access(candidate)
      attempt += 1
      candidate = path.join(parsed.dir, `${parsed.name}(${attempt})${parsed.ext}`)
    } catch {
      return candidate
    }
  }
}

async function copyTimestamps(source: string, target: string) {
  try {
    const stats = await fs.stat(source)
    await fs.utimes(target, stats.atime, stats.mtime)
  } catch {
    // ignore timestamp errors
  }
}
