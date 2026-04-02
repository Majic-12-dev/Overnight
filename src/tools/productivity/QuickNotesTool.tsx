import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { NotebookPen, Plus, Trash2, Copy, Download, Search, Pencil, Check, X } from 'lucide-react'

type QuickNotesToolProps = {
  tool: ToolDefinition
}

type Note = {
  id: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

const STORAGE_KEY = 'docflow-quick-notes'

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveNotes(notes: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
  } catch { /* ignore */ }
}

export function QuickNotesTool({ tool }: QuickNotesToolProps) {
  const [notes, setNotes] = useState<Note[]>(loadNotes)
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const contentRef = useRef<HTMLTextAreaElement>(null)

  // Persist notes on change
  useEffect(() => {
    saveNotes(notes)
  }, [notes])

  const activeNote = useMemo(
    () => notes.find(n => n.id === activeNoteId) ?? null,
    [notes, activeNoteId]
  )

  const filteredNotes = useMemo(() => {
    if (!search.trim()) return notes
    const q = search.toLowerCase()
    return notes.filter(
      n => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    )
  }, [notes, search])

  const handleCreateNote = useCallback(() => {
    const now = new Date().toISOString()
    const newNote: Note = {
      id: generateId(),
      title: 'Untitled Note',
      content: '',
      createdAt: now,
      updatedAt: now,
    }
    setNotes(prev => [newNote, ...prev])
    setActiveNoteId(newNote.id)
    setSearch('')
  }, [])

  const handleUpdateContent = useCallback(
    (content: string) => {
      if (!activeNoteId) return
      setNotes(prev =>
        prev.map(n =>
          n.id === activeNoteId
            ? { ...n, content, updatedAt: new Date().toISOString() }
            : n
        )
      )
    },
    [activeNoteId]
  )

  const handleDeleteNote = useCallback(
    (id: string) => {
      setNotes(prev => prev.filter(n => n.id !== id))
      if (activeNoteId === id) setActiveNoteId(null)
    },
    [activeNoteId]
  )

  const handleCopyNote = useCallback(() => {
    if (!activeNote) return
    navigator.clipboard.writeText(activeNote.content).catch(() => {})
  }, [activeNote])

  const handleExportNote = useCallback(() => {
    if (!activeNote) return
    const content = `# ${activeNote.title}\n\n${activeNote.content}`
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeNote.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'note'}.md`
    a.click()
    URL.revokeObjectURL(url)
  }, [activeNote])

  const handleStartRename = useCallback(() => {
    if (!activeNote) return
    setRenamingId(activeNote.id)
    setRenameValue(activeNote.title)
  }, [activeNote])

  const handleSaveRename = useCallback(() => {
    if (!renamingId || !renameValue.trim()) {
      setRenamingId(null)
      return
    }
    setNotes(prev =>
      prev.map(n =>
        n.id === renamingId
          ? { ...n, title: renameValue.trim(), updatedAt: new Date().toISOString() }
          : n
      )
    )
    setRenamingId(null)
  }, [renamingId, renameValue])

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <Button onClick={handleCreateNote} className="w-full">
              <Plus className="mr-2 h-4 w-4" /> New Note
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1.5 rounded-xl border border-border bg-[#0d1117] px-2">
              <Search className="h-3.5 w-3.5 text-muted flex-shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notes..."
                className="w-full h-9 bg-transparent border-0 px-1 text-xs text-text focus:outline-none placeholder:text-muted"
              />
            </div>
          </div>

          {filteredNotes.length > 0 && (
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {filteredNotes.map(note => (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => { setActiveNoteId(note.id); setRenamingId(null) }}
                  className={`w-full text-left rounded-xl border px-3 py-2.5 transition ${
                    activeNoteId === note.id
                      ? 'border-accent bg-accent/10'
                      : 'border-border bg-base/60 hover:bg-panel'
                  }`}
                >
                  <div className="text-xs font-medium text-text truncate">{note.title}</div>
                  <div className="text-[10px] text-muted mt-0.5 truncate">
                    {note.content.slice(0, 60) || 'Empty note'}
                  </div>
                  <div className="text-[10px] text-muted mt-0.5">{formatDate(note.updatedAt)}</div>
                </button>
              ))}
            </div>
          )}

          {filteredNotes.length === 0 && (
            <div className="text-center text-xs text-muted py-4">
              {search ? 'No notes match your search' : 'No notes yet'}
            </div>
          )}

          {notes.length > 0 && (
            <div className="text-[11px] text-muted text-center">
              {notes.length} note{notes.length !== 1 ? 's' : ''} saved locally
            </div>
          )}

          <Badge className="border-0 bg-accent/15 text-accent">Offline • Persisted in localStorage</Badge>
        </div>
      }
    >
      <div className="space-y-4">
        {activeNote ? (
          <>
            {/* Title */}
            <div className="flex items-center gap-2">
              {renamingId === activeNote.id ? (
                <div className="flex flex-1 items-center gap-1">
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveRename()
                      if (e.key === 'Escape') setRenamingId(null)
                    }}
                    className="flex-1 h-9 rounded-lg border border-accent bg-base/70 px-2 text-sm font-medium text-text focus:outline-none focus:ring-1 focus:ring-accent"
                    autoFocus
                  />
                  <button type="button" onClick={handleSaveRename} className="text-emerald-400 hover:text-emerald-300">
                    <Check className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => setRenamingId(null)} className="text-muted hover:text-text">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-1">
                  <h3 className="text-sm font-semibold text-text flex-1">{activeNote.title}</h3>
                  <button type="button" onClick={handleStartRename} className="text-muted hover:text-text">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleCopyNote}
                  className="rounded-lg border border-border bg-base/60 p-1.5 text-muted hover:text-text transition"
                  title="Copy content"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleExportNote}
                  className="rounded-lg border border-border bg-base/60 p-1.5 text-muted hover:text-text transition"
                  title="Export as .md"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteNote(activeNote.id)}
                  className="rounded-lg border border-red-500/30 bg-red-500/10 p-1.5 text-red-400 hover:text-red-300 transition"
                  title="Delete note"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="text-[10px] text-muted">
              Last edited: {formatDate(activeNote.updatedAt)} · {activeNote.content.length} chars
            </div>

            {/* Content */}
            <textarea
              ref={contentRef}
              value={activeNote.content}
              onChange={(e) => handleUpdateContent(e.target.value)}
              className="w-full min-h-[400px] p-4 border border-border rounded-xl bg-base/50 text-sm font-mono resize-y focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="Start writing your note here...&#10;&#10;Supports plain text and markdown syntax."
              spellCheck={false}
            />
          </>
        ) : (
          <Card className="flex flex-col items-center justify-center py-16 space-y-3">
            <NotebookPen className="h-8 w-8 text-muted" />
            <div className="text-sm font-medium text-text">No note selected</div>
            <div className="text-xs text-muted">
              Select a note from the sidebar or create a new one to get started.
            </div>
            <Button variant="outline" onClick={handleCreateNote} className="mt-2">
              <Plus className="mr-2 h-4 w-4" /> Create Note
            </Button>
          </Card>
        )}
      </div>
    </BaseToolLayout>
  )
}
