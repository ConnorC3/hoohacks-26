"use client"

import { SECTOR_COLORS, DEFAULT_MIN_WEIGHT, DEFAULT_MAX_PVALUE } from "./constants"

export interface FilterState {
  minWeight: number
  maxPValue: number
  sectors: string[]
}

interface Props {
  filters: FilterState
  onChange: (filters: FilterState) => void
}

const ALL_SECTORS = Object.keys(SECTOR_COLORS)

export function defaultFilters(): FilterState {
  return {
    minWeight: DEFAULT_MIN_WEIGHT,
    maxPValue: DEFAULT_MAX_PVALUE,
    sectors: [],
  }
}

export default function FilterBar({ filters, onChange }: Props) {
  function update(patch: Partial<FilterState>) {
    onChange({ ...filters, ...patch })
  }

  function toggleSector(sector: string) {
    const next = filters.sectors.includes(sector)
      ? filters.sectors.filter((s) => s !== sector)
      : [...filters.sectors, sector]
    update({ sectors: next })
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4 bg-zinc-900 border-b border-zinc-700 text-white">
      <div className="flex flex-wrap items-end gap-6">
        {/* Min edge weight */}
        <label className="flex flex-col gap-1 min-w-40">
          <span className="text-xs text-zinc-400 uppercase tracking-wider">
            Min Edge Weight: <strong>{filters.minWeight.toFixed(2)}</strong>
          </span>
          <input
            type="range"
            min={0}
            max={0.5}
            step={0.01}
            value={filters.minWeight}
            onChange={(e) => update({ minWeight: parseFloat(e.target.value) })}
            className="accent-indigo-500"
          />
        </label>

        {/* Max p-value */}
        <label className="flex flex-col gap-1 min-w-40">
          <span className="text-xs text-zinc-400 uppercase tracking-wider">
            Max p-value: <strong>{filters.maxPValue.toFixed(2)}</strong>
          </span>
          <input
            type="range"
            min={0.01}
            max={0.2}
            step={0.01}
            value={filters.maxPValue}
            onChange={(e) => update({ maxPValue: parseFloat(e.target.value) })}
            className="accent-indigo-500"
          />
        </label>
      </div>

      {/* Sector filter */}
      <div className="flex flex-wrap gap-2">
        {ALL_SECTORS.map((sector) => {
          const active =
            filters.sectors.length === 0 || filters.sectors.includes(sector)
          return (
            <button
              key={sector}
              onClick={() => toggleSector(sector)}
              className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                active
                  ? "border-transparent text-white"
                  : "border-zinc-600 text-zinc-500 bg-transparent"
              }`}
              style={active ? { backgroundColor: SECTOR_COLORS[sector] } : {}}
            >
              {sector}
            </button>
          )
        })}
      </div>
    </div>
  )
}
