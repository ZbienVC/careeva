'use client';

import { useRef, useState } from 'react';
import { uploadAPI } from '@/lib/api';
import { LoadingSpinner } from './Loading';

interface ResumeUploadProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export default function ResumeUpload({ onSuccess, onError }: ResumeUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const [uploadedData, setUploadedData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await handleFile(files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files.length > 0) {
      await handleFile(files[0]);
    }
  };

  const handleFile = async (file: File) => {
    // Validate file type
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(file.type)) {
      const error = 'Please upload a PDF or DOCX file';
      onError?.(error);
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      const error = 'File size must be less than 10MB';
      onError?.(error);
      return;
    }

    setLoading(true);
    setFileName(file.name);

    const result = await uploadAPI.upload(file);

    if (result.success) {
      setUploadedData(result.data);
      onSuccess?.();
    } else {
      onError?.(result.error || 'Upload failed');
    }

    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      {!uploadedData ? (
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-blue-500 bg-blue-500 bg-opacity-10'
              : 'border-[#30363d] hover:border-blue-500'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx"
            onChange={handleFileSelect}
            className="hidden"
            disabled={loading}
          />

          {loading ? (
            <>
              <LoadingSpinner />
              <p className="text-gray-400 mt-4">Uploading and parsing {fileName}...</p>
            </>
          ) : (
            <>
              <div className="text-4xl mb-4">📄</div>
              <h3 className="text-lg font-semibold text-white mb-2">Drop your resume here</h3>
              <p className="text-gray-400 text-sm">or click to browse</p>
              <p className="text-gray-500 text-xs mt-2">PDF or DOCX (max 10MB)</p>
            </>
          )}
        </div>
      ) : null}

      {/* Uploaded Data Preview */}
      {uploadedData && (
        <div className="bg-[#161b22] border border-green-700 border-opacity-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-green-400 mb-4">✓ Resume Parsed Successfully</h3>

          <div className="space-y-4 text-sm">
            {uploadedData.skills && uploadedData.skills.length > 0 && (
              <div>
                <h4 className="text-gray-400 font-medium mb-2">Skills ({uploadedData.skills.length})</h4>
                <div className="flex flex-wrap gap-2">
                  {uploadedData.skills.map((skill: string, i: number) => (
                    <span key={i} className="px-3 py-1 bg-blue-900 text-blue-200 rounded-full text-xs">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {uploadedData.roles && uploadedData.roles.length > 0 && (
              <div>
                <h4 className="text-gray-400 font-medium mb-2">Roles</h4>
                <p className="text-gray-300">{uploadedData.roles.join(', ')}</p>
              </div>
            )}

            {uploadedData.yearsOfExperience && (
              <div>
                <h4 className="text-gray-400 font-medium mb-2">Years of Experience</h4>
                <p className="text-gray-300">{uploadedData.yearsOfExperience} years</p>
              </div>
            )}

            {uploadedData.technologies && uploadedData.technologies.length > 0 && (
              <div>
                <h4 className="text-gray-400 font-medium mb-2">Technologies</h4>
                <div className="flex flex-wrap gap-2">
                  {uploadedData.technologies.map((tech: string, i: number) => (
                    <span key={i} className="px-2 py-1 bg-purple-900 text-purple-200 rounded text-xs">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setUploadedData(null)}
            className="mt-6 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Upload Another Resume
          </button>
        </div>
      )}
    </div>
  );
}
