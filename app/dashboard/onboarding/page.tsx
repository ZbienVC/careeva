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
    // Check if user is logged in
    profileAPI.get().then((result) => {
      if (!result.success) {
        router.push('/login');
      }
      setLoading(false);
    });
  }, [router]);

  if (loading) {
    return <LoadingPage />;
  }

  if (success) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-green-900 bg-opacity-30 border border-green-700 rounded-lg p-8 text-center">
          <div className="text-5xl mb-4">✓</div>
          <h1 className="text-3xl font-bold text-green-400 mb-4">All Set!</h1>
          <p className="text-green-300 mb-8">
            Your preferences have been saved. Now let's find you some great job opportunities.
          </p>
          <button
            onClick={() => router.push('/dashboard/jobs')}
            className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
          >
            Browse Jobs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-white mb-2">Let's Get to Know You</h1>
      <p className="text-gray-400 mb-8">
        Answer a few questions about your career goals to help us find the best job matches for you.
      </p>

      {error && (
        <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-4 mb-6">
          <p className="text-red-300">{error}</p>
        </div>
      )}

      <OnboardingForm
        onSuccess={() => setSuccess(true)}
        onError={(error) => setError(error)}
      />
    </div>
  );
}
