'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import OnboardingForm from '@/components/OnboardingForm';
import { profileAPI } from '@/lib/api';
import { LoadingPage } from '@/components/Loading';

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    profileAPI.get().then((result) => {
      if (!result.success) router.push('/login');
      setLoading(false);
    });
  }, [router]);

  if (loading) return <LoadingPage />;

  if (success) {
    return (
      <div className="page-shell">
        <div className="hero-panel gradient-border p-10 text-center">
          <div className="relative z-10 mx-auto max-w-2xl">
            <div className="text-6xl">✓</div>
            <h1 className="mt-6 text-4xl font-bold text-white">You’re dialed in.</h1>
            <p className="mt-4 text-lg text-slate-300">
              Your preferences are saved. Careeva can now personalize job matching, ranking, and cover letter generation much more effectively.
            </p>
            <button onClick={() => router.push('/dashboard/jobs')} className="btn-primary mt-8">
              Browse matched jobs
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell space-y-8">
      <section className="hero-panel gradient-border p-8 md:p-10">
        <div className="relative z-10 max-w-3xl">
          <div className="badge mb-4">Onboarding flow</div>
          <h1 className="section-heading text-4xl md:text-5xl">Let’s tune your search direction.</h1>
          <p className="section-subcopy mt-4 text-base md:text-lg">
            This guided setup keeps your preferences coherent across job discovery, profile positioning, and application writing.
          </p>
        </div>
      </section>

      {error && <div className="premium-card border-red-500/30 bg-red-500/10 p-4 text-red-200">{error}</div>}

      <OnboardingForm onSuccess={() => setSuccess(true)} onError={(message) => setError(message)} />
    </div>
  );
}
