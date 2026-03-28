'use client';

import { useMemo, useState } from 'react';
import { onboardingAPI } from '@/lib/api';
import { LoadingSpinner } from './Loading';

interface OnboardingFormProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

const ONBOARDING_STEPS = [
  { id: 'jobTitle', label: 'What role are you pursuing next?', helper: 'This becomes the anchor for recommendations and writing.', type: 'text' },
  { id: 'targetIndustries', label: 'Which industries interest you most?', helper: 'Choose the spaces where you want Careeva to focus.', type: 'multi-select' },
  { id: 'desiredSalaryMin', label: 'What salary floor should we optimize around?', helper: 'Set the lower bound that still feels like a strong move.', type: 'number' },
  { id: 'desiredSalaryMax', label: 'What salary ceiling would make this feel like a win?', helper: 'Optional, but useful for prioritization.', type: 'number' },
  { id: 'jobType', label: 'What work styles fit best?', helper: 'Mix remote, hybrid, full-time, contract, and more.', type: 'multi-select' },
  { id: 'willingToRelocate', label: 'Are you open to relocation?', helper: 'This affects how aggressively jobs are surfaced outside your area.', type: 'radio' },
  { id: 'careerGoals', label: 'What does a strong next step look like?', helper: 'Use a sentence or two to describe your direction.', type: 'textarea' },
  { id: 'additionalInfo', label: 'Anything else we should know?', helper: 'Add constraints, advantages, timing, or context.', type: 'textarea' },
];

const INDUSTRIES = ['Technology', 'Finance', 'Healthcare', 'Retail', 'Manufacturing', 'Education', 'Telecommunications', 'Energy', 'Real Estate', 'Other'];
const JOB_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship', 'Remote', 'Hybrid', 'On-site'];

export default function OnboardingForm({ onSuccess, onError }: OnboardingFormProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    jobTitle: '',
    targetIndustries: [] as string[],
    desiredSalaryMin: '',
    desiredSalaryMax: '',
    jobType: [] as string[],
    willingToRelocate: '',
    careerGoals: '',
    additionalInfo: '',
  });

  const step = ONBOARDING_STEPS[currentStep];
  const progress = ((currentStep + 1) / ONBOARDING_STEPS.length) * 100;
  const completionSignals = useMemo(() => {
    return Object.values(formData).flatMap((item) => (Array.isArray(item) ? [item.length > 0] : [Boolean(item)])).filter(Boolean).length;
  }, [formData]);

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleMultiSelect = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field as keyof typeof prev].includes(value)
        ? (prev[field as keyof typeof prev] as string[]).filter((v) => v !== value)
        : [...(prev[field as keyof typeof prev] as string[]), value],
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);

    const submitData = {
      jobTitle: formData.jobTitle || undefined,
      targetIndustries: formData.targetIndustries.length > 0 ? formData.targetIndustries : undefined,
      desiredSalaryMin: formData.desiredSalaryMin ? parseInt(formData.desiredSalaryMin) : undefined,
      desiredSalaryMax: formData.desiredSalaryMax ? parseInt(formData.desiredSalaryMax) : undefined,
      jobType: formData.jobType.length > 0 ? formData.jobType : undefined,
      willingToRelocate: formData.willingToRelocate === 'yes',
      careerGoals: formData.careerGoals || undefined,
      additionalInfo: formData.additionalInfo || undefined,
    };

    const result = await onboardingAPI.submit(submitData);

    if (result.success) onSuccess?.();
    else onError?.(result.error || 'Failed to save onboarding');

    setLoading(false);
  };

  return (
    <div className="grid gap-8 xl:grid-cols-[0.8fr_1.2fr]">
      <div className="premium-card p-6 md:p-7">
        <div className="badge mb-4">Guided setup</div>
        <h3 className="text-2xl font-bold text-white">Build a better search baseline.</h3>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          A few focused answers give Careeva the context it needs to rank roles more intelligently and generate more believable application material.
        </p>

        <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-violet-500" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-3 flex items-center justify-between text-sm text-slate-400">
          <span>Step {currentStep + 1} / {ONBOARDING_STEPS.length}</span>
          <span>{Math.round(progress)}%</span>
        </div>

        <div className="mt-8 space-y-3">
          {ONBOARDING_STEPS.map((item, index) => {
            const active = index === currentStep;
            const complete = index < currentStep;
            return (
              <div key={item.id} className={`rounded-2xl border px-4 py-3 text-sm ${active ? 'border-blue-400/40 bg-blue-500/10' : 'border-white/10 bg-white/[0.03]'} ${complete ? 'text-white' : 'text-slate-400'}`}>
                <div className="flex items-center gap-3">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${complete ? 'bg-emerald-500 text-white' : active ? 'bg-blue-500 text-white' : 'bg-white/10 text-slate-400'}`}>
                    {complete ? '✓' : index + 1}
                  </div>
                  <span>{item.label}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 premium-card-soft p-4 text-sm text-slate-300">
          <div className="text-slate-500">Completion signals</div>
          <div className="mt-1 text-2xl font-bold text-white">{completionSignals}</div>
          <div className="text-slate-400">Fields completed so far</div>
        </div>
      </div>

      <div className="premium-card p-6 md:p-8 space-y-6">
        <div>
          <div className="text-sm uppercase tracking-[0.22em] text-slate-500">Current prompt</div>
          <h2 className="mt-2 text-3xl font-bold text-white">{step.label}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">{step.helper}</p>
        </div>

        {step.type === 'text' && (
          <input
            type="text"
            value={formData[step.id as keyof typeof formData] as string}
            onChange={(e) => handleInputChange(step.id, e.target.value)}
            placeholder="Enter your answer..."
          />
        )}

        {step.type === 'number' && (
          <input
            type="number"
            value={formData[step.id as keyof typeof formData] as string}
            onChange={(e) => handleInputChange(step.id, e.target.value)}
            placeholder="Enter amount..."
          />
        )}

        {step.type === 'textarea' && (
          <textarea
            value={formData[step.id as keyof typeof formData] as string}
            onChange={(e) => handleInputChange(step.id, e.target.value)}
            placeholder="Enter your answer..."
            rows={6}
          />
        )}

        {step.type === 'multi-select' && (
          <div className="grid gap-3 sm:grid-cols-2">
            {(step.id === 'targetIndustries' ? INDUSTRIES : JOB_TYPES).map((option) => {
              const checked = (formData[step.id as keyof typeof formData] as string[]).includes(option);
              return (
                <label key={option} className={`rounded-2xl border p-4 cursor-pointer transition ${checked ? 'border-blue-400/40 bg-blue-500/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]'}`}>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={checked} onChange={() => handleMultiSelect(step.id, option)} className="h-4 w-4 accent-blue-500" />
                    <span className="text-slate-200">{option}</span>
                  </div>
                </label>
              );
            })}
          </div>
        )}

        {step.type === 'radio' && (
          <div className="grid gap-3 sm:grid-cols-2">
            {['yes', 'no'].map((option) => {
              const checked = formData.willingToRelocate === option;
              return (
                <label key={option} className={`rounded-2xl border p-4 cursor-pointer transition ${checked ? 'border-blue-400/40 bg-blue-500/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]'}`}>
                  <div className="flex items-center gap-3">
                    <input type="radio" name="relocation" value={option} checked={checked} onChange={(e) => handleInputChange('willingToRelocate', e.target.value)} className="h-4 w-4 accent-blue-500" />
                    <span className="capitalize text-slate-200">{option}</span>
                  </div>
                </label>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
          <button onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))} disabled={currentStep === 0 || loading} className="btn-secondary disabled:opacity-50">
            Previous
          </button>
          {currentStep < ONBOARDING_STEPS.length - 1 ? (
            <button onClick={() => setCurrentStep((prev) => Math.min(ONBOARDING_STEPS.length - 1, prev + 1))} className="btn-primary">
              Continue
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={loading} className="btn-primary disabled:opacity-50">
              {loading && <LoadingSpinner />}
              {loading ? 'Saving...' : 'Complete onboarding'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
