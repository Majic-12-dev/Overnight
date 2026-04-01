import { promises as fs } from 'node:fs'
import path from 'node:path'
import { ensureDir } from '../utils/fs'

export type BulkRenamePayload = {
  outputDir: string
  items: { sourcePath: string; targetName: string }[]
}

export async function bulkRename({ outputDir, items }: BulkRenamePayload) {
  if (!items.length) throw new Error('No files provided.')
  await ensureDir(outputDir)

  const outputs: string[] = []

  for (const item of items) {
    const safeName = sanitizeFileName(item.targetName)
    const targetPath = await uniquePath(path.join(outputDir, safeName))
    await fs.copyFile(item.sourcePath, targetPath)
    outputs.push(targetPath)
  }

  return { outputDir, totalOutputs: outputs.length, outputs }
}

export type DeleteEmptyFoldersPayload = {
  paths: string[]
  recursive: boolean
}

/**
 * Recursively scans directories and deletes empty folders.
 * @param payload - The directories to scan and options
 * @returns Object with counts of deleted folders and remaining empty folders
 */
export async function deleteEmptyFolders({ paths, recursive }: DeleteEmptyFoldersPayload) {
  if (!paths.length) {
    throw new Error('No directories provided.')
  }

  // Validate all directories exist and are directories
  for (const dirPath of paths) {
    try {
      const stats = await fs.stat(dirPath)
      if (!stats.isDirectory()) {
        throw new Error(`'${dirPath}' is not a directory.`)
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Cannot access '${dirPath}': ${error.message}`)
      }
      throw error
    }
  }

  // Collect all directories to scan
  const allDirs: string[] = []
  for (const root of paths) {
    if (recursive) {
      const dirs = await listAllDirectories(root)
      allDirs.push(...dirs)
    } else {
      allDirs.push(root)
    }
  }

  // Sort directories by depth (deepest first) so we delete children before parents
  allDirs.sort((a, b) => {
    const depthA = a.split(path.sep).length
    const depthB = b.split(path.sep).length
    return depthB - depthA
  })

  const deleted: string[] = []
  const remainingEmpty: string[] = []

  for (const dir of allDirs) {
    try {
      const isEmpty = await isDirectoryEmpty(dir)
      if (isEmpty) {
        await fs.rmdir(dir)
        deleted.push(dir)
      } else {
        remainingEmpty.push(dir)
      }
    } catch (error) {
      // Skip directories that can't be accessed
      console.error(`Failed to process '${dir}':`, error)
    }
  }

  // If recursive, we may need to re-check parents of deleted folders
  // But since we sorted by depth deepest first, deleting a child doesn't
  // automatically make parent empty check valid in same pass because
  // parent might have other children. We'll just report what we deleted.
  
  return {
    totalDeleted: deleted.length,
    totalRemainingEmpty: remainingEmpty.length,
    deleted,
    remainingEmpty,
  }
}

/**
 * Recursively lists all directories under a root path.
 */
async function listAllDirectories(root: string): Promise<string[]> {
  const dirs: string[] = []
  const stack: string[] = [root]

  while (stack.length) {
    const current = stack.pop()!
    dirs.push(current)

    try {
      const entries = await fs.readdir(current, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory()) {
          stack.push(path.join(current, entry.name))
        }
      }
    } catch {
      // Permission errors or non-existent dirs are skipped
    }
  }

  return dirs
}

/**
 * Checks if a directory is empty (no files, no subdirectories).
 */
async function isDirectoryEmpty(dirPath: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(dirPath)
    return entries.length === 0
  } catch {
    // If we can't read the directory, treat it as not empty to be safe
    return false
  }
}

function sanitizeFileName(name: string) {
  return name.replace(/[<>:\"/\\|?*]+/g, '_').trim()
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

export type ScanLargeFilesPayload = {
  path: string
  thresholdBytes: number
}

export async function scanLargeFiles({ path: rootPath, thresholdBytes }: ScanLargeFilesPayload) {
  const files: { path: string; size: number }[] = []
  const stack: string[] = [rootPath]

  while (stack.length) {
    const current = stack.pop()!

    try {
      const entries = await fs.readdir(current, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(current, entry.name)
        if (entry.isDirectory()) {
          stack.push(fullPath)
        } else if (entry.isFile()) {
          const stats = await fs.stat(fullPath)
          if (stats.size >= thresholdBytes) {
            files.push({ path: fullPath, size: stats.size })
          }
        }
      }
    } catch {
      // Permission errors or non-existent dirs are skipped
    }
  }
  return files
}
