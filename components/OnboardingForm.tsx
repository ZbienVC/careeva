'use client';

import { useState } from 'react';
import { onboardingAPI } from '@/lib/api';
import { LoadingSpinner } from './Loading';

interface OnboardingFormProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

const ONBOARDING_STEPS = [
  { id: 'jobTitle', label: 'What is your current or target job title?', type: 'text' },
  { id: 'targetIndustries', label: 'What industries interest you?', type: 'multi-select' },
  { id: 'desiredSalaryMin', label: 'Desired salary minimum ($)', type: 'number' },
  { id: 'desiredSalaryMax', label: 'Desired salary maximum ($)', type: 'number' },
  { id: 'jobType', label: 'What job types interest you?', type: 'multi-select' },
  { id: 'willingToRelocate', label: 'Are you willing to relocate?', type: 'radio' },
  { id: 'careerGoals', label: 'What are your career goals?', type: 'textarea' },
  { id: 'additionalInfo', label: 'Anything else we should know?', type: 'textarea' },
];

const INDUSTRIES = [
  'Technology',
  'Finance',
  'Healthcare',
  'Retail',
  'Manufacturing',
  'Education',
  'Telecommunications',
  'Energy',
  'Real Estate',
  'Other',
];

const JOB_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship', 'Remote'];

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

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleMultiSelect = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field as keyof typeof prev].includes(value)
        ? (prev[field as keyof typeof prev] as string[]).filter((v) => v !== value)
        : [...(prev[field as keyof typeof prev] as string[]), value],
    }));
  };

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
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

    if (result.success) {
      onSuccess?.();
    } else {
      onError?.(result.error || 'Failed to save onboarding');
    }

    setLoading(false);
  };

  const step = ONBOARDING_STEPS[currentStep];
  const progress = ((currentStep + 1) / ONBOARDING_STEPS.length) * 100;

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold text-white">
            Step {currentStep + 1} of {ONBOARDING_STEPS.length}
          </h3>
          <span className="text-sm text-gray-400">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-[#30363d] rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 transition-all" style={{ width: `${progress}%` }}></div>
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-8">
        <h2 className="text-xl font-bold text-white mb-6">{step.label}</h2>

        {step.type === 'text' && (
          <input
            type="text"
            value={formData[step.id as keyof typeof formData] as string}
            onChange={(e) => handleInputChange(step.id, e.target.value)}
            placeholder="Enter your answer..."
            className="w-full px-4 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
        )}

        {step.type === 'number' && (
          <input
            type="number"
            value={formData[step.id as keyof typeof formData] as string}
            onChange={(e) => handleInputChange(step.id, e.target.value)}
            placeholder="Enter amount..."
            className="w-full px-4 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
        )}

        {step.type === 'textarea' && (
          <textarea
            value={formData[step.id as keyof typeof formData] as string}
            onChange={(e) => handleInputChange(step.id, e.target.value)}
            placeholder="Enter your answer..."
            rows={5}
            className="w-full px-4 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none resize-none"
          />
        )}

        {step.type === 'multi-select' && (
          <div className="space-y-3">
            {(step.id === 'targetIndustries' ? INDUSTRIES : JOB_TYPES).map((option) => (
              <label key={option} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={(formData[step.id as keyof typeof formData] as string[]).includes(option)}
                  onChange={() => handleMultiSelect(step.id, option)}
                  className="w-4 h-4 accent-blue-500"
                />
                <span className="text-gray-300">{option}</span>
              </label>
            ))}
          </div>
        )}

        {step.type === 'radio' && (
          <div className="space-y-3">
            {['Yes', 'No'].map((option) => (
              <label key={option} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="relocation"
                  value={option.toLowerCase()}
                  checked={formData.willingToRelocate === option.toLowerCase()}
                  onChange={(e) => handleInputChange('willingToRelocate', e.target.value)}
                  className="w-4 h-4 accent-blue-500"
                />
                <span className="text-gray-300">{option}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-4 justify-between">
        <button
          onClick={handlePrev}
          disabled={currentStep === 0 || loading}
          className="px-6 py-2 bg-[#30363d] hover:bg-[#484f58] disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
        >
          Previous
        </button>

        <div className="flex gap-3">
          {currentStep < ONBOARDING_STEPS.length - 1 ? (
            <button
              onClick={handleNext}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              {loading && <LoadingSpinner />}
              {loading ? 'Submitting...' : 'Complete'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
