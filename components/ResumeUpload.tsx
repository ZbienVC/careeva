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
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(file.type)) {
      const error = 'Please upload a PDF or DOCX file';
      onError?.(error);
      return;
    }

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
      {!uploadedData ? (
        <div
          className={`rounded-3xl border-2 border-dashed p-8 text-center transition-all ${
            isDragging ? 'border-blue-400 bg-blue-500/10 shadow-lg shadow-blue-950/20' : 'border-white/10 bg-white/[0.03] hover:border-blue-400/50 hover:bg-white/[0.05]'
          } ${loading ? 'pointer-events-none opacity-90' : 'cursor-pointer'}`}
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
            <div className="space-y-4">
              <LoadingSpinner />
              <div>
                <p className="text-base font-medium text-white">Parsing {fileName}</p>
                <p className="mt-1 text-sm text-slate-400">Careeva is extracting skills, roles, technologies, and experience signals.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500/20 via-cyan-400/15 to-violet-500/20 text-3xl text-white">
                ↑
              </div>
              <h3 className="mt-5 text-xl font-semibold text-white">Drop your resume here</h3>
              <p className="mt-2 text-sm text-slate-400">or click to browse from your device</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2 text-xs text-slate-400">
                <span className="badge">PDF</span>
                <span className="badge">DOCX</span>
                <span className="badge">Max 10MB</span>
              </div>
            </>
          )}
        </div>
      ) : null}

      {uploadedData && (
        <div className="rounded-3xl border border-emerald-500/25 bg-emerald-500/10 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-emerald-100">Resume parsed successfully</h3>
              <p className="mt-1 text-sm text-emerald-200/80">Your profile intelligence has been refreshed and is ready for scoring and writing flows.</p>
            </div>
            <button onClick={() => setUploadedData(null)} className="btn-secondary !px-4 !py-2 text-sm">
              Upload another
            </button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {uploadedData.skills && uploadedData.skills.length > 0 && (
              <div className="premium-card-soft p-4">
                <h4 className="text-sm font-medium text-slate-300">Skills ({uploadedData.skills.length})</h4>
                <div className="mt-3 flex flex-wrap gap-2">
                  {uploadedData.skills.map((skill: string, i: number) => (
                    <span key={i} className="badge border-blue-500/20 bg-blue-500/10 text-blue-100">{skill}</span>
                  ))}
                </div>
              </div>
            )}

            {uploadedData.technologies && uploadedData.technologies.length > 0 && (
              <div className="premium-card-soft p-4">
                <h4 className="text-sm font-medium text-slate-300">Technologies</h4>
                <div className="mt-3 flex flex-wrap gap-2">
                  {uploadedData.technologies.map((tech: string, i: number) => (
                    <span key={i} className="badge border-violet-500/20 bg-violet-500/10 text-violet-100">{tech}</span>
                  ))}
                </div>
              </div>
            )}

            {uploadedData.roles && uploadedData.roles.length > 0 && (
              <div className="premium-card-soft p-4">
                <h4 className="text-sm font-medium text-slate-300">Roles</h4>
                <p className="mt-3 text-sm leading-6 text-slate-300">{uploadedData.roles.join(', ')}</p>
              </div>
            )}

            <div className="premium-card-soft p-4">
              <h4 className="text-sm font-medium text-slate-300">Experience</h4>
              <p className="mt-3 text-sm leading-6 text-slate-300">{uploadedData.yearsOfExperience || 0} years detected</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
