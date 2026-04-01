/// <reference types="vite/client" />

interface Window {
  // expose in the `electron/preload/index.ts`
  ipcRenderer: import('electron').IpcRenderer
  api: {
    getDefaultOutputDir: () => Promise<string>
    selectOutputDir: () => Promise<string | null>
    selectFile: (payload: {
      title?: string
      filters?: { name: string; extensions: string[] }[]
    }) => Promise<string | null>
    revealInFolder: (targetPath: string) => Promise<void>
    mergePdf: (payload: {
      inputPaths: string[]
      outputDir: string
      outputName: string
    }) => Promise<{ outputPath: string; pageCount: number }>
    splitPdf: (payload: {
      inputPaths: string[]
      outputDir: string
      mode: 'ranges' | 'extract' | 'remove'
      ranges?: string
    }) => Promise<{ outputDir: string; totalOutputs: number; outputs: string[] }>
    rotatePdf: (payload: {
      inputPaths: string[]
      outputDir: string
      rotation: number
      ranges?: string | null
    }) => Promise<{ outputDir: string; totalOutputs: number; outputs: string[] }>
    watermarkPdf: (payload: {
      inputPaths: string[]
      outputDir: string
      type: 'text' | 'image'
      text?: string
      imagePath?: string
      opacity: number
      rotation: number
      size: number
      position: string
    }) => Promise<{ outputDir: string; totalOutputs: number; outputs: string[] }>
    metadataPdf: (payload: {
      inputPaths: string[]
      outputDir: string
      metadata: {
        title?: string | null
        author?: string | null
        subject?: string | null
        keywords?: string | null
        creator?: string | null
      }
    }) => Promise<{ outputDir: string; totalOutputs: number; outputs: string[] }>
    unlockPdf: (payload: {
      inputPaths: string[]
      outputDir: string
      password: string
    }) => Promise<{ outputDir: string; totalOutputs: number; outputs: string[] }>
    compressPdf: (payload: {
      inputPaths: string[]
      outputDir: string
      level: 'low' | 'medium' | 'high'
    }) => Promise<{
      outputDir: string
      inputCount: number
      averageReduction: number
      outputs: string[]
    }>
    convertImages: (payload: {
      inputPaths: string[]
      outputDir: string
      format: 'jpg' | 'png' | 'webp'
      quality: number
      keepTimestamps: boolean
    }) => Promise<{ outputDir: string; totalOutputs: number; outputs: string[] }>
    resizeImages: (payload: {
      inputPaths: string[]
      outputDir: string
      mode: 'percent' | 'width' | 'height' | 'fit'
      percent: number
      width: number
      height: number
      sharpen: boolean
    }) => Promise<{ outputDir: string; totalOutputs: number; outputs: string[] }>
    compressImages: (payload: {
      inputPaths: string[]
      outputDir: string
      quality: number
      format: 'auto' | 'jpg' | 'png' | 'webp'
    }) => Promise<{ outputDir: string; totalOutputs: number; outputs: string[] }>
    imagesToPdf: (payload: {
      inputPaths: string[]
      outputDir: string
      outputName: string
    }) => Promise<{ outputPath: string; pageCount: number }>
    stripExif: (payload: { inputPaths: string[]; outputDir: string }) => Promise<{
      outputDir: string
      totalOutputs: number
      outputs: string[]
    }>
    filterImages: (payload: {
      inputPaths: string[]
      outputDir: string
      filter: 'grayscale' | 'sepia' | 'invert'
    }) => Promise<{
      outputDir: string
      totalOutputs: number
      outputs: string[]
    }>
    renameImages: (payload: {
      outputDir: string
      items: { sourcePath: string; targetName: string }[]
    }) => Promise<{
      outputDir: string
      totalOutputs: number
      outputs: string[]
    }>
    mergeTextFiles: (payload: {
      inputPaths: string[]
      outputDir: string
      outputName: string
      separator: string
      includeHeader: boolean
    }) => Promise<{ outputPath: string; sourceCount: number }>
    organizeFiles: (payload: {
      inputPaths: string[]
      outputDir: string
      rule: 'extension' | 'date'
    }) => Promise<{ count: number; outputDir: string; results: string[] }>
    bulkRename: (payload: {
      outputDir: string
      items: { sourcePath: string; targetName: string }[]
    }) => Promise<{ outputDir: string; totalOutputs: number; outputs: string[] }>
    deleteEmptyFolders: (payload: {
      paths: string[]
      recursive: boolean
    }) => Promise<{
      totalDeleted: number
      totalRemainingEmpty: number
      deleted: string[]
      remainingEmpty: string[]
    }>
    checksumFiles: (payload: {
      inputPaths: string[]
      algorithm: 'md5' | 'sha1' | 'sha256'
    }) => Promise<{
      algorithm: 'md5' | 'sha1' | 'sha256'
      items: { path: string; md5: string; sha1: string; sha256: string }[]
    }>
    scanLargeFiles: (payload: { path: string; thresholdBytes: number }) => Promise<
      { path: string; size: number }[]
    >
    processArchive: (payload: { mode: 'zip' | 'unzip'; sources: string[]; outputPath: string }) => Promise<{
      mode: 'zip' | 'unzip'
      outputPath: string
      count: number
    }>
  }
}
