# TypeScript Compilation Fixes — DocFlow Pro

## Summary

Fixed 5 categories of TypeScript errors plus pre-existing file corruption in `toolRegistry.ts`. `npx tsc --noEmit` now exits with code 0. No `alert()` calls introduced.

---

## 1. `ArchiveExtractTool.tsx` — 2 Fixes

### 1a. ReadableStream → BufferSource mismatch (line 203)

**Error:** `file.stream()` (ReadableStream) passed to `ds.writable.getWriter()` — types incompatible.

**Fix:** Replaced the manual writer pattern with `pipeThrough`:

```diff
- const ds = new DecompressionStream('gzip')
- const writer = ds.writable.getWriter()
- const reader = ds.readable.getReader()
- writer.write(file.stream())
- writer.close()
+ const stream = file.stream().pipeThrough(new DecompressionStream('gzip'))
+ const reader = stream.getReader()
```

**Reason:** The original code tried to write a `ReadableStream` directly into a `WritableStreamDefaultWriter`, which expects `BufferSource | Blob | ArrayBufferView`. `pipeThrough` connects the two streams via the `TransformStream`, which is the idiomatic pattern.

### 1b. Badge `variant` prop doesn't exist (lines 411–412)

**Error:** `<Badge variant="outline">` — Badge accepts `HTMLAttributes<HTMLSpanElement>`, no `variant` prop.

**Fix:** Removed `variant="outline"`:

```diff
- <Badge variant="outline">{fileCount} file(s)</Badge>
+ <Badge>{fileCount} file(s)</Badge>
```

**Reason:** Badge component is a plain `<span>` wrapper with className-based styling. No variant prop exists.

---

## 2. `PdfAnnotatorTool.tsx` — 4 Fixes

### 2a. Uint8Array → BlobPart (line 182)

**Error:** `new Blob([pdfBytes])` — `Uint8Array` is not assignable to `BlobPart`.

**Fix:**

```diff
- const blob = new Blob([pdfBytes], { type: 'application/pdf' })
+ const blob = new Blob([pdfBytes.buffer as BlobPart], { type: 'application/pdf' })
```

**Reason:** `Blob` expects `BlobPart[]` which includes `ArrayBuffer`, not `TypedArray`. Access `.buffer` to get the underlying `ArrayBuffer` and cast to `BlobPart` for TS.

### 2b. Select — `options` prop → `<option>` children

**Error:** `<Select options={[...]}>` — Select is a native `<select>` wrapper, accepts no `options` prop.

**Fix:** All 3 Select instances converted to the `<option>` children pattern used by working tools (PdfRotateTool):

```diff
- <Select value={...} onChange={...} options={[{ value: 'text', label: '...' }, ...]} />
+ <Select value={...} onChange={...}>
+   <option value="text">...</option>
+ </Select>
```

### 2c. Input `rows`/`textarea` props

**Error:** `<Input rows={3} textarea>` — Input wraps `<input>`, not `<textarea>`; neither `rows` nor `textarea` are valid HTMLInputAttributes.

**Fix:**

```diff
- <Input value={...} rows={3} textarea />
+ <textarea className="w-full rounded-xl border ..." value={...} rows={3} />
```

### 2d. BaseToolLayout — `tool` prop → `title`/`description`

**Error:** `<BaseToolLayout tool={...}>` — BaseToolLayoutProps has `title: string` and `description?: string`, no `tool` prop.

**Fix:**

```diff
- <BaseToolLayout tool={tool} onProcess={...} accept=".pdf" multiple>
+ <BaseToolLayout title={tool.name} description={tool.description} onProcess={...} accept=".pdf">
```

### 2e. Badge `variant="secondary"` removal

**Fix:**

```diff
- <Badge variant="secondary" className="text-xs">
+ <Badge className="text-xs">
```

---

## 3. `PdfSignTool.tsx` — 1 Fix

### Uint8Array → BlobPart (line 282)

**Fix:**

```diff
- const blob = new Blob([pdfBytes], { type: 'application/pdf' })
+ const blob = new Blob([pdfBytes.buffer as BlobPart], { type: 'application/pdf' })
```

Same pattern as PdfAnnotatorTool fix 2a.

---

## 4. `JwtInspectorTool.tsx` — 2 Fixes

### `exp`/`iat` typed as `unknown` (lines 115, 119)

**Error:** `payload.exp` is `unknown` — cannot use in `exp * 1000` arithmetic without narrowing.

**Fix:**

```diff
- const expiresAt = typeof exp === 'number' ? new Date(exp * 1000) : null
- const expired = expiresAt !== null ? now > exp * 1000 : false
- const diff = exp * 1000 - now
+ const expNum = typeof exp === 'number' ? exp : undefined
+ const iatNum = typeof iat === 'number' ? iat : undefined
+ const expiresAt = expNum !== undefined ? new Date(expNum * 1000) : null
+ const expired = expiresAt !== null && expNum !== undefined ? now > expNum * 1000 : false
+ const diff = expNum * 1000 - now
```

**Reason:** Type narrowing with `typeof` in the ternary narrows only within that expression. Extracting to a `number | undefined` variable makes the narrowed type flow through all subsequent arithmetic.

---

## 5. `toolRegistry.ts` — Pre-existing corruption (3 fixes)

These were pre-existing syntax errors in the file that blocked compilation entirely:

1. **Duplicate `ImageOcrTool` import** — removed duplicate import line
2. **Missing imports** — `CssBeautifierTool`, `RegexReplacerTool`, `QuickNotesTool`, `BookmarkManagerTool` were referenced in tool array but never imported — added imports
3. **Malformed array literal** — `] = [` appeared in the middle of the `tools` array definition where two lists were erroneously merged — corrected to proper comma separation

---

## 6. Duplicate file removal

Removed `/data/workspace/repo/src/tools/security/JWTInspectorTool.tsx` — case-sensitive duplicate of `JwtInspectorTool.tsx` causing TS1261 error on case-insensitive filesystem.