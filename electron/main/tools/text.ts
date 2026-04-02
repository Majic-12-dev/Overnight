import { createReadStream, createWriteStream, promises as fs } from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { ensureDir } from '../utils/fs'
import { validatePaths } from '../utils/pathValidation'

export type MergeTextPayload = {
  inputPaths: string[]
  outputDir: string
  outputName: string
  separator: string
  includeHeader: boolean
}

/**
 * Writes a string chunk to a WriteStream, resolving when flushed and rejecting on error.
 */
function writeToStream(
  stream: ReturnType<typeof createWriteStream>,
  data: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.write(data, 'utf-8', (err: Error | null | undefined) => {
      if (err) reject(err)
      else resolve()
    })
  })
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

  const writeStream = createWriteStream(outputPath, { encoding: 'utf-8' })

  try {
    for (let i = 0; i < inputPaths.length; i++) {
      const filePath = inputPaths[i]

      // Write separator between files (not before the first)
      if (i > 0) {
        await writeToStream(writeStream, separator || '\n')
      }

      // Write the optional file header with a trailing newline
      if (includeHeader) {
        await writeToStream(writeStream, `----- ${path.basename(filePath)} -----\n`)
      }

      // Stream the file content to the output
      const readStream = createReadStream(filePath, { encoding: 'utf-8' })
      await pipeline(readStream, writeStream, { end: false })
    }
  } catch (err) {
    writeStream.destroy(err as Error)
    throw err
  }

  // Close the write stream
  await new Promise<void>((resolve, reject) => {
    writeStream.end((err: Error | null | undefined) => {
      if (err) reject(err)
      else resolve()
    })
  })

  return { outputPath, sourceCount: inputPaths.length }
}

function sanitizeFileName(name: string) {
  return name.replace(/[<>:"/\\|?*]+/g, '_').trim()
}
