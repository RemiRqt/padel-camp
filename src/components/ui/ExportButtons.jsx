import { useState } from 'react'
import { FileSpreadsheet, FileText, Loader2 } from 'lucide-react'

export default function ExportButtons({ onExcel, onPDF }) {
  const [loadingExcel, setLoadingExcel] = useState(false)
  const [loadingPDF, setLoadingPDF] = useState(false)

  const handleExcel = async () => {
    setLoadingExcel(true)
    try { await onExcel() } finally { setLoadingExcel(false) }
  }

  const handlePDF = async () => {
    setLoadingPDF(true)
    try { await onPDF() } finally { setLoadingPDF(false) }
  }

  return (
    <div className="flex gap-1.5">
      <button
        onClick={handleExcel}
        disabled={loadingExcel}
        title="Export Excel"
        className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] bg-white border border-separator text-xs font-medium text-text-secondary hover:border-success/50 hover:text-success transition-colors cursor-pointer disabled:opacity-50"
      >
        {loadingExcel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
        <span className="hidden sm:inline">Excel</span>
      </button>
      <button
        onClick={handlePDF}
        disabled={loadingPDF}
        title="Export PDF"
        className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] bg-white border border-separator text-xs font-medium text-text-secondary hover:border-danger/50 hover:text-danger transition-colors cursor-pointer disabled:opacity-50"
      >
        {loadingPDF ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
        <span className="hidden sm:inline">PDF</span>
      </button>
    </div>
  )
}
