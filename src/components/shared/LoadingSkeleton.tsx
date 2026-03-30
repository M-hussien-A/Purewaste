import { Skeleton } from '@/components/ui/skeleton';

interface LoadingSkeletonProps {
  rows?: number;
  columns?: number;
  type?: 'table' | 'card' | 'list';
}

export function LoadingSkeleton({
  rows = 5,
  columns = 4,
  type = 'table',
}: LoadingSkeletonProps) {
  if (type === 'card') {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-6">
            <Skeleton className="mb-2 h-4 w-24" />
            <Skeleton className="h-8 w-32" />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'list') {
    return (
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-8 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton key={j} className="h-6 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
