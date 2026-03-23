import { Skeleton } from "@/components/ui/skeleton";

export function FlightBoardSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
      </div>
      <div className="space-y-2">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 rounded-xl border border-border/50 px-4 py-3"
          >
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-6 w-20 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
