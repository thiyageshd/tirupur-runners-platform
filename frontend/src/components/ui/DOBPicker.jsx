import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import {
  format, getDaysInMonth, startOfMonth, getDay,
  addMonths, subMonths, setYear as dfSetYear,
  parse, isValid,
} from 'date-fns'

const currentYear = new Date().getFullYear()
const MAX_YEAR = currentYear - 5   // min age 5
const MIN_YEAR = currentYear - 100

const YEARS = Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, i) => MAX_YEAR - i)
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function parseISO(v) {
  if (!v) return null
  const d = parse(v, 'yyyy-MM-dd', new Date())
  return isValid(d) ? d : null
}

/**
 * Modern DOB picker — calendar popup with month navigation + year grid.
 * Controlled component: value = "YYYY-MM-DD", onChange receives same format.
 */
export default function DOBPicker({ value, onChange, error }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('days') // 'days' | 'years'
  const [selected, setSelected] = useState(parseISO(value))
  const [viewDate, setViewDate] = useState(parseISO(value) || new Date(1995, 0, 1))
  const containerRef = useRef(null)
  const yearListRef = useRef(null)

  // Sync if parent resets value
  useEffect(() => {
    const d = parseISO(value)
    setSelected(d)
    if (d) setViewDate(d)
  }, [value])

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
        setMode('days')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Scroll selected year into view when year grid opens
  useEffect(() => {
    if (mode === 'years' && yearListRef.current) {
      const active = yearListRef.current.querySelector('[data-active="true"]')
      active?.scrollIntoView({ block: 'center' })
    }
  }, [mode])

  const viewYear = viewDate.getFullYear()
  const viewMonth = viewDate.getMonth()

  // Build calendar grid (nulls = leading empty cells)
  const totalDays = getDaysInMonth(viewDate)
  const startOffset = getDay(startOfMonth(viewDate)) // 0 = Sunday
  const cells = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ]

  const selectDay = (day) => {
    const d = new Date(viewYear, viewMonth, day)
    setSelected(d)
    onChange(format(d, 'yyyy-MM-dd'))
    setOpen(false)
    setMode('days')
  }

  const selectYear = (y) => {
    setViewDate(dfSetYear(viewDate, y))
    setMode('days')
  }

  const prevMonth = () => {
    const prev = subMonths(viewDate, 1)
    if (prev.getFullYear() >= MIN_YEAR) setViewDate(prev)
  }

  const nextMonth = () => {
    const next = addMonths(viewDate, 1)
    if (next.getFullYear() <= MAX_YEAR) setViewDate(next)
  }

  const isSelectedDay = (day) =>
    selected &&
    selected.getDate() === day &&
    selected.getMonth() === viewMonth &&
    selected.getFullYear() === viewYear

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger input */}
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setMode('days') }}
        className={`
          w-full h-11 px-4 flex items-center justify-between rounded-xl border text-sm transition-all
          bg-white font-medium
          ${error
            ? 'border-red-400 ring-2 ring-red-100'
            : open
            ? 'border-brand-500 ring-2 ring-brand-500/20'
            : 'border-gray-300 hover:border-gray-400'
          }
        `}
      >
        <span className={selected ? 'text-gray-900' : 'text-gray-400'}>
          {selected ? format(selected, 'd MMMM yyyy') : 'Select date of birth'}
        </span>
        <Calendar size={15} className={error ? 'text-red-400' : 'text-gray-400'} />
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute z-50 mt-2 left-0 bg-white border border-gray-200 rounded-2xl shadow-2xl p-4 w-72 select-none">

          {/* ── Day / Calendar view ── */}
          {mode === 'days' && (
            <>
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>

                <button
                  type="button"
                  onClick={() => setMode('years')}
                  className="text-sm font-semibold text-gray-900 hover:text-brand-600 px-3 py-1.5 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  {format(viewDate, 'MMMM yyyy')}
                </button>

                <button
                  type="button"
                  onClick={nextMonth}
                  className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Weekday labels */}
              <div className="grid grid-cols-7 mb-2">
                {DAY_LABELS.map((d) => (
                  <div key={d} className="text-center text-[10px] font-semibold text-gray-400 tracking-wide py-1">
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-y-1">
                {cells.map((day, i) =>
                  day === null ? (
                    <div key={`e-${i}`} />
                  ) : (
                    <button
                      key={day}
                      type="button"
                      onClick={() => selectDay(day)}
                      className={`
                        w-9 h-9 mx-auto flex items-center justify-center rounded-full text-sm font-medium transition-colors
                        ${isSelectedDay(day)
                          ? 'bg-brand-600 text-white shadow-sm'
                          : 'text-gray-700 hover:bg-brand-50 hover:text-brand-600'
                        }
                      `}
                    >
                      {day}
                    </button>
                  )
                )}
              </div>
            </>
          )}

          {/* ── Year picker view ── */}
          {mode === 'years' && (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-900">Select Year</span>
                <button
                  type="button"
                  onClick={() => setMode('days')}
                  className="text-xs text-gray-400 hover:text-gray-600 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100"
                >
                  ✕
                </button>
              </div>

              <div
                ref={yearListRef}
                className="grid grid-cols-4 gap-1 max-h-56 overflow-y-auto pr-1"
              >
                {YEARS.map((y) => (
                  <button
                    key={y}
                    type="button"
                    data-active={y === viewYear}
                    onClick={() => selectYear(y)}
                    className={`
                      py-2 rounded-xl text-sm font-medium transition-colors
                      ${y === viewYear
                        ? 'bg-brand-600 text-white'
                        : 'text-gray-700 hover:bg-brand-50 hover:text-brand-600'
                      }
                    `}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
