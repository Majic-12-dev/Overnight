import { useState, useMemo, useCallback } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { ArrowLeftRight } from 'lucide-react'

type ToolProps = {
  tool: ToolDefinition
}

type CategoryId = 'length' | 'weight' | 'temperature' | 'speed' | 'data' | 'time'
type UnitId = string

type CategoryUnit = {
  id: UnitId
  label: string
  toBase: (v: number) => number
  fromBase: (v: number) => number
}

type Category = {
  id: CategoryId
  label: string
  units: CategoryUnit[]
}

const categories: Category[] = [
  {
    id: 'length',
    label: 'Length',
    units: [
      { id: 'm', label: 'Meter (m)', toBase: (v) => v, fromBase: (v) => v },
      { id: 'km', label: 'Kilometer (km)', toBase: (v) => v * 1000, fromBase: (v) => v / 1000 },
      { id: 'mi', label: 'Mile (mi)', toBase: (v) => v * 1609.344, fromBase: (v) => v / 1609.344 },
      { id: 'ft', label: 'Foot (ft)', toBase: (v) => v * 0.3048, fromBase: (v) => v / 0.3048 },
      { id: 'in', label: 'Inch (in)', toBase: (v) => v * 0.0254, fromBase: (v) => v / 0.0254 },
      { id: 'cm', label: 'Centimeter (cm)', toBase: (v) => v * 0.01, fromBase: (v) => v / 0.01 },
      { id: 'mm', label: 'Millimeter (mm)', toBase: (v) => v * 0.001, fromBase: (v) => v / 0.001 },
      { id: 'yd', label: 'Yard (yd)', toBase: (v) => v * 0.9144, fromBase: (v) => v / 0.9144 },
    ],
  },
  {
    id: 'weight',
    label: 'Weight',
    units: [
      { id: 'kg', label: 'Kilogram (kg)', toBase: (v) => v, fromBase: (v) => v },
      { id: 'lb', label: 'Pound (lb)', toBase: (v) => v * 0.453592, fromBase: (v) => v / 0.453592 },
      { id: 'oz', label: 'Ounce (oz)', toBase: (v) => v * 0.0283495, fromBase: (v) => v / 0.0283495 },
      { id: 'g', label: 'Gram (g)', toBase: (v) => v * 0.001, fromBase: (v) => v / 0.001 },
      { id: 'mg', label: 'Milligram (mg)', toBase: (v) => v * 0.000001, fromBase: (v) => v / 0.000001 },
      { id: 'ton', label: 'Metric Ton (t)', toBase: (v) => v * 1000, fromBase: (v) => v / 1000 },
    ],
  },
  {
    id: 'temperature',
    label: 'Temperature',
    units: [
      { id: 'C', label: 'Celsius (°C)', toBase: (v) => v, fromBase: (v) => v },
      { id: 'F', label: 'Fahrenheit (°F)', toBase: (v) => (v - 32) * (5 / 9), fromBase: (v) => v * (9 / 5) + 32 },
      { id: 'K', label: 'Kelvin (K)', toBase: (v) => v - 273.15, fromBase: (v) => v + 273.15 },
    ],
  },
  {
    id: 'speed',
    label: 'Speed',
    units: [
      { id: 'm_s', label: 'Meters/sec (m/s)', toBase: (v) => v, fromBase: (v) => v },
      { id: 'kmh', label: 'Kilometers/hr (km/h)', toBase: (v) => v / 3.6, fromBase: (v) => v * 3.6 },
      { id: 'mph', label: 'Miles/hr (mph)', toBase: (v) => v * 0.44704, fromBase: (v) => v / 0.44704 },
      { id: 'kn', label: 'Knots (kn)', toBase: (v) => v * 0.514444, fromBase: (v) => v / 0.514444 },
    ],
  },
  {
    id: 'data',
    label: 'Data',
    units: [
      { id: 'B', label: 'Byte (B)', toBase: (v) => v, fromBase: (v) => v },
      { id: 'KB', label: 'Kilobyte (KB)', toBase: (v) => v * 1024, fromBase: (v) => v / 1024 },
      { id: 'MB', label: 'Megabyte (MB)', toBase: (v) => v * 1048576, fromBase: (v) => v / 1048576 },
      { id: 'GB', label: 'Gigabyte (GB)', toBase: (v) => v * 1073741824, fromBase: (v) => v / 1073741824 },
      { id: 'TB', label: 'Terabyte (TB)', toBase: (v) => v * 1099511627776, fromBase: (v) => v / 1099511627776 },
    ],
  },
  {
    id: 'time',
    label: 'Time',
    units: [
      { id: 'ms', label: 'Millisecond (ms)', toBase: (v) => v * 0.001, fromBase: (v) => v / 0.001 },
      { id: 's', label: 'Second (s)', toBase: (v) => v, fromBase: (v) => v },
      { id: 'min', label: 'Minute (min)', toBase: (v) => v * 60, fromBase: (v) => v / 60 },
      { id: 'hr', label: 'Hour (hr)', toBase: (v) => v * 3600, fromBase: (v) => v / 3600 },
      { id: 'day', label: 'Day (day)', toBase: (v) => v * 86400, fromBase: (v) => v / 86400 },
    ],
  },
]

function getUnit(categoryId: CategoryId, unitId: UnitId): CategoryUnit | undefined {
  const cat = categories.find((c) => c.id === categoryId)
  return cat?.units.find((u) => u.id === unitId)
}

function getUnits(categoryId: CategoryId): CategoryUnit[] {
  return categories.find((c) => c.id === categoryId)?.units ?? []
}

function formatResult(value: number): string {
  if (Number.isNaN(value) || !Number.isFinite(value)) return '—'
  if (value === 0) return '0'
  const abs = Math.abs(value)
  if (abs >= 1e12 || (abs < 1e-6 && abs !== 0)) {
    return value.toExponential(6)
  }
  return parseFloat(value.toPrecision(10)).toString()
}

export function UnitConverterTool({ tool }: ToolProps) {
  const [category, setCategory] = useState<CategoryId>('length')
  const [fromUnit, setFromUnit] = useState<UnitId>('m')
  const [toUnit, setToUnit] = useState<UnitId>('km')
  const [inputValue, setInputValue] = useState('1')

  const handleCategoryChange = (catId: CategoryId) => {
    setCategory(catId)
    const units = getUnits(catId)
    if (units.length >= 2) {
      setFromUnit(units[0].id)
      setToUnit(units[1].id)
    }
  }

  const handleSwap = useCallback(() => {
    setFromUnit(toUnit)
    setToUnit(fromUnit)
  }, [fromUnit, toUnit])

  const converted = useMemo(() => {
    const fromValue = parseFloat(inputValue)
    if (Number.isNaN(fromValue)) return null
    const from = getUnit(category, fromUnit)
    const to = getUnit(category, toUnit)
    if (!from || !to) return null
    const baseValue = from.toBase(fromValue)
    return to.fromBase(baseValue)
  }, [inputValue, category, fromUnit, toUnit])

  const categoryUnits = useMemo(() => getUnits(category), [category])

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted">Category</div>
            <Select
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value as CategoryId)}
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Button variant="outline" onClick={handleSwap} className="w-full">
              <ArrowLeftRight className="mr-2 h-4 w-4" />
              Swap Units
            </Button>
          </div>
          {converted !== null && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
              <div className="text-xs font-semibold text-emerald-400">Result</div>
              <div className="font-mono text-lg text-emerald-300 mt-1">
                {formatResult(converted)}
              </div>
              <div className="text-xs text-muted mt-1">
                {inputValue} {fromUnit} = {formatResult(converted)} {toUnit}
              </div>
            </div>
          )}
        </div>
      }
    >
      <div className="grid grid-cols-[1fr] gap-4">
        <div className="grid grid-cols-[1fr_auto_1fr] gap-4">
          {/* From */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase text-muted">From</label>
            <div className="grid grid-cols-1 gap-2">
              <Select
                value={fromUnit}
                onChange={(e) => setFromUnit(e.target.value)}
              >
                {categoryUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </Select>
              <input
                type="text"
                inputMode="decimal"
                value={inputValue}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '' || v === '-' || /^-?\d*\.?\d*$/.test(v)) {
                    setInputValue(v)
                  }
                }}
                placeholder="Enter value…"
                className="w-full h-10 rounded-xl border border-border bg-base/70 px-3 text-sm font-mono text-text shadow-inner focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          {/* Swap button (centered) */}
          <div className="flex items-end justify-center pb-1">
            <Button variant="ghost" onClick={handleSwap} className="rounded-full p-2 h-10 w-10">
              <ArrowLeftRight className="h-4 w-4" />
            </Button>
          </div>

          {/* To */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase text-muted">To</label>
            <div className="grid grid-cols-1 gap-2">
              <Select
                value={toUnit}
                onChange={(e) => setToUnit(e.target.value)}
              >
                {categoryUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </Select>
              <div className="w-full h-10 rounded-xl border border-border bg-[#0d1117] px-3 text-sm font-mono text-emerald-300 flex items-center">
                {converted !== null ? formatResult(converted) : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Quick reference for all units in this category */}
        {categoryUnits.length > 0 && inputValue !== '' && (
          <div className="mt-2">
            <div className="text-xs font-semibold uppercase text-muted mb-2">All Conversions</div>
            <div className="grid grid-cols-2 gap-1.5">
              {categoryUnits.map((u) => {
                const from = getUnit(category, fromUnit)
                if (!from) return null
                const baseVal = from.toBase(parseFloat(inputValue) || 0)
                const val = u.fromBase(baseVal)
                return (
                  <div
                    key={u.id}
                    className="text-xs font-mono text-muted rounded-lg px-2 py-1.5 bg-base/40 border border-border/50"
                  >
                    <span className="text-text">{u.id}</span>: {formatResult(val)}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </BaseToolLayout>
  )
}
