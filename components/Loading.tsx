'use client';

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center" role="status" aria-label="Loading">
      <div className="relative h-8 w-8">
        <div className="absolute inset-0 rounded-full border-2 border-white/10"></div>
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-blue-400"></div>
      </div>
    </div>
  );
}

export function LoadingPage({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <LoadingSpinner />
        <p className="mt-4 text-sm text-slate-400">{message}</p>
      </div>
    </div>
  );
}

export function LoadingSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="premium-card-soft animate-pulse p-6">
          <div className="mb-4 h-4 w-3/4 rounded bg-white/10"></div>
          <div className="h-4 w-1/2 rounded bg-white/10"></div>
        </div>
      ))}
    </div>
  );
}
