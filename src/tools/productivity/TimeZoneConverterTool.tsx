import { useEffect, useMemo, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Select'
import { Clock, Globe, Plus, Trash2, ArrowLeftRight, Copy, Check } from 'lucide-react'

type ToolProps = {
  tool: ToolDefinition
}

type CityEntry = {
  id: string
  label: string
  timezone: string
  offset: string
  emoji: string
}

const COMMON_TIMEZONES: CityEntry[] = [
  { id: 'utc', label: 'UTC', timezone: 'UTC', offset: '+00:00', emoji: '🌐' },
  { id: 'ny', label: 'New York', timezone: 'America/New_York', offset: 'varies', emoji: '🗽' },
  { id: 'chicago', label: 'Chicago', timezone: 'America/Chicago', offset: 'varies', emoji: '🏙️' },
  { id: 'la', label: 'Los Angeles', timezone: 'America/Los_Angeles', offset: 'varies', emoji: '🌴' },
  { id: 'london', label: 'London', timezone: 'Europe/London', offset: 'varies', emoji: '🇬🇧' },
  { id: 'paris', label: 'Paris', timezone: 'Europe/Paris', offset: 'varies', emoji: '🇫🇷' },
  { id: 'berlin', label: 'Berlin', timezone: 'Europe/Berlin', offset: 'varies', emoji: '🇩🇪' },
  { id: 'moscow', label: 'Moscow', timezone: 'Europe/Moscow', offset: 'varies', emoji: '🇷🇺' },
  { id: 'dubai', label: 'Dubai', timezone: 'Asia/Dubai', offset: 'varies', emoji: '🏗️' },
  { id: 'mumbai', label: 'Mumbai', timezone: 'Asia/Kolkata', offset: 'varies', emoji: '🇮🇳' },
  { id: 'shanghai', label: 'Shanghai', timezone: 'Asia/Shanghai', offset: 'varies', emoji: '🇨🇳' },
  { id: 'tokyo', label: 'Tokyo', timezone: 'Asia/Tokyo', offset: 'varies', emoji: '🗼' },
  { id: 'sydney', label: 'Sydney', timezone: 'Australia/Sydney', offset: 'varies', emoji: '🇦🇺' },
  { id: 'auckland', label: 'Auckland', timezone: 'Pacific/Auckland', offset: 'varies', emoji: '🇳🇿' },
  { id: 'sao', label: 'São Paulo', timezone: 'America/Sao_Paulo', offset: 'varies', emoji: '🇧🇷' },
  { id: 'dakar', label: 'Dakar', timezone: 'Africa/Dakar', offset: 'varies', emoji: '🇸🇳' },
]

function getUtcOffset(timezone: string, date?: Date): string {
  try {
    const d = date ?? new Date()
    const str = d.toLocaleString('en-GB', { timeZone: timezone, timeZoneName: 'shortOffset' })
    const match = str.match(/GMT([+-]\d{1,2}(?::\d{2})?)/)
    if (match) {
      // Normalize offset to always have HH:MM
      const raw = match[1]
      const [h, m] = raw.split(':')
      const hours = parseInt(h).toString().padStart(2, '0')
      const mins = m ?? '00'
      return `UTC${h.startsWith('-') ? '' : '+'}${hours}:${mins}`
    }
    // Fallback: use offsetFromUtc calculation
    const utcStr = d.toLocaleString('en-GB', { timeZone: 'UTC' })
    const tzStr = d.toLocaleString('en-GB', { timeZone: timezone })
    const utcMs = new Date(utcStr).getTime()
    const tzMs = new Date(tzStr).getTime()
    const diffMin = Math.round((tzMs - utcMs) / 60000)
    const sign = diffMin >= 0 ? '+' : '-'
    const absMin = Math.abs(diffMin)
    const hh = Math.floor(absMin / 60).toString().padStart(2, '0')
    const mm = (absMin % 60).toString().padStart(2, '0')
    return `UTC${sign}${hh}:${mm}`
  } catch {
    return 'UTC'
  }
}

function getTimeInZone(timezone: string, date?: Date): string {
  try {
    return new Date(date ?? Date.now()).toLocaleTimeString('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  } catch {
    return '--:--:--'
  }
}

function getTimeInZoneWithDate(timezone: string, date?: Date): { time: string; dateStr: string; dayName: string } {
  try {
    const d = date ?? new Date()
    return {
      time: d.toLocaleTimeString('en-GB', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }),
      dateStr: d.toLocaleDateString('en-GB', {
        timeZone: timezone,
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      dayName: d.toLocaleDateString('en-GB', {
        timeZone: timezone,
        weekday: 'short',
      }),
    }
  } catch {
    return { time: '--:--:--', dateStr: '--', dayName: '--' }
  }
}

function convertTime(
  sourceTz: string,
  targetTz: string,
  hours: number,
  minutes: number,
): { time: string; dateStr: string; dayName: string; dayDiff: number } {
  const now = new Date()
  const sourceParts = now.toLocaleString('en-GB', {
    timeZone: sourceTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).split(/[/ ,:]/)

  const sourceDate = new Date(
    parseInt(sourceParts[2]),
    parseInt(sourceParts[1]) - 1,
    parseInt(sourceParts[0]),
    hours,
    minutes,
  )

  // Now map this source-zone local date back to UTC, then to target zone
  // Approach: compute the UTC offset difference
  const sourceUtcOffset = getOffsetMinutes(sourceTz)
  const targetUtcOffset = getOffsetMinutes(targetTz)
  const diffMinutes = targetUtcOffset - sourceUtcOffset

  const targetDate = new Date(sourceDate.getTime() + diffMinutes * 60000)

  const dayDiff = Math.round(
    (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  )

  return {
    time: targetDate.toLocaleTimeString('en-GB', {
      timeZone: targetTz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
    dateStr: targetDate.toLocaleDateString('en-GB', {
      timeZone: targetTz,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
    dayName: targetDate.toLocaleDateString('en-GB', {
      timeZone: targetTz,
      weekday: 'short',
    }),
    dayDiff,
  }
}

function getOffsetMinutes(timezone: string): number {
  const now = new Date()
  const utcStr = now.toLocaleString('en-GB', { timeZone: 'UTC' })
  const tzStr = now.toLocaleString('en-GB', { timeZone: timezone })
  return Math.round((new Date(tzStr).getTime() - new Date(utcStr).getTime()) / 60000)
}

const DEFAULT_CLOCK_IDS = ['ny', 'london', 'tokyo', 'sydney', 'dubai', 'mumbai']

export function TimeZoneConverterTool({ tool }: ToolProps) {
  const [tick, setTick] = useState(0)
  const [selectedClockIds, setSelectedClockIds] = useState<string[]>(DEFAULT_CLOCK_IDS)
  const [showAdd, setShowAdd] = useState(false)
  const [addQuery, setAddQuery] = useState('')
  const [clockAddKey, setClockAddKey] = useState(0) // force re-render when adding

  // Converter state
  const [sourceTz, setSourceTz] = useState('America/New_York')
  const [targetTz, setTargetTz] = useState('Asia/Tokyo')
  const [convHour, setConvHour] = useState(9)
  const [convMin, setConvMin] = useState(0)
  const [copied, setCopied] = useState(false)

  // Live clock tick
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const selectedCities = useMemo(
    () =>
      selectedClockIds
        .map((id) => COMMON_TIMEZONES.find((c) => c.id === id))
        .filter(Boolean) as CityEntry[],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedClockIds, clockAddKey, tick],
  )

  const filteredOptions = useMemo(() => {
    if (!addQuery.trim()) return COMMON_TIMEZONES.filter((c) => !selectedClockIds.includes(c.id))
    const q = addQuery.toLowerCase()
    return COMMON_TIMEZONES.filter(
      (c) =>
        !selectedClockIds.includes(c.id) &&
        (c.label.toLowerCase().includes(q) || c.timezone.toLowerCase().includes(q)),
    )
  }, [addQuery, selectedClockIds, clockAddKey])

  const handleAddCity = (entry: CityEntry) => {
    setSelectedClockIds((prev) => [...prev, entry.id])
    setClockAddKey((k) => k + 1)
    setAddQuery('')
    setShowAdd(false)
  }

  const handleRemoveCity = (id: string) => {
    setSelectedClockIds((prev) => prev.filter((c) => c !== id))
  }

  const handleSwapConverter = () => {
    setSourceTz(targetTz)
    setTargetTz(sourceTz)
  }

  const converted = useMemo(() => {
    return convertTime(sourceTz, targetTz, convHour, convMin)
  }, [sourceTz, targetTz, convHour, convMin])

  const handleCopyConverted = () => {
    const text = `${converted.time} — ${converted.dayName}, ${converted.dateStr} (${targetTz})`
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const sourceLabel = COMMON_TIMEZONES.find((c) => c.timezone === sourceTz)?.label ?? sourceTz
  const targetLabel = COMMON_TIMEZONES.find((c) => c.timezone === targetTz)?.label ?? targetTz

  const converterOptions = (
    <div className="space-y-4 text-sm">
      <div className="space-y-3">
        <div>
          <div className="text-xs font-semibold uppercase text-muted mb-1">From</div>
          <Select value={sourceTz} onChange={(e) => setSourceTz(e.target.value)}>
            {COMMON_TIMEZONES.map((c) => (
              <option key={c.id} value={c.timezone}>
                {c.emoji} {c.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex justify-center">
          <Button variant="ghost" size="sm" onClick={handleSwapConverter}>
            <ArrowLeftRight className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase text-muted mb-1">To</div>
          <Select value={targetTz} onChange={(e) => setTargetTz(e.target.value)}>
            {COMMON_TIMEZONES.map((c) => (
              <option key={c.id} value={c.timezone}>
                {c.emoji} {c.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold uppercase text-muted mb-1">Time</div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs text-muted">Hour</label>
            <Select value={String(convHour)} onChange={(e) => setConvHour(Number(e.target.value))}>
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>
                  {i.toString().padStart(2, '0')}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex-1">
            <label className="text-xs text-muted">Minute</label>
            <Select value={String(convMin)} onChange={(e) => setConvMin(Number(e.target.value))}>
              {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                <option key={m} value={m}>
                  {m.toString().padStart(2, '0')}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-accent/20 bg-accent/10 p-3 space-y-1">
        <div className="text-xs font-semibold text-accent">Converted Time</div>
        <div className="font-mono text-2xl text-text">{converted.time}</div>
        <div className="text-xs text-muted">
          {converted.dayName}, {converted.dateStr}
        </div>
        {converted.dayDiff !== 0 && (
          <Badge className={converted.dayDiff > 0 ? 'bg-emerald-500/15 text-emerald-400 border-0' : 'bg-blue-500/15 text-blue-400 border-0'}>
            {converted.dayDiff > 0 ? `+${converted.dayDiff} day` : `${converted.dayDiff} day`}
            {Math.abs(converted.dayDiff) !== 1 ? 's' : ''}
          </Badge>
        )}
        <div className="text-xs text-muted mt-1">
          {convHour.toString().padStart(2, '0')}:{convMin.toString().padStart(2, '0')} {sourceLabel} → {targetLabel}
        </div>
        <Button variant="ghost" size="sm" onClick={handleCopyConverted} className="mt-1">
          {copied ? <Check className="h-3 w-3 mr-1 text-emerald-400" /> : <Copy className="h-3 w-3 mr-1" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>

      <Badge className="border-0 bg-accent/15 text-accent">Client-side · Live clock</Badge>
    </div>
  )

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={converterOptions}
    >
      <div className="space-y-6">
        {/* World Clock Grid */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-text">World Clock</h2>
            <Button variant="outline" size="sm" onClick={() => setShowAdd(!showAdd)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add City
            </Button>
          </div>

          {/* Add city dropdown */}
          {showAdd && (
            <Card className="mb-4 border-accent/30 bg-accent/5 space-y-2">
              <input
                type="text"
                placeholder="Search cities…"
                value={addQuery}
                onChange={(e) => setAddQuery(e.target.value)}
                className="w-full h-9 rounded-lg border border-border bg-base/70 px-3 text-sm text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <div className="max-h-40 overflow-y-auto space-y-1">
                {filteredOptions.length === 0 ? (
                  <div className="text-xs text-muted py-2">No matching cities found.</div>
                ) : (
                  filteredOptions.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => handleAddCity(entry)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-text hover:bg-accent/10 transition"
                    >
                      <span>{entry.emoji}</span>
                      <span className="flex-1 text-left">{entry.label}</span>
                      <span className="text-xs font-mono text-muted">{entry.timezone}</span>
                    </button>
                  ))
                )}
              </div>
            </Card>
          )}

          {/* Clock Grid */}
          {selectedCities.length === 0 ? (
            <Card className="text-center py-8">
              <Globe className="h-8 w-8 text-muted mx-auto mb-2" />
              <p className="text-sm text-muted">Add cities to see their current time.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {selectedCities.map((city) => {
                const { time, dateStr, dayName } = getTimeInZoneWithDate(city.timezone)
                const utcOffset = getUtcOffset(city.timezone)
                return (
                  <Card key={city.id} className="relative group space-y-2 hover:border-accent/40 transition-colors">
                    <button
                      type="button"
                      onClick={() => handleRemoveCity(city.id)}
                      className="absolute top-2 right-2 p-1 rounded-md text-muted hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition"
                      title="Remove"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>

                    <div className="flex items-center gap-1.5">
                      <span className="text-lg">{city.emoji}</span>
                      <div>
                        <div className="text-sm font-semibold text-text">{city.label}</div>
                        <div className="text-xs font-mono text-muted">{utcOffset}</div>
                      </div>
                    </div>

                    <div className="font-mono text-2xl font-bold text-text tracking-tight">
                      {time}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-muted" />
                      <span className="text-xs text-muted">
                        {dayName}, {dateStr}
                      </span>
                    </div>

                    {/* Relative to local */}
                    <RelativeBadge cityTz={city.timezone} />
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        {/* Converter inline summary */}
        <Card className="space-y-2">
          <h3 className="text-sm font-semibold text-text flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-accent" />
            Quick Convert
          </h3>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-sm">
            <div className="flex-1 font-mono text-text">
              {convHour.toString().padStart(2, '0')}:{convMin.toString().padStart(2, '0')}{' '}
              <span className="text-muted">({sourceLabel})</span>
            </div>
            <ArrowLeftRight className="h-4 w-4 text-muted flex-shrink-0" />
            <div className="flex-1 font-mono text-lg text-emerald-300">
              {converted.time}{' '}
              <span className="text-xs text-muted">({targetLabel})</span>
            </div>
            {converted.dayDiff !== 0 && (
              <Badge className={converted.dayDiff > 0 ? 'bg-emerald-500/15 text-emerald-400 border-0 flex-shrink-0' : 'bg-blue-500/15 text-blue-400 border-0 flex-shrink-0'}>
                {converted.dayDiff > 0 ? `+${converted.dayDiff}` : converted.dayDiff}d
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted">Use the Options panel for full conversion controls.</p>
        </Card>
      </div>
    </BaseToolLayout>
  )
}

function RelativeBadge({ cityTz }: { cityTz: string }) {
  const diffMin = useMemo(() => {
    return getOffsetMinutes(cityTz) - getOffsetMinutes('UTC')
  }, [cityTz]) // tick is handled via parent re-render

  const hours = Math.floor(Math.abs(diffMin) / 60)
  const mins = Math.abs(diffMin) % 60
  const sign = diffMin >= 0 ? '+' : '-'
  const label = mins > 0 ? `${sign}${hours}:${mins.toString().padStart(2, '0')}h` : `${sign}${hours}h`

  return (
    <Badge className={`border-0 text-xs ${diffMin >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-orange-500/10 text-orange-400'}`}>
      {label} from UTC
    </Badge>
  )
}
