import { promises as fs } from 'node:fs'
import path from 'node:path'
import { ensureDir } from '../utils/fs'
import { validatePaths } from '../utils/pathValidation'

export type MergeTextPayload = {
  inputPaths: string[]
  outputDir: string
  outputName: string
  separator: string
  includeHeader: boolean
}

export async function mergeTextFiles({
  inputPaths,
  outputDir,
  outputName,
  separator,
  includeHeader,
}: MergeTextPayload) {
  if (!inputPaths.length) throw new Error('No text files provided.')

  const safeName = sanitizeFileName(outputName || 'merged.txt')
  const outputPath = path.join(outputDir, safeName)

  validatePaths(inputPaths, outputPath)
  await ensureDir(outputDir)

  const pieces: string[] = []

  for (const filePath of inputPaths) {
    const content = await fs.readFile(filePath, 'utf-8')
    if (includeHeader) {
      pieces.push(`----- ${path.basename(filePath)} -----`)
    }
    pieces.push(content)
  }

  const merged = pieces.join(separator || '\n')
  await fs.writeFile(outputPath, merged, 'utf-8')

  return { outputPath, sourceCount: inputPaths.length }
}

function sanitizeFileName(name: string) {
  return name.replace(/[<>:"/\\|?*]+/g, '_').trim()
}
