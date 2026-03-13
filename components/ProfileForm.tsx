'use client';

import { useState } from 'react';
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

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
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
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">Profile Information</h2>
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Edit Profile
          </button>
        </div>

        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-6 space-y-4">
          {profile.jobTitle && (
            <div>
              <h4 className="text-gray-400 text-sm font-medium">Current/Target Job Title</h4>
              <p className="text-white mt-1">{profile.jobTitle}</p>
            </div>
          )}

          {profile.targetIndustries && profile.targetIndustries.length > 0 && (
            <div>
              <h4 className="text-gray-400 text-sm font-medium">Target Industries</h4>
              <div className="flex flex-wrap gap-2 mt-2">
                {profile.targetIndustries.map((industry) => (
                  <span key={industry} className="px-3 py-1 bg-blue-900 text-blue-200 rounded-full text-xs">
                    {industry}
                  </span>
                ))}
              </div>
            </div>
          )}

          {(profile.desiredSalaryMin || profile.desiredSalaryMax) && (
            <div>
              <h4 className="text-gray-400 text-sm font-medium">Desired Salary</h4>
              <p className="text-white mt-1">
                ${profile.desiredSalaryMin?.toLocaleString()} - ${profile.desiredSalaryMax?.toLocaleString()}
              </p>
            </div>
          )}

          {profile.careerGoals && (
            <div>
              <h4 className="text-gray-400 text-sm font-medium">Career Goals</h4>
              <p className="text-gray-300 mt-1">{profile.careerGoals}</p>
            </div>
          )}

          {profile.skills && profile.skills.length > 0 && (
            <div>
              <h4 className="text-gray-400 text-sm font-medium">Skills</h4>
              <div className="flex flex-wrap gap-2 mt-2">
                {profile.skills.map((skill) => (
                  <span key={skill} className="px-2 py-1 bg-purple-900 text-purple-200 rounded text-xs">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Edit Profile</h2>

      <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-6 space-y-4">
        <div>
          <label className="block text-gray-300 text-sm font-medium mb-2">Job Title</label>
          <input
            type="text"
            value={formData.jobTitle}
            onChange={(e) => handleChange('jobTitle', e.target.value)}
            placeholder="e.g., Software Engineer"
            className="w-full px-4 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-gray-300 text-sm font-medium mb-2">Target Industries</label>
          <input
            type="text"
            value={formData.targetIndustries}
            onChange={(e) => handleChange('targetIndustries', e.target.value)}
            placeholder="e.g., Technology, Finance, Healthcare (comma-separated)"
            className="w-full px-4 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Min Salary ($)</label>
            <input
              type="number"
              value={formData.desiredSalaryMin}
              onChange={(e) => handleChange('desiredSalaryMin', e.target.value)}
              placeholder="e.g., 100000"
              className="w-full px-4 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Max Salary ($)</label>
            <input
              type="number"
              value={formData.desiredSalaryMax}
              onChange={(e) => handleChange('desiredSalaryMax', e.target.value)}
              placeholder="e.g., 150000"
              className="w-full px-4 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-gray-300 text-sm font-medium mb-2">Career Goals</label>
          <textarea
            value={formData.careerGoals}
            onChange={(e) => handleChange('careerGoals', e.target.value)}
            placeholder="What are your career aspirations?"
            rows={4}
            className="w-full px-4 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none resize-none"
          />
        </div>

        <div>
          <label className="block text-gray-300 text-sm font-medium mb-2">Additional Info</label>
          <textarea
            value={formData.additionalInfo}
            onChange={(e) => handleChange('additionalInfo', e.target.value)}
            placeholder="Any other information we should know?"
            rows={4}
            className="w-full px-4 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none resize-none"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => setIsEditing(false)}
          disabled={loading}
          className="px-6 py-2 bg-[#30363d] hover:bg-[#484f58] disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={loading}
          className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          {loading && <LoadingSpinner />}
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
