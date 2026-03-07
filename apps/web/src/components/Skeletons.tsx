function SkeletonBox({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <SkeletonBox className="h-7 w-64" />
        <SkeletonBox className="mt-2 h-4 w-48" />
      </div>
      {/* Balance card */}
      <SkeletonBox className="h-32 w-full rounded-xl" />
      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <SkeletonBox key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      {/* Chart + budgets */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SkeletonBox className="h-64 rounded-xl" />
        <SkeletonBox className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

export function CardGridSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <SkeletonBox className="h-7 w-40" />
          <SkeletonBox className="mt-2 h-4 w-64" />
        </div>
        <SkeletonBox className="h-10 w-36 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-100 bg-white p-6 shadow-card">
            <SkeletonBox className="h-4 w-3/4" />
            <SkeletonBox className="mt-3 h-3 w-1/2" />
            <SkeletonBox className="mt-4 h-3.5 w-full rounded-full" />
            <SkeletonBox className="mt-3 h-3 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <SkeletonBox className="h-7 w-48" />
          <SkeletonBox className="mt-2 h-4 w-72" />
        </div>
        <SkeletonBox className="h-10 w-32 rounded-xl" />
      </div>
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-card">
            <SkeletonBox className="h-10 w-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <SkeletonBox className="h-4 w-1/3" />
              <SkeletonBox className="h-3 w-2/3" />
            </div>
            <SkeletonBox className="h-8 w-20 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <SkeletonBox className="h-7 w-40" />
        <SkeletonBox className="mt-2 h-4 w-64" />
      </div>
      {/* Filter bar */}
      <div className="flex flex-wrap gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-card">
        {[...Array(5)].map((_, i) => (
          <SkeletonBox key={i} className="h-10 w-32 rounded-xl" />
        ))}
      </div>
      {/* Table */}
      <div className="rounded-xl border border-gray-100 bg-white shadow-card overflow-hidden">
        <div className="border-b border-gray-100 bg-gray-50 px-4 py-3 flex gap-4">
          {[80, 160, 120, 80, 100, 80].map((w, i) => (
            <SkeletonBox key={i} className="h-3" style={{ width: w }} />
          ))}
        </div>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-gray-50 px-4 py-3.5">
            <SkeletonBox className="h-3 w-20" />
            <SkeletonBox className="h-3 w-40" />
            <SkeletonBox className="h-3 w-24" />
            <SkeletonBox className="h-3 w-16 ml-auto" />
            <SkeletonBox className="h-5 w-20 rounded-full" />
            <SkeletonBox className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
