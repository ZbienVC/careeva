'use client';

import { JobScore } from '@/lib/types';
import { getScoreColor } from '@/lib/api';

interface JobScorerProps {
  score: JobScore;
}

export default function JobScorer({ score }: JobScorerProps) {
  const overallColor = getScoreColor(score.overallScore);

  const categories = [
    { label: 'Skills Match', value: score.skillsScore, weight: '35%' },
    { label: 'Role Match', value: score.roleScore, weight: '25%' },
    { label: 'Technologies', value: score.techScore, weight: '25%' },
    { label: 'Experience', value: score.experienceScore, weight: '15%' },
  ];

  return (
    <div className="space-y-6">
      {/* Overall Score Circle */}
      <div className="flex justify-center mb-8">
        <div className="relative w-48 h-48 rounded-full flex items-center justify-center border-8" style={{ borderColor: overallColor }}>
          <div className="text-center">
            <div className="text-5xl font-bold" style={{ color: overallColor }}>
              {Math.round(score.overallScore)}
            </div>
            <div className="text-sm text-gray-400 mt-2">Match Score</div>
            <div className="text-xs text-gray-500 mt-1">
              {score.overallScore >= 80
                ? 'Excellent Match'
                : score.overallScore >= 60
                ? 'Good Match'
                : score.overallScore >= 40
                ? 'Fair Match'
                : 'Limited Match'}
            </div>
          </div>
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Score Breakdown</h3>

        {categories.map((category) => (
          <div key={category.label}>
            <div className="flex justify-between items-center mb-2">
              <div>
                <h4 className="text-white font-medium">{category.label}</h4>
                <p className="text-xs text-gray-500">{category.weight}</p>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-blue-400">{Math.round(category.value)}</div>
                <div className="text-xs text-gray-500">/100</div>
              </div>
            </div>
            <div className="h-2 bg-[#30363d] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
                style={{ width: `${category.value}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>

      {/* Reasoning */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
        <h3 className="text-white font-medium mb-3">Why This Score?</h3>
        <p className="text-gray-300 text-sm leading-relaxed">{score.reasoning}</p>
      </div>

      {/* Quality Indicator */}
      <div className="bg-gradient-to-r from-blue-900 to-purple-900 bg-opacity-30 border border-blue-700 border-opacity-50 rounded-lg p-4">
        <p className="text-blue-200 text-sm">
          💡 <strong>Tip:</strong> This score is based on your resume data and job requirements. Consider applying to
          positions with scores above 60 for the best fit.
        </p>
      </div>
    </div>
  );
}
