export function TableSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-10 bg-zinc-100 animate-pulse rounded" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-16 bg-zinc-100/50 animate-pulse rounded" />
      ))}
    </div>
  );
}
