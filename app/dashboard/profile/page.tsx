'use client';

import { useEffect, useState } from 'react';
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

  const handleSuccess = async () => {
    setSuccessMessage('Profile updated successfully!');
    setTimeout(() => setSuccessMessage(''), 3000);
    // Reload profile
    const result = await profileAPI.get();
    if (result.success) {
      setProfile(result.data!);
    }
  };

  const handleError = (error: string) => {
    setError(error);
    setTimeout(() => setError(''), 3000);
  };

  if (loading) {
    return <LoadingPage />;
  }

  if (!profile) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-6 text-center">
          <p className="text-red-300">{error || 'Failed to load profile'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {successMessage && (
        <div className="mb-6 bg-green-900 bg-opacity-30 border border-green-700 rounded-lg p-4">
          <p className="text-green-300">{successMessage}</p>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-4">
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {/* Profile Form */}
      <ProfileForm
        profile={profile}
        onSuccess={handleSuccess}
        onError={handleError}
      />

      {/* Resume Data */}
      {(profile.skills?.length || 0) > 0 && (
        <div className="mt-12 bg-[#161b22] border border-[#30363d] rounded-lg p-8">
          <h2 className="text-2xl font-bold text-white mb-6">Parsed Resume Data</h2>

          <div className="space-y-6">
            {profile.skills && profile.skills.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Skills ({profile.skills.length})</h3>
                <div className="flex flex-wrap gap-2">
                  {profile.skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-3 py-1 bg-blue-900 text-blue-200 rounded-full text-sm"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {profile.technologies && profile.technologies.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Technologies ({profile.technologies.length})</h3>
                <div className="flex flex-wrap gap-2">
                  {profile.technologies.map((tech) => (
                    <span
                      key={tech}
                      className="px-3 py-1 bg-purple-900 text-purple-200 rounded-full text-sm"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {profile.roles && profile.roles.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Previous Roles</h3>
                <ul className="space-y-2">
                  {profile.roles.map((role) => (
                    <li key={role} className="text-gray-300">
                      • {role}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {profile.education && profile.education.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Education</h3>
                <ul className="space-y-2">
                  {profile.education.map((edu) => (
                    <li key={edu} className="text-gray-300">
                      • {edu}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {profile.industries && profile.industries.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Industries</h3>
                <ul className="space-y-2">
                  {profile.industries.map((industry) => (
                    <li key={industry} className="text-gray-300">
                      • {industry}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
