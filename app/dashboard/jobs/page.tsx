'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { JobWithScore } from '@/lib/types';
import { jobsAPI, profileAPI } from '@/lib/api';
import JobCard from '@/components/JobCard';
import { LoadingPage, LoadingSkeleton } from '@/components/Loading';

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobWithScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalJobs, setTotalJobs] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    const loadJobs = async () => {
      try {
        // Check auth
        const authResult = await profileAPI.get();
        if (!authResult.success) {
          router.push('/login');
          return;
        }

        // Load jobs
        const result = await jobsAPI.list({
          page,
          pageSize,
          search: search || undefined,
        });

        if (result.success) {
          setJobs(result.data?.jobs || []);
          setTotalJobs(result.data?.total || 0);
        } else {
          setError(result.error || 'Failed to load jobs');
        }
      } catch (err) {
        setError('Failed to load jobs');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(() => {
      loadJobs();
      setLoading(true);
    }, 300);

    return () => clearTimeout(timer);
  }, [search, page, router]);

  if (loading && jobs.length === 0) {
    return <LoadingPage />;
  }

  const totalPages = Math.ceil(totalJobs / pageSize);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">Job Opportunities</h1>
        <p className="text-gray-400">
          Found {totalJobs} job{totalJobs !== 1 ? 's' : ''} matching your profile
        </p>
      </div>

      {/* Search */}
      <div className="mb-8">
        <input
          type="text"
          placeholder="Search by job title, company..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full px-4 py-3 bg-[#161b22] border border-[#30363d] rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {error && (
        <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-4 mb-8">
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {/* Jobs List */}
      {jobs.length > 0 ? (
        <>
          <div className="grid gap-6 mb-12">
            {loading ? (
              <LoadingSkeleton count={3} />
            ) : (
              jobs.map((job) => <JobCard key={job.id} job={job} />)
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-4 py-2 bg-[#30363d] hover:bg-[#484f58] disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                Previous
              </button>

              <div className="text-gray-400">
                Page {page} of {totalPages}
              </div>

              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 bg-[#30363d] hover:bg-[#484f58] disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-12 text-center">
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="text-lg font-bold text-white mb-2">No Jobs Found</h3>
          <p className="text-gray-400">
            {search ? 'Try adjusting your search criteria' : 'No job opportunities are currently available'}
          </p>
        </div>
      )}
    </div>
  );
}
