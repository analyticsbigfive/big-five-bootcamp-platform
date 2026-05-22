export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-64 bg-slate-200 rounded animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-slate-100 animate-pulse" />
        ))}
      </div>
      <div className="h-96 rounded-2xl bg-slate-100 animate-pulse" />
    </div>
  )
}
