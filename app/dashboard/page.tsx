'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UserProfile, JobWithScore } from '@/lib/types';
import { profileAPI, jobsAPI } from '@/lib/api';
import { LoadingPage, LoadingSkeleton } from '@/components/Loading';
import ResumeUpload from '@/components/ResumeUpload';

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [recentJobs, setRecentJobs] = useState<JobWithScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load profile
        const profileResult = await profileAPI.get();
        if (!profileResult.success) {
          router.push('/login');
          return;
        }
        setProfile(profileResult.data!);

        // Load recent jobs
        const jobsResult = await jobsAPI.list({ pageSize: 5 });
        if (jobsResult.success) {
          setRecentJobs(jobsResult.data?.jobs || []);
        }
      } catch (err) {
        setError('Failed to load dashboard');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [router]);

  if (loading) {
    return <LoadingPage />;
  }

  if (error || !profile) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-6 text-center">
          <p className="text-red-300">{error || 'Failed to load profile'}</p>
          <Link href="/" className="text-blue-400 hover:text-blue-300 mt-4 inline-block">
            Return to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-white mb-2">
          Welcome back, {profile.jobTitle || 'User'}! 👋
        </h1>
        <p className="text-gray-400">Here's your job search dashboard</p>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-4 mb-12">
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="bg-[#161b22] border border-[#30363d] hover:border-blue-500 rounded-lg p-6 text-left transition-colors"
        >
          <div className="text-3xl mb-2">📄</div>
          <h3 className="font-bold text-white">Upload Resume</h3>
          <p className="text-gray-400 text-sm mt-1">Update your resume for better matches</p>
        </button>

        <Link href="/dashboard/onboarding" className="bg-[#161b22] border border-[#30363d] hover:border-purple-500 rounded-lg p-6 text-left transition-colors">
          <div className="text-3xl mb-2">🎯</div>
          <h3 className="font-bold text-white">Job Preferences</h3>
          <p className="text-gray-400 text-sm mt-1">Set your career goals and preferences</p>
        </Link>

        <Link href="/dashboard/jobs" className="bg-[#161b22] border border-[#30363d] hover:border-green-500 rounded-lg p-6 text-left transition-colors">
          <div className="text-3xl mb-2">💼</div>
          <h3 className="font-bold text-white">Browse Jobs</h3>
          <p className="text-gray-400 text-sm mt-1">Explore job opportunities</p>
        </Link>
      </div>

      {/* Resume Upload Modal */}
      {showUpload && (
        <div className="mb-12">
          <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Upload or Update Resume</h2>
              <button
                onClick={() => setShowUpload(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ✕
              </button>
            </div>
            <ResumeUpload
              onSuccess={() => {
                setShowUpload(false);
                // Reload profile
                profileAPI.get().then((result) => {
                  if (result.success) {
                    setProfile(result.data!);
                  }
                });
              }}
              onError={(error) => setError(error)}
            />
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-4 mb-12">
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-6">
          <div className="text-sm text-gray-400 mb-2">Profile Skills</div>
          <div className="text-2xl font-bold text-white">{profile.skills?.length || 0}</div>
        </div>
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-6">
          <div className="text-sm text-gray-400 mb-2">Years of Experience</div>
          <div className="text-2xl font-bold text-white">{profile.yearsOfExperience || 0}</div>
        </div>
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-6">
          <div className="text-sm text-gray-400 mb-2">Target Industries</div>
          <div className="text-2xl font-bold text-white">{profile.targetIndustries?.length || 0}</div>
        </div>
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-6">
          <div className="text-sm text-gray-400 mb-2">Recent Jobs Viewed</div>
          <div className="text-2xl font-bold text-white">{recentJobs.length}</div>
        </div>
      </div>

      {/* Recent Jobs */}
      {recentJobs.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold text-white mb-6">Recent Jobs</h2>
          <div className="space-y-4">
            {recentJobs.map((job) => (
              <Link
                key={job.id}
                href={`/dashboard/jobs/${job.id}`}
                className="bg-[#161b22] border border-[#30363d] hover:border-blue-500 rounded-lg p-6 transition-colors block"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-white hover:text-blue-400">{job.title}</h3>
                    <p className="text-gray-400 text-sm">{job.company}</p>
                    <p className="text-gray-500 text-sm mt-2">{job.location}</p>
                  </div>
                  {job.score && (
                    <div className="text-right">
                      <div className="text-lg font-bold text-blue-400">{Math.round(job.score.overallScore)}</div>
                      <div className="text-xs text-gray-500">match</div>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>

          <Link
            href="/dashboard/jobs"
            className="inline-block mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            View All Jobs
          </Link>
        </div>
      )}

      {recentJobs.length === 0 && (
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-12 text-center">
          <div className="text-4xl mb-4">💼</div>
          <h3 className="text-lg font-bold text-white mb-2">No Jobs Available Yet</h3>
          <p className="text-gray-400 mb-6">Upload your resume and complete your preferences to see job matches</p>
          <Link href="/dashboard/jobs" className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors inline-block">
            Browse All Jobs
          </Link>
        </div>
      )}
    </div>
  );
}
