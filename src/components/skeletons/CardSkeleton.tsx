export function CardSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-32 bg-zinc-100 animate-pulse rounded-lg" />
      ))}
    </div>
  );
}
