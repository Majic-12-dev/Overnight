# Batch 7 Code Review — Critic Report

## Verdict

```json
{
  "verdict": "FAIL",
  "reason": "Multiple pattern violations and a runtime dependency risk identified across 4 new tools and 1 UI component.",
  "required_fixes": [
    "FileShredderTool.tsx: `(window as any).api.shredFiles` is an untyped runtime dependency on an Electron preload API that is not declared in any TypeScript definition. If the preload script lacks `shredFiles` or the interface changes, this fails silently at build time and crashes at runtime. Must verify the IPC handler exists and add a proper TypeScript declaration (e.g., `interface ElectronAPI { shredFiles(args: { inputPaths: string[]; passes: number; verify: boolean }): Promise<{ filesProcessed: number; bytesOverwritten?: number; verificationPassed?: boolean; errors?: string[] }> }` and cast via `(window as any).api as ElectronAPI`). Additionally, the `(window as any)` pattern defeats type safety entirely.",
    "ImageEnhancerTool.tsx: Does NOT use BaseToolLayout, unlike every other existing tool in the repo. All other image tools (ImageConvertTool, ImageResizeTool, ImageCompressTool, ImageToPdfTool, ImageExifTool, etc.) use BaseToolLayout for consistent dropzone, progress, and error UX. This tool ships its own entirely custom layout with dropzone, upload button, export cards, and sidebar. This breaks UI/UX consistency across the tool grid. Either migrate to BaseToolLayout with an options panel/sidebar, or provide documented justification for the deviation.",
    "ImageEnhancerTool.tsx: Uses native `<input type=\"range\">` directly in the sidebar for angle control instead of the new `Slider` component. The sidebar imports `Slider` from `@/components/ui/Slider` but the angle range input in the options panel uses a bare `<input type=\"range\">` with inline Tailwind classes. This is inconsistent — either use `Slider` or don't import it at all. This also means the angle slider lacks the accessibility attributes baked into `Slider` (focus-visible ring, proper id-label wiring).",
    "Slider.tsx: Missing ARIA attributes for accessibility compliance. The component renders `<input type=\"range\">` without `role=\"slider\"` (redundant for native range but harmless), and critically lacks `aria-label` or `aria-labelledby` forwarding. Since the visual label is a separate `<label>` element, the `id` prop on the input should be used correctly by the label's `htmlFor` (which it is), but the `aria-valuenow`, `aria-valuemin`, and `aria-valuemax` attributes are not forwarded even though they're standard for slider widgets. Pass through `aria-valuenow={value}`, `aria-valuemin={min}`, `aria-valuemax={max}` from props, or spread them via `...props`.",
    "QrCodeDecoderTool.tsx: `setTimeout` in `ResultCard`'s `handleCopy` callback is not cleaned up on unmount. If the user copies text and immediately navigates away, the `setCopied(true)` call fires on an unmounted component, triggering a React warning. Fix: use `useEffect` with cleanup or track mounted state."
  ]
}
```

---

## Detailed Findings

### CRITICAL (runtime / architectural)

| # | File | Severity | Finding |
|---|------|----------|---------|
| 1 | FileShredderTool.tsx:38-40 | **Critical** | Untyped `(window as any).api.shredFiles` — no TS interface, no runtime guard beyond `if (!api?.shredFiles)`, no contract enforcement. The throw catches missing API but provides zero type safety on call args or return shape. The `result` fields (`filesProcessed`, `bytesOverwritten`, `verificationPassed`, `errors`) are all `any`-typed and could be anything at runtime. |
| 2 | FileShredderTool.tsx:42 | **Critical** | `.path` is accessed on `ToolFile` objects. `ToolFile` type includes `path?: string`. If `path` is undefined (drag-dropped files without path context in browser), the filter removes it and throws. This is defensible for Electron context but should be documented or guarded with a user-friendly message instead of throwing. |

### HIGH (pattern violations / consistency)

| # | File | Severity | Finding |
|---|------|----------|---------|
| 3 | ImageEnhancerTool.tsx (entire file) | **High** | Complete UI inconsistency. Every other tool in the codebase uses `BaseToolLayout`. This tool builds its own `<header>`, `<Card>`, `<input file>`, sidebar grid layout. The result: users see a completely different UI paradigm when switching between tools. Image-enhancer also does not show progress during convolution rendering — large images with sharpness applied will freeze the UI thread with no loading indicator. |
| 4 | ImageEnhancerTool.tsx:309-326 | **High** | Native `<input type="range">` used for angle control instead of imported `Slider` component. The sidebar imports `Slider` and uses it for 4 sliders, then switches to raw HTML for the 5th. This is a code smell — either the `Slider` component is insufficient for the angle use case (why?), or this was an oversight. |

### MEDIUM (accessibility / code quality)

| # | File | Severity | Finding |
|---|------|----------|---------|
| 5 | Slider.tsx | **Medium** | No `aria-valuenow`, `aria-valuemin`, `aria-valuemax` forwarded. Native `<input type="range">` exposes these implicitly, but AT users and testing tools look for explicit ARIA. Easy fix: `aria-valuenow={props.value}`, `aria-valuemin={props.min}`, `aria-valuemax={props.max}` in the spread or explicit props. |
| 6 | QrCodeDecoderTool.tsx:156 | **Medium** | `setTimeout(() => setCopied(false), 2000)` without cleanup. If `ResultCard` unmounts before 2s elapses, React dev mode warns about state update on unmounted component. Fix: `useRef` for timer ID + `useEffect` cleanup, or `AbortController`. |
| 7 | GradientGeneratorTool.tsx:134 | **Low-Medium** | `idCounter` is a module-level mutable counter. Not thread-safe (irrelevant in browser) but could theoretically collide if IDs are serialized and restored. For a fresh-page app this is fine, but `crypto.randomUUID()` is available and should be preferred (as Slider.tsx already does). Minor nit. |
| 8 | ImageEnhancerTool.tsx:107-110 | **Low-Medium** | `drawToCanvas` is recreated on every `settings` change because `settings` is in the `useCallback` deps. This means `useEffect` re-fires on every settings change, which triggers a `requestAnimationFrame`. This is intentional but the `drawToCanvas` dependency in `useEffect` causes the effect to re-run for reasons other than `settings` changing (e.g., `holdingOriginal` toggle). Should memo more carefully or extract the canvas logic into a custom hook. |

### VERIFIED PASS (no issues found)

| Check | Result |
|-------|--------|
| No `alert()` calls in any new file | ✅ Confirmed — zero alert() across all 6 files |
| QrCodeDecoderTool uses BaseToolLayout | ✅ Yes |
| GradientGeneratorTool uses BaseToolLayout | ✅ Yes |
| FileShredderTool uses BaseToolLayout | ✅ Yes |
| TypeScript build passes (noEmit = 0 errors) | ✅ Confirmed (per context) |
| Vite build passes | ✅ Confirmed (per context) |
| Slider component handles edge cases (zero value, missing props) | ✅ `value=0` renders as `"0"`, missing label skips label block |
| jsQR `inversionAttempts: 'attemptBoth'` | ✅ Good default for robustness |
| FileShredderTool warnings (irreversible) | ✅ Yellow warning card present |
| no `dangerouslySetInnerHTML` anywhere | ✅ None |
| no `eval()` or `new Function()` | ✅ None |

### Summary

| Category | Count |
|----------|-------|
| Critical | 2 |
| High | 2 |
| Medium | 3 |
| Verified Pass | 12 |

**Verdict: FAIL** — The FileShredderTool's untyped IPC dependency and ImageEnhancerTool's complete deviation from the established `BaseToolLayout` pattern are sufficient to block without remediation.