'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/Loading';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Sign in failed');
      }

      setSubmitted(true);
      // Redirect to dashboard immediately
      setTimeout(() => {
        router.push('/dashboard');
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-8">
          <h1 className="text-2xl font-bold text-white mb-2">Welcome Back</h1>
          <p className="text-gray-400 mb-6">Sign in to your Careeva account</p>

          {submitted ? (
            <div className="bg-green-900 bg-opacity-30 border border-green-700 rounded-lg p-4 text-center">
              <div className="text-3xl mb-2">✓</div>
              <h3 className="text-green-400 font-semibold mb-2">Sign In Successful!</h3>
              <p className="text-green-300 text-sm">Welcome back to Careeva</p>
              <p className="text-green-300 text-sm mt-2">Redirecting to dashboard...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  disabled={loading}
                  className="w-full px-4 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none disabled:opacity-50"
                />
              </div>

              {error && (
                <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-3">
                  <p className="text-red-300 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                {loading && <LoadingSpinner />}
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <p className="text-gray-400">
              Don't have an account?{' '}
              <Link href="/signup" className="text-blue-400 hover:text-blue-300">
                Sign up here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
