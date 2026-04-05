import { useState, useEffect } from 'react'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function daysInMonth(month, year) {
  if (!month || !year) return 31
  return new Date(parseInt(year), parseInt(month), 0).getDate()
}

const currentYear = new Date().getFullYear()
const MAX_YEAR = currentYear - 5    // min age 5
const MIN_YEAR = currentYear - 100  // max age 100

const YEARS = Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, i) => MAX_YEAR - i)

/**
 * Mobile-friendly DOB picker using 3 select dropdowns (Day / Month / Year).
 * Works as a controlled component — `value` is "YYYY-MM-DD", `onChange` receives the same format.
 * Designed to integrate with react-hook-form's <Controller />.
 */
export default function DOBPicker({ value, onChange, error }) {
  const [day, setDay] = useState('')
  const [month, setMonth] = useState('')
  const [year, setYear] = useState('')

  // Parse initial / externally provided value
  useEffect(() => {
    if (value && typeof value === 'string' && value.length === 10) {
      const [y, m, d] = value.split('-')
      setYear(y || '')
      setMonth(m ? String(parseInt(m, 10)) : '')
      setDay(d ? String(parseInt(d, 10)) : '')
    }
  }, [value])

  const maxDays = daysInMonth(month, year)

  const emit = (d, m, y) => {
    if (d && m && y) {
      onChange(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`)
    } else {
      onChange('')
    }
  }

  const handleDay = (v) => { setDay(v); emit(v, month, year) }

  const handleMonth = (v) => {
    const max = daysInMonth(v, year)
    const safeDay = day && parseInt(day) > max ? String(max) : day
    setMonth(v)
    setDay(safeDay)
    emit(safeDay, v, year)
  }

  const handleYear = (v) => {
    const max = daysInMonth(month, v)
    const safeDay = day && parseInt(day) > max ? String(max) : day
    setYear(v)
    setDay(safeDay)
    emit(safeDay, month, v)
  }

  const selectClass = `
    w-full h-11 px-2 rounded-xl border text-sm font-medium
    bg-white text-gray-900 appearance-none cursor-pointer
    focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
    ${error ? 'border-red-400' : 'border-gray-300'}
  `

  return (
    <div className="flex gap-2">
      {/* Day */}
      <div className="flex-1 min-w-0">
        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1 text-center">Day</label>
        <select value={day} onChange={(e) => handleDay(e.target.value)} className={selectClass}>
          <option value="">—</option>
          {Array.from({ length: maxDays }, (_, i) => i + 1).map((d) => (
            <option key={d} value={String(d)}>{d}</option>
          ))}
        </select>
      </div>

      {/* Month */}
      <div className="flex-[2] min-w-0">
        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1 text-center">Month</label>
        <select value={month} onChange={(e) => handleMonth(e.target.value)} className={selectClass}>
          <option value="">—</option>
          {MONTHS.map((name, i) => (
            <option key={i + 1} value={String(i + 1)}>{name}</option>
          ))}
        </select>
      </div>

      {/* Year */}
      <div className="flex-[1.5] min-w-0">
        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1 text-center">Year</label>
        <select value={year} onChange={(e) => handleYear(e.target.value)} className={selectClass}>
          <option value="">—</option>
          {YEARS.map((y) => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
