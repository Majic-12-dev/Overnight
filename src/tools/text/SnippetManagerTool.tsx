import { useCallback, useState, useMemo, useRef, type ReactNode } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Copy, FileCode, Plus, Trash2, Search, CheckCircle2, FolderOpen } from 'lucide-react'

type SnippetManagerToolProps = { tool: ToolDefinition }

type Snippet = {
  id: string
  title: string
  code: string
  language: string
  tags: string[]
  createdAt: number
  updatedAt: number
}

const STORAGE_KEY = 'docflow-snippets'
const LANGUAGES = [
  'javascript', 'typescript', 'python', 'html', 'css', 'json', 'sql',
  'bash', 'regex', 'markdown', 'yaml', 'xml', 'java', 'c', 'cpp', 'rust',
  'go', 'php', 'ruby', 'swift', 'kotlin', 'other',
]

function loadSnippets(): Snippet[] {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : [] } catch { return [] }
}
function saveSnippets(snippets: Snippet[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snippets)) } catch { /* storage full */ }
}
function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const LANGUAGE_COLORS: Record<string, string> = {
  javascript: 'bg-yellow-500/15 text-yellow-700',
  typescript: 'bg-blue-500/15 text-blue-700',
  python: 'bg-green-500/15 text-green-700',
  html: 'bg-orange-500/15 text-orange-700',
  css: 'bg-pink-500/15 text-pink-700',
  json: 'bg-purple-500/15 text-purple-700',
  sql: 'bg-cyan-500/15 text-cyan-700',
  bash: 'bg-gray-500/15 text-gray-700',
  regex: 'bg-red-500/15 text-red-700',
  markdown: 'bg-slate-500/15 text-slate-700',
  yaml: 'bg-amber-500/15 text-amber-700',
  xml: 'bg-indigo-500/15 text-indigo-700',
}

export function SnippetManagerTool({ tool }: SnippetManagerToolProps) {
  const [snippets, setSnippets] = useState<Snippet[]>(loadSnippets)
  const [view, setView] = useState<'list' | 'edit' | 'new'>('list')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [formTitle, setFormTitle] = useState('')
  const [formCode, setFormCode] = useState('')
  const [formLanguage, setFormLanguage] = useState('javascript')
  const [formTags, setFormTags] = useState('')
  const [copied, setCopied] = useState(false)
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const persist = useCallback((updated: Snippet[]) => { setSnippets(updated); saveSnippets(updated) }, [])
  const selectedSnippet = useMemo(() => snippets.find(s => s.id === selectedId), [snippets, selectedId])

  const filtered = useMemo(() => {
    if (!search.trim()) return snippets
    const q = search.toLowerCase()
    return snippets.filter(s => s.title.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || s.language.toLowerCase().includes(q) || s.tags.some(t => t.toLowerCase().includes(q)))
  }, [snippets, search])

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    snippets.forEach(s => s.tags.forEach(t => tagSet.add(t)))
    return Array.from(tagSet).sort()
  }, [snippets])

  const openEditor = useCallback((snippet?: Snippet) => {
    if (snippet) {
      setFormTitle(snippet.title); setFormCode(snippet.code); setFormLanguage(snippet.language)
      setFormTags(snippet.tags.join(', ')); setSelectedId(snippet.id); setView('edit')
    } else {
      setFormTitle(''); setFormCode(''); setFormLanguage('javascript')
      setFormTags(''); setSelectedId(null); setView('new')
    }
  }, [])

  const saveSnippet = useCallback(() => {
    if (!formTitle.trim()) return
    const tags = formTags.split(',').map(t => t.trim()).filter(Boolean)
    const now = Date.now()
    if (view === 'edit' && selectedId) {
      const updated = snippets.map(s => s.id === selectedId ? { ...s, title: formTitle.trim(), code: formCode, language: formLanguage, tags, updatedAt: now } : s)
      persist(updated)
    } else {
      persist([{ id: createId(), title: formTitle.trim(), code: formCode, language: formLanguage, tags, createdAt: now, updatedAt: now }, ...snippets])
    }
    setView('list'); setSelectedId(null)
  }, [view, selectedId, formTitle, formCode, formLanguage, formTags, snippets, persist])

  const deleteSnippet = useCallback((id: string) => {
    persist(snippets.filter(s => s.id !== id))
    if (selectedId === id) setView('list')
  }, [snippets, selectedId, persist])

  const handleCopy = useCallback((code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current)
      copiedTimeoutRef.current = setTimeout(() => setCopied(false), 2000)
    })
  }, [])

  const handleProcess = useCallback(async (
    files: Array<{ file: File; name: string; size: number }>,
    context: { setProgress: (v: number) => void; setResult: (r: ReactNode | null) => void; setError: (m: string | null) => void }
  ) => {
    if (!files.length) { context.setError('No files selected.'); return }
    context.setProgress(10)
    try {
      const importedSnippets: Snippet[] = []
      for (const file of files) {
        const text = await file.file.text()
        const ext = file.name.split('.').pop()?.toLowerCase() || 'other'
        importedSnippets.push({ id: createId(), title: file.name, code: text, language: ext === 'js' ? 'javascript' : ext === 'ts' ? 'typescript' : ext === 'py' ? 'python' : ext === 'css' ? 'css' : ext === 'html' ? 'html' : ext === 'json' ? 'json' : 'other', tags: ['imported'], createdAt: Date.now(), updatedAt: Date.now() })
      }
      const updated = [...importedSnippets, ...snippets]
      persist(updated)
      context.setProgress(100)
      context.setResult(
        <Card className="space-y-3 border-border bg-base/60 p-4">
          <Badge className="border-0 bg-accent/15 text-accent">Import complete</Badge>
          <div className="text-sm">Imported {importedSnippets.length} snippet(s) from {files.length} file(s).</div>
        </Card>
      )
    } catch (e: unknown) { context.setError(e instanceof Error ? e.message : 'Import failed.') }
  }, [snippets, persist])

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      accept="*/*"
      instructions="Import code files from your device."
      onProcess={handleProcess}
    >
      <Card className="p-4 space-y-3">
        {view === 'list' ? (
          <>
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search snippets by title, code, language, or tag..." className="w-full rounded-lg border border-border bg-base pl-9 pr-3 py-2 text-sm text-text placeholder:text-muted" />
              </div>
              <Button onClick={() => openEditor()} className="gap-2"><Plus className="h-4 w-4" /> New Snippet</Button>
            </div>

            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {allTags.map(tag => (
                  <button key={tag} className="px-2 py-0.5 rounded-full text-xs border border-border hover:bg-accent/10 text-muted hover:text-text transition" onClick={() => setSearch(search === tag ? '' : tag)}>{tag}</button>
                ))}
              </div>
            )}
            {snippets.length === 0 ? (
              <div className="py-8 text-center">
                <FileCode className="h-8 w-8 text-muted mx-auto mb-2" />
                <p className="text-sm text-muted">No snippets saved yet. Create one or import from files.</p>
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted">No snippets match your search.</p>
            ) : (
              <div className="space-y-2">
                {filtered.map(snippet => (
                  <div key={snippet.id} className="flex items-center justify-between rounded-xl border border-border bg-base/60 p-3 text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-text truncate">{snippet.title}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={`border-0 text-xs ${LANGUAGE_COLORS[snippet.language] || 'bg-muted/20'}`}>{snippet.language}</Badge>
                        {snippet.tags.map(t => <span key={t} className="text-xs text-muted">#{t}</span>)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                      <Button variant="ghost" onClick={() => handleCopy(snippet.code)} title="Copy code"><Copy className="h-4 w-4" /></Button>
                      <Button variant="ghost" onClick={() => openEditor(snippet)} title="Edit"><FolderOpen className="h-4 w-4" /></Button>
                      <Button variant="ghost" onClick={() => deleteSnippet(snippet.id)} title="Delete"><Trash2 className="h-4 w-4 text-red-500" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text">{view === 'new' ? 'New Snippet' : 'Edit Snippet'}</h3>
              <Button variant="ghost" onClick={() => setView('list')}>Cancel</Button>
            </div>
            <div>
              <label className="text-xs font-medium">Title</label>
              <input type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="My useful snippet..." className="w-full rounded-lg border border-border bg-base p-2 text-sm text-text placeholder:text-muted" />
            </div>
            <div>
              <label className="text-xs font-medium">Language</label>
              <select value={formLanguage} onChange={(e) => setFormLanguage(e.target.value)} className="w-full rounded-lg border border-border bg-base p-2 text-sm text-text">
                {LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium">Code</label>
              <textarea value={formCode} onChange={(e) => setFormCode(e.target.value)} placeholder="Paste your snippet here..." rows={12} className="w-full rounded-lg border border-border bg-base p-3 font-mono text-xs text-text placeholder:text-muted resize-y" spellCheck={false} />
            </div>
            <div>
              <label className="text-xs font-medium">Tags (comma-separated)</label>
              <input type="text" value={formTags} onChange={(e) => setFormTags(e.target.value)} placeholder="helper, auth, react..." className="w-full rounded-lg border border-border bg-base p-2 text-sm text-text placeholder:text-muted" />
              {formTags.trim() && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {formTags.split(',').map(t => t.trim()).filter(Boolean).map((tag, i) => <Badge key={i} className="border-0 bg-muted/20 text-muted text-xs">#{tag}</Badge>)}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={saveSnippet}>{view === 'new' ? 'Create Snippet' : 'Save Changes'}</Button>
              {copied && <Badge className="border-0 bg-green-500/15 text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Copied</Badge>}
            </div>
          </div>
        )}
      </Card>
    </BaseToolLayout>
  )
}
