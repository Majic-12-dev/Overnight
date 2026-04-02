import * as yauzl from 'yauzl'
import { Readable } from 'node:stream'
import archiver from 'archiver'
import type { ArchiverError } from 'archiver'
import { createWriteStream, promises as fs } from 'node:fs'
import path from 'node:path'
import { ensureDir } from '../utils/fs'
import { validatePaths } from '../utils/pathValidation'

// ─── Zip-bomb / resource limits ─── R8 ───
// Sensible defaults: max 10 000 entries, max 1 GB total uncompressed size.
export const DEFAULT_MAX_ENTRIES = 10_000
export const DEFAULT_MAX_TOTAL_SIZE = 1_073_741_824 // 1 GiB in bytes

// ─── Unix file-type mask constants (upper 16 bits of externalFileAttributes) ───
// Extracted from the POSIX spec – used for symlink detection (R2) and chmod (R4).
const UNIX_FILE_TYPE_MASK = 0o170000 // S_IFMT
const UNIX_SYMLINK_TYPE = 0o120000   // S_IFLNK

interface YauzlEntry {
  fileName: string
  // R2 / R4 — these fields are needed for symlink detection and permission preservation
  compressedSize: number
  uncompressedSize: number
  externalFileAttributes: number
}

interface YauzlZipFile {
  readEntry(callback: (err: Error | null, entry: YauzlEntry | null) => void): void
  close(): void
  openReadStream(
    entry: YauzlEntry,
    callback: (err: Error | null, stream: Readable) => void
  ): void
}

/** Copy directory tree when rename would fail with EXDEV (cross-volume) — R7 fallback */
async function copyDirRecursively(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true })
  const entries = await fs.readdir(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      await copyDirRecursively(srcPath, destPath)
    } else {
      await fs.copyFile(srcPath, destPath)
    }
  }
}

export type ProcessArchivePayload = {
  mode: 'zip' | 'unzip'
  sources: string[]
  outputPath: string
}

export async function processArchive({ mode, sources, outputPath }: ProcessArchivePayload) {
  if (!sources.length) throw new Error('No files provided.')

  if (mode === 'zip') {
    // Ensure output path ends with .zip
    let finalOutputPath = outputPath
    if (!finalOutputPath.toLowerCase().endsWith('.zip')) {
      finalOutputPath += '.zip'
    }

    // Validate paths before any file operations
    validatePaths(sources, finalOutputPath)

    // Ensure output directory exists
    await ensureDir(path.dirname(finalOutputPath))

    const output = createWriteStream(finalOutputPath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    // Log warnings but do not fail
    archive.on('warning', (err: ArchiverError) => {
      console.warn('Archive warning:', err)
    })

    await new Promise<void>((resolve, reject) => {
      const cleanup = async (): Promise<void> => {
        output.destroy()
        archive.destroy()
        await fs.unlink(finalOutputPath).catch(() => {})
      }

      const onError = (err: unknown) => {
        cleanup().catch(() => {})
        if (err instanceof Error) reject(err)
        else reject(new Error(String(err)))
      }

      archive.on('error', onError)
      output.on('error', onError)

      output.on('close', () => {
        resolve()
      })

      archive.pipe(output)

      // Add files and finalize asynchronously
      ;(async () => {
        try {
          for (const source of sources) {
            const stats = await fs.stat(source)
            if (stats.isDirectory()) {
              archive.directory(source, path.basename(source))
            } else {
              archive.file(source, { name: path.basename(source) })
            }
          }
          archive.finalize()
        } catch (error: unknown) {
          cleanup().catch(() => {})
          if (error instanceof Error) reject(error)
          else reject(new Error(String(error)))
        }
      })()
    })

    return { outputPath: finalOutputPath, count: sources.length }
  } else {
    // Unzip mode with streaming extraction
    if (sources.length !== 1) throw new Error('Only one zip file can be unzipped at a time.')
    const source = sources[0]

    // Validate paths before extraction
    validatePaths(source, outputPath)

    // Ensure parent directory of output exists
    await ensureDir(path.dirname(outputPath))

    // Promisified helpers
    const openZip = (p: string): Promise<YauzlZipFile> =>
      new Promise((resolve, reject) => {
        yauzl.open(p, { lazyEntries: true }, (err, zip) =>
          err
            ? reject(new Error(`Failed to open zip file: ${err?.message}`))
            : resolve(zip as unknown as YauzlZipFile)
        )
      })

    const readNextEntry = (zip: YauzlZipFile): Promise<YauzlEntry | null> =>
      new Promise((resolve, reject) => {
        zip.readEntry((err: Error | null, entry: YauzlEntry | null) =>
          err
            ? reject(new Error(`Failed to read zip entry: ${err?.message}`))
            : resolve(entry)
        )
      })

    const openEntryStream = (zip: YauzlZipFile, entry: YauzlEntry): Promise<Readable> =>
      new Promise((resolve, reject) => {
        zip.openReadStream(entry, (err: Error | null, stream: Readable) =>
          err
            ? reject(new Error(`Failed to open entry stream: ${err?.message}`))
            : resolve(stream)
        )
      })

    // Declare tempDir and zip for scoping
    let tempDir: string | null = null
    let zip: YauzlZipFile | null = null

    try {
      // Open zip and create temp dir after successful open
      zip = await openZip(source)
      tempDir = await fs.mkdtemp(path.join(path.dirname(outputPath), '.tmp-'))

      let entriesExtracted = 0
      let cumulativeUncompressedSize = 0

      // ─── R8 limits ───
      const maxEntries = DEFAULT_MAX_ENTRIES
      const maxTotalSize = DEFAULT_MAX_TOTAL_SIZE

      while (true) {
        // R8 — entry count guard before processing each entry
        if (entriesExtracted >= maxEntries) {
          throw new Error(`Maximum entry count exceeded (${maxEntries}). Possible zip bomb.`)
        }

        const entry = await readNextEntry(zip)
        if (!entry) break

        const fileName = entry.fileName

        // ─── R8 — cumulative uncompressed size guard ───
        cumulativeUncompressedSize += entry.uncompressedSize ?? 0
        if (cumulativeUncompressedSize > maxTotalSize) {
          throw new Error(
            `Maximum total uncompressed size exceeded (${maxTotalSize} bytes). Possible zip bomb.`
          )
        }

        // ─── R1 — null byte injection check ───
        if (fileName.includes('\0')) {
          throw new Error(`Null byte in entry path: ${fileName}`)
        }

        // ─── Existing zip-slip defence ───
        if (path.isAbsolute(fileName)) {
          throw new Error(`Invalid entry path (absolute): ${fileName}`)
        }
        const normalized = path.normalize(fileName)
        const segments = normalized.split(path.sep)
        if (segments.includes('..')) {
          throw new Error(`Invalid entry path (contains '..' segment): ${fileName}`)
        }
        const targetPath = path.join(tempDir, normalized)
        try {
          const resolvedTarget = path.resolve(targetPath)
          const resolvedTemp = path.resolve(tempDir)
          if (
            !resolvedTarget.startsWith(resolvedTemp + path.sep) &&
            resolvedTarget !== resolvedTemp
          ) {
            throw new Error(`Entry path traversal attempt: ${fileName}`)
          }
        } catch {
          throw new Error(`Invalid entry path: ${fileName}`)
        }

        // ─── R2 — symlink detection and rejection ───
        // Unix file type is stored in the upper 16 bits of externalFileAttributes.
        const unixFileType = (entry.externalFileAttributes >>> 16) & UNIX_FILE_TYPE_MASK
        if (unixFileType === UNIX_SYMLINK_TYPE) {
          throw new Error(`Symlink entries are not allowed for security reasons: ${fileName}`)
        }

        // ─── R3 — directory detection (ZIP spec mandates forward slashes only) ───
        if (fileName.endsWith('/')) {
          await fs.mkdir(targetPath, { recursive: true })
        } else {
          // File extraction
          const readStream = await openEntryStream(zip, entry)
          // Ensure parent dir exists
          await fs.mkdir(path.dirname(targetPath), { recursive: true })
          const writeStream = createWriteStream(targetPath)
          let settled = false

          await new Promise<void>((resolve, reject) => {
            // R5 — attach readStream.on('error') BEFORE writeStream.on('error')
            // so both handlers are registered before the pipe establishes,
            // eliminating a narrow race where writeStream errors synchronously.
            readStream.on('error', (err) => {
              if (settled) return
              settled = true
              writeStream.destroy()
              readStream.destroy()
              reject(new Error(`Failed to read ${fileName}: ${err.message}`))
            })

            writeStream.on('error', (err) => {
              if (settled) return
              settled = true
              writeStream.destroy()
              readStream.destroy()
              reject(new Error(`Failed to write ${fileName}: ${err.message}`))
            })

            writeStream.on('finish', () => {
              if (settled) return
              settled = true
              resolve()
            })

            readStream.pipe(writeStream)
          })

          // R4 — preserve file permissions from the archive
          const unixMode = (entry.externalFileAttributes >>> 16) & 0o777
          if (unixMode > 0) {
            await fs.chmod(targetPath, unixMode)
          }

          entriesExtracted++
        }
      }

      // ─── Atomic replace with cross-volume fallback — R7 ───
      await fs.rm(outputPath, { recursive: true, force: true })
      try {
        await fs.rename(tempDir, outputPath)
      } catch (renameErr: unknown) {
        const code = renameErr instanceof Error && 'code' in renameErr ? (renameErr as NodeJS.ErrnoException).code : undefined
        if (code === 'EXDEV') {
          // Cross-volume rename not supported — copy recursively then remove temp
          await copyDirRecursively(tempDir, outputPath)
          await fs.rm(tempDir, { recursive: true, force: true })
        } else {
          throw renameErr
        }
      }

      return { outputPath, count: entriesExtracted }
    } catch (error) {
      if (tempDir) {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
      }
      throw error
    } finally {
      if (zip) zip.close()
    }
  }
}
