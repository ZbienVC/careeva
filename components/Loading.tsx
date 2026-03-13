'use client';

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center">
      <div className="relative w-8 h-8">
        <div className="absolute inset-0 rounded-full border-2 border-[#30363d]"></div>
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-500 animate-spin"></div>
      </div>
    </div>
  );
}

export function LoadingPage() {
  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
      <div className="text-center">
        <LoadingSpinner />
        <p className="text-gray-400 mt-4">Loading...</p>
      </div>
    </div>
  );
}

export function LoadingSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-[#161b22] border border-[#30363d] rounded-lg p-6 animate-pulse">
          <div className="h-4 bg-[#30363d] rounded w-3/4 mb-4"></div>
          <div className="h-4 bg-[#30363d] rounded w-1/2"></div>
        </div>
      ))}
    </div>
  );
}
