'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/Loading';

const HIGHLIGHTS = [
  'Resume parsing that turns your raw experience into structured profile intelligence.',
  'Cleaner application tracking with visible movement from applied to offer.',
  'AI-generated cover letters that pull from your real profile context.',
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/profile')
      .then((res) => {
        if (res.ok) router.replace('/dashboard');
      })
      .finally(() => setCheckingAuth(false));
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Sign in failed');
      }

      setSubmitted(true);
      setTimeout(() => router.push('/dashboard'), 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="flex min-h-[calc(100vh-72px)] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="mx-auto grid min-h-[calc(100vh-72px)] max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-16">
      <section className="hero-panel gradient-border hidden p-8 lg:flex lg:flex-col lg:justify-between">
        <div className="relative z-10">
          <div className="badge mb-4">Welcome back</div>
          <h1 className="section-heading text-5xl">Pick up your search with less friction.</h1>
          <p className="section-subcopy mt-5 max-w-xl text-base leading-7 md:text-lg">
            Careeva keeps your role targeting, resume intelligence, and application workflow in one polished command center.
          </p>
        </div>

        <div className="relative z-10 mt-10 space-y-4">
          {HIGHLIGHTS.map((item, index) => (
            <div key={item} className="premium-card-soft flex items-start gap-4 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/10 text-sm font-semibold text-white">0{index + 1}</div>
              <p className="text-sm leading-6 text-slate-300">{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex items-center justify-center">
        <div className="premium-card gradient-border w-full max-w-xl p-7 md:p-9">
          <div className="mb-8">
            <div className="badge mb-4">Sign in</div>
            <h1 className="text-3xl font-bold text-white md:text-4xl">Access your dashboard</h1>
            <p className="mt-3 text-sm leading-6 text-slate-400 md:text-base">
              Use the email tied to your account. We’ll drop you straight back into your pipeline.
            </p>
          </div>

          {submitted ? (
            <div className="rounded-3xl border border-emerald-500/25 bg-emerald-500/10 p-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-2xl text-emerald-200">✓</div>
              <h3 className="mt-4 text-xl font-semibold text-emerald-100">Signed in successfully</h3>
              <p className="mt-2 text-sm text-emerald-200/90">Redirecting you to your dashboard now.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="field-label">Email address</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
              )}

              <div>
                <label htmlFor="password" className="field-label">Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="current-password"
                  placeholder="Your password"
                  className="field-input mt-1 w-full"
                />
              </div>
              <button type="submit" disabled={loading || !email || !password} className="btn-primary w-full disabled:opacity-50">
                {loading && <LoadingSpinner />}
                {loading ? 'Signing you in...' : 'Continue to dashboard'}
              </button>
            </form>
          )}

          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
            New here?{' '}
            <Link href="/signup" className="font-semibold text-blue-300 hover:text-blue-200">
              Create your account
            </Link>
            {' '}and get set up in under a minute.
          </div>
        </div>
      </section>
    </div>
  );
}
