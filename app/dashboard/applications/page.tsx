'use client';

import { useState, useEffect } from 'react';
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
  { key: 'applied', label: 'Applied', color: '#2563eb' },
  { key: 'phone_screen', label: 'Phone Screen', color: '#f59e0b' },
  { key: 'interview', label: 'Interview', color: '#8b5cf6' },
  { key: 'offer', label: 'Offer', color: '#10b981' },
  { key: 'rejected', label: 'Rejected', color: '#6b7280' },
];

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
  const { data: session } = useSession();
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
      const app = apps.find(a => a.id === id);
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

  const openEdit = (a: Application) => {
    setForm(a);
    setEditing(a.id);
    setModal(true);
  };

  if (loading) return <div style={{ color: '#e6edf3' }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#e6edf3', margin: '0 0 4px' }}>Applications</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, margin: 0 }}>{apps.length} total applications tracked</p>
        </div>
        <button
          onClick={() => {
            setForm(blank());
            setEditing(null);
            setModal(true);
          }}
          style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
        >
          + Add Application
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {COLUMNS.map(col => {
          const colApps = apps.filter(a => a.status === col.key as any);
          return (
            <div
              key={col.key}
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 12, minHeight: 400 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.color }} />
                <span style={{ fontWeight: 700, fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{col.label}</span>
                <span style={{ marginLeft: 'auto', fontSize: 12, background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)', padding: '1px 7px', borderRadius: 10 }}>
                  {colApps.length}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {colApps.map(a => (
                  <div
                    key={a.id}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 12 }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#e6edf3', marginBottom: 2 }}>{a.company}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>{a.role}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>{a.dateApplied}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                      <button
                        onClick={() => openEdit(a)}
                        style={{ fontSize: 11, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#e6edf3', borderRadius: 4, padding: '3px 8px', cursor: 'pointer' }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => remove(a.id)}
                        style={{ fontSize: 11, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: 4, padding: '3px 8px', cursor: 'pointer' }}
                      >
                        Remove
                      </button>
                    </div>
                    <select
                      value={a.status}
                      onChange={e => move(a.id, e.target.value)}
                      style={{ fontSize: 11, padding: '4px 6px', width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, color: col.color }}
                    >
                      {COLUMNS.map(c => (
                        <option key={c.key} value={c.key}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#161b22', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 32, width: 480, maxWidth: '90vw' }}>
            <h2 style={{ margin: '0 0 24px', fontSize: 20, fontWeight: 800, color: '#e6edf3' }}>
              {editing ? 'Edit Application' : 'Add Application'}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6, display: 'block' }}>Company</label>
                <input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} placeholder="Company name" />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6, display: 'block' }}>Role</label>
                <input value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} placeholder="Job title" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6, display: 'block' }}>Status</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as any })}>
                  {COLUMNS.map(c => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6, display: 'block' }}>Date Applied</label>
                <input type="date" value={form.dateApplied} onChange={e => setForm({ ...form, dateApplied: e.target.value })} />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6, display: 'block' }}>Job URL</label>
              <input value={form.url || ''} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://..." />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6, display: 'block' }}>Notes</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="Any notes about this application..." />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setModal(false);
                  setEditing(null);
                }}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#e6edf3', borderRadius: 8, padding: '10px 20px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={save}
                style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
