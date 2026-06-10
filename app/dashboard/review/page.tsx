'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface Task {
  id: string;
  status: string;
  mode: string;
  atsType?: string | null;
  applyUrl?: string | null;
  lastError?: string | null;
  screenshotKey?: string | null;
  fieldReport?: {
    filled?: Array<{ label: string; value: string; via: string }>;
    unanswered?: string[];
    guessed?: string[];
    skippedOptional?: string[];
    resumeAttached?: boolean;
    coverLetterAttached?: boolean;
  } | null;
  packet?: { coverLetter?: string; answers?: Record<string, string> } | null;
  createdAt: string;
  submittedAt?: string | null;
  job?: { title: string; company: string; url?: string; applyUrl?: string } | null;
}

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  queued: { label: 'Queued', cls: 'bg-slate-100 text-slate-600' },
  claimed: { label: 'Working…', cls: 'bg-blue-50 text-blue-600' },
  filling: { label: 'Filling form…', cls: 'bg-blue-50 text-blue-600' },
  awaiting_approval: { label: 'Needs your approval', cls: 'bg-amber-50 text-amber-700' },
  approved: { label: 'Approved — submitting', cls: 'bg-indigo-50 text-indigo-600' },
  submitting: { label: 'Submitting…', cls: 'bg-indigo-50 text-indigo-600' },
  submitted: { label: 'Submitted ✓', cls: 'bg-emerald-50 text-emerald-700' },
  needs_review: { label: 'Needs review', cls: 'bg-orange-50 text-orange-700' },
  failed: { label: 'Failed', cls: 'bg-red-50 text-red-600' },
  cancelled: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-400' },
};

export default function ReviewQueuePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('active');

  const load = useCallback(async () => {
    const res = await fetch('/api/apply-queue', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setTasks(data.tasks || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000); // live-ish updates while worker runs
    return () => clearInterval(t);
  }, [load]);

  const act = async (id: string, action: 'approve' | 'cancel' | 'retry') => {
    setActing(id + action);
    await fetch(`/api/apply-queue/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    setActing(null);
    load();
  };

  const visible = tasks.filter((t) => {
    if (filter === 'active') return !['submitted', 'cancelled', 'failed'].includes(t.status);
    if (filter === 'approval') return t.status === 'awaiting_approval';
    if (filter === 'done') return ['submitted', 'cancelled', 'failed'].includes(t.status);
    return true;
  });

  const approvalCount = tasks.filter((t) => t.status === 'awaiting_approval').length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Review Queue</h1>
          <p className="text-sm text-slate-500">
            Applications the worker has filled. Approve to submit, or open the form to finish yourself.
          </p>
        </div>
        <Link href="/dashboard/automation" className="text-sm font-semibold text-indigo-600 hover:underline">
          ← Automation
        </Link>
      </div>

      {approvalCount > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-semibold">
          {approvalCount} application{approvalCount > 1 ? 's' : ''} waiting for your approval
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {[
          { id: 'active', label: 'Active' },
          { id: 'approval', label: `Needs approval (${approvalCount})` },
          { id: 'done', label: 'Done' },
          { id: 'all', label: 'All' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              filter === f.id ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center text-slate-400 text-sm">
          Nothing here. Run the automation to fill this queue.
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((t) => {
            const st = STATUS_STYLE[t.status] || { label: t.status, cls: 'bg-slate-100 text-slate-600' };
            const isOpen = expanded === t.id;
            const report = t.fieldReport;
            return (
              <div key={t.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                <button onClick={() => setExpanded(isOpen ? null : t.id)} className="w-full p-4 flex items-center gap-4 text-left">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 truncate">
                      {t.job?.title || 'Job'} <span className="text-slate-400 font-medium">@ {t.job?.company}</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      {t.atsType || 'unknown ATS'} · {t.mode.replace(/_/g, ' ')} · {new Date(t.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${st.cls}`}>{st.label}</span>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 border-t border-slate-50 pt-3 space-y-3">
                    {t.lastError && (
                      <p className="text-xs text-orange-700 bg-orange-50 rounded-lg p-2 font-medium">{t.lastError}</p>
                    )}

                    {report && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div className="bg-slate-50 rounded-lg p-2">
                          <p className="font-bold text-slate-700">{report.filled?.length || 0} filled</p>
                          <p className="text-slate-400">fields</p>
                        </div>
                        <div className={`rounded-lg p-2 ${report.resumeAttached ? 'bg-emerald-50' : 'bg-red-50'}`}>
                          <p className="font-bold text-slate-700">Resume {report.resumeAttached ? '✓' : '✗'}</p>
                          <p className="text-slate-400">file attached</p>
                        </div>
                        <div className={`rounded-lg p-2 ${(report.unanswered?.length || 0) === 0 ? 'bg-slate-50' : 'bg-amber-50'}`}>
                          <p className="font-bold text-slate-700">{report.unanswered?.length || 0} unanswered</p>
                          <p className="text-slate-400">required</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-2">
                          <p className="font-bold text-slate-700">{report.guessed?.length || 0} AI-guessed</p>
                          <p className="text-slate-400">flagged</p>
                        </div>
                      </div>
                    )}

                    {report?.unanswered && report.unanswered.length > 0 && (
                      <div className="text-xs text-amber-800 bg-amber-50 rounded-lg p-2">
                        <p className="font-bold mb-1">Unanswered required questions:</p>
                        <ul className="list-disc ml-4 space-y-0.5">
                          {report.unanswered.map((q, i) => <li key={i}>{q}</li>)}
                        </ul>
                        <p className="mt-1 text-amber-600">Add these as Reusable Answers in your profile, then Retry.</p>
                      </div>
                    )}

                    {t.screenshotKey && (
                      <details className="text-xs">
                        <summary className="font-bold text-indigo-600 cursor-pointer">View filled-form screenshot</summary>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/screenshots?key=${encodeURIComponent(t.screenshotKey)}`}
                          alt="Filled application form"
                          className="mt-2 rounded-xl border border-slate-200 w-full"
                        />
                      </details>
                    )}

                    <div className="flex flex-wrap gap-2 pt-1">
                      {t.status === 'awaiting_approval' && (
                        <button
                          onClick={() => act(t.id, 'approve')}
                          disabled={acting === t.id + 'approve'}
                          className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {acting === t.id + 'approve' ? 'Approving…' : '✓ Approve & Submit'}
                        </button>
                      )}
                      {(t.applyUrl || t.job?.applyUrl) && (
                        <a
                          href={t.applyUrl || t.job?.applyUrl || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:border-indigo-300"
                        >
                          Open form ↗ (companion view)
                        </a>
                      )}
                      {['failed', 'needs_review', 'cancelled'].includes(t.status) && (
                        <button
                          onClick={() => act(t.id, 'retry')}
                          disabled={acting === t.id + 'retry'}
                          className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50"
                        >
                          Retry
                        </button>
                      )}
                      {!['submitted', 'cancelled'].includes(t.status) && (
                        <button
                          onClick={() => act(t.id, 'cancel')}
                          disabled={acting === t.id + 'cancel'}
                          className="px-4 py-2 rounded-xl bg-white border border-red-200 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      )}
                    </div>

                    {t.packet?.coverLetter && (
                      <details className="text-xs">
                        <summary className="font-bold text-slate-500 cursor-pointer">Cover letter & answers (copy for manual paste)</summary>
                        <pre className="mt-2 p-3 bg-slate-50 rounded-xl whitespace-pre-wrap text-slate-700 max-h-64 overflow-y-auto">{t.packet.coverLetter}</pre>
                        {t.packet.answers && (
                          <div className="mt-2 space-y-1">
                            {Object.entries(t.packet.answers).map(([k, v]) => (
                              <p key={k} className="text-slate-600"><span className="font-bold">{k}:</span> {v}</p>
                            ))}
                          </div>
                        )}
                      </details>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
