'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface SavedLetter {
  id: string;
  company: string;
  jobTitle: string;
  date: string;
  content: string;
}

export default function CoverLetterPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [company, setCompany] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [hiringManager, setHiringManager] = useState('');
  const [candidateName, setCandidateName] = useState('Zachary Bienstock');
  const [tone, setTone] = useState('professional');
  const [jd, setJd] = useState('');
  const [loading, setLoading] = useState(false);
  const [letter, setLetter] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [savedLetters, setSavedLetters] = useState<SavedLetter[]>([]);

  useEffect(() => {
    if (!session) router.push('/login');
    else fetchSavedLetters();
  }, [session, router]);

  const fetchSavedLetters = async () => {
    try {
      const res = await fetch('/api/writing-samples', { credentials: 'include' });
      if (res.ok) {
        const samples = await res.json();
        const coverLetters = samples.filter((s: any) => s.type === 'cover_letter');
        setSavedLetters(
          coverLetters.map((s: any) => ({
            id: s.id,
            company: s.title?.split(' - ')[0] || 'Saved',
            jobTitle: s.title?.split(' - ')[1] || 'Letter',
            date: new Date(s.createdAt).toLocaleDateString(),
            content: s.content,
          }))
        );
      }
    } catch (e) {
      console.error('Failed to fetch letters:', e);
    }
  };

  const generate = async () => {
    if (!company || !jobTitle || !jd) {
      setError('Company, job title, and job description are required');
      return;
    }

    setLoading(true);
    setError('');
    setLetter('');

    try {
      const res = await fetch('/api/generate-cover-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobDescription: jd,
          jobTitle,
          company,
          hiringManager,
          candidateName,
          tone,
        }),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLetter(data.coverLetter);
    } catch (e: any) {
      setError(e.message || 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(letter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const save = async () => {
    try {
      const res = await fetch('/api/writing-samples', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${company} - ${jobTitle}`,
          type: 'cover_letter',
          content: letter,
        }),
        credentials: 'include',
      });

      if (res.ok) {
        await fetchSavedLetters();
        alert('Cover letter saved!');
      }
    } catch (e) {
      console.error('Failed to save letter:', e);
    }
  };

  const loadLetter = (savedLetter: SavedLetter) => {
    setLetter(savedLetter.content);
    setCompany(savedLetter.company);
    setJobTitle(savedLetter.jobTitle);
  };

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: '#e6edf3', margin: '0 0 8px' }}>Cover Letter AI</h1>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, margin: '0 0 32px' }}>
        Generate a tailored, compelling cover letter in seconds
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 6, display: 'block' }}>
                Company *
              </label>
              <input value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. Google" />
            </div>
            <div>
              <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 6, display: 'block' }}>
                Job Title *
              </label>
              <input value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="e.g. Analyst" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 6, display: 'block' }}>
                Your Name
              </label>
              <input value={candidateName} onChange={e => setCandidateName(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 6, display: 'block' }}>
                Hiring Manager (optional)
              </label>
              <input value={hiringManager} onChange={e => setHiringManager(e.target.value)} placeholder="e.g. Jane Smith" />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 6, display: 'block' }}>
              Tone
            </label>
            <select value={tone} onChange={e => setTone(e.target.value)}>
              <option value="professional">Professional</option>
              <option value="enthusiastic">Enthusiastic</option>
              <option value="conversational">Conversational</option>
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 6, display: 'block' }}>
              Job Description *
            </label>
            <textarea
              value={jd}
              onChange={e => setJd(e.target.value)}
              rows={10}
              placeholder="Paste the job description..."
              style={{ resize: 'vertical' }}
            />
          </div>
          {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <button
            onClick={generate}
            disabled={loading}
            style={{
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '12px 28px',
              fontSize: 15,
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Writing with AI...' : 'Generate Cover Letter'}
          </button>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Cover Letter</label>
            {letter && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={copy}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#e6edf3',
                    borderRadius: 6,
                    padding: '4px 12px',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  {copied ? '✅ Copied!' : 'Copy'}
                </button>
                <button
                  onClick={save}
                  style={{
                    background: 'rgba(16,185,129,0.2)',
                    border: '1px solid rgba(16,185,129,0.3)',
                    color: '#10b981',
                    borderRadius: 6,
                    padding: '4px 12px',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Save
                </button>
              </div>
            )}
          </div>
          <textarea
            value={letter}
            onChange={e => setLetter(e.target.value)}
            rows={22}
            placeholder="Your cover letter will appear here..."
            style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.6 }}
          />
        </div>
      </div>

      {savedLetters.length > 0 && (
        <div style={{ marginTop: 40 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#e6edf3', marginBottom: 16 }}>Saved Cover Letters</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {savedLetters.map(l => (
              <div
                key={l.id}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10,
                  padding: '14px 18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#e6edf3' }}>
                    {l.jobTitle} at {l.company}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{l.date}</div>
                </div>
                <button
                  onClick={() => loadLetter(l)}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#e6edf3',
                    borderRadius: 6,
                    padding: '6px 14px',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Load
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
