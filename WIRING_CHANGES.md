The tool-calling budget has been exhausted. The file `/data/workspace/repo/src/data/toolRegistry.ts` currently has **one partial change** applied — `Paintbrush` was added to the lucide-react imports. The remaining patches were not completed due to budget constraints.

Here is the complete WIRING_CHANGES.md documenting the full set of edits that must be applied:

---

# Wiring Changes for 6 Unregistered Tools

## Starting State (clean file, `git checkout` restored)

| Tool | Import Present? | Entry Present? | categoryId (current) |
|------|:-:|:-:|----------------------|
| SVGOptimizerTool | ❌ | ❌ | — |
| PdfAnnotatorTool | ❌ | ❌ | — |
| PdfSignTool | ❌ | ❌ | — |
| SubnetCalculatorTool | ✅ (line 155) | ✅ (line 922) | `'productivity'` (wrong) |
| CSSBeautifierTool | ❌ | ❌ | — |
| SqlFormatterTool | ❌ | ❌ | — |

## Required Edits

### 1. Lucide-React icon imports — add 3 icons

After this block in the file:
```
  Network,
  Palette,
```
Change to:
```
  Network,
  Paintbrush,
  Palette,
```
Also add `Signature` and `Database` to the import block (insert anywhere alphabetical is fine — recommended: `Signature` near `Shield`/`ShieldCheck`, `Database` after `Crop`/before `Diff`).

### 2. Component imports — add 5 imports

After this line (line 155 in clean file):
```typescript
import { SubnetCalculatorTool } from '@/tools/network/SubnetCalculatorTool'
```
Add:
```typescript
import { SvgOptimizerTool } from '@/tools/image/SVGOptimizerTool'
import { PdfAnnotatorTool } from '@/tools/pdf/PdfAnnotatorTool'
import { PdfSignTool } from '@/tools/pdf/PdfSignTool'
import { CssBeautifierTool } from '@/tools/text/CSSBeautifierTool'
import { SqlFormatterTool } from '@/tools/text/SQLFormatterTool'
```
**Note**: The exported function names use different casing than the filenames:
- `SVGOptimizerTool.tsx` → `export function SvgOptimizerTool`
- `CSSBeautifierTool.tsx` → `export function CssBeautifierTool`
- `SQLFormatterTool.tsx` → `export function SqlFormatterTool`

### 3. Add `'network'` category

In the `categories[]` array, after the `'productivity'` entry (before the closing `]`), add:
```typescript
  {
    id: 'network',
    label: 'Network',
    description: 'IP and subnet utilities.',
    icon: Network,
  },
```

### 4. Fix SubnetCalculatorTool categoryId

In the existing `subnet-calc` entry, change:
```diff
-   categoryId: 'productivity',
+   categoryId: 'network',
```

### 5. Add 5 new tool entries to `tools[]` array

Append these entries before the closing `]` of the `tools` array (after the `subnet-calc` entry):

```typescript
  {
    id: 'svg-optimizer',
    name: 'SVG Optimizer',
    description: 'Optimize and compress SVG files for web use.',
    categoryId: 'image',
    icon: Sparkles,
    component: SvgOptimizerTool,
  },
  {
    id: 'pdf-annotate',
    name: 'PDF Annotator',
    description: 'Add text, highlights, and annotations to PDF pages.',
    categoryId: 'pdf',
    icon: Paintbrush,
    component: PdfAnnotatorTool,
  },
  {
    id: 'pdf-sign',
    name: 'PDF Sign',
    description: 'Digitally sign PDF documents with certificates.',
    categoryId: 'pdf',
    icon: Signature,
    component: PdfSignTool,
  },
  {
    id: 'css-beautifier',
    name: 'CSS Beautifier',
    description: 'Beautify and format CSS code with options.',
    categoryId: 'text',
    icon: Code2,
    component: CssBeautifierTool,
  },
  {
    id: 'sql-formatter',
    name: 'SQL Formatter',
    description: 'Format and beautify SQL queries.',
    categoryId: 'text',
    icon: Database,
    component: SqlFormatterTool,
  },
```

### 6. Untouched entries

- `jwt-inspector` — left as-is
- `url-encoder` — left as-is

## Verification Steps

After all edits are applied, run:
```bash
cd /data/workspace/repo && npx tsc --noEmit src/data/toolRegistry.ts
```
Expected: no type errors (all imported components must exist at the given paths and export correctly typed default/named exports matching `ComponentType<{ tool: ToolDefinition }>`).