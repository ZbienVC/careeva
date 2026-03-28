'use client';

import { useMemo, useState } from 'react';
import { UserProfile } from '@/lib/types';
import { profileAPI } from '@/lib/api';
import { LoadingSpinner } from './Loading';

interface ProfileFormProps {
  profile: UserProfile;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export default function ProfileForm({ profile, onSuccess, onError }: ProfileFormProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    jobTitle: profile.jobTitle || '',
    targetIndustries: profile.targetIndustries?.join(', ') || '',
    desiredSalaryMin: profile.desiredSalaryMin?.toString() || '',
    desiredSalaryMax: profile.desiredSalaryMax?.toString() || '',
    careerGoals: profile.careerGoals || '',
    additionalInfo: profile.additionalInfo || '',
  });

  const profileStrength = useMemo(() => {
    const items = [formData.jobTitle, formData.targetIndustries, formData.careerGoals, formData.additionalInfo];
    return Math.round((items.filter(Boolean).length / items.length) * 100);
  }, [formData]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setLoading(true);

    const submitData = {
      jobTitle: formData.jobTitle,
      targetIndustries: formData.targetIndustries
        .split(',')
        .map((i) => i.trim())
        .filter((i) => i),
      desiredSalaryMin: formData.desiredSalaryMin ? parseInt(formData.desiredSalaryMin) : undefined,
      desiredSalaryMax: formData.desiredSalaryMax ? parseInt(formData.desiredSalaryMax) : undefined,
      careerGoals: formData.careerGoals,
      additionalInfo: formData.additionalInfo,
    };

    const result = await profileAPI.update(submitData);

    if (result.success) {
      setIsEditing(false);
      onSuccess?.();
    } else {
      onError?.(result.error || 'Failed to save profile');
    }

    setLoading(false);
  };

  if (!isEditing) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Profile strategy</h2>
            <p className="mt-1 text-sm text-slate-400">Keep your targeting, salary expectations, and narrative clean and current.</p>
          </div>
          <button onClick={() => setIsEditing(true)} className="btn-primary">
            Edit profile
          </button>
        </div>

        <div className="premium-card p-6 md:p-8">
          <div className="mb-8 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm uppercase tracking-[0.22em] text-slate-500">Profile completeness</div>
              <div className="mt-2 text-4xl font-bold text-white">{profileStrength}%</div>
            </div>
            <div className="w-full max-w-sm">
              <div className="h-3 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-violet-500" style={{ width: `${profileStrength}%` }} />
              </div>
              <div className="mt-2 text-sm text-slate-400">Stronger profile data improves matching, writing, and application quality.</div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="premium-card-soft p-5">
              <div className="text-sm text-slate-500">Target title</div>
              <div className="mt-2 text-lg font-semibold text-white">{profile.jobTitle || 'Add your target role'}</div>
            </div>
            <div className="premium-card-soft p-5">
              <div className="text-sm text-slate-500">Desired salary</div>
              <div className="mt-2 text-lg font-semibold text-white">
                {profile.desiredSalaryMin || profile.desiredSalaryMax
                  ? `$${profile.desiredSalaryMin?.toLocaleString() || '—'} - $${profile.desiredSalaryMax?.toLocaleString() || '—'}`
                  : 'Set compensation targets'}
              </div>
            </div>
            <div className="premium-card-soft p-5 md:col-span-2">
              <div className="text-sm text-slate-500">Target industries</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(profile.targetIndustries?.length ? profile.targetIndustries : ['No industries selected']).map((industry) => (
                  <span key={industry} className="badge">{industry}</span>
                ))}
              </div>
            </div>
            <div className="premium-card-soft p-5 md:col-span-2">
              <div className="text-sm text-slate-500">Career goals</div>
              <p className="mt-2 leading-7 text-slate-300">{profile.careerGoals || 'Add a concise direction statement so Careeva can personalize job scoring and cover letters better.'}</p>
            </div>
            <div className="premium-card-soft p-5 md:col-span-2">
              <div className="text-sm text-slate-500">Additional context</div>
              <p className="mt-2 leading-7 text-slate-300">{profile.additionalInfo || 'Share constraints, strengths, relocation preferences, or anything else that shapes a strong application.'}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Edit profile</h2>
        <p className="mt-1 text-sm text-slate-400">Refine the details that drive recommendations, writing quality, and workflow personalization.</p>
      </div>

      <div className="premium-card p-6 md:p-8 space-y-5">
        <div>
          <label className="field-label">Target job title</label>
          <input
            type="text"
            value={formData.jobTitle}
            onChange={(e) => handleChange('jobTitle', e.target.value)}
            placeholder="e.g., Product Analyst, Growth Associate"
          />
        </div>

        <div>
          <label className="field-label">Target industries</label>
          <input
            type="text"
            value={formData.targetIndustries}
            onChange={(e) => handleChange('targetIndustries', e.target.value)}
            placeholder="Technology, Finance, Healthcare"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="field-label">Min salary ($)</label>
            <input
              type="number"
              value={formData.desiredSalaryMin}
              onChange={(e) => handleChange('desiredSalaryMin', e.target.value)}
              placeholder="100000"
            />
          </div>
          <div>
            <label className="field-label">Max salary ($)</label>
            <input
              type="number"
              value={formData.desiredSalaryMax}
              onChange={(e) => handleChange('desiredSalaryMax', e.target.value)}
              placeholder="150000"
            />
          </div>
        </div>

        <div>
          <label className="field-label">Career goals</label>
          <textarea
            value={formData.careerGoals}
            onChange={(e) => handleChange('careerGoals', e.target.value)}
            placeholder="Describe the direction you want your next move to support."
            rows={4}
          />
        </div>

        <div>
          <label className="field-label">Additional context</label>
          <textarea
            value={formData.additionalInfo}
            onChange={(e) => handleChange('additionalInfo', e.target.value)}
            placeholder="Relocation preferences, availability, deal-breakers, notable strengths..."
            rows={4}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button onClick={() => setIsEditing(false)} disabled={loading} className="btn-secondary disabled:opacity-50">
          Cancel
        </button>
        <button onClick={handleSave} disabled={loading} className="btn-primary disabled:opacity-50">
          {loading && <LoadingSpinner />}
          {loading ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
