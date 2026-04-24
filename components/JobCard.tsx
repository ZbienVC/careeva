'use client';

import { JobWithScore } from '@/lib/types';
import Link from 'next/link';
import { getScoreColor, getScoreQuality } from '@/lib/api';
import { useState, useEffect } from 'react';

interface JobCardProps {
  job: JobWithScore;
  onQuickApply?: (jobId: string) => void;
}

function getSavedJobs(): string[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('careeva_saved_jobs') || '[]'); } catch { return []; }
}

function toggleSavedJob(jobId: string): boolean {
  const saved = getSavedJobs();
  const idx = saved.indexOf(jobId);
  if (idx >= 0) { saved.splice(idx, 1); } else { saved.push(jobId); }
  localStorage.setItem('careeva_saved_jobs', JSON.stringify(saved));
  return idx < 0;
}

export default function JobCard({ job, onQuickApply }: JobCardProps) {
  const score = job.score?.overallScore || 0;
  const scoreColor = getScoreColor(score);
  const scoreQuality = getScoreQuality(score);
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    setSaved(getSavedJobs().includes(job.id));
  }, [job.id]);

  const handleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    const isNowSaved = toggleSavedJob(job.id);
    setSaved(isNowSaved);
    setToast(isNowSaved ? 'Job saved \u2713' : 'Job removed');
    setTimeout(() => setToast(''), 2000);
  };

  const handleQuickApply = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (job.url) window.open(job.url, '_blank');
    try {
      await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          company: job.company,
          role: job.title,
          status: 'applied',
          dateApplied: new Date().toISOString().split('T')[0],
          notes: '',
          url: job.url || '',
        }),
      });
      setToast('Application tracked \u2713');
      setTimeout(() => setToast(''), 2500);
      onQuickApply?.(job.id);
    } catch {
      setToast('Applied — tracking failed');
      setTimeout(() => setToast(''), 2500);
    }
  };

  // Score bar color
  const barColor = score >= 70 ? 'bg-emerald-400' : score >= 50 ? 'bg-amber-400' : 'bg-red-400';

  return (
    <div className="premium-card group overflow-hidden transition duration-200 hover:-translate-y-1 hover:border-white/15 relative">
      {/* Match score bar at top */}
      {score > 0 && (
        <div className="h-1 w-full bg-white/5">
          <div className={`h-full ${barColor} transition-all`} style={{ width: `${Math.min(score, 100)}%` }} />
        </div>
      )}

      <div className="p-6">
        {toast && (
          <div className="absolute top-3 right-3 z-10 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow-lg">
            {toast}
          </div>
        )}

        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="badge">{job.source || 'Curated role'}</span>
              {job.applied && <span className="badge border-emerald-500/30 bg-emerald-500/10 text-emerald-200">Applied</span>}
            </div>
            <h3 className="text-xl font-semibold text-white transition-colors group-hover:text-blue-300">{job.title}</h3>
            <p className="mt-1 text-base text-slate-300">{job.company}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-400">
              <span className="rounded-full bg-white/[0.04] px-3 py-1">\uD83D\uDCCD {job.location}</span>
              <span className="rounded-full bg-white/[0.04] px-3 py-1 capitalize">\uD83D\uDCBC {job.jobType}</span>
              {job.salary && <span className="rounded-full bg-white/[0.04] px-3 py-1">\uD83D\uDCB0 {job.salary}</span>}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            {score > 0 && (
              <div className="rounded-3xl border border-white/10 bg-slate-900/80 px-5 py-4 text-center shadow-inner shadow-black/20">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Match</div>
                <div className="mt-1 text-4xl font-bold" style={{ color: scoreColor }}>
                  {Math.round(score)}
                </div>
                <div className="text-xs capitalize text-slate-400">{scoreQuality} fit</div>
              </div>
            )}
            <button
              onClick={handleSave}
              title={saved ? 'Remove from saved' : 'Save job'}
              className={`rounded-2xl border px-3 py-2 text-lg transition ${saved ? 'border-amber-400/40 bg-amber-500/10 text-amber-300' : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-amber-300'}`}
            >
              {saved ? '\u2605' : '\u2606'}
            </button>
          </div>
        </div>

        <p className="mb-6 line-clamp-3 text-sm leading-6 text-slate-400">{job.description}</p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href={`/dashboard/jobs/${job.id}`} className="btn-primary flex-1">
            View role details
          </Link>
          {job.url && (
            <button onClick={handleQuickApply} className="btn-secondary flex-1 text-center">
              Quick Apply
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
