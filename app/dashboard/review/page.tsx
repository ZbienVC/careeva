'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconClipboardCheck,
  IconArrowRight,
  IconLink,
} from '@/components/icons';
import { stripDiagnostics, slugifyQuestion } from '@/lib/answer-key';

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
    diag?: {
      workerBuild?: string;
      scope?: string;
      textInputs?: number;
      selects?: number;
      comboboxes?: number;
      fileInputs?: number;
    };
  } | null;
  packet?: { coverLetter?: string; answers?: Record<string, string> } | null;
  createdAt: string;
  submittedAt?: string | null;
  job?: { title: string; company: string; url?: string; applyUrl?: string } | null;
}

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  queued: { label: 'Queued', cls: 'badge-warning' },
  claimed: { label: 'Working…', cls: 'badge' },
  filling: { label: 'Filling form…', cls: 'badge' },
  awaiting_approval: { label: 'Needs your approval', cls: 'badge-warning' },
  approved: { label: 'Approved — submitting', cls: 'badge' },
  submitting: { label: 'Submitting…', cls: 'badge' },
  submitted: { label: 'Submitted', cls: 'badge-success' },
  needs_review: { label: 'Needs review', cls: 'badge-warning' },
  failed: { label: 'Failed', cls: 'badge-danger' },
  cancelled: { label: 'Cancelled', cls: 'badge' },
};

export default function ReviewQueuePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('active');
  const [editing, setEditing] = useState<string | null>(null);
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({});
  const [draftQuestionTexts, setDraftQuestionTexts] = useState<Record<string, string>>({});

  const [workerOnline, setWorkerOnline] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/apply-queue', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setTasks(data.tasks || []);
      if (data.worker) setWorkerOnline(Boolean(data.worker.online));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000); // live-ish updates while worker runs
    return () => clearInterval(t);
  }, [load]);

  const [actionError, setActionError] = useState<string | null>(null);

  const act = async (id: string, action: 'approve' | 'cancel' | 'retry') => {
    setActing(id + action);
    setActionError(null);
    const res = await fetch(`/api/apply-queue/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      // A silently-swallowed 409 here looked like a dead Retry button.
      const data = await res.json().catch(() => ({}));
      setActionError(data.error || `Could not ${action} (HTTP ${res.status}) — refresh and try again`);
    }
    setActing(null);
    load();
  };

  const saveAnswers = async (id: string) => {
    setActing(id + 'save');
    await fetch(`/api/apply-queue/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_answers', answers: draftAnswers, questionTexts: draftQuestionTexts }),
    });
    setActing(null);
    setEditing(null);
    load();
  };

  const openEditor = (t: Task) => {
    const answers: Record<string, string> = { ...(t.packet?.answers || {}) };
    const texts: Record<string, string> = {};
    for (const question of t.fieldReport?.unanswered || []) {
      // The worker's diagnostic suffix must NEVER reach the saved key or
      // question text — a polluted key can't match the form field again.
      const clean = stripDiagnostics(question);
      const key = slugifyQuestion(clean);
      if (!(key in answers)) answers[key] = '';
      texts[key] = clean;
    }
    setDraftAnswers(answers);
    setDraftQuestionTexts(texts);
    setEditing(t.id);
  };

  // Primary signal: the worker's heartbeat (updated every ~45s). Fallback: a
  // task still queued after a few minutes also means the engine isn't picking up.
  const workerLooksOffline =
    workerOnline === false ||
    tasks.some((t) => t.status === 'queued' && Date.now() - new Date(t.createdAt).getTime() > 3 * 60 * 1000);

  const visible = tasks.filter((t) => {
    if (filter === 'active') return !['submitted', 'cancelled', 'failed'].includes(t.status);
    if (filter === 'approval') return t.status === 'awaiting_approval';
    if (filter === 'done') return ['submitted', 'cancelled', 'failed'].includes(t.status);
    return true;
  });

  const approvalCount = tasks.filter((t) => t.status === 'awaiting_approval').length;

  return (
    <div className="page-shell space-y-8">
      {/* Header */}
      <section className="hero-panel gradient-border p-8 md:p-10">
        <div className="relative z-10">
          <div className="badge mb-4">Step 4 of 5 · Review queue</div>
          <h1 className="section-heading text-4xl">Approve before anything is sent.</h1>
          <p className="section-subcopy mt-4">
            Applications the worker has filled for you. Approve to submit, or open the form to finish it yourself.
          </p>
          <div className="mt-6">
            <Link href="/dashboard/automation" className="btn-ghost inline-flex items-center gap-2 text-sm">
              <IconArrowRight className="rotate-180" size={16} /> Back to automation
            </Link>
          </div>
        </div>
      </section>

      {workerLooksOffline && (
        <div className="alert-error text-sm">
          <p className="flex items-center gap-2 font-semibold">
            <IconAlertTriangle size={18} /> The apply engine looks offline
          </p>
          <p className="mt-1.5">
            Applications have been queued for several minutes without being picked up. Nothing can be
            filled or submitted until the worker service is running on Railway — see{' '}
            <span className="font-mono">DEPLOY-WORKER.md</span> in the repo for the 10-minute setup.
            Your queue is safe and will process as soon as it comes online.
          </p>
        </div>
      )}

      {approvalCount > 0 && (
        <div className="alert-warning flex items-center gap-3 text-sm font-semibold">
          <IconAlertTriangle size={18} />
          {approvalCount} application{approvalCount > 1 ? 's' : ''} waiting for your approval
        </div>
      )}

      {actionError && (
        <div className="alert-error flex items-center gap-3 text-sm font-semibold">
          <IconAlertTriangle size={18} /> {actionError}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'active', label: 'Active' },
          { id: 'approval', label: `Needs approval (${approvalCount})` },
          { id: 'done', label: 'Done' },
          { id: 'all', label: 'All' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`${filter === f.id ? 'btn-primary' : 'btn-secondary'} text-sm !px-4 !py-2`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.05] text-slate-400">
            <IconClipboardCheck size={26} />
          </div>
          <p className="mt-4 text-sm text-slate-400">Nothing here yet. Run the automation to fill this queue.</p>
          <div className="mt-6">
            <Link href="/dashboard/automation" className="btn-primary inline-flex items-center gap-2">
              Run automation <IconArrowRight size={16} />
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((t) => {
            const st = STATUS_STYLE[t.status] || { label: t.status, cls: 'badge' };
            const isOpen = expanded === t.id;
            const report = t.fieldReport;
            return (
              <div key={t.id} className="premium-card-soft overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : t.id)}
                  className="flex w-full items-center gap-4 p-5 text-left transition hover:bg-white/[0.03] focus-visible:bg-white/[0.03]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-white">
                      {t.job?.title || 'Job'} <span className="font-medium text-slate-400">@ {t.job?.company}</span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {t.atsType || 'unknown ATS'} · {t.mode.replace(/_/g, ' ')} · {new Date(t.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className={`${st.cls} whitespace-nowrap`}>{st.label}</span>
                </button>

                {isOpen && (
                  <div className="space-y-4 border-t border-white/[0.06] px-5 pb-5 pt-4">
                    {t.lastError && (
                      <div className="alert-warning flex items-start gap-2 text-xs">
                        <IconAlertTriangle size={14} className="mt-0.5 shrink-0" />
                        <span>{t.lastError}</span>
                      </div>
                    )}

                    {report && (
                      <div className="grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
                        <div className="stat-tile">
                          <p className="font-semibold text-white">{report.filled?.length || 0} filled</p>
                          <p className="mt-0.5 text-slate-500">fields</p>
                        </div>
                        <div className="stat-tile">
                          <p className="flex items-center gap-1.5 font-semibold text-white">
                            Resume{' '}
                            {report.resumeAttached ? (
                              <IconCheck size={14} className="text-emerald-300" />
                            ) : (
                              <IconX size={14} className="text-red-300" />
                            )}
                          </p>
                          <p className={`mt-0.5 ${report.resumeAttached ? 'text-slate-500' : 'text-red-300'}`}>
                            {report.resumeAttached ? 'file attached' : 'not attached'}
                          </p>
                        </div>
                        <div className="stat-tile">
                          <p className={`font-semibold ${(report.unanswered?.length || 0) === 0 ? 'text-white' : 'text-amber-300'}`}>
                            {report.unanswered?.length || 0} unanswered
                          </p>
                          <p className="mt-0.5 text-slate-500">required</p>
                        </div>
                        <div className="stat-tile">
                          <p className="font-semibold text-white">{report.guessed?.length || 0} AI-guessed</p>
                          <p className="mt-0.5 text-slate-500">flagged</p>
                        </div>
                      </div>
                    )}

                    {report?.diag && (
                      <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                        worker {report.diag.workerBuild} · form in {report.diag.scope} · saw {report.diag.textInputs ?? 0} inputs
                        / {report.diag.selects ?? 0} selects / {report.diag.comboboxes ?? 0} dropdowns / {report.diag.fileInputs ?? 0} file fields
                      </p>
                    )}

                    {report?.unanswered && report.unanswered.length > 0 && (
                      <div className="alert-warning text-xs">
                        <p className="mb-1 flex items-center gap-2 font-semibold">
                          <IconAlertTriangle size={14} /> Unanswered required questions:
                        </p>
                        <ul className="ml-4 list-disc space-y-0.5">
                          {report.unanswered.map((q, i) => <li key={i}>{q}</li>)}
                        </ul>
                        <div className="mt-3">
                          <button onClick={() => openEditor(t)} className="btn-primary text-xs !px-3 !py-1.5">
                            Answer them now — saved for every future application
                          </button>
                        </div>
                      </div>
                    )}

                    {t.screenshotKey && (
                      <details className="text-xs">
                        <summary className="cursor-pointer font-semibold text-blue-300 transition hover:text-blue-200">
                          View filled-form screenshot
                        </summary>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/screenshots?key=${encodeURIComponent(t.screenshotKey)}`}
                          alt="Filled application form"
                          className="mt-2 w-full rounded-xl border border-white/10"
                        />
                      </details>
                    )}

                    <div className="flex flex-wrap gap-2 pt-1">
                      {t.status === 'awaiting_approval' && (
                        <button
                          onClick={() => act(t.id, 'approve')}
                          disabled={acting === t.id + 'approve'}
                          className="btn-primary text-sm !px-4 !py-2 disabled:opacity-50"
                        >
                          {acting === t.id + 'approve' ? (
                            'Approving…'
                          ) : (
                            <>
                              <IconCheck size={16} /> Approve & Submit
                            </>
                          )}
                        </button>
                      )}
                      {(t.applyUrl || t.job?.applyUrl) && (
                        <a
                          href={t.applyUrl || t.job?.applyUrl || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary text-sm !px-4 !py-2"
                        >
                          <IconLink size={16} /> Open original form (manual fallback)
                        </a>
                      )}
                      {['failed', 'needs_review', 'cancelled'].includes(t.status) && (
                        <button
                          onClick={() => act(t.id, 'retry')}
                          disabled={acting === t.id + 'retry'}
                          className="btn-secondary text-sm !px-4 !py-2 disabled:opacity-50"
                        >
                          Retry
                        </button>
                      )}
                      {!['submitted', 'cancelled'].includes(t.status) && (
                        <button
                          onClick={() => act(t.id, 'cancel')}
                          disabled={acting === t.id + 'cancel'}
                          className="btn-danger text-sm !px-4 !py-2 disabled:opacity-50"
                        >
                          <IconX size={16} /> Cancel
                        </button>
                      )}
                    </div>

                    {/* Edit the answers right here — saving requeues the task so
                        the worker refills the form with your edits. */}
                    {t.packet?.answers && Object.keys(t.packet.answers).length > 0 && (
                      <div className="text-xs">
                        {editing === t.id ? (
                          <div className="space-y-3 rounded-xl border border-blue-400/25 bg-blue-500/[0.05] p-3">
                            <p className="font-semibold text-blue-300">Edit answers — the form is refilled with your changes, and new answers join your answer bank for every future application</p>
                            {Object.entries(draftAnswers).map(([k, v]) => (
                              <div key={k}>
                                <label className="field-label !mb-1 !text-xs">
                                  {draftQuestionTexts[k] || k.replace(/_/g, ' ')}
                                  {draftQuestionTexts[k] && !v && <span className="ml-2 text-amber-300">(new — needs your answer)</span>}
                                </label>
                                <textarea
                                  value={v}
                                  rows={Math.min(4, Math.max(1, Math.ceil(v.length / 90)))}
                                  onChange={(e) => setDraftAnswers((prev) => ({ ...prev, [k]: e.target.value }))}
                                  className="!text-xs"
                                />
                              </div>
                            ))}
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveAnswers(t.id)}
                                disabled={acting === t.id + 'save'}
                                className="btn-primary text-xs !px-3 !py-1.5 disabled:opacity-50"
                              >
                                {acting === t.id + 'save' ? 'Saving…' : 'Save & refill form'}
                              </button>
                              <button onClick={() => setEditing(null)} className="btn-ghost text-xs !px-3 !py-1.5">
                                Discard
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <p className="font-semibold text-slate-400">Answers on this application</p>
                              {['awaiting_approval', 'needs_review', 'failed', 'queued'].includes(t.status) && (
                                <button onClick={() => openEditor(t)} className="btn-ghost text-xs !px-3 !py-1">
                                  Edit answers
                                </button>
                              )}
                            </div>
                            {Object.entries(t.packet.answers).map(([k, v]) => (
                              <p key={k} className="text-slate-400"><span className="font-semibold text-slate-300">{k.replace(/_/g, ' ')}:</span> {v}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {t.packet?.coverLetter && (
                      <details className="text-xs">
                        <summary className="cursor-pointer font-semibold text-slate-400 transition hover:text-slate-300">
                          Cover letter
                        </summary>
                        <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-slate-300">{t.packet.coverLetter}</pre>
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
