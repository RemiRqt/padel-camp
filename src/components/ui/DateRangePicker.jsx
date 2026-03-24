import { useState } from 'react'
import { Calendar } from 'lucide-react'

const PRESETS = [
  { label: "Aujourd'hui", days: 0 },
  { label: '7 jours', days: 7 },
  { label: '30 jours', days: 30 },
  { label: '90 jours', days: 90 },
  { label: 'Cette année', days: -1 },
]

function toInput(date) {
  return date.toISOString().split('T')[0]
}

export default function DateRangePicker({ from, to, onChange }) {
  const [open, setOpen] = useState(false)

  const applyPreset = (days) => {
    const end = new Date()
    let start
    if (days === -1) {
      start = new Date(end.getFullYear(), 0, 1)
    } else if (days === 0) {
      start = new Date()
    } else {
      start = new Date()
      start.setDate(start.getDate() - days)
    }
    onChange(toInput(start), toInput(end))
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-[12px] bg-white border border-separator text-sm hover:border-primary/30 transition-colors cursor-pointer"
      >
        <Calendar className="w-4 h-4 text-primary" />
        <span className="text-text-secondary">
          {from && to
            ? `${new Date(from).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} — ${new Date(to).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
            : 'Période'}
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-[16px] shadow-[0_4px_12px_rgba(11,39,120,0.15)] p-4 w-72">
            <div className="flex flex-wrap gap-1.5 mb-4">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => applyPreset(p.days)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium bg-bg hover:bg-primary hover:text-white transition-colors cursor-pointer"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <div>
                <label className="text-[10px] font-medium text-text-secondary uppercase">Du</label>
                <input
                  type="date"
                  value={from || ''}
                  onChange={(e) => onChange(e.target.value, to)}
                  className="w-full px-3 py-2 rounded-[10px] bg-bg border border-separator text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-text-secondary uppercase">Au</label>
                <input
                  type="date"
                  value={to || ''}
                  onChange={(e) => onChange(from, e.target.value)}
                  className="w-full px-3 py-2 rounded-[10px] bg-bg border border-separator text-sm"
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
