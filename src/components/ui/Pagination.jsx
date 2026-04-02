import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-center gap-2 pt-4">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 0}
        className="p-2 rounded-[10px] hover:bg-bg disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
      >
        <ChevronLeft className="w-4 h-4 text-text-secondary" />
      </button>
      <span className="text-sm text-text-secondary">
        {page + 1} / {totalPages}
      </span>
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages - 1}
        className="p-2 rounded-[10px] hover:bg-bg disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
      >
        <ChevronRight className="w-4 h-4 text-text-secondary" />
      </button>
    </div>
  )
}
