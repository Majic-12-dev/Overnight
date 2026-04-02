import AdmZip from 'adm-zip'
import archiver from 'archiver'
import type { ArchiverError } from 'archiver'
import { createWriteStream, promises as fs } from 'node:fs'
import path from 'node:path'
import { ensureDir } from '../utils/fs'

function validatePaths(input: string | string[], output: string): void {
  const resolvedOutput = path.resolve(output)
  const inputs = Array.isArray(input) ? input : [input]

  for (const singleInput of inputs) {
    const resolvedInput = path.resolve(singleInput)

    if (resolvedInput === resolvedOutput) {
      throw new Error(`Input path equals output path: ${singleInput}`)
    }

    // Check if output is inside input
    try {
      const rel = path.relative(resolvedInput, resolvedOutput)
      // If rel is non-empty and doesn't start with '..', output is a descendant of input
      if (rel && !rel.startsWith('..')) {
        throw new Error(`Output path is inside input path: ${output} is inside ${singleInput}`)
      }
    } catch (e) {
      // path.relative throws if paths are on different drives (Windows); ignore as they cannot be contained.
    }

    // Check if input is inside output
    try {
      const rel = path.relative(resolvedOutput, resolvedInput)
      if (rel && !rel.startsWith('..')) {
        throw new Error(`Input path is inside output path: ${singleInput} is inside ${output}`)
      }
    } catch (e) {
      // ignore cross-drive errors
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
    // Unzip mode
    if (sources.length !== 1) throw new Error('Only one zip file can be unzipped at a time.')
    const source = sources[0]
    
    // Validate paths before extraction
    validatePaths(source, outputPath)
    
    await ensureDir(outputPath)
    const zip = new AdmZip(source)
    zip.extractAllTo(outputPath, true /* overwrite */)
    
    return { outputPath, count: 1 }
  }
}