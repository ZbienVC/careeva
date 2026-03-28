'use client';

import { JobWithScore } from '@/lib/types';
import Link from 'next/link';
import { getScoreColor, getScoreQuality } from '@/lib/api';

interface JobCardProps {
  job: JobWithScore;
}

export default function JobCard({ job }: JobCardProps) {
  const score = job.score?.overallScore || 0;
  const scoreColor = getScoreColor(score);
  const scoreQuality = getScoreQuality(score);

  return (
    <div className="premium-card group overflow-hidden p-6 transition duration-200 hover:-translate-y-1 hover:border-white/15">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="badge">{job.source || 'Curated role'}</span>
            {job.applied && <span className="badge border-emerald-500/30 bg-emerald-500/10 text-emerald-200">Applied</span>}
          </div>
          <h3 className="text-xl font-semibold text-white transition-colors group-hover:text-blue-300">{job.title}</h3>
          <p className="mt-1 text-base text-slate-300">{job.company}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-400">
            <span className="rounded-full bg-white/[0.04] px-3 py-1">📍 {job.location}</span>
            <span className="rounded-full bg-white/[0.04] px-3 py-1 capitalize">💼 {job.jobType}</span>
            {job.salary && <span className="rounded-full bg-white/[0.04] px-3 py-1">💰 {job.salary}</span>}
          </div>
        </div>

        {score > 0 && (
          <div className="rounded-3xl border border-white/10 bg-slate-900/80 px-5 py-4 text-center shadow-inner shadow-black/20">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Match</div>
            <div className="mt-1 text-4xl font-bold" style={{ color: scoreColor }}>
              {Math.round(score)}
            </div>
            <div className="text-xs capitalize text-slate-400">{scoreQuality} fit</div>
          </div>
        )}
      </div>

      <p className="mb-6 line-clamp-3 text-sm leading-6 text-slate-400">{job.description}</p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href={`/dashboard/jobs/${job.id}`} className="btn-primary flex-1">
          View role details
        </Link>
        {job.url && (
          <a href={job.url} target="_blank" rel="noopener noreferrer" className="btn-secondary flex-1 text-center">
            Open listing
          </a>
        )}
      </div>
    </div>
  );
}
