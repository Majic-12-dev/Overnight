# Feature Report: Batch 3 — CSV Converter & Markdown Table Generator

## Summary

Two new tools added to DocFlow Pro: **CSV Converter** (`csv-converter`) and **Markdown Table Generator** (`markdown-table`). Both are frontend-only, use `BaseToolLayout`, and require no IPC.

## Artifacts

| File | Path | Description |
|------|------|-------------|
| CsvConverterTool.tsx | `src/tools/file/CsvConverterTool.tsx` | CSV↔JSON bidirectional converter with validation |
| MarkdownTableTool.tsx | `src/tools/text/MarkdownTableTool.tsx` | Dynamic markdown table builder with live preview |
| toolRegistry.ts | `src/data/toolRegistry.ts` | Updated imports + two new tool entries |

## Tool 1: CSV Converter

**ID:** `csv-converter`
**Category:** `file`
**Icon:** `Table2` (lucide-react)
**Features:**
- Paste CSV → converts to JSON array-of-objects
- Paste JSON → converts back to CSV with proper escaping
- Manual CSV parser (no PapaParse dependency) handles:
  - Quoted fields with embedded commas/newlines
  - Double-quote escaping (`""` → `"`)
  - CRLF and LF line endings
- Column count mismatch errors reported with line references
- Copy result to clipboard with 2s confirmation hint
- Download as `.json` or `.csv` (client-side blob)
- Swap direction buttons to flip CSV↔JSON flow
- All timeouts cleaned up via `ref + useEffect` unmount

**Validation:**
- Empty input detection
- JSON parse errors caught with exact message
- CSV column count per-row validation

## Tool 2: Markdown Table Generator

**ID:** `markdown-table`
**Category:** `text`
**Icon:** `Table` (lucide-react)
**Features:**
- Starts with a 3-column × 2-row default grid
- Add/remove columns dynamically (all rows auto-adjust)
- Add/remove rows dynamically
- Edit column headers inline (click to rename)
- Live markdown table preview rendered below the editor grid
- "Copy Table Markdown" button copies formatted markdown text
- Reset button restores default 3×2 empty table
- All timeouts cleaned up via `ref + useEffect` unmount

**Markdown Format:**
```
| Col 1 | Col 2 | Col 3 |
| --- | --- | --- |
| cell | cell | cell |
```

## Registration Changes

### toolRegistry.ts additions

1. **Icons:** Added `Table` and `Table2` to lucide-react imports
2. **Imports:**
   - `CsvConverterTool` from `@/tools/file/CsvConverterTool`
   - `MarkdownTableTool` from `@/tools/text/MarkdownTableTool`
3. **Tool entries** appended to `tools[]`:
   - `{ id: 'csv-converter', ..., icon: Table2, ... }` → file category
   - `{ id: 'markdown-table', ..., icon: Table, ... }` → text category

## Compliance Checklist

| Requirement | Status |
|-------------|--------|
| CsvConverterTool at `src/tools/file/CsvConverterTool.tsx` | ✅ |
| MarkdownTableTool at `src/tools/text/MarkdownTableTool.tsx` | ✅ |
| BaseToolLayout with custom children | ✅ |
| Both imported and registered in toolRegistry.ts | ✅ |
| `npx tsc --noEmit` passes (zero errors) | ✅ |
| No `alert()` calls in either file | ✅ (search confirmed 0 matches) |
| No `Math.random()` calls | ✅ (`crypto.randomUUID()` from BaseToolLayout used for any IDs) |
| `setTimeout` uses cleanup refs | ✅ (`useRef` + `useEffect` unmount in both files) |
| Frontend-only, no IPC required | ✅ |
| No new npm dependencies | ✅ (manual CSV parser, no PapaParse) |

## Design Notes

- CSV parser uses a character-by-character state machine, not regex, for correct quote handling
- Markdown table output uses standard GitHub-flavored table syntax with `|` delimiters and `---` separator row
- Copy hints use a ref-based timer (not state-embedded setTimeout) to guarantee cleanup on unmount
- Cell editing in the markdown table uses controlled inputs bound to a 2D state array
