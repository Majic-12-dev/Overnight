import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Bookmark as BookmarkIcon, Plus, Trash2, Pencil, ExternalLink, Copy, Check, Search, Download, X, Tag, Globe } from 'lucide-react'

type BookmarkManagerToolProps = {
  tool: ToolDefinition
}

type Bookmark = {
  id: string
  title: string
  url: string
  tags: string[]
  notes: string
  createdAt: string
}

const STORAGE_KEY = 'docflow-bookmarks'

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function loadBookmarks(): Bookmark[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveBookmarks(bookmarks: Bookmark[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks))
  } catch { /* ignore */ }
}

const TAG_COLORS: Record<string, string> = {
  work: 'bg-blue-500/20 text-blue-300',
  personal: 'bg-purple-500/20 text-purple-300',
  reference: 'bg-emerald-500/20 text-emerald-300',
  tools: 'bg-amber-500/20 text-amber-300',
  docs: 'bg-cyan-500/20 text-cyan-300',
  dev: 'bg-red-500/20 text-red-300',
  design: 'bg-pink-500/20 text-pink-300',
  reading: 'bg-orange-500/20 text-orange-300',
}

function getTagColor(tag: string): string {
  const lower = tag.toLowerCase()
  return TAG_COLORS[lower] ?? 'bg-muted/20 text-muted'
}

export function BookmarkManagerTool({ tool }: BookmarkManagerToolProps) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(loadBookmarks)
  const [search, setSearch] = useState('')
  const [filterTag, setFilterTag] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [formTags, setFormTags] = useState('')
  const [formNotes, setFormNotes] = useState('')

  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    saveBookmarks(bookmarks)
  }, [bookmarks])

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    bookmarks.forEach(b => b.tags.forEach(t => tagSet.add(t)))
    return Array.from(tagSet).sort()
  }, [bookmarks])

  const filteredBookmarks = useMemo(() => {
    let result = bookmarks

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        b =>
          b.title.toLowerCase().includes(q) ||
          b.url.toLowerCase().includes(q) ||
          b.tags.some(t => t.toLowerCase().includes(q)) ||
          b.notes.toLowerCase().includes(q)
      )
    }

    if (filterTag) {
      result = result.filter(b => b.tags.includes(filterTag))
    }

    return result
  }, [bookmarks, search, filterTag])

  const resetForm = useCallback(() => {
    setFormTitle('')
    setFormUrl('')
    setFormTags('')
    setFormNotes('')
    setShowAddForm(false)
    setEditingId(null)
  }, [])

  const handleAdd = useCallback(() => {
    if (!formUrl.trim()) return
    const now = new Date().toISOString()
    const tags = formTags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)
    const newBookmark: Bookmark = {
      id: generateId(),
      title: formTitle.trim() || formUrl.trim(),
      url: formUrl.trim(),
      tags,
      notes: formNotes.trim(),
      createdAt: now,
    }
    setBookmarks(prev => [newBookmark, ...prev])
    resetForm()
  }, [formTitle, formUrl, formTags, formNotes, resetForm])

  const handleDelete = useCallback(
    (id: string) => {
      setBookmarks(prev => prev.filter(b => b.id !== id))
      if (editingId === id) setEditingId(null)
    },
    [editingId]
  )

  const handleCopyUrl = useCallback(
    (bookmark: Bookmark) => {
      navigator.clipboard.writeText(bookmark.url).catch(() => {})
      setCopiedId(bookmark.id)
      if (copyTimeout.current) clearTimeout(copyTimeout.current)
      copyTimeout.current = setTimeout(() => setCopiedId(null), 2000)
    },
    []
  )

  const handleEdit = useCallback((bookmark: Bookmark) => {
    setEditingId(bookmark.id)
    setFormTitle(bookmark.title)
    setFormUrl(bookmark.url)
    setFormTags(bookmark.tags.join(', '))
    setFormNotes(bookmark.notes)
    setShowAddForm(false)
  }, [])

  const handleSaveEdit = useCallback(() => {
    if (!editingId || !formUrl.trim()) return
    const tags = formTags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)
    setBookmarks(prev =>
      prev.map(b =>
        b.id === editingId
          ? { ...b, title: formTitle.trim() || formUrl.trim(), url: formUrl.trim(), tags, notes: formNotes.trim() }
          : b
      )
    )
    resetForm()
  }, [editingId, formTitle, formUrl, formTags, formNotes, resetForm])

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(bookmarks, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'bookmarks.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [bookmarks])

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const FormContent = () => (
    <div className="space-y-3">
      <Input
        value={formTitle}
        onChange={(e) => setFormTitle(e.target.value)}
        placeholder="Title (optional, defaults to URL)"
      />
      <Input
        value={formUrl}
        onChange={(e) => setFormUrl(e.target.value)}
        placeholder="https://example.com/article"
      />
      <Input
        value={formTags}
        onChange={(e) => setFormTags(e.target.value)}
        placeholder="Tags (comma separated): work, docs, tools"
      />
      <textarea
        value={formNotes}
        onChange={(e) => setFormNotes(e.target.value)}
        placeholder="Notes (optional)"
        className="w-full min-h-[60px] p-3 border border-border rounded-lg bg-base/50 text-sm text-text resize-y focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
      <div className="flex gap-2">
        <Button onClick={editingId ? handleSaveEdit : handleAdd} disabled={!formUrl.trim()}>
          {editingId ? 'Save Changes' : <><Plus className="mr-1.5 h-3.5 w-3.5" /> Add Bookmark</>}
        </Button>
        <Button variant="outline" onClick={resetForm}>
          Cancel
        </Button>
      </div>
    </div>
  )

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-muted">Quick Add</span>
            </div>
            <Button onClick={() => { setShowAddForm(true); setEditingId(null) }} className="w-full" variant="outline">
              <Plus className="mr-2 h-4 w-4" /> Add Bookmark
            </Button>
          </div>

          {allTags.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase text-muted">Filter by Tag</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setFilterTag(null)}
                  className={`rounded-lg px-2 py-1 text-[10px] font-medium transition ${
                    filterTag === null
                      ? 'bg-accent/20 text-accent border border-accent/30'
                      : 'bg-base/60 text-muted border border-border hover:text-text'
                  }`}
                >
                  All
                </button>
                {allTags.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                    className={`rounded-lg px-2 py-1 text-[10px] font-medium transition ${
                      filterTag === tag
                        ? `${getTagColor(tag)} border border-current/30`
                        : `${getTagColor(tag)} opacity-60 hover:opacity-100`
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Button variant="ghost" className="w-full text-xs" onClick={handleExport}>
            <Download className="mr-2 h-3 w-3" /> Export as JSON
          </Button>

          <Badge className="border-0 bg-accent/15 text-accent">Offline • Persisted in localStorage</Badge>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Search */}
        <div className="flex items-center gap-1.5 rounded-xl border border-border bg-[#0d1117] px-2">
          <Search className="h-3.5 w-3.5 text-muted flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bookmarks..."
            className="w-full h-9 bg-transparent border-0 px-1 text-sm text-text focus:outline-none placeholder:text-muted"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="text-muted hover:text-text">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Add/Edit Form */}
        {showAddForm && <Card><FormContent /></Card>}
        {editingId && <Card><FormContent /></Card>}

        {/* Bookmark List */}
        <div className="space-y-2">
          {filteredBookmarks.length === 0 && (
            <Card className="flex flex-col items-center justify-center py-12 space-y-3">
              <BookmarkIcon className="h-8 w-8 text-muted" />
              <div className="text-sm font-medium text-text">
                {bookmarks.length === 0 ? 'No bookmarks yet' : 'No bookmarks match'}
              </div>
              <div className="text-xs text-muted">
                {bookmarks.length === 0
                  ? 'Click "Add Bookmark" to save your first link.'
                  : 'Try adjusting your search or tag filter.'}
              </div>
            </Card>
          )}

          {filteredBookmarks.map(bm => (
            <Card key={bm.id} className="space-y-2 group">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-accent flex-shrink-0" />
                    <h4 className="text-sm font-medium text-text truncate">{bm.title}</h4>
                  </div>
                  <a
                    href={bm.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted hover:text-accent flex items-center gap-1 truncate mt-0.5"
                  >
                    {bm.url}
                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  </a>
                  {bm.notes && (
                    <p className="text-xs text-muted mt-1 line-clamp-2">{bm.notes}</p>
                  )}
                  {bm.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {bm.tags.map(tag => (
                        <span
                          key={tag}
                          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${getTagColor(tag)}`}
                        >
                          <Tag className="h-2.5 w-2.5" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="text-[10px] text-muted mt-1">{formatDate(bm.createdAt)}</div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition">
                  <button
                    type="button"
                    onClick={() => handleCopyUrl(bm)}
                    className="rounded p-1 text-muted hover:text-accent transition"
                    title="Copy URL"
                  >
                    {copiedId === bm.id ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEdit(bm)}
                    className="rounded p-1 text-muted hover:text-text transition"
                    title="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(bm.id)}
                    className="rounded p-1 text-muted hover:text-red-400 transition"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {bookmarks.length > 0 && (
          <div className="text-[11px] text-muted text-center">
            {filteredBookmarks.length} of {bookmarks.length} bookmarks
          </div>
        )}
      </div>
    </BaseToolLayout>
  )
}
