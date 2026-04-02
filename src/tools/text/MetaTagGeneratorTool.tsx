import { useCallback, useMemo, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Switch } from '@/components/ui/Switch'
import { Textarea } from '@/components/ui/Textarea'
import {
  CheckCircle,
  Copy,
  Download,
  ExternalLink,
  Globe,
  Share2,
  Tag,
  Twitter,
} from 'lucide-react'

type MetaTagGeneratorToolProps = {
  tool: ToolDefinition
}

type SectionToggles = {
  standard: boolean
  openGraph: boolean
  twitter: boolean
  jsonLd: boolean
}

const DEFAULT_SECTIONS: SectionToggles = {
  standard: true,
  openGraph: true,
  twitter: true,
  jsonLd: false,
}

const OG_TYPES = [
  'website',
  'article',
  'profile',
  'book',
  'video.movie',
  'music.song',
]

const TWITTER_CARDS = [
  { value: 'summary', label: 'Summary' },
  { value: 'summary_large_image', label: 'Summary Large Image' },
]

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function MetaTagGeneratorTool({ tool }: MetaTagGeneratorToolProps) {
  // Form fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [keywords, setKeywords] = useState('')
  const [author, setAuthor] = useState('')
  const [url, setUrl] = useState('')
  const [imageUrl, setImageUrl] = useState('')

  // OG specific
  const [ogType, setOgType] = useState('website')

  // Twitter card specific
  const [twitterCard, setTwitterCard] = useState('summary_large_image')

  // Section toggles
  const [sections, setSections] = useState<SectionToggles>(DEFAULT_SECTIONS)

  const [copied, setCopied] = useState(false)
  const [copiedPreview, setCopiedPreview] = useState(false)

  // Toggle handler
  const toggleSection = useCallback(
    (key: keyof SectionToggles) => {
      setSections((prev) => ({ ...prev, [key]: !prev[key] }))
    },
    [],
  )

  // Generate HTML output
  const generatedHtml = useMemo(() => {
    const lines: string[] = []

    if (sections.standard) {
      lines.push('<!-- Standard Meta Tags -->')
      if (title) lines.push(`<meta name="title" content="${escapeHtml(title)}">`)
      if (title) lines.push(`<meta charset="UTF-8">`)
      lines.push(`<meta name="viewport" content="width=device-width, initial-scale=1.0">`)
      if (description)
        lines.push(`<meta name="description" content="${escapeHtml(description)}">`)
      if (keywords)
        lines.push(`<meta name="keywords" content="${escapeHtml(keywords)}">`)
      if (author) lines.push(`<meta name="author" content="${escapeHtml(author)}">`)
      lines.push(`<title>${escapeHtml(title || 'Untitled')}</title>`)
      lines.push('')
    }

    if (sections.openGraph) {
      lines.push('<!-- Open Graph Meta Tags -->')
      if (title) lines.push(`<meta property="og:title" content="${escapeHtml(title)}">`)
      if (description)
        lines.push(`<meta property="og:description" content="${escapeHtml(description)}">`)
      if (imageUrl)
        lines.push(`<meta property="og:image" content="${escapeHtml(imageUrl)}">`)
      if (url) lines.push(`<meta property="og:url" content="${escapeHtml(url)}">`)
      lines.push(`<meta property="og:type" content="${ogType}">`)
      lines.push('')
    }

    if (sections.twitter) {
      lines.push('<!-- Twitter Card Meta Tags -->')
      lines.push(`<meta name="twitter:card" content="${twitterCard}">`)
      if (title)
        lines.push(`<meta name="twitter:title" content="${escapeHtml(title)}">`)
      if (description)
        lines.push(`<meta name="twitter:description" content="${escapeHtml(description)}">`)
      if (imageUrl)
        lines.push(`<meta name="twitter:image" content="${escapeHtml(imageUrl)}">`)
      lines.push('')
    }

    if (sections.jsonLd && (title || description || imageUrl || author)) {
      lines.push('<!-- JSON-LD Structured Data -->')
      const articleData: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        ...(title && { headline: title }),
        ...(description && { description: description }),
        ...(imageUrl && { image: imageUrl }),
        ...(author && { author: { '@type': 'Person', name: author } }),
        ...(url && { mainEntityOfPage: { '@type': 'WebPage', '@id': url } }),
        datePublished: new Date().toISOString(),
        dateModified: new Date().toISOString(),
        ...(author && { publisher: { '@type': 'Organization', name: author } }),
      }
      lines.push(
        `<script type="application/ld+json">${JSON.stringify(articleData, null, 2)}</script>`,
      )
      lines.push('')
    }

    return lines.map((line) => (line ? escapeHtml(line) : '')).join('\n')
  }, [title, description, keywords, author, url, imageUrl, ogType, twitterCard, sections])

  const previewTitle = title || 'Your Page Title'
  const previewDescription = description || 'Your page description will appear here...'
  const previewImage = imageUrl || 'https://placehold.co/600x314/1a1a2e/e94560?text=No+Image'
  const previewDomain = url ? new URL(url).hostname : 'example.com'
  const previewSiteName = previewDomain.replace('www.', '')

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(generatedHtml).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [generatedHtml])

  const handleDownload = useCallback(() => {
    const htmlContent = `<!DOCTYPE html>\n<html lang="en">\n<head>\n    ${generatedHtml.replace(/[<>]/g, (m: string) => m === '<' ? '    <' : '>')}\n</head>\n<body>\n    <!-- Meta tags applied to head -->\n</body>\n</html>`

    // Use raw generated lines for download (not escaped)
    const rawLines: string[] = []
    if (sections.standard) {
      rawLines.push('<!-- Standard Meta Tags -->')
      if (title) rawLines.push(`<meta name="title" content="${title}">`)
      rawLines.push(`<meta charset="UTF-8">`)
      rawLines.push(`<meta name="viewport" content="width=device-width, initial-scale=1.0">`)
      if (description) rawLines.push(`<meta name="description" content="${description}">`)
      if (keywords) rawLines.push(`<meta name="keywords" content="${keywords}">`)
      if (author) rawLines.push(`<meta name="author" content="${author}">`)
      rawLines.push(`<title>${title || 'Untitled'}</title>`)
      rawLines.push('')
    }
    if (sections.openGraph) {
      rawLines.push('<!-- Open Graph Meta Tags -->')
      if (title) rawLines.push(`<meta property="og:title" content="${title}">`)
      if (description) rawLines.push(`<meta property="og:description" content="${description}">`)
      if (imageUrl) rawLines.push(`<meta property="og:image" content="${imageUrl}">`)
      if (url) rawLines.push(`<meta property="og:url" content="${url}">`)
      rawLines.push(`<meta property="og:type" content="${ogType}">`)
      rawLines.push('')
    }
    if (sections.twitter) {
      rawLines.push('<!-- Twitter Card Meta Tags -->')
      rawLines.push(`<meta name="twitter:card" content="${twitterCard}">`)
      if (title) rawLines.push(`<meta name="twitter:title" content="${title}">`)
      if (description) rawLines.push(`<meta name="twitter:description" content="${description}">`)
      if (imageUrl) rawLines.push(`<meta name="twitter:image" content="${imageUrl}">`)
      rawLines.push('')
    }
    if (sections.jsonLd && (title || description || imageUrl || author)) {
      rawLines.push('<!-- JSON-LD Structured Data -->')
      const data: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        ...(title && { headline: title }),
        ...(description && { description: description }),
        ...(imageUrl && { image: imageUrl }),
        ...(author && { author: { '@type': 'Person', name: author } }),
        ...(url && { mainEntityOfPage: { '@type': 'WebPage', '@id': url } }),
        datePublished: new Date().toISOString(),
        dateModified: new Date().toISOString(),
      }
      rawLines.push(`<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n</script>`)
      rawLines.push('')
    }
    const bodyHtml = `<!DOCTYPE html>\n<html lang="en">\n<head>\n${rawLines.join('\n')}</head>\n<body>\n</body>\n</html>`
    const blob = new Blob([bodyHtml], { type: 'text/html' })
    const downloadUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = 'meta-tags.html'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(downloadUrl)
  }, [title, description, keywords, author, url, imageUrl, ogType, twitterCard, sections])

  const hasContent = title || description || keywords || author || url || imageUrl

  const options = (
    <div className='space-y-4 text-sm'>
      <div className='space-y-2'>
        <div className='text-xs font-semibold uppercase text-muted'>Sections</div>
        <div className='space-y-2'>
          <Switch
            label='Standard Tags'
            checked={sections.standard}
            onChange={() => toggleSection('standard')}
          />
          <Switch
            label='Open Graph'
            checked={sections.openGraph}
            onChange={() => toggleSection('openGraph')}
          />
          <Switch
            label='Twitter Card'
            checked={sections.twitter}
            onChange={() => toggleSection('twitter')}
          />
          <Switch
            label='JSON-LD'
            checked={sections.jsonLd}
            onChange={() => toggleSection('jsonLd')}
          />
        </div>
      </div>

      <div className='space-y-2'>
        <div className='text-xs font-semibold uppercase text-muted'>OG Type</div>
        <select
          value={ogType}
          onChange={(e) => setOgType(e.target.value)}
          className='w-full rounded-xl border border-border bg-base/70 px-3 py-2 text-sm text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent'
        >
          {OG_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className='space-y-2'>
        <div className='text-xs font-semibold uppercase text-muted'>Twitter Card</div>
        <select
          value={twitterCard}
          onChange={(e) => setTwitterCard(e.target.value)}
          className='w-full rounded-xl border border-border bg-base/70 px-3 py-2 text-sm text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent'
        >
          {TWITTER_CARDS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <Badge className='border-0 bg-accent/15 text-accent'>Offline • Client-side</Badge>
    </div>
  )

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={options}
    >
      <div className='space-y-6'>
        {/* Form inputs */}
        <div className='grid grid-cols-2 gap-4'>
          <div className='space-y-1.5'>
            <label className='text-xs font-semibold uppercase text-muted'>Page Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='My Awesome Page'
            />
          </div>
          <div className='space-y-1.5'>
            <label className='text-xs font-semibold uppercase text-muted'>Author</label>
            <Input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder='John Doe'
            />
          </div>
        </div>

        <div className='space-y-1.5'>
          <label className='text-xs font-semibold uppercase text-muted'>Description</label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder='A brief description of your page...'
            rows={3}
          />
        </div>

        <div className='space-y-1.5'>
          <label className='text-xs font-semibold uppercase text-muted'>
            Keywords <span className='font-normal normal-case text-text'>(comma-separated)</span>
          </label>
          <Input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder='react, typescript, web development'
          />
        </div>

        <div className='grid grid-cols-2 gap-4'>
          <div className='space-y-1.5'>
            <label className='text-xs font-semibold uppercase text-muted'>Page URL</label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder='https://example.com/page'
            />
          </div>
          <div className='space-y-1.5'>
            <label className='text-xs font-semibold uppercase text-muted'>Image URL</label>
            <Input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder='https://example.com/og-image.jpg'
            />
          </div>
        </div>

        {/* Social Media Preview */}
        {hasContent && (
          <Card className='space-y-3'>
            <div className='flex items-center gap-2'>
              <ExternalLink className='h-4 w-4 text-accent' />
              <h3 className='text-sm font-semibold text-text'>Social Media Preview</h3>
              <div className='ml-auto flex gap-2'>
                <Badge className='gap-1'>
                  <Globe className='h-3 w-3' />
                  Facebook
                </Badge>
                <Badge className='gap-1'>
                  <Twitter className='h-3 w-3' />
                  Twitter
                </Badge>
              </div>
            </div>

            {/* Twitter-style card preview */}
            <div
              className='overflow-hidden rounded-xl border border-border bg-base/60'
              style={{ maxWidth: '504px' }}
            >
              {/* Card image */}
              <div className='relative bg-muted/50'>
                <img
                  src={previewImage}
                  alt={previewTitle}
                  className='h-48 w-full object-cover'
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).src =
                      'https://placehold.co/504x264/1a1a2e/e94560?text=Preview'
                  }}
                />
              </div>
              {/* Card content */}
              <div className='px-3 py-2.5'>
                <div className='truncate text-[11px] uppercase tracking-wide text-muted'>
                  {previewSiteName}
                </div>
                <div className='mt-0.5 truncate font-semibold text-text'>
                  {previewTitle}
                </div>
                <div className='line-clamp-2 mt-0.5 text-[13px] text-muted'>
                  {previewDescription}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Generated HTML output */}
        {generatedHtml && (
          <Card className='space-y-3'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <Tag className='h-4 w-4 text-accent' />
                <h3 className='text-sm font-semibold text-text'>Generated HTML</h3>
              </div>
              <div className='flex gap-2'>
                <Button
                  variant='ghost'
                  className='h-7 text-[11px]'
                  onClick={handleCopy}
                >
                  {copied ? (
                    <>
                      <CheckCircle className='mr-1 h-3 w-3 text-green-400' />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className='mr-1 h-3 w-3' />
                      Copy
                    </>
                  )}
                </Button>
                <Button variant='ghost' className='h-7 text-[11px]' onClick={handleDownload}>
                  <Download className='mr-1 h-3 w-3' />
                  Download .html
                </Button>
              </div>
            </div>
            <pre className='overflow-x-auto rounded-xl border border-border bg-base/60 p-3 text-xs font-mono text-text whitespace-pre-wrap break-all'>
              {generatedHtml}
            </pre>
          </Card>
        )}
      </div>
    </BaseToolLayout>
  )
}
