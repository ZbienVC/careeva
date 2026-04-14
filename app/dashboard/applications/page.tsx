'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { profileAPI } from '@/lib/api';

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
  { key: 'applied', label: 'Applied', color: 'bg-blue-400', dot: 'bg-blue-400' },
  { key: 'phone_screen', label: 'Phone Screen', color: 'bg-amber-400', dot: 'bg-amber-400' },
  { key: 'interview', label: 'Interview', color: 'bg-violet-400', dot: 'bg-violet-400' },
  { key: 'offer', label: 'Offer', color: 'bg-emerald-400', dot: 'bg-emerald-400' },
  { key: 'rejected', label: 'Rejected', color: 'bg-slate-400', dot: 'bg-slate-300' },
] as const;

type StatusKey = typeof COLUMNS[number]['key'];

function StatusBadge({ status }: { status: string }) {
  const col = COLUMNS.find(c => c.key === status);
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
      status === 'applied' ? 'bg-blue-50 text-blue-700' :
      status === 'phone_screen' ? 'bg-amber-50 text-amber-700' :
      status === 'interview' ? 'bg-violet-50 text-violet-700' :
      status === 'offer' ? 'bg-emerald-50 text-emerald-700' :
      status === 'rejected' ? 'bg-slate-100 text-slate-500' :
      'bg-slate-100 text-slate-500'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${col?.dot || 'bg-slate-400'}`} />
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
  }, [router]);

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
      // Also update status
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

  // Stats
  const stats = useMemo(() => ({
    total: apps.length,
    interviews: apps.filter(a => ['interview', 'offer'].includes(a.status)).length,
    offers: apps.filter(a => a.status === 'offer').length,
    rejected: apps.filter(a => a.status === 'rejected').length,
    rate: apps.length > 0 ? Math.round(apps.filter(a => ['interview', 'offer'].includes(a.status)).length / apps.length * 100) : 0,
  }), [apps]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Applications</h1>
          <p className="text-slate-400 text-sm mt-0.5">{apps.length} total · {stats.rate}% interview rate</p>
        </div>
        <button
          onClick={() => { setForm(blank()); setEditing(null); setModal(true); }}
          className="px-5 py-2.5 rounded-xl text-white font-bold text-sm"
          style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
          + Add Application
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Applied', value: stats.total, color: 'text-slate-900' },
          { label: 'Interviews', value: stats.interviews, color: 'text-violet-600' },
          { label: 'Offers', value: stats.offers, color: 'text-emerald-600' },
          { label: 'Interview Rate', value: `${stats.rate}%`, color: stats.rate >= 15 ? 'text-emerald-600' : 'text-slate-900' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`text-2xl font-black tabular-nums ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {error && <div className="text-red-500 text-sm bg-red-50 rounded-xl p-3">{error}</div>}

      {/* View toggle */}
      <div className="flex gap-2">
        {(['list', 'board'] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold capitalize transition-all ${view === v ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:text-slate-700'}`}>
            {v}
          </button>
        ))}
      </div>

      {/* List view */}
      {view === 'list' && (
        <div className="space-y-2">
          {apps.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <p className="text-4xl mb-3">📋</p>
              <p className="font-semibold">No applications yet</p>
              <p className="text-sm mt-1">Run automation to start applying, or add manually above</p>
            </div>
          )}
          {apps.map(app => (
            <div key={app.id} className="bg-white rounded-2xl border border-slate-100 px-5 py-4 flex items-center gap-4 hover:border-slate-200 transition-all">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 text-sm">{app.role}</p>
                <p className="text-slate-400 text-xs">{app.company} · {new Date(app.dateApplied || app.createdAt || Date.now()).toLocaleDateString()}</p>
                {app.notes && <p className="text-slate-400 text-xs mt-0.5 truncate">{app.notes}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <StatusBadge status={app.status} />
                {/* Status quick-update */}
                <select
                  value={app.status}
                  onChange={e => updateStatus(app.id, e.target.value as StatusKey)}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1 text-slate-600 bg-white cursor-pointer"
                >
                  {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
                {/* Follow up button */}
                <button
                  onClick={() => generateFollowup(app)}
                  title="Generate follow-up email"
                  className="text-xs px-2 py-1 rounded-lg bg-purple-50 text-purple-700 font-semibold hover:bg-purple-100 transition-all"
                >
                  Follow Up
                </button>
                {/* Feedback button */}
                <button
                  onClick={() => setFeedbackApp(app)}
                  title="Log outcome"
                  className="text-xs px-2 py-1 rounded-lg bg-amber-50 text-amber-700 font-semibold hover:bg-amber-100 transition-all"
                >
                  Feedback
                </button>
                {/* Cover letter button */}
                {app.coverLetter && (
                  <button
                    onClick={() => setCoverLetterApp(app)}
                    title="View cover letter"
                    className="text-xs px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-semibold hover:bg-indigo-100 transition-all"
                  >
                    CL
                  </button>
                )}
                {/* Edit */}
                <button
                  onClick={() => { setForm({ ...app }); setEditing(app.id); setModal(true); }}
                  className="text-xs px-2 py-1 rounded-lg bg-slate-50 text-slate-500 font-semibold hover:bg-slate-100 transition-all"
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Board view */}
      {view === 'board' && (
        <div className="grid grid-cols-5 gap-3 overflow-x-auto pb-4">
          {COLUMNS.map(col => (
            <div key={col.key} className="bg-slate-50 rounded-2xl p-3 min-h-[300px]">
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">{col.label}</p>
                <span className="ml-auto text-xs text-slate-400 font-semibold">{byStatus[col.key]?.length || 0}</span>
              </div>
              <div className="space-y-2">
                {(byStatus[col.key] || []).map(app => (
                  <div key={app.id} className="bg-white rounded-xl border border-slate-100 p-3 shadow-sm">
                    <p className="font-bold text-slate-900 text-xs leading-tight">{app.role}</p>
                    <p className="text-slate-400 text-xs mt-0.5">{app.company}</p>
                    <div className="flex gap-1 mt-2">
                      <button onClick={() => setFeedbackApp(app)} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold">
                        Feedback
                      </button>
                      {app.coverLetter && (
                        <button onClick={() => setCoverLetterApp(app)} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold">
                          CL
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

      {/* Add/Edit modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-black text-slate-900">{editing ? 'Edit Application' : 'Add Application'}</h2>
            {[
              { label: 'Company', field: 'company' as const, type: 'text' },
              { label: 'Role / Title', field: 'role' as const, type: 'text' },
              { label: 'Date Applied', field: 'dateApplied' as const, type: 'date' },
              { label: 'Job URL', field: 'url' as const, type: 'url' },
            ].map(({ label, field, type }) => (
              <div key={field}>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">{label}</label>
                <input
                  type={type}
                  value={(form as any)[field] || ''}
                  onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-400"
                />
              </div>
            ))}
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Status</label>
              <select
                value={form.status}
                onChange={e => setForm(p => ({ ...p, status: e.target.value as StatusKey }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-400"
              >
                {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Notes</label>
              <textarea
                value={form.notes || ''}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                rows={2}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-400 resize-none"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => { setModal(false); setForm(blank()); setEditing(null); }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={saveApp} disabled={saving || !form.company || !form.role}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback modal */}
      {feedbackApp && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-black text-slate-900">Log Outcome</h2>
            <p className="text-slate-500 text-sm">{feedbackApp.role} at {feedbackApp.company}</p>
            <p className="text-xs text-slate-400">This helps Careeva learn what's working and improve future cover letters.</p>
            <textarea
              value={feedbackNote}
              onChange={e => setFeedbackNote(e.target.value)}
              placeholder="Optional notes (e.g. interviewer name, feedback received...)"
              rows={2}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-400 resize-none"
            />
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => submitFeedback('interview')}
                className="py-2.5 rounded-xl text-sm font-bold text-violet-700 bg-violet-50 hover:bg-violet-100">
                🎉 Interview
              </button>
              <button onClick={() => submitFeedback('offer')}
                className="py-2.5 rounded-xl text-sm font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100">
                🏆 Offer
              </button>
              <button onClick={() => submitFeedback('rejection')}
                className="py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-slate-50 hover:bg-slate-100">
                ✗ Rejected
              </button>
            </div>
            <button onClick={() => { setFeedbackApp(null); setFeedbackNote(''); }}
              className="w-full py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Follow-up draft modal */}
      {followupApp && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900">Follow-Up Draft</h2>
              <p className="text-sm text-slate-400">{followupApp.role} at {followupApp.company}</p>
            </div>
            {generatingFollowup ? (
              <div className="flex items-center gap-3 py-6 justify-center text-slate-400">
                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/></svg>
                <span className="text-sm">Generating draft...</span>
              </div>
            ) : followupDraft ? (
              <>
                <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                  {followupDraft}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => navigator.clipboard.writeText(followupDraft)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">
                    Copy
                  </button>
                  <button onClick={() => { setFollowupApp(null); setFollowupDraft('); }}
                    className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold"
                    style={{ background: "linear-gradient(135deg,#8b5cf6,#6d28d9)" }}>
                    Done
                  </button>
                </div>
              </>
            ) : (
              <p className="text-slate-400 text-sm text-center py-4">Could not generate draft. Try again.</p>
            )}
            <button onClick={() => { setFollowupApp(null); setFollowupDraft(""); }} className="w-full py-2 text-xs text-slate-400 hover:text-slate-600">Cancel</button>
          </div>
        </div>
      )}

      {/* Cover letter modal */}
      {coverLetterApp && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900">Cover Letter</h2>
              <p className="text-sm text-slate-400">{coverLetterApp.role} at {coverLetterApp.company}</p>
            </div>
            <div className="flex-1 overflow-y-auto bg-slate-50 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-wrap font-mono leading-relaxed">
              {coverLetterApp.coverLetter || 'No cover letter stored for this application.'}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigator.clipboard.writeText(coverLetterApp.coverLetter || '')}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">
                Copy
              </button>
              <button onClick={() => setCoverLetterApp(null)}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold"
                style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
