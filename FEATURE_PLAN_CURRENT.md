# Feature Plan: Current Session

## Completed
- ✅ 4 previously-unimported tools wired into registry (file-mime-type, yaml-json, snippet-manager, password-audit)

## Batch 2: New Tools (Web Dev & Data)
1. **CSS Gradient Generator** (productivity) — Visual gradient editor, multi-stop support, angle control, CSS output with copy
2. **Favicon Generator** (image) — Convert image to favicon (ICO + multi-size PNG), preview all sizes
3. **JSON Diff Tool** (text) — Visual JSON comparison with tree highlighting and structural differences
4. **SQL Formatter** (text) — Format, beautify, and minify SQL — uses sql-formatter library

## Batch 3: New Tools (Advanced Utilities)
5. **Data Format Converter** (productivity) — Convert between CSV/TSV/JSON/XML/YAML formats with preview
6. **Image Slicer** (image) — Split image into equal grid pieces (horizontal, vertical, or 2D grid)
7. **Meta Tag Generator** (text) — Generate HTML meta tags, Open Graph, Twitter Cards from form inputs
8. **HTML to PDF** (file) — Convert raw HTML string to PDF (uses electron's built-in printToPDF)

## Constraints
- All tools extend BaseToolLayout
- All tools accept `{ tool: ToolDefinition }` prop
- No alert() calls in src/
- Use existing IPC patterns for electron-level operations
- Each tool must compile: npx tsc --noEmit must pass
