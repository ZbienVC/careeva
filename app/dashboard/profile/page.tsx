'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserProfile } from '@/lib/types';
import { profileAPI } from '@/lib/api';
import ProfileForm from '@/components/ProfileForm';
import { LoadingPage } from '@/components/Loading';

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const result = await profileAPI.get();
        if (!result.success) {
          router.push('/login');
          return;
        }
        setProfile(result.data!);
      } catch (err) {
        setError('Failed to load profile');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [router]);

  const profileSignals = useMemo(() => {
    if (!profile) return [];
    return [
      { label: 'Skills', value: profile.skills?.length || 0, tone: 'text-blue-300' },
      { label: 'Technologies', value: profile.technologies?.length || 0, tone: 'text-violet-300' },
      { label: 'Prior roles', value: profile.roles?.length || 0, tone: 'text-cyan-300' },
      { label: 'Education items', value: profile.education?.length || 0, tone: 'text-emerald-300' },
    ];
  }, [profile]);

  const handleSuccess = async () => {
    setSuccessMessage('Profile updated successfully.');
    setTimeout(() => setSuccessMessage(''), 3000);
    const result = await profileAPI.get();
    if (result.success) setProfile(result.data!);
  };

  const handleError = (message: string) => {
    setError(message);
    setTimeout(() => setError(''), 3000);
  };

  if (loading) return <LoadingPage />;

  if (!profile) {
    return (
      <div className="page-shell">
        <div className="premium-card p-8 text-center">
          <p className="text-red-300">{error || 'Failed to load profile'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell space-y-8">
      <section className="hero-panel gradient-border p-8 md:p-10">
        <div className="relative z-10 grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div>
            <div className="badge mb-4">Profile intelligence</div>
            <h1 className="section-heading text-4xl md:text-5xl">Sharpen the story behind your search.</h1>
            <p className="section-subcopy mt-4 text-base md:text-lg">
              Better profile context improves job ranking, personalization, and how your AI-generated application materials sound.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {profileSignals.map((item) => (
              <div key={item.label} className="stat-tile">
                <div className="text-sm text-slate-400">{item.label}</div>
                <div className={`mt-2 text-3xl font-bold ${item.tone}`}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {successMessage && <div className="premium-card border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200">{successMessage}</div>}
      {error && <div className="premium-card border-red-500/30 bg-red-500/10 p-4 text-red-200">{error}</div>}

      <section className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
        <ProfileForm profile={profile} onSuccess={handleSuccess} onError={handleError} />

        {(profile.skills?.length || 0) > 0 && (
          <div className="premium-card p-6 md:p-8">
            <h2 className="text-2xl font-bold text-white">Resume intelligence</h2>
            <p className="mt-2 text-sm text-slate-400">Parsed data currently informing scoring, matching, and AI writing workflows.</p>

            <div className="mt-6 space-y-6">
              {profile.skills && profile.skills.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-white">Skills</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {profile.skills.map((skill) => (
                      <span key={skill} className="badge border-blue-500/20 bg-blue-500/10 text-blue-100">{skill}</span>
                    ))}
                  </div>
                </div>
              )}

              {profile.technologies && profile.technologies.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-white">Technologies</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {profile.technologies.map((tech) => (
                      <span key={tech} className="badge border-violet-500/20 bg-violet-500/10 text-violet-100">{tech}</span>
                    ))}
                  </div>
                </div>
              )}

              {profile.roles && profile.roles.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-white">Previous roles</h3>
                  <ul className="mt-3 space-y-2 text-slate-300">
                    {profile.roles.map((role) => <li key={role}>• {role}</li>)}
                  </ul>
                </div>
              )}

              {profile.education && profile.education.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-white">Education</h3>
                  <ul className="mt-3 space-y-2 text-slate-300">
                    {profile.education.map((edu) => <li key={edu}>• {edu}</li>)}
                  </ul>
                </div>
              )}

              {profile.industries && profile.industries.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-white">Detected industries</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {profile.industries.map((industry) => <span key={industry} className="badge">{industry}</span>)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
