import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },
})

contextBridge.exposeInMainWorld('api', {
  getDefaultOutputDir: () => ipcRenderer.invoke('app:get-default-output-dir'),
  selectOutputDir: () => ipcRenderer.invoke('app:select-output-dir'),
  selectFile: (payload: { title?: string; filters?: { name: string; extensions: string[] }[] }) =>
    ipcRenderer.invoke('app:select-file', payload),
  revealInFolder: (targetPath: string) => ipcRenderer.invoke('app:reveal-path', targetPath),
  mergePdf: (payload: { inputPaths: string[]; outputDir: string; outputName: string }) =>
    ipcRenderer.invoke('pdf:merge', payload),
  splitPdf: (payload: {
    inputPaths: string[]
    outputDir: string
    mode: 'ranges' | 'extract' | 'remove'
    ranges?: string
  }) => ipcRenderer.invoke('pdf:split', payload),
  rotatePdf: (payload: {
    inputPaths: string[]
    outputDir: string
    rotation: number
    ranges?: string | null
  }) => ipcRenderer.invoke('pdf:rotate', payload),
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
  }) => ipcRenderer.invoke('pdf:watermark', payload),
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
  }) => ipcRenderer.invoke('pdf:metadata', payload),
  unlockPdf: (payload: { inputPaths: string[]; outputDir: string; password: string }) =>
    ipcRenderer.invoke('pdf:unlock', payload),
  encryptPdf: (payload: {
    inputPaths: string[]
    outputDir: string
    userPassword?: string
    ownerPassword?: string
    permissions: {
      print: boolean
      modify: boolean
      copy: boolean
      annotate: boolean
      form: boolean
    }
  }) => ipcRenderer.invoke('pdf:encrypt', payload),
  pdfToImages: (payload: {
    inputPaths: string[]
    outputDir: string
    format: 'png' | 'jpg'
    quality: number
    dpi: number
    pageRange?: string
  }) => ipcRenderer.invoke('pdf:to-images', payload),
  compressPdf: (payload: { inputPaths: string[]; outputDir: string; level: 'low' | 'medium' | 'high' }) =>
    ipcRenderer.invoke('pdf:compress', payload),
  repairPdf: (payload: { inputPaths: string[]; outputDir: string }) =>
    ipcRenderer.invoke('pdf:repair', payload),
  convertImages: (payload: {
    inputPaths: string[]
    outputDir: string
    format: 'jpg' | 'png' | 'webp'
    quality: number
    keepTimestamps: boolean
  }) => ipcRenderer.invoke('image:convert', payload),
  resizeImages: (payload: {
    inputPaths: string[]
    outputDir: string
    mode: 'percent' | 'width' | 'height' | 'fit'
    percent: number
    width: number
    height: number
    sharpen: boolean
  }) => ipcRenderer.invoke('image:resize', payload),
  compressImages: (payload: {
    inputPaths: string[]
    outputDir: string
    quality: number
    format: 'auto' | 'jpg' | 'png' | 'webp'
  }) => ipcRenderer.invoke('image:compress', payload),
  imagesToPdf: (payload: { inputPaths: string[]; outputDir: string; outputName: string }) =>
    ipcRenderer.invoke('image:to-pdf', payload),
  stripExif: (payload: { inputPaths: string[]; outputDir: string }) =>
    ipcRenderer.invoke('image:strip-exif', payload),
  filterImages: (payload: { inputPaths: string[]; outputDir: string; filter: 'grayscale' | 'sepia' | 'invert' }) =>
    ipcRenderer.invoke('image:filter', payload),
  mergeTextFiles: (payload: {
    inputPaths: string[]
    outputDir: string
    outputName: string
    separator: string
    includeHeader: boolean
  }) => ipcRenderer.invoke('text:merge', payload),
  organizeFiles: (payload: { inputPaths: string[]; outputDir: string; rule: 'extension' | 'date' }) =>
    ipcRenderer.invoke('file:organize', payload),
  bulkRename: (payload: {
    outputDir: string
    items: { sourcePath: string; targetName: string }[]
  }) => ipcRenderer.invoke('file:bulk-rename', payload),
  deleteEmptyFolders: (payload: { paths: string[]; recursive: boolean }) =>
    ipcRenderer.invoke('file:delete-empty', payload),
  scanLargeFiles: (payload: { path: string; thresholdBytes: number }) =>
    ipcRenderer.invoke('file:scan-large', payload),
  deleteFiles: (payload: { items: { sourcePath: string }[] }) =>
    ipcRenderer.invoke('file:delete', payload),
  shredFiles: (payload: { inputPaths: string[]; passes: 3 | 7 | 35; verify: boolean }) =>
    ipcRenderer.invoke('file:shred', payload),
  checksumFiles: (payload: { inputPaths: string[]; algorithm: 'md5' | 'sha1' | 'sha256' }) =>
    ipcRenderer.invoke('security:checksum', payload),
  processArchive: (payload: { mode: 'zip' | 'unzip'; sources: string[]; outputPath: string }) =>
    ipcRenderer.invoke('archive:process', payload),
  renameImages: (payload: { outputDir: string; items: { sourcePath: string; targetName: string }[] }) =>
    ipcRenderer.invoke('image:rename', payload),
  processSecurity: (payload: { mode: 'encrypt' | 'decrypt'; file: string; password: string; output: string }) =>
    ipcRenderer.invoke('security:process', payload),
  watermarkImages: (payload: {
    inputPaths: string[];
    outputDir: string;
    type: 'text' | 'image';
    text?: string;
    imagePath?: string;
    size: number;
    color?: string;
    position: 'top-left' | 'top-right' | 'center' | 'bottom-left' | 'bottom-right';
    rotation: number;
    opacity: number;
  }) => ipcRenderer.invoke('image:watermark', payload),
  extractImages: (payload: { filePath: string }) =>
    ipcRenderer.invoke('pdf:extract-images', payload),
  downloadExtractedImages: (payload: { images: { data: string; page: number; format: 'jpeg' | 'png' }[]; outputDir: string; baseName: string }) =>
    ipcRenderer.invoke('pdf:download-extracted-images', payload),
  getPdfPageCount: (payload: { filePath: string }) =>
    ipcRenderer.invoke('pdf:get-page-count', payload),
  reorderPages: (payload: { filePath: string; pageOrder: number[]; outputDir: string; outputName?: string }) =>
    ipcRenderer.invoke('pdf:reorder-pages', payload),
})

// --------- Preload scripts loading ---------
function domReady(condition: DocumentReadyState[] = ['complete', 'interactive']) {
  return new Promise(resolve => {
    if (condition.includes(document.readyState)) {
      resolve(true)
    } else {
      document.addEventListener('readystatechange', () => {
        if (condition.includes(document.readyState)) {
          resolve(true)
        }
      })
    }
  })
}

const safeDOM = {
  append(parent: HTMLElement, child: HTMLElement) {
    if (!Array.from(parent.children).find(e => e === child)) {
      return parent.appendChild(child)
    }
  },
  remove(parent: HTMLElement, child: HTMLElement) {
    if (Array.from(parent.children).find(e => e === child)) {
      return parent.removeChild(child)
    }
  },
}

/**
 * https://tobiasahlin.com/spinkit
 * https://connoratherton.com/loaders
 * https://projects.lukehaas.me/css-loaders
 * https://matejkustec.github.io/SpinThatShit
 */
function useLoading() {
  const className = `loaders-css__square-spin`
  const styleContent = `
@keyframes square-spin {
  25% { transform: perspective(100px) rotateX(180deg) rotateY(0); }
  50% { transform: perspective(100px) rotateX(180deg) rotateY(180deg); }
  75% { transform: perspective(100px) rotateX(0) rotateY(180deg); }
  100% { transform: perspective(100px) rotateX(0) rotateY(0); }
}
.${className} > div {
  animation-fill-mode: both;
  width: 50px;
  height: 50px;
  background: #fff;
  animation: square-spin 3s 0s cubic-bezier(0.09, 0.57, 0.49, 0.9) infinite;
}
.app-loading-wrap {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #282c34;
  z-index: 9;
}
    `
  const oStyle = document.createElement('style')
  const oDiv = document.createElement('div')

  oStyle.id = 'app-loading-style'
  oStyle.innerHTML = styleContent
  oDiv.className = 'app-loading-wrap'
  oDiv.innerHTML = `<div class="${className}"><div></div></div>`

  return {
    appendLoading() {
      safeDOM.append(document.head, oStyle)
      safeDOM.append(document.body, oDiv)
    },
    removeLoading() {
      safeDOM.remove(document.head, oStyle)
      safeDOM.remove(document.body, oDiv)
    },
  }
}

// ----------------------------------------------------------------------

const { appendLoading, removeLoading } = useLoading()
domReady().then(appendLoading)

window.onmessage = (ev) => {
  ev.data.payload === 'removeLoading' && removeLoading()
}

setTimeout(removeLoading, 4999)
