import { createCipheriv, createDecipheriv, randomBytes, scrypt as scryptCallback, createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { createReadStream, createWriteStream, constants as fsConstants } from 'node:fs'
import { pipeline } from 'stream/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)

// Streaming format version: includes version byte for unambiguous autodetection
const VERSION_BYTE = 0x02

export type ChecksumPayload = {
  inputPaths: string[]
  algorithm: 'md5' | 'sha1' | 'sha256'
}

export type SecurityProcessPayload = {
  mode: 'encrypt' | 'decrypt'
  file: string
  password: string
  output: string
}

interface ChecksumItem {
  path: string
  [key: string]: string
}

// Prevent in-place overwrites: ensure input and output are different files
function validatePaths(input: string, output: string) {
  const resolvedInput = path.resolve(input)
  const resolvedOutput = path.resolve(output)
  if (resolvedInput === resolvedOutput) {
    throw new Error('Input and output paths must be different to prevent data loss.')
  }
}

export async function checksumFiles({ inputPaths, algorithm }: ChecksumPayload) {
  if (!inputPaths.length) throw new Error('No files provided.')
  const items: ChecksumItem[] = []
  for (const filePath of inputPaths) {
    const hash = createHash(algorithm)
    const stream = createReadStream(filePath)
    try {
      for await (const chunk of stream) {
        hash.update(chunk)
      }
      items.push({ path: filePath, [algorithm]: hash.digest('hex') })
    } catch (err) {
      stream.destroy()
      throw err
    }
  }
  return { algorithm, items }
}

export async function processSecurity({ mode, file, password, output }: SecurityProcessPayload) {
  validatePaths(file, output)

  if (mode === 'encrypt') {
    const salt = randomBytes(16)
    const iv = randomBytes(12)
    // Async key derivation to avoid blocking event loop
    const key = (await scrypt(password, salt, 32)) as Buffer
    const cipher = createCipheriv('aes-256-gcm', key, iv)

    const versionBuf = Buffer.from([VERSION_BYTE])
    // Authenticate header (version + salt + iv) via AAD in parts
    ;(cipher as any).updateAAD(versionBuf)
    ;(cipher as any).updateAAD(salt)
    ;(cipher as any).updateAAD(iv)

    const inputStream = createReadStream(file)
    // Write to temporary file first for atomicity
    const tempOutput = output + '.tmp.' + randomBytes(8).toString('hex')
    const outputStream = createWriteStream(tempOutput)

    // Attach error listener immediately to catch write failures
    const errorPromise = new Promise<void>((_, reject) => {
      outputStream.on('error', reject)
    })

    try {
      // Write header with error handling
      if (!outputStream.write(versionBuf)) {
        await new Promise<void>((resolve) => outputStream.once('drain', resolve))
      }
      if (!outputStream.write(salt)) {
        await new Promise<void>((resolve) => outputStream.once('drain', resolve))
      }
      if (!outputStream.write(iv)) {
        await new Promise<void>((resolve) => outputStream.once('drain', resolve))
      }

      // Stream data through cipher into output
      await pipeline(inputStream, cipher, outputStream)

      // Ensure outputStream closed before appending tag
      await new Promise<void>((resolve, reject) => {
        outputStream.once('close', resolve)
        outputStream.once('error', reject)
      })

      // Append auth tag after ciphertext (streaming-friendly)
      const tag = cipher.getAuthTag()
      await fs.appendFile(tempOutput, tag)

      // fsync to guarantee data durability
      const fd = await fs.open(tempOutput, fsConstants.O_RDWR)
      await fd.sync()
      await fd.close()

      // Atomic rename to final output
      await fs.rename(tempOutput, output)
      return { success: true, path: output }
    } catch (err) {
      // Explicit cleanup
      try { inputStream.destroy() } catch {}
      try { outputStream.destroy() } catch {}
      await fs.unlink(tempOutput).catch(() => {})
      throw err
    } finally {
      // Suppress unhandled rejection from errorPromise if already handled
      errorPromise.catch(() => {})
    }
  } else {
    // Decryption: use stat to get file size
    const stats = await fs.stat(file)

    // Read first byte safely with guaranteed close
    let firstByte: Buffer
    let vfd: any
    try {
      vfd = await fs.open(file, 'r')
      firstByte = Buffer.alloc(1)
      await vfd.read(firstByte, 0, 1, 0)
    } finally {
      if (vfd) await vfd.close()
    }
    const version = firstByte[0]

    // Try new streaming format (VERSION_BYTE)
    async function tryNewFormat(): Promise<boolean> {
      let hfd: any, tfd: any, inStream: any, outStream: any
      try {
        if (stats.size < 29 + 16) throw new Error('File too small for new format.')
        // Read full header: version(1) + salt(16) + iv(12)
        const hdr = Buffer.alloc(29)
        hfd = await fs.open(file, 'r')
        await hfd.read(hdr, 0, 29, 0)
        await hfd.close()
        hfd = undefined

        if (hdr[0] !== VERSION_BYTE) return false
        const salt = hdr.subarray(1, 17)
        const iv = hdr.subarray(17, 29)
        const key = (await scrypt(password, salt, 32)) as Buffer

        // Read tag from EOF
        const tag = Buffer.alloc(16)
        tfd = await fs.open(file, 'r')
        await tfd.read(tag, 0, 16, stats.size - 16)
        await tfd.close()
        tfd = undefined

        const decipher = createDecipheriv('aes-256-gcm', key, iv)
        decipher.setAuthTag(tag)
        ;(decipher as any).updateAAD(hdr) // authenticate header

        // Ciphertext: after header (29) up to before tag (exclusive end specified as -1)
        const inStream = createReadStream(file, { start: 29, end: stats.size - 16 - 1 })
        const outStream = createWriteStream(output)
        await pipeline(inStream, decipher, outStream)
        return true
      } catch {
        await fs.unlink(output).catch(() => {})
        return false
      } finally {
        if (hfd) await hfd.close().catch(() => {})
        if (tfd) await tfd.close().catch(() => {})
        if (inStream) inStream.destroy()
        if (outStream) outStream.destroy()
      }
    }

    // Try legacy format (no version)
    async function tryLegacy(): Promise<boolean> {
      let hfd: any, inStream: any, outStream: any
      try {
        if (stats.size < 44) throw new Error('File too small for legacy format.')
        const legacyHeader = Buffer.alloc(44)
        hfd = await fs.open(file, 'r')
        await hfd.read(legacyHeader, 0, 44, 0)
        await hfd.close()
        hfd = undefined

        const salt = legacyHeader.subarray(0, 16)
        const iv = legacyHeader.subarray(16, 28)
        const tag = legacyHeader.subarray(28, 44)
        const key = (await scrypt(password, salt, 32)) as Buffer
        const decipher = createDecipheriv('aes-256-gcm', key, iv)
        decipher.setAuthTag(tag)
        // Legacy does not use AAD

        const inStream = createReadStream(file, { start: 44 })
        const outStream = createWriteStream(output)
        await pipeline(inStream, decipher, outStream)
        return true
      } catch {
        await fs.unlink(output).catch(() => {})
        return false
      } finally {
        if (hfd) await hfd.close().catch(() => {})
        if (inStream) inStream.destroy()
        if (outStream) outStream.destroy()
      }
    }

    // Decision based on version byte presence
    if (version === VERSION_BYTE) {
      if (await tryNewFormat()) return { success: true, path: output }
      if (await tryLegacy()) return { success: true, path: output }
      throw new Error('Decryption failed: invalid password or corrupted file.')
    } else {
      if (await tryLegacy()) return { success: true, path: output }
      if (await tryNewFormat()) return { success: true, path: output }
      throw new Error('Decryption failed: invalid password or corrupted file.')
    }
  }
}
