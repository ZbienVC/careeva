'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { profileAPI } from '@/lib/api';
import {
  IconListChecks,
  IconBell,
  IconTarget,
  IconCheck,
  IconAlertTriangle,
  IconChevronRight,
  IconMail,
  IconFileText,
  IconCopy,
  IconX,
} from '@/components/icons';

interface Application {
  id: string;
  company: string;
  role: string;
  status: 'applied' | 'phone_screen' | 'interview' | 'offer' | 'rejected';
  dateApplied: string;
  createdAt?: string;
  notes: string;
  url?: string;
  coverLetter?: string;
  jobId?: string;
}

const COLUMNS = [
  { key: 'applied',       label: 'Applied',       color: 'bg-blue-400',   dot: 'bg-blue-400'   },
  { key: 'phone_screen',  label: 'Screening',     color: 'bg-amber-400',  dot: 'bg-amber-400'  },
  { key: 'interview',     label: 'Interview',     color: 'bg-violet-400', dot: 'bg-violet-400' },
  { key: 'offer',         label: 'Offer',         color: 'bg-emerald-400',dot: 'bg-emerald-400'},
  { key: 'rejected',      label: 'Rejected',      color: 'bg-slate-400',  dot: 'bg-slate-300'  },
] as const;

type StatusKey = typeof COLUMNS[number]['key'];

function StatusBadge({ status }: { status: string }) {
  const col = COLUMNS.find(c => c.key === status);
  return (
    <span className={`badge ${
      status === 'applied'      ? 'border-blue-500/25 bg-blue-500/10 text-blue-200' :
      status === 'phone_screen' ? 'badge-warning' :
      status === 'interview'    ? 'border-violet-500/25 bg-violet-500/10 text-violet-200' :
      status === 'offer'        ? 'badge-success' :
      status === 'rejected'     ? 'badge-danger' :
      ''
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${col?.dot || 'bg-slate-400'}`} />
      {col?.label || status}
    </span>
  );
}

const blank = (): Application => ({
  id: '',
  company: '',
  role: '',
  status: 'applied',
  dateApplied: new Date().toISOString().split('T')[0],
  notes: '',
  url: '',
});

function NotesPanel({ app, onSave }: { app: Application; onSave: (id: string, notes: string) => void }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(app.notes || '');

  return (
    <div>
      <button onClick={() => setOpen(v => !v)}
        className="flex min-h-[32px] items-center gap-1 rounded-lg text-xs font-medium text-slate-500 transition-colors hover:text-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50">
        <IconChevronRight size={14} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
        {app.notes ? 'Notes' : 'Add notes'}
      </button>
      {open && (
        <div className="mt-2">
          <textarea
            value={val}
            onChange={e => setVal(e.target.value)}
            onBlur={() => onSave(app.id, val)}
            rows={2}
            placeholder="Add notes about this application..."
            className="w-full resize-none text-xs"
          />
          <p className="mt-0.5 text-[10px] text-slate-500">Saves automatically when you click away</p>
        </div>
      )}
    </div>
  );
}

export default function Applications() {
  const router = useRouter();
  const [apps, setApps] = useState<Application[]>([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Application>(blank());
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [feedbackApp, setFeedbackApp] = useState<Application | null>(null);
  const [feedbackNote, setFeedbackNote] = useState('');
  const [coverLetterApp, setCoverLetterApp] = useState<Application | null>(null);
  const [followupApp, setFollowupApp] = useState<Application | null>(null);
  const [followupDraft, setFollowupDraft] = useState('');
  const [generatingFollowup, setGeneratingFollowup] = useState(false);
  const [view, setView] = useState<'board' | 'list'>('list');
  const [reminders, setReminders] = useState<Record<string, string>>({});
  const [reminderApp, setReminderApp] = useState<Application | null>(null);
  const [reminderDate, setReminderDate] = useState('');

  const fetchApplications = async () => {
    try {
      const res = await fetch('/api/applications', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch applications');
      setApps(await res.json());
    } catch (e) {
      console.error('Failed to fetch applications:', e);
      setError('Unable to load application tracker right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    profileAPI.get().then((result) => {
      if (!result.success) router.push('/login');
      else fetchApplications();
    });
    // Load reminders from localStorage
    try {
      const stored = localStorage.getItem('careeva_reminders');
      if (stored) setReminders(JSON.parse(stored));
    } catch { /* ignore */ }
  }, [router]);

  const overdueCount = useMemo(() => {
    const today = new Date();
    return Object.values(reminders).filter(d => d && new Date(d) < today).length;
  }, [reminders]);

  const saveApp = async () => {
    setSaving(true);
    try {
      const method = editing ? 'PUT' : 'POST';
      const url = editing ? `/api/applications/${editing}` : '/api/applications';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Save failed');
      await fetchApplications();
      setModal(false);
      setForm(blank());
      setEditing(null);
    } catch (e) {
      setError('Failed to save application');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: StatusKey) => {
    try {
      await fetch(`/api/applications/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      setApps(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    } catch { /* non-fatal */ }
  };

  const deleteApp = async (id: string) => {
    if (!window.confirm('Delete this application from your tracker? This can\'t be undone.')) return;
    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Delete failed');
      setApps(prev => prev.filter(a => a.id !== id));
    } catch {
      setError('Failed to delete application');
    }
  };

  const saveNotes = async (id: string, notes: string) => {
    try {
      await fetch(`/api/applications/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ notes }),
      });
      setApps(prev => prev.map(a => a.id === id ? { ...a, notes } : a));
    } catch { /* non-fatal */ }
  };

  const saveReminder = (appId: string, date: string) => {
    const updated = { ...reminders, [appId]: date };
    setReminders(updated);
    try { localStorage.setItem('careeva_reminders', JSON.stringify(updated)); } catch { /* ignore */ }
    setReminderApp(null);
    setReminderDate('');
  };

  const generateFollowup = async (app: Application) => {
    setFollowupApp(app);
    setGeneratingFollowup(true);
    setFollowupDraft('');
    try {
      const res = await fetch('/api/applications/followups', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: app.id, action: 'email_sent', generateDraft: true }),
      });
      const data = await res.json();
      if (data.draft) setFollowupDraft(data.draft);
    } catch { /* non-fatal */ }
    setGeneratingFollowup(false);
  };

  const submitFeedback = async (signal: 'interview' | 'rejection' | 'offer') => {
    if (!feedbackApp) return;
    try {
      await fetch(`/api/applications/${feedbackApp.id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ signal, notes: feedbackNote }),
      });
      const newStatus: StatusKey = signal === 'interview' ? 'interview' : signal === 'offer' ? 'offer' : 'rejected';
      await updateStatus(feedbackApp.id, newStatus);
    } catch { /* non-fatal */ }
    setFeedbackApp(null);
    setFeedbackNote('');
  };

  const byStatus = useMemo(() => {
    const map: Record<string, Application[]> = {};
    COLUMNS.forEach(c => { map[c.key] = []; });
    apps.forEach(a => {
      if (map[a.status]) map[a.status].push(a);
      else map['applied'].push(a);
    });
    return map;
  }, [apps]);

  const stats = useMemo(() => ({
    total: apps.length,
    interviews: apps.filter(a => ['interview', 'offer'].includes(a.status)).length,
    offers: apps.filter(a => a.status === 'offer').length,
    rejected: apps.filter(a => a.status === 'rejected').length,
    rate: apps.length > 0 ? Math.round(apps.filter(a => ['interview', 'offer'].includes(a.status)).length / apps.length * 100) : 0,
  }), [apps]);

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
    </div>
  );

  return (
    <div className="page-shell space-y-8">
      {/* Hero header */}
      <section className="hero-panel gradient-border p-8 md:p-10">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="badge mb-4">Step 5 of 5 · Tracker</div>
            <h1 className="section-heading text-4xl">Track every application.</h1>
            <p className="section-subcopy mt-4">
              {apps.length} total · {stats.rate}% interview rate
            </p>
            {overdueCount > 0 && (
              <div className="badge badge-warning mt-3">
                <IconAlertTriangle size={14} />
                {overdueCount} follow-up{overdueCount > 1 ? 's' : ''} overdue
              </div>
            )}
          </div>
          <button
            onClick={() => { setForm(blank()); setEditing(null); setModal(true); }}
            className="btn-primary">
            + Add Application
          </button>
        </div>

        {/* Summary stats */}
        <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: 'Applied',       value: stats.total,      color: 'text-white' },
            { label: 'Interviews',    value: stats.interviews, color: 'text-violet-300' },
            { label: 'Offers',        value: stats.offers,     color: 'text-emerald-300' },
            { label: 'Response Rate', value: `${stats.rate}%`, color: stats.rate >= 15 ? 'text-emerald-300' : 'text-white' },
          ].map(s => (
            <div key={s.label} className="stat-tile">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">{s.label}</p>
              <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      </section>

      {error && (
        <div className="alert-error flex items-center gap-2">
          <IconAlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* View toggle */}
      <div className="flex gap-2">
        {(['list', 'board'] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={`${view === v ? 'btn-secondary' : 'btn-ghost'} text-sm !px-4 !py-2 capitalize`}>
            {v}
          </button>
        ))}
      </div>

      {/* List view */}
      {view === 'list' && (
        <div className="space-y-3">
          {apps.length === 0 && (
            <div className="empty-state">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.05] text-slate-400">
                <IconListChecks size={26} />
              </div>
              <p className="mt-4 font-semibold text-white">No applications yet</p>
              <p className="mt-1 text-sm text-slate-400">Run automation to start applying, or add one manually.</p>
              <button
                onClick={() => { setForm(blank()); setEditing(null); setModal(true); }}
                className="btn-primary mt-6">
                + Add Application
              </button>
            </div>
          )}
          {apps.map(app => (
            <div key={app.id} className="premium-card-soft p-5 transition-colors hover:border-white/20">
              <div className="flex flex-wrap items-center gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white">{app.role}</p>
                  <p className="text-xs text-slate-400">{app.company} · {new Date(app.dateApplied || app.createdAt || Date.now()).toLocaleDateString()}</p>
                </div>
                <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                  <StatusBadge status={app.status} />
                  {/* Status quick-update */}
                  <select
                    value={app.status}
                    onChange={e => updateStatus(app.id, e.target.value as StatusKey)}
                    className="cursor-pointer !w-auto text-xs"
                  >
                    {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                  {/* Reminder indicator */}
                  {reminders[app.id] && (
                    <span className={`badge ${new Date(reminders[app.id]) < new Date() ? 'badge-danger' : ''}`}>
                      <IconBell size={12} />
                      {new Date(reminders[app.id]) < new Date() ? 'Overdue · ' : ''}{new Date(reminders[app.id]).toLocaleDateString()}
                    </span>
                  )}
                  {/* Set reminder */}
                  <button
                    onClick={() => { setReminderApp(app); setReminderDate(reminders[app.id] || ''); }}
                    title="Set follow-up reminder"
                    aria-label="Set follow-up reminder"
                    className="btn-ghost text-sm !px-3 !py-2"
                  >
                    <IconBell size={14} />
                  </button>
                  {/* Follow up button */}
                  <button
                    onClick={() => generateFollowup(app)}
                    title="Generate follow-up email"
                    className="btn-ghost text-sm !px-3 !py-2 !text-violet-300"
                  >
                    <IconMail size={14} /> Follow Up
                  </button>
                  {/* Feedback button */}
                  <button
                    onClick={() => setFeedbackApp(app)}
                    title="Log outcome"
                    className="btn-ghost text-sm !px-3 !py-2 !text-amber-300"
                  >
                    <IconTarget size={14} /> Feedback
                  </button>
                  {app.coverLetter && (
                    <button
                      onClick={() => setCoverLetterApp(app)}
                      title="View cover letter"
                      className="btn-ghost text-sm !px-3 !py-2 !text-blue-300"
                    >
                      <IconFileText size={14} /> Letter
                    </button>
                  )}
                  <button
                    onClick={() => { setForm({ ...app }); setEditing(app.id); setModal(true); }}
                    className="btn-secondary text-sm !px-3 !py-2"
                  >
                    Edit
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); deleteApp(app.id); }}
                    title="Delete application"
                    aria-label="Delete application"
                    className="btn-ghost text-sm !px-3 !py-2 !text-slate-500 hover:!text-red-300"
                  >
                    <IconX size={14} />
                  </button>
                </div>
              </div>
              {/* Expandable notes */}
              <div className="mt-2">
                <NotesPanel app={app} onSave={saveNotes} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Board view */}
      {view === 'board' && (
        <div className="grid grid-cols-5 gap-3 overflow-x-auto pb-4">
          {COLUMNS.map(col => (
            <div key={col.key} className="premium-card-soft min-h-[300px] p-3">
              <div className="mb-3 flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                <p className="text-xs font-bold uppercase tracking-wider text-slate-300">{col.label}</p>
                <span className="ml-auto text-xs font-semibold text-slate-500">{byStatus[col.key]?.length || 0}</span>
              </div>
              <div className="space-y-2">
                {(byStatus[col.key] || []).map(app => (
                  <div key={app.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-3 transition-colors hover:border-white/20">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-bold leading-tight text-white">{app.role}</p>
                      <button
                        onClick={e => { e.stopPropagation(); deleteApp(app.id); }}
                        title="Delete application"
                        aria-label="Delete application"
                        className="-mr-1 -mt-1 flex-shrink-0 rounded-md p-1 text-slate-500 transition-colors hover:text-red-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
                      >
                        <IconX size={12} />
                      </button>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">{app.company}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <select
                        value={app.status}
                        onChange={e => updateStatus(app.id, e.target.value as StatusKey)}
                        className="w-full cursor-pointer !px-2 !py-1 text-[11px]"
                      >
                        {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                      </select>
                      <button onClick={() => setFeedbackApp(app)} className="btn-ghost !px-2 !py-1 text-[11px] !text-amber-300">
                        Feedback
                      </button>
                      {app.coverLetter && (
                        <button onClick={() => setCoverLetterApp(app)} className="btn-ghost !px-2 !py-1 text-[11px] !text-blue-300">
                          Letter
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reminder modal */}
      {reminderApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="premium-card w-full max-w-sm space-y-4 p-6">
            <h2 className="text-lg font-bold text-white">Set Follow-Up Reminder</h2>
            <p className="text-sm text-slate-400">{reminderApp.role} at {reminderApp.company}</p>
            <div>
              <label className="field-label">Reminder Date</label>
              <input
                type="date"
                value={reminderDate}
                onChange={e => setReminderDate(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setReminderApp(null); setReminderDate(''); }}
                className="btn-secondary flex-1">
                Cancel
              </button>
              <button onClick={() => saveReminder(reminderApp.id, reminderDate)} disabled={!reminderDate}
                className="btn-primary flex-1 disabled:opacity-50">
                Save Reminder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="premium-card w-full max-w-lg space-y-4 p-6">
            <h2 className="text-lg font-bold text-white">{editing ? 'Edit Application' : 'Add Application'}</h2>
            {[
              { label: 'Company', field: 'company' as const, type: 'text' },
              { label: 'Role / Title', field: 'role' as const, type: 'text' },
              { label: 'Date Applied', field: 'dateApplied' as const, type: 'date' },
              { label: 'Job URL', field: 'url' as const, type: 'url' },
            ].map(({ label, field, type }) => (
              <div key={field}>
                <label className="field-label">{label}</label>
                <input
                  type={type}
                  value={(form as any)[field] || ''}
                  onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                  className="w-full"
                />
              </div>
            ))}
            <div>
              <label className="field-label">Status</label>
              <select
                value={form.status}
                onChange={e => setForm(p => ({ ...p, status: e.target.value as StatusKey }))}
                className="w-full"
              >
                {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Notes</label>
              <textarea
                value={form.notes || ''}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                rows={2}
                className="w-full resize-none"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => { setModal(false); setForm(blank()); setEditing(null); }}
                className="btn-secondary flex-1">
                Cancel
              </button>
              <button onClick={saveApp} disabled={saving || !form.company || !form.role}
                className="btn-primary flex-1 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback modal */}
      {feedbackApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="premium-card w-full max-w-sm space-y-4 p-6">
            <h2 className="text-lg font-bold text-white">Log Outcome</h2>
            <p className="text-sm text-slate-400">{feedbackApp.role} at {feedbackApp.company}</p>
            <p className="text-xs text-slate-500">This helps Careeva learn what is working and improve future cover letters.</p>
            <textarea
              value={feedbackNote}
              onChange={e => setFeedbackNote(e.target.value)}
              placeholder="Optional notes (e.g. interviewer name, feedback received...)"
              rows={2}
              className="w-full resize-none"
            />
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => submitFeedback('interview')}
                className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-violet-500/25 bg-violet-500/10 text-sm font-bold text-violet-300 transition-colors hover:bg-violet-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">
                <IconTarget size={14} /> Interview
              </button>
              <button onClick={() => submitFeedback('offer')}
                className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-sm font-bold text-emerald-300 transition-colors hover:bg-emerald-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50">
                <IconCheck size={14} /> Offer
              </button>
              <button onClick={() => submitFeedback('rejection')}
                className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-red-500/25 bg-red-500/10 text-sm font-bold text-red-300 transition-colors hover:bg-red-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50">
                <IconX size={14} /> Rejected
              </button>
            </div>
            <button onClick={() => { setFeedbackApp(null); setFeedbackNote(''); }}
              className="btn-secondary w-full">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Follow-up draft modal */}
      {followupApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="premium-card w-full max-w-lg space-y-4 p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-white">Follow-Up Draft</h2>
              <p className="text-sm text-slate-400">{followupApp.role} at {followupApp.company}</p>
            </div>
            {generatingFollowup ? (
              <div className="flex items-center justify-center gap-3 py-6 text-slate-400">
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/></svg>
                <span className="text-sm">Generating draft...</span>
              </div>
            ) : followupDraft ? (
              <>
                <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-relaxed text-slate-300">
                  {followupDraft}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => navigator.clipboard.writeText(followupDraft)}
                    className="btn-secondary flex-1">
                    <IconCopy size={14} /> Copy
                  </button>
                  <button onClick={() => { setFollowupApp(null); setFollowupDraft(''); }}
                    className="btn-primary flex-1">
                    Done
                  </button>
                </div>
              </>
            ) : (
              <p className="py-4 text-center text-sm text-slate-400">Could not generate draft. Try again.</p>
            )}
            <button onClick={() => { setFollowupApp(null); setFollowupDraft(''); }} className="w-full py-2 text-xs text-slate-500 transition-colors hover:text-slate-300">Cancel</button>
          </div>
        </div>
      )}

      {/* Cover letter modal */}
      {coverLetterApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="premium-card flex max-h-[80vh] w-full max-w-2xl flex-col space-y-4 p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-white">Cover Letter</h2>
              <p className="text-sm text-slate-400">{coverLetterApp.role} at {coverLetterApp.company}</p>
            </div>
            <div className="flex-1 overflow-y-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-white/[0.04] p-4 font-mono text-sm leading-relaxed text-slate-300">
              {coverLetterApp.coverLetter || 'No cover letter stored for this application.'}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigator.clipboard.writeText(coverLetterApp.coverLetter || '')}
                className="btn-secondary flex-1">
                <IconCopy size={14} /> Copy
              </button>
              <button onClick={() => setCoverLetterApp(null)}
                className="btn-primary flex-1">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
