# Changelog

All notable changes to DocFlow Pro will be documented in this file.

## [Unreleased]

### 🆕 New Tools (10 + 4 bonus)

#### Developer Category (3)
- **Favicon Generator** — Generate favicons in multiple sizes (16x16, 32x32, 48x48, 64x64) from uploaded images with preview and download.
- **HTTP Headers Tool** — Inspect and display HTTP response headers for any URL, with security header analysis and grading.
- **OpenGraph Preview Tool** — Preview Open Graph / social media card rendering for any URL, showing title, description, image, and site metadata.

#### File Category (1 + 1 bonus)
- **CSV Analyzer** — Upload CSV files, view summary statistics, column types, duplicates, and export cleaned/filtered results.
- **Markdown to PDF Converter** (bonus) — Convert Markdown documents to styled PDF with table of contents and syntax-highlighted code blocks.

#### Image Category (1 + 1 bonus)
- **SVG to PNG Converter** — Convert SVG files to raster PNG images with configurable output dimensions and transparent background support.
- **Image Diff Tool** (bonus) — Side-by-side and pixel-diff comparison of two images with overlay slider and mismatch highlighting.

#### PDF Category (1)
- **PDF Batch Compressor** — Compress multiple PDFs at once with configurable quality settings and progress tracking.

#### Security Category (1)
- **Data Anonymizer** — Replace PII (names, emails, phones, SSNs, IPs, credit cards) with realistic fake data using pattern matching.

#### Text Category (2 + 2 bonus)
- **ASCII Art Generator** — Convert images to ASCII art with configurable character sets, color output, and multiple dithering modes.
- **Regex Test Suite** — Real-time regex pattern testing with match highlighting, capture group visualization, and regex cheat sheet.
- **Text Statistics** — Comprehensive text analysis: word count, character count, sentence count, reading time, readability scores, and frequency analysis.
- **CSS Formatter** (bonus) — Format/minify/beautify CSS with configurable brace style, indentation, and property sorting.
- **JSON Diff** (bonus) — Deep comparison of two JSON objects with syntax highlighting, patch generation, and structural diff visualization.

#### Tool Wiring (2 fixes)
- **BackgroundRemoverTool.tsx** — Complete rewrite (+303 lines): replaced broken canvas-based removal with proper `@imgly/background-removal` integration, added drag-and-drop upload, progress UI, and dual download (PNG/WebP).
- **ImageMetadataTool.tsx** — Wired into toolRegistry.ts with correct category assignment, icon, and props.

### 🆕 New Tools (previously documented — 6)

#### PDF Category
- **PDF Redaction Tool** — Permanently black out sensitive regions in PDFs with visual selection and page navigation.
- **PDF Form Filler Tool** — Detect, display, and fill PDF form fields (text, checkbox, radio, dropdown) client-side.

#### Productivity Category
- **Barcode Generator** — Generate QR, Code 128, EAN-13, and UPC-A barcodes using `bwip-js` with configurable settings.

#### Image Category
- **Image Metadata Editor** — View and edit EXIF, IPTC, and GPS metadata in images using `exifr` + `piexifjs`.

#### Text Category
- **HTML Sanitizer** — Strip dangerous HTML tags/attributes, minify, beautify, and extract text/links/images.
- **JSON Schema Validator** — Validate JSON data against JSON Schema (draft 4/6/7/2019-12) using AJV with detailed error reporting.

### 🐛 Bug Fixes

| Fix | Description |
|-----|-------------|
| `image:watermark` IPC gap | Added missing import + IPC handler in `electron/main/index.ts` |
| `PdfAnnotatorTool.tsx` | Fixed incomplete file (truncated at line 186) — rewrote entire component |
| `ArchiveExtractTool.tsx` | Fixed `ReadableStream` type error and removed invalid `Badge` variant prop |
| `JwtInspectorTool.tsx` | Fixed `exp` cast from `unknown` — added proper type narrowing |
| Duplicate imports | Removed duplicate `lucide-react` imports in `Database`, `NotebookPen`, `BarcodeGeneratorTool`, `ImageOcrTool` |
| `BaseToolLayout` prop misuse | Migrated all tools from deprecated `tool` prop to explicit `title`/`description` props |
| `Badge` variant prop | Replaced unsupported `variant` prop with `className` styling across 4 files |
| `bwip-js` import pattern | Fixed import to `import bwipjs from 'bwip-js'` and destructured `toCanvas` |
| `piexifjs` type declarations | Added `declare module 'piexifjs'` to satisfy TypeScript |
| Duplicate `PdfRedactTool.tsx` | Removed orphaned file in favor of `PdfRedactionTool.tsx` |
| Memory leaks (Critic review) | Added 5-minute auto-revoke timers for Blob URLs in 3 tools |
| `ArchiveExtractTool.tsx` keyboard accessibility | Added full keyboard navigation: Home/End keys for file tree, roving tabindex pattern, extract button focus management, and ARIA tree roles (`role="tree"`, `role="treeitem"`) |

### ♿ Accessibility Improvements

- **ArchiveExtractTool** — Full keyboard navigation for file tree:
  - Home/End keys jump to first/last tree item
  - Arrow Up/Down moves focus between tree items (roving tabindex)
  - Arrow Left/Right collapses/expands folders
  - Enter/Space toggles file selection
  - Extract button receives focus after extraction completes
  - ARIA tree roles (`role="tree"`, `role="treeitem"`, `aria-expanded`, `aria-selected`) applied to file tree structure

### 📦 New Dependencies

| Package | Purpose |
|---------|---------|
| `bwip-js` | Barcode generation (QR, Code128, EAN, UPC) |
| `exifr` | EXIF/IPTC/GPS metadata parsing |
| `piexifjs` | JPEG EXIF metadata editing |
| `ajv` | JSON Schema validation |
| `@types/piexifjs` (custom) | TypeScript type declarations for piexifjs |

### 🔧 Internal Changes

- Enforced consistent `BaseToolLayout` usage: `title={name} description={desc} onProcess={handler}`
- Removed all `alert()` calls from codebase — use UI error cards and status messages instead
- Total tool registry count: **110+ tools** across 7 categories
- Pre-commit verification: `npx tsc --noEmit` and `npm run build` both pass cleanly
- Added critic review workflow for new feature validation
