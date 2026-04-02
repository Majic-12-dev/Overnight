# Changelog

All notable changes to DocFlow Pro will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added (Cycle 3 — 13 new tools)
- **Base64 Encoder/Decoder** (`base64-encoder`): Encode text or files to Base64; decode Base64 back to text or files. Download support.
- **XML Formatter/Validator** (`xml-formatter`): Pretty-print, minify, and validate XML with detailed error reporting (line/column).
- **Image Collage Maker** (`image-collage`): Arrange 2–9 images into collages with 6 layouts, spacing, and background controls.
- **PDF Extract Images** (`pdf-extract-images`): Extract embedded images from PDF pages at original resolution. Download as ZIP.
- **PDF Page Reorder** (`pdf-reorder`): Visually reorder, delete, and rearrange PDF pages with drag-and-drop. Save reordered PDF.
- **Word Counter** (`word-counter`): Live word count, character analysis, reading/speaking time estimation.
- **Case Converter** (`case-converter`): 11 text transformations: UPPER, lower, Title, Sentence, camelCase, PascalCase, snake_case, kebab-case, CONSTANT_CASE, invert, aLtErNaTiNg.
- **Lorem Ipsum Generator** (`lorem-generator`): Generate placeholder paragraphs, sentences, or words with copy support.
- **Slug Generator** (`slug-generator`): Convert text to URL-safe slugs with configurable separators, lowercase toggle, and max length.
- **Text Hash Generator** (`text-hash`): Compute SHA-1, SHA-256, SHA-512, and MD5 hashes of any text.
- **Text Encrypt/Decrypt** (`text-encrypt`): AES-256-GCM text encryption/decryption with PBKDF2 key derivation (100K iterations).
- **Pomodoro Timer** (`pomodoro`): Configurable work/break intervals with audio alerts and session tracking.
- **Image to Base64** (`image-to-base64`): Convert images to Base64 data URIs with preview and copy.
- **UUID Generator** (`uuid-generator`): Batch-generate v4 (random) and v7 (time-sorted) UUIDs with copy support.
- **Password Generator** (`password-generator`): Cryptographically secure passwords with configurable strength.
- **Text Diff** (`text-diff`): Line-by-line text comparison with color-coded output.
- **JSON Formatter** (`json-formatter`): Validate, pretty-print, and minify JSON with error reporting.
- **CSV Converter** (`csv-converter`): Bidirectional CSV↔JSON conversion with column validation.
- **Markdown Table Generator** (`markdown-table`): Dynamic table builder with live markdown preview.
- **Unit Converter** (`unit-converter`): Convert length, weight, temperature, speed, data, and time.
- **Regex Tester** (`regex-tester`): Test regex patterns with match highlighting and replace.
- **Timestamp Converter** (`timestamp-converter`): Convert Unix timestamps to local date/time and vice versa.
- **Color Palette Generator** (`color-palette`): Generate harmonious color palettes with lockable swatches.

### Fixed
- **unit-converter**: Resolve unit ID collision ('ms' used for both m/s and ms).
- **password-generator**: Replace `Math.random()` with `crypto.getRandomValues()` for cryptographic security.
- **password-generator, JsonFormatterTool**: Fix `setTimeout` memory leak with cleanup refs.

---

## [0.1.0] - 2026-04-02

### Fixed
- **Build pipeline**: Resolved TypeScript compilation errors (type casting).
- **Vite config**: Added `@napi-rs/canvas` to rollup external dependencies for Electron main process bundling.
- **Dependencies**: Added `@napi-rs/canvas` to package.json for PDF-to-images rendering.

### Added
- **PDF Unlock** (`pdf:unlock`): IPC handler in `electron/main/index.ts` and `unlockPdf` function in `electron/main/tools/pdf.ts` — removes PDF restrictions when the user provides a known password.

---

## Batch 7 — 5 New Tools (2026-04-02)

### New Tools
- **QR Code Decoder** — Decode QR codes from images using jsQR library. Supports batch scanning, URL detection with open-link action, and clipboard copy.
- **Image Enhancer** — Canvas-based brightness, contrast, saturation, and sharpness adjustments with live preview, before/after comparison, and PNG/JPEG export.
- **Gradient Generator** — Visual CSS gradient creator with color stops, angle control, presets, and one-click CSS copy.
- **File Shredder** — Secure file deletion with DoD 5220.22-M (3/7/35-pass) overwrite standards and verification.

### Infrastructure
- Added `jsqr` dependency for client-side QR decoding
- New `Slider` UI component with ARIA accessibility attributes
- All new tools integrated into toolRegistry with proper categories and icons

## Batch 4 — Code & Developer Tools (2026-04-02)

### New Tools
- **Code Minifier** — Minify HTML, CSS, JS with compression ratio stats and beautify option
- **Regex Pattern Library** — 8 named presets (email, URL, phone, IP, date, etc.) with live match highlighting
- **Time Zone Converter** — Multiple time zone clocks, live updates, and conversion between zones

### Infrastructure
- All tools compile cleanly with `npx tsc --noEmit` and `npm run build`
