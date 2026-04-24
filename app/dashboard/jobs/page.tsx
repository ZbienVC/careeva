'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { JobWithScore } from '@/lib/types';
import { jobsAPI, profileAPI } from '@/lib/api';
import JobCard from '@/components/JobCard';
import { LoadingPage, LoadingSkeleton } from '@/components/Loading';

const FILTER_CHIPS = [
  { key: 'all', label: 'All' },
  { key: 'remote', label: 'Remote' },
  { key: 'full_time', label: 'Full-time' },
  { key: 'senior', label: 'Senior' },
  { key: 'entry', label: 'Entry-level' },
];

function matchesChip(job: JobWithScore, chip: string): boolean {
  if (chip === 'all') return true;
  const loc = (job.location || '').toLowerCase();
  const type = (job.jobType || '').toLowerCase();
  const title = (job.title || '').toLowerCase();
  if (chip === 'remote') return loc.includes('remote') || type.includes('remote');
  if (chip === 'full_time') return type.includes('full') || type.includes('full_time');
  if (chip === 'senior') return title.includes('senior') || title.includes('sr.');
  if (chip === 'entry') return title.includes('junior') || title.includes('entry') || title.includes('associate');
  return true;
}

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobWithScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalJobs, setTotalJobs] = useState(0);
  const [sortBy, setSortBy] = useState<'match' | 'recent' | 'company'>('match');
  const [activeChip, setActiveChip] = useState('all');
  const pageSize = 9;

  useEffect(() => {
    const loadJobs = async () => {
      try {
        const authResult = await profileAPI.get();
        if (!authResult.success) {
          router.push('/login');
          return;
        }

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
      setLoading(true);
      loadJobs();
    }, 250);

    return () => clearTimeout(timer);
  }, [search, page, router]);

  const sortedJobs = useMemo(() => {
    let filtered = jobs.filter((job) => matchesChip(job, activeChip));
    if (sortBy === 'company') {
      return filtered.sort((a, b) => a.company.localeCompare(b.company));
    }
    if (sortBy === 'recent') {
      return filtered.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    }
    return filtered.sort((a, b) => (b.score?.overallScore || 0) - (a.score?.overallScore || 0));
  }, [jobs, sortBy, activeChip]);

  if (loading && jobs.length === 0) return <LoadingPage />;

  const totalPages = Math.ceil(totalJobs / pageSize);
  const strongMatches = jobs.filter((job) => (job.score?.overallScore || 0) >= 70).length;
  const readyToApply = jobs.filter((job) => !!job.url).length;

  return (
    <div className="page-shell space-y-8">
      <section className="hero-panel gradient-border p-8 md:p-10">
        <div className="relative z-10 flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="badge mb-4">Opportunity pipeline</div>
            <h1 className="section-heading text-4xl md:text-5xl">Explore smarter-fit job opportunities.</h1>
            <p className="section-subcopy mt-4 text-base md:text-lg">
              Search, sort, and triage openings with a cleaner view of fit, quality, and application readiness.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3 xl:min-w-[460px]">
            <div className="stat-tile">
              <div className="text-sm text-slate-400">Total roles</div>
              <div className="mt-2 text-3xl font-bold text-white">{totalJobs}</div>
            </div>
            <div className="stat-tile">
              <div className="text-sm text-slate-400">Strong matches</div>
              <div className="mt-2 text-3xl font-bold text-emerald-300">{strongMatches}</div>
            </div>
            <div className="stat-tile">
              <div className="text-sm text-slate-400">Apply-ready</div>
              <div className="mt-2 text-3xl font-bold text-blue-300">{readyToApply}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="premium-card p-6 md:p-7 space-y-4">
        <div className="grid gap-4 lg:grid-cols-[1.4fr_0.7fr_0.7fr]">
          <div>
            <label className="field-label">Search roles</label>
            <input
              type="text"
              placeholder="Search by job title, company, location..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <label className="field-label">Sort by</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'match' | 'recent' | 'company')}>
              <option value="match">Best match</option>
              <option value="recent">Most recent</option>
              <option value="company">Company name</option>
            </select>
          </div>
          <div className="flex items-end">
            <div className="premium-card-soft w-full p-4 text-sm text-slate-300">
              <div className="text-slate-500">Live summary</div>
              <div className="mt-1">{totalJobs} jobs surfaced for your current profile.</div>
            </div>
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2">
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip.key}
              onClick={() => setActiveChip(chip.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors border ${
                activeChip === chip.key
                  ? 'border-blue-400/50 bg-blue-500/15 text-blue-200'
                  : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-white hover:border-white/20'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <div className="premium-card border-red-500/30 bg-red-500/10 p-4 text-red-200">
          {error}
        </div>
      )}

      <section>
        {sortedJobs.length > 0 ? (
          <>
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-white">Recommended roles</h2>
                <p className="mt-1 text-sm text-slate-400">Browse curated matches and prioritize the best-fit opportunities first.</p>
              </div>
              <div className="badge">Page {page} of {Math.max(totalPages, 1)}</div>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              {loading ? <LoadingSkeleton count={4} /> : sortedJobs.map((job) => <JobCard key={job.id} job={job} />)}
            </div>

            {totalPages > 1 && (
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="btn-secondary disabled:opacity-50"
                >
                  Previous
                </button>
                <div className="text-sm text-slate-400">Showing page {page} of {totalPages}</div>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="btn-secondary disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="empty-state">
            <div className="text-5xl">&#x1F4CB;</div>
            <h3 className="mt-4 text-2xl font-semibold text-white">No jobs found</h3>
            <p className="mt-2 text-slate-400">
              {search
                ? 'Try broadening the search, removing a company name, or using fewer keywords.'
                : activeChip !== 'all'
                ? 'No jobs match this filter. Try switching to "All" or a different filter.'
                : 'No opportunities are currently available. Complete your profile to unlock AI-matched roles.'}
            </p>
            {!search && activeChip === 'all' && (
              <div className="mt-6 flex justify-center gap-3">
                <a href="/dashboard/profile" className="btn-primary">Complete profile</a>
                <a href="https://www.linkedin.com/jobs" target="_blank" rel="noreferrer" className="btn-secondary">Browse LinkedIn Jobs</a>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
