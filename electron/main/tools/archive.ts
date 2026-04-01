import AdmZip from 'adm-zip'
import archiver from 'archiver'
import type { ArchiverError } from 'archiver'
import { createWriteStream, promises as fs } from 'node:fs'
import path from 'node:path'
import { ensureDir } from '../utils/fs'

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
    
    // Ensure output directory exists
    await ensureDir(path.dirname(finalOutputPath))
    
    const output = createWriteStream(finalOutputPath)
    const archive = archiver('zip', { zlib: { level: 9 } })
    
    // Cleanup helper - destroy streams and delete partial file
    const cleanup = async (): Promise<void> => {
      output.destroy()
      archive.destroy()
      await fs.unlink(finalOutputPath).catch(() => {})
    }
    
    // Attach error listeners immediately, before any async operations
    const handleStreamError = (err: unknown) => {
      cleanup().catch(() => {})
      if (err instanceof Error) throw err
      throw new Error(String(err))
    }
    
    archive.on('error', handleStreamError)
    output.on('error', handleStreamError)
    
    // Log warnings but do not fail
    archive.on('warning', (err: ArchiverError) => {
      console.warn('Archive warning:', err)
    })
    
    // Pipe archive to the output stream
    archive.pipe(output)
    
    try {
      // Add files and directories to the archive
      for (const source of sources) {
        const stats = await fs.stat(source)
        if (stats.isDirectory()) {
          archive.directory(source, path.basename(source))
        } else {
          archive.file(source, { name: path.basename(source) })
        }
      }
      
      // Finalize and wait for the output to close
      await new Promise<void>((resolve, reject) => {
        archive.on('error', reject)
        output.on('error', reject)
        output.on('close', resolve)
        archive.finalize()
      })
    } catch (error: unknown) {
      // Ensure cleanup on any error (including fs.stat, archive.file/directory, finalize)
      await cleanup()
      if (error instanceof Error) throw error
      throw new Error(String(error))
    }
    
    return { outputPath: finalOutputPath, count: sources.length }
  } else {
    // Unzip mode (unchanged)
    if (sources.length !== 1) throw new Error('Only one zip file can be unzipped at a time.')
    const source = sources[0]
    
    await ensureDir(outputPath)
    const zip = new AdmZip(source)
    zip.extractAllTo(outputPath, true /* overwrite */)
    
    return { outputPath, count: 1 }
  }
}