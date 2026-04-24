'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { JobWithScore } from '@/lib/types';
import { jobsAPI, scoreAPI, profileAPI } from '@/lib/api';
import JobScorer from '@/components/JobScorer';
import { LoadingPage } from '@/components/Loading';

function getNotes(jobId: string): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(`careeva_notes_${jobId}`) || '';
}
function saveNotes(jobId: string, notes: string) {
  localStorage.setItem(`careeva_notes_${jobId}`, notes);
}

export default function JobDetailPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.id as string;

  const [job, setJob] = useState<JobWithScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scoring, setScoring] = useState(false);
  const [notes, setNotes] = useState('');
  const [toast, setToast] = useState('');
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    const loadJob = async () => {
      try {
        const authResult = await profileAPI.get();
        if (!authResult.success) {
          router.push('/login');
          return;
        }

        const result = await jobsAPI.get(jobId);
        if (result.success) {
          setJob(result.data!);
          setNotes(getNotes(jobId));

          if (!result.data?.score) {
            setScoring(true);
            const scoreResult = await scoreAPI.calculate(jobId);
            if (scoreResult.success && result.data) {
              setJob({ ...result.data, score: scoreResult.data as any });
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

  const handleNotesChange = (val: string) => {
    setNotes(val);
    saveNotes(jobId, val);
  };

  const handleQuickApply = async () => {
    if (!job) return;
    setApplying(true);
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
    } catch {
      setToast('Applied \u2014 tracking failed');
    } finally {
      setApplying(false);
      setTimeout(() => setToast(''), 3000);
    }
  };

  const handleGenerateCoverLetter = () => {
    if (!job) return;
    const params = new URLSearchParams({
      company: job.company,
      jobTitle: job.title,
      jd: job.description.slice(0, 2000),
    });
    router.push(`/dashboard/cover-letter?${params.toString()}`);
  };

  if (loading) return <LoadingPage />;

  if (error || !job) {
    return (
      <div className="page-shell">
        <div className="premium-card p-8 text-center">
          <p className="text-red-300 mb-4">{error || 'Job not found'}</p>
          <Link href="/dashboard/jobs" className="text-blue-300 hover:text-blue-200">Back to Jobs</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell space-y-8">
      {toast && (
        <div className="fixed top-6 right-6 z-50 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white shadow-xl">
          {toast}
        </div>
      )}

      {/* Back */}
      <div>
        <Link href="/dashboard/jobs" className="btn-ghost inline-flex items-center gap-2">
          \u2190 Back to Jobs
        </Link>
      </div>

      {/* Header */}
      <section className="hero-panel gradient-border p-8 md:p-10">
        <div className="relative z-10">
          <div className="badge mb-4">{job.source || 'Curated role'}</div>
          <h1 className="section-heading text-3xl md:text-4xl">{job.title}</h1>
          <p className="mt-2 text-xl text-slate-300">{job.company}</p>

          <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-400">
            <span className="rounded-full bg-white/[0.05] px-4 py-1.5">\uD83D\uDCCD {job.location}</span>
            <span className="rounded-full bg-white/[0.05] px-4 py-1.5 capitalize">\uD83D\uDCBC {job.jobType}</span>
            {job.salary && <span className="rounded-full bg-white/[0.05] px-4 py-1.5">\uD83D\uDCB0 {job.salary}</span>}
            <span className="rounded-full bg-white/[0.05] px-4 py-1.5">\uD83D\uDCC5 Posted {new Date(job.createdAt).toLocaleDateString()}</span>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={handleQuickApply}
              disabled={applying}
              className="btn-primary disabled:opacity-50"
            >
              {applying ? 'Tracking...' : job.url ? '\u26A1 Quick Apply + Track' : 'Mark as Applied'}
            </button>
            <button onClick={handleGenerateCoverLetter} className="btn-secondary">
              \u270F\uFE0F Generate Cover Letter
            </button>
            {job.url && (
              <a href={job.url} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                Open Original Listing \u2197
              </a>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-[1.4fr_0.9fr]">
        {/* Main Content */}
        <div className="space-y-6">
          <div className="premium-card p-6 md:p-8">
            <h2 className="text-2xl font-bold text-white mb-6">About This Role</h2>
            <div
              className="text-slate-300 whitespace-pre-wrap leading-7 text-sm"
              dangerouslySetInnerHTML={{ __html: job.description.replace(/\n/g, '<br />') }}
            />

            {job.requirements && (
              <>
                <h3 className="text-xl font-bold text-white mt-8 mb-4">Requirements</h3>
                <div
                  className="text-slate-300 whitespace-pre-wrap leading-7 text-sm"
                  dangerouslySetInnerHTML={{ __html: job.requirements.replace(/\n/g, '<br />') }}
                />
              </>
            )}
          </div>

          {/* Notes */}
          <div className="premium-card p-6 md:p-8">
            <h2 className="text-xl font-bold text-white mb-4">Notes about this role</h2>
            <p className="text-sm text-slate-400 mb-3">Saved locally in your browser.</p>
            <textarea
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              rows={5}
              placeholder="Key insights, contacts, reasons you like this role, questions to ask..."
              className="w-full"
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {scoring ? (
            <div className="premium-card p-8 text-center">
              <div className="text-slate-400">Calculating your match score...</div>
            </div>
          ) : job.score ? (
            <JobScorer score={job.score} />
          ) : (
            <div className="premium-card p-8 text-center">
              <p className="text-slate-400">No score available. Upload your resume to see a match score.</p>
            </div>
          )}

          {/* Company Info */}
          <div className="premium-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Company</h3>
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-slate-500">Name</div>
                <div className="mt-1 text-white">{job.company}</div>
              </div>
              <div>
                <div className="text-slate-500">Location</div>
                <div className="mt-1 text-white">{job.location}</div>
              </div>
              <div>
                <div className="text-slate-500">Job Type</div>
                <div className="mt-1 text-white capitalize">{job.jobType}</div>
              </div>
              {job.salary && (
                <div>
                  <div className="text-slate-500">Salary</div>
                  <div className="mt-1 text-white">{job.salary}</div>
                </div>
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="premium-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button onClick={handleGenerateCoverLetter} className="btn-secondary w-full text-left">
                \u270F\uFE0F Write Cover Letter
              </button>
              <Link href="/dashboard/applications" className="btn-secondary w-full block text-left">
                \uD83D\uDCC4 View Applications
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
