'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/Loading';

const BENEFITS = [
  { label: 'Profile intelligence', value: 'Resume + goals + preferences in one place' },
  { label: 'AI job matching', value: 'Spot higher-fit roles faster' },
  { label: 'Application workflow', value: 'Track each opportunity without chaos' },
];

export default function SignupPage() {
  const [formData, setFormData] = useState({ email: '', name: '', password: '' });
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

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, name: formData.name, password: formData.password }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Sign up failed');
      }

      setSubmitted(true);
      setTimeout(() => router.push('/dashboard/onboarding'), 800);
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
    <div className="mx-auto grid min-h-[calc(100vh-72px)] max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[0.98fr_1.02fr] lg:px-8 lg:py-16">
      <section className="flex items-center justify-center order-2 lg:order-1">
        <div className="premium-card gradient-border w-full max-w-xl p-7 md:p-9">
          <div className="mb-8">
            <div className="badge mb-4">Get started</div>
            <h1 className="text-3xl font-bold text-white md:text-4xl">Create your Careeva workspace</h1>
            <p className="mt-3 text-sm leading-6 text-slate-400 md:text-base">
              Set up your account once, then move straight into onboarding, resume upload, and better-fit applications.
            </p>
          </div>

          {submitted ? (
            <div className="rounded-3xl border border-emerald-500/25 bg-emerald-500/10 p-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-2xl text-emerald-200">✓</div>
              <h3 className="mt-4 text-xl font-semibold text-emerald-100">Account ready</h3>
              <p className="mt-2 text-sm text-emerald-200/90">Taking you into onboarding so your recommendations can start strong.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="name" className="field-label">Full name</label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Zachary Bienstock"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="email" className="field-label">Email address</label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="you@example.com"
                  required
                  disabled={loading}
                />
              </div>

              {error && <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}

              <div>
                <label htmlFor="signup-password" className="field-label">Password</label>
                <input
                  id="signup-password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  placeholder="Choose a password (min. 6 characters)"
                  className="field-input mt-1 w-full"
                />
              </div>
              <button type="submit" disabled={loading || !formData.email || !formData.password || formData.password.length < 6} className="btn-primary w-full disabled:opacity-50">
                {loading && <LoadingSpinner />}
                {loading ? 'Creating your workspace...' : 'Create account'}
              </button>
            </form>
          )}

          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-blue-300 hover:text-blue-200">
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <section className="hero-panel gradient-border order-1 p-8 lg:order-2">
        <div className="relative z-10">
          <div className="badge mb-4">Premium workflow</div>
          <h2 className="section-heading text-5xl">A cleaner job search stack from day one.</h2>
          <p className="section-subcopy mt-5 max-w-xl text-base leading-7 md:text-lg">
            Careeva helps you move from scattered tabs and generic AI outputs to a tighter system with real profile context.
          </p>

          <div className="mt-8 space-y-4">
            {BENEFITS.map((item) => (
              <div key={item.label} className="premium-card-soft p-5">
                <div className="text-sm uppercase tracking-[0.18em] text-slate-500">{item.label}</div>
                <div className="mt-2 text-base text-white">{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
