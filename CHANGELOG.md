# Changelog

All notable changes to DocFlow Pro will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- **QR Code Generator** (`qr-code-generator`): Generate QR codes from texts/URLs with PNG download.
- **Password Generator** (`password-generator`): Cryptographically secure passwords with configurable strength.
- **Text Diff** (`text-diff`): Line-by-line text comparison with color-coded output.
- **JSON Formatter** (`json-formatter`): Validate, pretty-print, and minify JSON with error reporting.
- **CSV Converter** (`csv-converter`): Bidirectional CSV↔JSON conversion with column validation.
- **Markdown Table Generator** (`markdown-table`): Dynamic table builder with live markdown preview.
- **Unit Converter** (`unit-converter`): Convert length, weight, temperature, speed, data, and time.
- **Regex Tester** (`regex-tester`): Test regex patterns with match highlighting and replace.

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
