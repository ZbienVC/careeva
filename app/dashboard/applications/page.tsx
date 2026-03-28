'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface Application {
  id: string;
  company: string;
  role: string;
  status: 'applied' | 'phone_screen' | 'interview' | 'offer' | 'rejected';
  dateApplied: string;
  notes: string;
  url?: string;
}

const COLUMNS = [
  { key: 'applied', label: 'Applied', color: 'bg-blue-400' },
  { key: 'phone_screen', label: 'Phone Screen', color: 'bg-amber-400' },
  { key: 'interview', label: 'Interview', color: 'bg-violet-400' },
  { key: 'offer', label: 'Offer', color: 'bg-emerald-400' },
  { key: 'rejected', label: 'Rejected', color: 'bg-slate-400' },
] as const;

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
  const sessionResult = useSession();
  const session = sessionResult?.data;
  const router = useRouter();
  const [apps, setApps] = useState<Application[]>([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Application>(blank());
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) router.push('/login');
    else fetchApplications();
  }, [session, router]);

  const fetchApplications = async () => {
    try {
      const res = await fetch('/api/applications', { credentials: 'include' });
      if (res.ok) setApps(await res.json());
    } catch (e) {
      console.error('Failed to fetch applications:', e);
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    try {
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch('/api/applications', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { ...form, id: editing } : form),
        credentials: 'include',
      });
      if (res.ok) {
        await fetchApplications();
        setModal(false);
        setForm(blank());
        setEditing(null);
      }
    } catch (e) {
      console.error('Failed to save application:', e);
    }
  };

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/applications?id=${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) await fetchApplications();
    } catch (e) {
      console.error('Failed to delete application:', e);
    }
  };

  const move = async (id: string, status: string) => {
    try {
      const app = apps.find((a) => a.id === id);
      if (app) {
        const res = await fetch('/api/applications', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...app, status }),
          credentials: 'include',
        });
        if (res.ok) await fetchApplications();
      }
    } catch (e) {
      console.error('Failed to move application:', e);
    }
  };

  const openEdit = (app: Application) => {
    setForm(app);
    setEditing(app.id);
    setModal(true);
  };

  const metrics = useMemo(
    () => ({
      total: apps.length,
      active: apps.filter((app) => ['applied', 'phone_screen', 'interview'].includes(app.status)).length,
      interviews: apps.filter((app) => app.status === 'interview').length,
      offers: apps.filter((app) => app.status === 'offer').length,
    }),
    [apps]
  );

  if (loading) {
    return (
      <div className="page-shell">
        <div className="premium-card p-8 text-slate-300">Loading application tracker...</div>
      </div>
    );
  }

  return (
    <div className="page-shell space-y-8">
      <section className="hero-panel gradient-border p-8 md:p-10">
        <div className="relative z-10 flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="badge mb-4">Application tracker</div>
            <h1 className="section-heading text-4xl md:text-5xl">Run your job pipeline like a clean sales funnel.</h1>
            <p className="section-subcopy mt-4 text-base md:text-lg">
              Track momentum, update statuses fast, and keep every opportunity visible from applied to offer.
            </p>
          </div>
          <button
            onClick={() => {
              setForm(blank());
              setEditing(null);
              setModal(true);
            }}
            className="btn-primary"
          >
            + Add application
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="stat-tile"><div className="text-sm text-slate-400">Total tracked</div><div className="mt-2 text-3xl font-bold text-white">{metrics.total}</div></div>
        <div className="stat-tile"><div className="text-sm text-slate-400">Active process</div><div className="mt-2 text-3xl font-bold text-blue-300">{metrics.active}</div></div>
        <div className="stat-tile"><div className="text-sm text-slate-400">Interviews</div><div className="mt-2 text-3xl font-bold text-violet-300">{metrics.interviews}</div></div>
        <div className="stat-tile"><div className="text-sm text-slate-400">Offers</div><div className="mt-2 text-3xl font-bold text-emerald-300">{metrics.offers}</div></div>
      </section>

      <section className="grid gap-4 xl:grid-cols-5">
        {COLUMNS.map((column) => {
          const columnApps = apps.filter((app) => app.status === column.key);
          return (
            <div key={column.key} className="premium-card p-4 md:p-5 min-h-[360px]">
              <div className="mb-4 flex items-center gap-3">
                <div className={`h-2.5 w-2.5 rounded-full ${column.color}`} />
                <span className="font-semibold text-white">{column.label}</span>
                <span className="ml-auto rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-slate-400">{columnApps.length}</span>
              </div>

              <div className="space-y-3">
                {columnApps.map((app) => (
                  <div key={app.id} className="premium-card-soft p-4">
                    <div className="text-base font-semibold text-white">{app.company}</div>
                    <div className="mt-1 text-sm text-slate-300">{app.role}</div>
                    <div className="mt-2 text-xs text-slate-500">Applied {app.dateApplied}</div>

                    {app.notes && <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-400">{app.notes}</p>}

                    <div className="mt-4 space-y-3">
                      <select value={app.status} onChange={(e) => move(app.id, e.target.value)} className="!rounded-xl !py-2 text-sm">
                        {COLUMNS.map((col) => (
                          <option key={col.key} value={col.key}>{col.label}</option>
                        ))}
                      </select>

                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => openEdit(app)} className="btn-secondary !rounded-xl !px-3 !py-2 text-xs">Edit</button>
                        {app.url && (
                          <a href={app.url} target="_blank" rel="noreferrer" className="btn-secondary !rounded-xl !px-3 !py-2 text-xs">
                            Open link
                          </a>
                        )}
                        <button onClick={() => remove(app.id)} className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200 hover:bg-red-500/20">
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {columnApps.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm text-slate-500">
                    No applications in {column.label.toLowerCase()} yet.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {modal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
          <div className="premium-card w-full max-w-2xl p-6 md:p-8">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white">{editing ? 'Edit application' : 'Add application'}</h2>
                <p className="mt-1 text-sm text-slate-400">Keep every role, status change, and note in one polished workflow.</p>
              </div>
              <button onClick={() => { setModal(false); setEditing(null); }} className="btn-ghost">Close</button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="field-label">Company</label>
                <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Company name" />
              </div>
              <div>
                <label className="field-label">Role</label>
                <input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Job title" />
              </div>
              <div>
                <label className="field-label">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Application['status'] })}>
                  {COLUMNS.map((column) => <option key={column.key} value={column.key}>{column.label}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Date applied</label>
                <input type="date" value={form.dateApplied} onChange={(e) => setForm({ ...form, dateApplied: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="field-label">Job URL</label>
                <input value={form.url || ''} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." />
              </div>
              <div className="md:col-span-2">
                <label className="field-label">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={4} placeholder="Key touchpoints, referrals, takeaways, follow-up reminders..." />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button onClick={() => { setModal(false); setEditing(null); }} className="btn-secondary">Cancel</button>
              <button onClick={save} className="btn-primary">Save application</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
