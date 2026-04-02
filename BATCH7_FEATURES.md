All 3 tools are complete and validated. Here's a summary:

## Implementation Summary

### Files Created
- `src/tools/productivity/QrCodeDecoderTool.tsx` - QR/Barcode decoder using @zxing/library
- `src/tools/image/BackgroundEnhancerTool.tsx` - Canvas-based image enhancement
- `src/tools/security/FileShredderTool.tsx` - Secure file deletion with DoD/Gutmann standards

### Files Modified
- `src/data/toolRegistry.ts` - Added imports and tool definition entries
- `src/vite-env.d.ts` - Added `shredFiles` IPC type declaration

### Validation
- ✅ `npx tsc --noEmit` - No TypeScript errors
- ✅ `npx vite build` - Build succeeds in 7.82s

### Tool Details

| Tool | Category | Dependencies | Key Features |
|------|----------|--------------|--------------|
| **QR Code Decoder** | Productivity | @zxing/library | Multi-format decode, URL detection, copy/download, inverted-color fallback |
| **Image Enhancer** | Image | Canvas API | Auto-contrast, brightness, contrast, sharpening, noise reduction, color temp |
| **File Shredder** | Security | IPC (`shredFiles`) | DoD 5220.22-M (3/7 passes), Gutmann (35 passes), verification toggle |