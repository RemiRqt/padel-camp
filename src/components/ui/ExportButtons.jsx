import { FileSpreadsheet, FileText } from 'lucide-react'

export default function ExportButtons({ onExcel, onPDF }) {
  return (
    <div className="flex gap-1.5">
      <button
        onClick={onExcel}
        title="Export Excel"
        className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] bg-white border border-separator text-xs font-medium text-text-secondary hover:border-success/50 hover:text-success transition-colors cursor-pointer"
      >
        <FileSpreadsheet className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Excel</span>
      </button>
      <button
        onClick={onPDF}
        title="Export PDF"
        className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] bg-white border border-separator text-xs font-medium text-text-secondary hover:border-danger/50 hover:text-danger transition-colors cursor-pointer"
      >
        <FileText className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">PDF</span>
      </button>
    </div>
  )
}
