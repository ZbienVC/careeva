'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { JobWithScore } from '@/lib/types';
import { jobsAPI, scoreAPI, profileAPI } from '@/lib/api';
import JobScorer from '@/components/JobScorer';
import { LoadingPage } from '@/components/Loading';

export default function JobDetailPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.id as string;

  const [job, setJob] = useState<JobWithScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scoring, setScoring] = useState(false);

  useEffect(() => {
    const loadJob = async () => {
      try {
        // Check auth
        const authResult = await profileAPI.get();
        if (!authResult.success) {
          router.push('/login');
          return;
        }

        // Load job
        const result = await jobsAPI.get(jobId);
        if (result.success) {
          setJob(result.data!);

          // Calculate score if not already present
          if (!result.data?.score) {
            setScoring(true);
            const scoreResult = await scoreAPI.calculate(jobId);
            if (scoreResult.success && result.data) {
              setJob({
                ...result.data,
                score: scoreResult.data as any,
              });
            }
            setScoring(false);
          }
        } else {
          setError(result.error || 'Failed to load job');
        }
      } catch (err) {
        setError('Failed to load job details');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadJob();
  }, [jobId, router]);

  if (loading) {
    return <LoadingPage />;
  }

  if (error || !job) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-6 text-center">
          <p className="text-red-300 mb-4">{error || 'Job not found'}</p>
          <Link href="/dashboard/jobs" className="text-blue-400 hover:text-blue-300">
            Back to Jobs
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Back Button */}
      <Link href="/dashboard/jobs" className="inline-block mb-6 text-blue-400 hover:text-blue-300 transition-colors">
        ← Back to Jobs
      </Link>

      {/* Job Header */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-8 mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">{job.title}</h1>
        <p className="text-xl text-gray-400 mb-4">{job.company}</p>

        <div className="grid md:grid-cols-4 gap-4 mb-6 text-sm">
          <div>
            <p className="text-gray-500">Location</p>
            <p className="text-white font-medium">{job.location}</p>
          </div>
          <div>
            <p className="text-gray-500">Job Type</p>
            <p className="text-white font-medium capitalize">{job.jobType}</p>
          </div>
          {job.salary && (
            <div>
              <p className="text-gray-500">Salary</p>
              <p className="text-white font-medium">{job.salary}</p>
            </div>
          )}
          <div>
            <p className="text-gray-500">Posted</p>
            <p className="text-white font-medium">
              {new Date(job.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {job.url && (
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
          >
            Apply on Original Site →
          </a>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Job Description */}
        <div className="lg:col-span-2">
          <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-8">
            <h2 className="text-2xl font-bold text-white mb-4">About This Role</h2>
            <div className="prose prose-invert max-w-none">
              <div
                className="text-gray-300 whitespace-pre-wrap leading-relaxed"
                dangerouslySetInnerHTML={{ __html: job.description.replace(/\n/g, '<br />') }}
              />
            </div>

            {job.requirements && (
              <>
                <h3 className="text-xl font-bold text-white mt-8 mb-4">Requirements</h3>
                <div
                  className="text-gray-300 whitespace-pre-wrap leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: job.requirements.replace(/\n/g, '<br />') }}
                />
              </>
            )}
          </div>
        </div>

        {/* Score Sidebar */}
        <div className="lg:col-span-1">
          {scoring ? (
            <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-8 text-center">
              <div className="text-xl text-gray-400">Calculating your match score...</div>
            </div>
          ) : job.score ? (
            <JobScorer score={job.score} />
          ) : (
            <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-8 text-center">
              <p className="text-gray-400">No score available. Upload your resume to see a match score.</p>
            </div>
          )}
        </div>
      </div>

      {/* CTA */}
      <div className="mt-12 bg-gradient-to-r from-blue-900 to-purple-900 bg-opacity-30 border border-blue-700 border-opacity-50 rounded-lg p-8 text-center">
        <h3 className="text-2xl font-bold text-white mb-4">Ready to apply?</h3>
        {job.url ? (
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Apply Now
          </a>
        ) : (
          <p className="text-gray-400">This job listing doesn't have an application URL</p>
        )}
      </div>
    </div>
  );
}
