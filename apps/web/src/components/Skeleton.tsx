export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3 animate-fade-in">
      <div className="skeleton h-4 w-1/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton h-3" style={{ width: `${85 - i * 15}%` }} />
      ))}
    </div>
  );
}

export function SkeletonHero() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-200 to-slate-300 p-8 space-y-4 animate-pulse">
      <div className="skeleton h-3 w-24 !bg-slate-400/30" />
      <div className="skeleton h-12 w-40 !bg-slate-400/30" />
      <div className="skeleton h-3 w-56 !bg-slate-400/30" />
      <div className="flex gap-2 mt-4">
        <div className="skeleton h-6 w-24 rounded-full !bg-slate-400/30" />
        <div className="skeleton h-6 w-28 rounded-full !bg-slate-400/30" />
      </div>
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-4 animate-fade-in">
      <SkeletonHero />
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
            <div className="skeleton h-2 w-12" />
            <div className="skeleton h-6 w-16" />
            <div className="skeleton h-2 w-10" />
          </div>
        ))}
      </div>
      <SkeletonCard lines={2} />
      <SkeletonCard lines={4} />
    </div>
  );
}
