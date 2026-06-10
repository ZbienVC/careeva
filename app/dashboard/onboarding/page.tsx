'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import OnboardingForm from '@/components/OnboardingForm';
import { profileAPI } from '@/lib/api';
import { LoadingPage } from '@/components/Loading';
import { IconCheckCircle } from '@/components/icons';

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [hasResume, setHasResume] = useState(false);

  useEffect(() => {
    profileAPI.get().then((result) => {
      if (!result.success) router.push('/login');
      else setHasResume(Boolean(result.data?.resumeUrl));
      setLoading(false);
    });
  }, [router]);

  if (loading) return <LoadingPage />;

  if (success) {
    return (
      <div className="page-shell">
        <div className="hero-panel gradient-border p-10 text-center">
          <div className="relative z-10 mx-auto max-w-2xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/15 text-emerald-300"><IconCheckCircle size={32} /></div>
            <h1 className="mt-6 text-4xl font-bold text-white">You’re dialed in.</h1>
            <p className="mt-4 text-lg text-slate-300">
              {hasResume
                ? 'Your preferences are saved. Careeva can now personalize job matching, ranking, and cover letter generation much more effectively.'
                : 'Your preferences are saved. One step left before the matching gets sharp: upload your resume so Careeva can learn your real experience and skills.'}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {hasResume ? (
                <button onClick={() => router.push('/dashboard/jobs')} className="btn-primary">
                  Browse matched jobs
                </button>
              ) : (
                <>
                  <button onClick={() => router.push('/dashboard/profile')} className="btn-primary">
                    Upload your resume next
                  </button>
                  <button onClick={() => router.push('/dashboard/jobs')} className="btn-ghost">
                    Skip for now — browse jobs
                  </button>
                </>
              )}
            </div>
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
