import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'

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

export async function checksumFiles({ inputPaths, algorithm }: ChecksumPayload) {
  if (!inputPaths.length) throw new Error('No files provided.')

  const items = []

  for (const filePath of inputPaths) {
    const buffer = await fs.readFile(filePath)
    const hash = createHash(algorithm).update(buffer).digest('hex')
    items.push({ path: filePath, [algorithm]: hash })
  }

  return { algorithm, items }
}

export async function processSecurity({ mode, file, password, output }: SecurityProcessPayload) {
  if (mode === 'encrypt') {
    const salt = randomBytes(16)
    const iv = randomBytes(12)
    const key = scryptSync(password, salt, 32)
    
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const input = await fs.readFile(file)
    const encrypted = Buffer.concat([cipher.update(input), cipher.final()])
    const tag = cipher.getAuthTag()
    
    // Structure: salt(16) + iv(12) + tag(16) + data
    await fs.writeFile(output, Buffer.concat([salt, iv, tag, encrypted]))
    return { success: true, path: output }
  } else {
    const encryptedFile = await fs.readFile(file)
    const salt = encryptedFile.subarray(0, 16)
    const iv = encryptedFile.subarray(16, 28)
    const tag = encryptedFile.subarray(28, 44)
    const encrypted = encryptedFile.subarray(44)
    
    const key = scryptSync(password, salt, 32)
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
    
    await fs.writeFile(output, decrypted)
    return { success: true, path: output }
  }
}
