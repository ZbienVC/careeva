'use client';

import { useEffect } from 'react';
import { IconAlertTriangle } from './icons';

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorBoundary({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="premium-card w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-300">
          <IconAlertTriangle size={26} />
        </div>
        <h1 className="mb-2 text-xl font-bold text-white">Something went wrong</h1>
        <p className="mb-6 text-slate-400">{error.message || 'An unexpected error occurred'}</p>
        <button onClick={() => reset()} className="btn-primary w-full">
          Try again
        </button>
      </div>
    </div>
  );
}
