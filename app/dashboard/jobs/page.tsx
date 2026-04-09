'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { JobWithScore } from '@/lib/types';
import { jobsAPI, profileAPI } from '@/lib/api';
import { LoadingPage } from '@/components/Loading';

// Status badge colors
const STATUS_COLORS: Record<string, string> = {
  remote: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  hybrid: 'bg-blue-50 text-blue-700 border-blue-200',
  onsite: 'bg-slate-100 text-slate-600 border-slate-200',
};

const ATS_COLORS: Record<string, string> = {
  greenhouse: 'bg-green-50 text-green-700',
  lever: 'bg-purple-50 text-purple-700',
  workday: 'bg-blue-50 text-blue-700',
  ashby: 'bg-orange-50 text-orange-700',
};

function ScoreBadge({ score }: { score?: number }) {
  if (!score) return null;
  const color = score >= 75 ? 'text-emerald-600 bg-emerald-50' : score >= 55 ? 'text-amber-600 bg-amber-50' : 'text-slate-400 bg-slate-50';
  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${color}`}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
      {score}
    </div>
  );
}

function JobCard({ job, onApply, onScore }: {
  job: JobWithScore & { atsType?: string; isRemote?: boolean; isHybrid?: boolean };
  onApply: (jobId: string) => void;
  onScore: (jobId: string) => void;
}) {
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [packet, setPacket] = useState<any>(null);

  const handleApply = async () => {
    setApplying(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'review_first' }),
      });
      const data = await res.json();
      if (data.status === 'applied' || data.status === 'queued_for_review' || data.status === 'prep_ready') {
        setApplied(true);
        if (data.packet) setPacket(data.packet);
        setPreviewMode(true);
      }
      onApply(job.id);
    } catch {
      // handle error
    } finally {
      setApplying(false);
    }
  };

  const jobType = job.isRemote ? 'remote' : job.isHybrid ? 'hybrid' : 'onsite';

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200 transition-all p-5 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-slate-900 text-base leading-tight truncate">{job.title}</h3>
          <p className="text-slate-500 text-sm mt-0.5">{job.company}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <ScoreBadge score={job.score?.overallScore} />
          {job.atsType && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize ${ATS_COLORS[job.atsType] || 'bg-slate-50 text-slate-500'}`}>
              {job.atsType}
            </span>
          )}
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-1.5 text-xs">
        {job.location && (
          <span className="text-slate-400 flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            {job.location}
          </span>
        )}
        <span className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold capitalize ${STATUS_COLORS[jobType] || STATUS_COLORS.onsite}`}>
          {jobType}
        </span>
        {job.salary && <span className="text-slate-500 text-[11px]">{job.salary}</span>}
      </div>

      {/* Description preview */}
      {job.description && (
        <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">{job.description.slice(0, 180)}...</p>
      )}

      {/* Application packet preview */}
      {previewMode && packet && (
        <div className="bg-slate-50 rounded-xl p-3 space-y-2 text-xs border border-slate-200">
          <p className="font-semibold text-slate-700 flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Application packet ready
            <span className={`ml-auto px-1.5 py-0.5 rounded-full ${packet.canAutoApply ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {packet.canAutoApply ? 'Can auto-submit' : 'Needs review'}
            </span>
          </p>
          {packet.missingFields?.length > 0 && (
            <p className="text-amber-600">Missing: {packet.missingFields.join(', ')}</p>
          )}
          <p className="text-slate-500 line-clamp-3">{packet.coverLetter?.slice(0, 200)}...</p>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setPreviewMode(false)} className="text-xs text-slate-400 hover:text-slate-600">Hide</button>
            {packet.canAutoApply && (
              <button
                onClick={async () => {
                  await fetch(`/api/jobs/${job.id}/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'auto' }) });
                  setApplied(true);
                }}
                className="ml-auto text-xs font-semibold text-emerald-600 hover:text-emerald-700"
              >
                Submit now →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-auto pt-1">
        {job.url && (
          <a href={job.url} target="_blank" rel="noopener noreferrer"
            className="flex-1 text-center text-xs font-semibold py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
            View Job
          </a>
        )}
        {!applied ? (
          <button onClick={handleApply} disabled={applying}
            className="flex-1 text-xs font-bold py-2 rounded-xl text-white transition-all disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
            {applying ? 'Preparing...' : 'Quick Apply'}
          </button>
        ) : (
          <button onClick={() => setPreviewMode(p => !p)}
            className="flex-1 text-xs font-bold py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
            {previewMode ? 'Hide Packet' : 'View Packet'} ✓
          </button>
        )}
      </div>
    </div>
  );
}

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'remote' | 'new' | 'high-match'>('all');
  const [sortBy, setSortBy] = useState<'match' | 'recent' | 'company'>('match');
  const [searchResult, setSearchResult] = useState<{ total: number; new: number } | null>(null);

  useEffect(() => {
    (async () => {
      const auth = await profileAPI.get();
      if (!auth.success) { router.push('/login'); return; }
      const result = await jobsAPI.list({ page: 1, pageSize: 50 });
      if (result.success) setJobs(result.data?.jobs || []);
      setLoading(false);
    })();
  }, [router]);

  const triggerSearch = async () => {
    setSearching(true);
    try {
      const res = await fetch('/api/jobs/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sources: ['remotive', 'themuse', 'adzuna', 'arbeitnow', 'weworkremotely', 'authenticjobs', 'indeed', 'dice'] }) });
      const data = await res.json();
      setSearchResult({ total: data.total || 0, new: data.new || 0 });
      // Reload jobs
      const result = await jobsAPI.list({ page: 1, pageSize: 50 });
      if (result.success) setJobs(result.data?.jobs || []);
    } catch { /* handle */ }
    setSearching(false);
  };

  const filtered = jobs.filter(j => {
    if (search && !j.title.toLowerCase().includes(search.toLowerCase()) && !j.company.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === 'remote') return j.isRemote || j.isHybrid || /remote/i.test(j.location || '');
    if (filter === 'new') {
      const age = Date.now() - new Date(j.createdAt || 0).getTime();
      return age < 7 * 24 * 3600 * 1000;
    }
    if (filter === 'high-match') return (j.score?.overallScore || j.score?.score || 0) >= 70;
    return true;
  }).sort((a, b) => {
    if (sortBy === 'match') return (b.score?.overallScore || b.score?.score || 0) - (a.score?.overallScore || a.score?.score || 0);
    if (sortBy === 'recent') return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    return a.company.localeCompare(b.company);
  });

  if (loading) return <LoadingPage />;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Job Pipeline</h1>
          <p className="text-slate-400 text-sm mt-0.5">{jobs.length} opportunities · click Quick Apply to generate your packet</p>
        </div>
        <div className="flex gap-2">
          <button onClick={triggerSearch} disabled={searching}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-60 transition-all"
            style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
            {searching ? (
              <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z"/></svg> Searching...</>
            ) : (
              <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> Find New Jobs</>
            )}
          </button>
        </div>
      </div>

      {/* Search result banner */}
      {searchResult && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3 text-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <span className="text-emerald-700 font-semibold">Found {searchResult.total} jobs · {searchResult.new} new added to your pipeline</span>
          <button onClick={() => setSearchResult(null)} className="ml-auto text-emerald-400 hover:text-emerald-600">✕</button>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search jobs or companies..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 bg-white" />
        </div>
        <div className="flex gap-2">
          {(['all', 'remote', 'new', 'high-match'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition-all ${filter === f ? 'text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              style={filter === f ? { background: 'linear-gradient(135deg,#10b981,#059669)' } : {}}>
              {f.replace('-', ' ')}
            </button>
          ))}
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-600 outline-none bg-white">
            <option value="match">Best match</option>
            <option value="recent">Most recent</option>
            <option value="company">Company A-Z</option>
          </select>
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && !loading && (
        <div className="text-center py-20 text-slate-400">
          <svg className="w-12 h-12 mx-auto mb-4 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
          <p className="text-lg font-semibold text-slate-600">No jobs yet</p>
          <p className="text-sm mt-1">Click <strong>Find New Jobs</strong> to search across multiple job boards</p>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(job => (
          <JobCard key={job.id} job={job} onApply={() => {}} onScore={() => {}} />
        ))}
      </div>
    </div>
  );
}
