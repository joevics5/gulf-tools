export function ToolWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="p-6 sm:p-8">
        {children}
      </div>
    </div>
  )
}
