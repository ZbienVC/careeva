'use client';

import { JobWithScore } from '@/lib/types';
import Link from 'next/link';
import { getScoreColor } from '@/lib/api';

interface JobCardProps {
  job: JobWithScore;
}

export default function JobCard({ job }: JobCardProps) {
  const score = job.score?.overallScore || 0;
  const scoreColor = getScoreColor(score);

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-6 hover:border-[#484f58] transition-all hover:shadow-lg">
      <div className="flex justify-between items-start gap-4 mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white hover:text-blue-400 transition-colors">
            {job.title}
          </h3>
          <p className="text-sm text-gray-400 mt-1">{job.company}</p>
        </div>

        {/* Score Badge */}
        {score > 0 && (
          <div
            className="flex-shrink-0 relative w-16 h-16 rounded-full flex items-center justify-center border-4"
            style={{ borderColor: scoreColor }}
          >
            <div className="text-center">
              <div className="text-xl font-bold" style={{ color: scoreColor }}>
                {Math.round(score)}
              </div>
              <div className="text-xs text-gray-400">match</div>
            </div>
          </div>
        )}
      </div>

      {/* Job Details */}
      <div className="space-y-2 mb-4 text-sm text-gray-300">
        <div className="flex items-center gap-2">
          <span className="text-gray-500">📍</span>
          <span>{job.location}</span>
        </div>
        {job.salary && (
          <div className="flex items-center gap-2">
            <span className="text-gray-500">💰</span>
            <span>{job.salary}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-gray-500">💼</span>
          <span className="capitalize">{job.jobType}</span>
        </div>
      </div>

      {/* Description Preview */}
      <p className="text-sm text-gray-400 mb-4 line-clamp-2">{job.description}</p>

      {/* CTA Button */}
      <Link
        href={`/dashboard/jobs/${job.id}`}
        className="inline-block w-full text-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
      >
        View Details
      </Link>

      {/* Applied Badge */}
      {job.applied && (
        <div className="mt-3 p-2 bg-green-900 bg-opacity-30 border border-green-700 rounded text-center text-xs text-green-300">
          ✓ Already Applied
        </div>
      )}
    </div>
  );
}
