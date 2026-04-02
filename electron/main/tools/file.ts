import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
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

function sanitizeFileName(name: string): string {
  if (name.includes('\0')) {
    throw new Error('Invalid file name: contains null byte')
  }
  // Strip leading dots (hidden/traversal protection)
  name = name.replace(/^\.+/, '')
  // Replace invalid characters
  name = name.replace(/[<>:\"/\\|?*]+/g, '_')
  // Trim whitespace
  name = name.trim()
  // Ensure non-empty
  if (!name) {
    name = 'file'
  }
  return name
}

async function uniquePath(targetPath: string, maxAttempts: number = 1000): Promise<string> {
  const parsed = path.parse(targetPath)
  let attempt = 0
  let candidate = targetPath
  while (true) {
    try {
      await fs.access(candidate)
      attempt += 1
      if (attempt >= maxAttempts) {
        throw new Error(`Maximum attempts (${maxAttempts}) exceeded for generating unique path for ${targetPath}`)
      }
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
  const visited = new Set<string>()

  while (stack.length) {
    const current = stack.pop()!

    try {
      const realPath = await fs.realpath(current)
      if (visited.has(realPath)) {
        continue
      }
      visited.add(realPath)

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

export type OrganizeFilesPayload = {
  inputPaths: string[]
  outputDir: string
  rule: 'extension' | 'date'
}

export async function organizeFiles({ inputPaths, outputDir, rule }: OrganizeFilesPayload) {
  if (!inputPaths.length) throw new Error('No files provided.')

  const results: string[] = []

  for (const sourcePath of inputPaths) {
    try {
      // Validate file exists
      const stats = await fs.stat(sourcePath)
      if (!stats.isFile()) {
        continue // skip directories
      }

      // Determine target subdirectory
      let subDir: string
      if (rule === 'extension') {
        const ext = getExtension(sourcePath)
        subDir = categorizeByExtension(ext)
      } else {
        subDir = categorizeByDate(stats.mtimeMs)
      }

      // Build final output path
      const targetDir = path.join(outputDir, subDir)
      await ensureDir(targetDir)

      const fileName = path.basename(sourcePath)
      const targetPath = await uniquePath(path.join(targetDir, fileName))

      // Move file
      await fs.copyFile(sourcePath, targetPath)
      results.push(targetPath)
    } catch (error) {
      console.error(`Failed to organize '${sourcePath}':`, error)
      // Continue with next file
    }
  }

  if (results.length === 0) {
    throw new Error('No files were successfully organized.')
  }

  return { count: results.length, outputDir, results }
}

export type DeleteFilesPayload = {
  items: { sourcePath: string }[]
  trashBaseDir: string
}

export type DeleteFileResult = {
  sourcePath: string
  success: boolean
  error?: string
  quarantinedPath?: string
}

export async function deleteFiles(
  { items }: { items: { sourcePath: string }[] },
  trashBaseDir: string
): Promise<{ results: DeleteFileResult[] }> {
  if (!items.length) {
    throw new Error('No files provided.')
  }

  // Create timestamped quarantine directory
  const now = new Date()
  const timestampStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`

  const trashDir = path.join(trashBaseDir, timestampStr)
  await ensureDir(trashDir)

  const results: DeleteFileResult[] = []

  for (const item of items) {
    const { sourcePath } = item
    try {
      // Check if file exists and is a file, with error categorization
      try {
        const stats = await fs.stat(sourcePath)
        if (!stats.isFile()) {
          results.push({ sourcePath, success: false, error: 'Not a file or does not exist' })
          continue
        }
      } catch (statError) {
        // Categorize errors from stat
        let errorMessage: string
        if (statError instanceof Error) {
          const nodeError = statError as NodeJS.ErrnoException
          if (nodeError.code === 'ENOENT') {
            errorMessage = 'File not found'
          } else if (nodeError.code === 'EACCES' || nodeError.code === 'EPERM') {
            errorMessage = 'Permission denied'
          } else {
            errorMessage = statError.message
          }
        } else {
          errorMessage = String(statError)
        }
        results.push({ sourcePath, success: false, error: errorMessage })
        continue
      }

      // Compute target path
      const fileName = path.basename(sourcePath)
      const safeName = sanitizeFileName(fileName)
      const targetPath = await uniquePath(path.join(trashDir, safeName))

      // Check if source and target are the same file (after resolving)
      const resolvedSource = path.resolve(sourcePath)
      const resolvedTarget = path.resolve(targetPath)
      if (resolvedSource === resolvedTarget) {
        // Already in quarantine? Treat as success without operation.
        results.push({ sourcePath, success: true, quarantinedPath: targetPath })
        continue
      }

      // Attempt rename, with EXDEV fallback
      try {
        await fs.rename(sourcePath, targetPath)
      } catch (renameError) {
        if (renameError instanceof Error && 'code' in renameError && renameError.code === 'EXDEV') {
          await fs.copyFile(sourcePath, targetPath)
          await fs.unlink(sourcePath)
        } else {
          throw renameError
        }
      }

      results.push({ sourcePath, success: true, quarantinedPath: targetPath })
    } catch (error) {
      // Any other error during file operations
      const errorMessage = error instanceof Error ? error.message : String(error)
      results.push({ sourcePath, success: false, error: errorMessage })
    }
  }

  return { results }
}

function getExtension(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  return ext.slice(1) // remove leading dot
}

function categorizeByExtension(ext: string): string {
  // Map extensions to friendly folder names
  const extensionMap: Record<string, string> = {
    // Images
    jpg: 'Images', jpeg: 'Images', png: 'Images', gif: 'Images', webp: 'Images', tiff: 'Images', tif: 'Images', bmp: 'Images', ico: 'Images', svg: 'Images',
    // Documents
    pdf: 'Documents', doc: 'Documents', docx: 'Documents', txt: 'Documents', rtf: 'Documents', odt: 'Documents',
    // Spreadsheets
    xls: 'Spreadsheets', xlsx: 'Spreadsheets', csv: 'Spreadsheets', ods: 'Spreadsheets',
    // Presentations
    ppt: 'Presentations', pptx: 'Presentations', key: 'Presentations', odp: 'Presentations',
    // Videos
    mp4: 'Videos', mov: 'Videos', avi: 'Videos', mkv: 'Videos', wmv: 'Videos', flv: 'Videos', webm: 'Videos',
    // Audio
    mp3: 'Audio', wav: 'Audio', flac: 'Audio', aac: 'Audio', ogg: 'Audio',
    // Archives
    zip: 'Archives', rar: 'Archives', '7z': 'Archives', tar: 'Archives', gz: 'Archives',
    // Code
    js: 'Code', ts: 'Code', jsx: 'Code', tsx: 'Code', py: 'Code', java: 'Code', c: 'Code', cpp: 'Code', cs: 'Code', php: 'Code', rb: 'Code', go: 'Code', rs: 'Code',
    // Data
    json: 'Data', xml: 'Data', yml: 'Data', yaml: 'Data',
  }

  return extensionMap[ext] || 'Other'
}

export type ShredFilesPayload = {
  inputPaths: string[]
  passes: 3 | 7 | 35
  verify: boolean
}

export type ShredFilesResult = {
  filesProcessed: number
  bytesOverwritten: number
  verificationPassed: boolean
  errors: string[]
}

export async function shredFiles({
  inputPaths,
  passes,
  verify,
}: ShredFilesPayload): Promise<ShredFilesResult> {
  if (!inputPaths.length) {
    throw new Error('No files provided.')
  }

  const errors: string[] = []
  let filesProcessed = 0
  let bytesOverwritten = 0

  // File size chunk for streaming: 1 MB chunks
  const CHUNK_SIZE = 1024 * 1024

  for (const filePath of inputPaths) {
    try {
      const stats = await fs.stat(filePath)
      if (!stats.isFile()) {
        errors.push(`'${filePath}' is not a file.`)
        continue
      }

      const fileSize = stats.size

      // Overwrite file contents N times with random bytes
      const fd = await fs.open(filePath, 'r+')

      for (let pass = 0; pass < passes; pass++) {
        let offset = 0
        while (offset < fileSize) {
          const writeSize = Math.min(CHUNK_SIZE, fileSize - offset)
          const randomData = randomBytes(writeSize)
          await fd.write(randomData, 0, writeSize, offset)
          offset += writeSize
        }
        // Ensure data hits the disk
        await fd.sync()
      }

      await fd.close()
      bytesOverwritten += fileSize * passes

      // Delete the file
      await fs.unlink(filePath)

      // Verify file no longer exists
      if (verify) {
        try {
          await fs.access(filePath)
          errors.push(`Verification failed: '${filePath}' still exists after deletion.`)
          continue
        } catch {
          // Expected: file should not be accessible
        }
      }

      filesProcessed++
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`Failed to shred '${filePath}': ${message}`)
    }
  }

  const verificationPassed = verify && errors.length === 0

  return {
    filesProcessed,
    bytesOverwritten,
    verificationPassed: verify ? verificationPassed : true,
    errors,
  }
}

function categorizeByDate(timestampMs: number): string {
  const date = new Date(timestampMs)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}/${month}`
}