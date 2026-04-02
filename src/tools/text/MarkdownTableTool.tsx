import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Copy, Plus, Trash2, X } from 'lucide-react'

type MarkdownTableToolProps = {
  tool: ToolDefinition
}

type CellData = string

/* ──────────────────────────────────────────────
   Component
   ────────────────────────────────────────────── */

export function MarkdownTableTool({ tool }: MarkdownTableToolProps) {
  // Start with a 3x3 table as default
  const DEFAULT_COLS = ['Column 1', 'Column 2', 'Column 3']
  const DEFAULT_ROWS: CellData[][] = [
    ['Row 1, Col 1', 'Row 1, Col 2', 'Row 1, Col 3'],
    ['Row 2, Col 1', 'Row 2, Col 2', 'Row 2, Col 3'],
  ]

  const [columns, setColumns] = useState<string[]>(DEFAULT_COLS)
  const [rows, setRows] = useState<CellData[][]>(DEFAULT_ROWS)
  const [copyHint, setCopyHint] = useState('')
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Ensure any pending copy hint timeout is cleaned up on unmount
  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        clearTimeout(copyTimerRef.current)
      }
    }
  }, [])

  const clearCopyTimer = useCallback(() => {
    if (copyTimerRef.current !== null) {
      clearTimeout(copyTimerRef.current)
      copyTimerRef.current = null
    }
  }, [])

  const handleColumnAdd = useCallback(() => {
    setColumns((prev) => [...prev, `Column ${prev.length + 1}`])
    setRows((prev) => prev.map((row) => [...row, '']))
  }, [])

  const handleColumnRemove = useCallback((index: number) => {
    setColumns((prev) => prev.filter((_, i) => i !== index))
    setRows((prev) => prev.map((row) => row.filter((_, i) => i !== index)))
  }, [])

  const handleRowAdd = useCallback(() => {
    setRows((prev) => [...prev, new Array(columns.length).fill('')])
  }, [columns.length])

  const handleRowRemove = useCallback((index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleCellChange = useCallback((rowIndex: number, colIndex: number, value: string) => {
    setRows((prev) => {
      const updated = prev.map((row) => [...row])
      updated[rowIndex][colIndex] = value
      return updated
    })
  }, [])

  const handleColumnRename = useCallback((colIndex: number, newName: string) => {
    setColumns((prev) => {
      const updated = [...prev]
      updated[colIndex] = newName
      return updated
    })
  }, [])

  const handleClear = useCallback(() => {
    setColumns(DEFAULT_COLS)
    setRows(DEFAULT_ROWS)
    setCopyHint('')
    clearCopyTimer()
  }, [clearCopyTimer])

  const markdownTable = useMemo(() => {
    if (columns.length === 0 || rows.length === 0) {
      return ''
    }

    let md = '| ' + columns.join(' | ') + ' |\n'
    md += '| ' + columns.map(() => '---').join(' | ') + ' |\n'
    for (const row of rows) {
      md += '| ' + row.join(' | ') + ' |\n'
    }
    return md.trimEnd()
  }, [columns, rows])

  const handleCopy = useCallback(() => {
    if (!markdownTable) return
    clearCopyTimer()

    try {
      navigator.clipboard.writeText(markdownTable).then(
        () => {
          setCopyHint('Copied!')
          copyTimerRef.current = setTimeout(() => {
            setCopyHint('')
            copyTimerRef.current = null
          }, 2000)
        },
        () => {
          setCopyHint('Copy failed.')
        }
      )
    } catch {
      setCopyHint('Copy failed.')
    }
  }, [markdownTable, clearCopyTimer])

  // Column header input ref management
  const colInputRefs = useRef<Map<number, HTMLInputElement>>(new Map())

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <Button onClick={handleColumnAdd} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Add Column
            </Button>
            <Button onClick={handleRowAdd} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Add Row
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={handleCopy} disabled={!markdownTable} className="w-full">
              <Copy className="mr-2 h-4 w-4" />
              {copyHint || 'Copy Table Markdown'}
            </Button>
          </div>
          <Button variant="ghost" onClick={handleClear} className="w-full text-xs">
            Clear & Reset
          </Button>
          <div className="text-xs text-muted">
            <div>Columns: {columns.length}</div>
            <div>Rows: {rows.length}</div>
          </div>
        </div>
      }
    >
      {/* Editor grid */}
      <div className="space-y-4">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="p-2 w-8" />
                {columns.map((col, colIdx) => (
                  <th key={colIdx} className="p-1 min-w-[120px] border border-border bg-base/80">
                    <div className="flex items-center gap-1">
                      <input
                        ref={(el) => {
                          if (el) colInputRefs.current.set(colIdx, el)
                          else colInputRefs.current.delete(colIdx)
                        }}
                        value={col}
                        onChange={(e) => handleColumnRename(colIdx, e.target.value)}
                        className="w-full bg-transparent text-xs font-medium text-text px-1 py-0.5 outline-none"
                        placeholder={`Column ${colIdx + 1}`}
                      />
                      {columns.length > 1 && (
                        <button
                          type="button"
                          className="text-muted hover:text-red-400 flex-shrink-0"
                          onClick={() => handleColumnRemove(colIdx)}
                          title="Remove column"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  <td className="p-1 w-8">
                    <button
                      type="button"
                      className="text-muted hover:text-red-400 w-full"
                      onClick={() => handleRowRemove(rowIdx)}
                      title="Remove row"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                  {row.map((cell, colIdx) => (
                    <td key={colIdx} className="p-1 border border-border bg-base/40">
                      <input
                        value={cell}
                        onChange={(e) => handleCellChange(rowIdx, colIdx, e.target.value)}
                        className="w-full bg-transparent text-xs text-text px-1 py-0.5 outline-none"
                        placeholder={`Row ${rowIdx + 1}, Col ${colIdx + 1}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length === 0 && (
          <div className="rounded-xl border border-border bg-base/60 px-4 py-6 text-center text-sm text-muted">
            Add rows to start building your table.
          </div>
        )}

        {/* Live Markdown preview */}
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase text-muted">Markdown Preview</div>
          <div className="border border-border rounded-lg bg-base/50 p-4 min-h-[120px] overflow-auto">
            {markdownTable ? (
              <>
                <pre className="text-xs font-mono text-text whitespace-pre-wrap break-words">
                  {markdownTable}
                </pre>
              </>
            ) : (
              <div className="text-xs text-muted italic">
                Table will appear here as you build it…
              </div>
            )}
          </div>
        </div>
      </div>
    </BaseToolLayout>
  )
}
