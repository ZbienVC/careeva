import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import os from 'os';
import crypto from 'crypto';
import { parseResume } from '@/lib/resume-parser';
import { prisma } from '@/lib/db';
import { getCurrentUserFromRequest } from '@/lib/session';
import { saveFile, getFile, deleteFile, contentTypeFor, isPersistent } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Auth optional — parse for everyone, save to DB only when signed in
    const user = await getCurrentUserFromRequest(request);

    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    // Accept by extension when MIME type is blank
    const ext = '.' + (file.name.split('.').pop()?.toLowerCase() || '');
    const allowedExts = ['.pdf', '.docx', '.doc', '.txt', '.png', '.jpg', '.jpeg', '.webp'];
    if (!allowedExts.includes(ext)) {
      return NextResponse.json({ error: 'Please upload a PDF, DOCX, TXT, or image (PNG/JPG/WebP) file' }, { status: 400 });
    }

    // Image resumes need AI vision to read — fail fast with a clear message
    // instead of a 500 deep inside the parser.
    const imageExts = ['.png', '.jpg', '.jpeg', '.webp'];
    if (imageExts.includes(ext) && !process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'Image resumes need AI vision (OPENAI_API_KEY) to read. Please upload your resume as PDF or DOCX instead.' },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());

    // Persist the REAL file (Railway Volume via lib/storage) so it can be
    // attached to applications later. public/uploads was ephemeral on Railway.
    let storageKey: string | null = null;
    if (user?.id) {
      const saved = await saveFile(`resumes/${user.id}`, file.name, bytes);
      storageKey = saved.key;
    }

    // Parser needs a path: write to OS tmp, parse, clean up.
    const tmpDir = join(os.tmpdir(), 'careeva-parse');
    mkdirSync(tmpDir, { recursive: true });
    const tmpPath = join(tmpDir, crypto.randomBytes(8).toString('hex') + ext);
    writeFileSync(tmpPath, bytes);
    let parsed;
    try {
      parsed = await parseResume(tmpPath);
    } finally {
      try { rmSync(tmpPath, { force: true }); } catch { /* ignore */ }
    }

    // Save to DB only when authenticated
    if (user?.id) {
      // 1. Update flat UserProfile (backward compat for scoring)
      await prisma.userProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          skills: parsed.skills,
          roles: parsed.roles,
          industries: parsed.industries,
          yearsExperience: parsed.yearsExperience,
          education: parsed.education,
          technologies: parsed.technologies,
          resumeUrl: storageKey ? 'storage://' + storageKey : null,
        },
        update: {
          skills: parsed.skills,
          roles: parsed.roles,
          industries: parsed.industries,
          yearsExperience: parsed.yearsExperience,
          education: parsed.education,
          technologies: parsed.technologies,
          resumeUrl: storageKey ? 'storage://' + storageKey : null,
        },
      });

      // 2. Save Resume record
      await prisma.resume.create({
        data: {
          userId: user.id,
          name: 'Uploaded ' + new Date().toLocaleDateString(),
          fileUrl: storageKey ? 'storage://' + storageKey : null,
          fileType: ext === '.pdf' ? 'pdf' : ext === '.txt' ? 'txt' : ['.png', '.jpg', '.jpeg', '.webp'].includes(ext) ? 'image' : 'docx',
          isBase: true,
          rawText: parsed.rawText || '',
        },
      });

      // 3. Auto-create WorkHistory records from parsed positions
      if (parsed.workHistory && parsed.workHistory.length > 0) {
        for (const wh of parsed.workHistory) {
          if (!wh.company || !wh.title) continue;
          // Skip if this company+title already exists
          const exists = await prisma.workHistory.findFirst({
            where: { userId: user.id, company: wh.company, title: wh.title },
          });
          if (exists) continue;

          await prisma.workHistory.create({
            data: {
              userId: user.id,
              company: wh.company,
              title: wh.title,
              startDate: wh.startDate ? new Date(wh.startDate + '-01') : undefined,
              endDate: wh.endDate ? new Date(wh.endDate + '-01') : undefined,
              isCurrent: wh.isCurrent || false,
              summary: wh.summary || '',
              skills: wh.skills || [],
              technologies: wh.technologies || [],
            },
          });
        }
      }

      // 4. Auto-create EducationEntry records
      if (parsed.educationEntries && parsed.educationEntries.length > 0) {
        for (const edu of parsed.educationEntries) {
          if (!edu.institution) continue;
          const exists = await prisma.educationEntry.findFirst({
            where: { userId: user.id, institution: edu.institution },
          });
          if (exists) continue;

          await prisma.educationEntry.create({
            data: {
              userId: user.id,
              institution: edu.institution,
              degree: edu.degree || '',
              fieldOfStudy: edu.fieldOfStudy || '',
              endDate: edu.endDate ? new Date(edu.endDate + '-06-01') : undefined,
              isCurrent: false,
            },
          });
        }
      }

      // 5. Bulk add skills (skip duplicates)
      const allSkills = [...new Set([...parsed.skills, ...parsed.technologies])];
      if (allSkills.length > 0) {
        const existing = await prisma.skill.findMany({
          where: { userId: user.id },
          select: { name: true },
        });
        const existingNames = new Set(existing.map((s: any) => s.name.toLowerCase()));
        const toAdd = allSkills.filter(s => !existingNames.has(s.toLowerCase())).slice(0, 60);
        if (toAdd.length > 0) {
          await prisma.skill.createMany({
            data: toAdd.map(name => ({ userId: user.id!, name, category: 'technical' })),
            skipDuplicates: true,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      profile: parsed,
      resume: {
        rawText: parsed.rawText || '',
        skills: parsed.skills,
        technologies: parsed.technologies,
        roles: parsed.roles,
        yearsExperience: parsed.yearsExperience,
        workHistory: parsed.workHistory || [],
        educationEntries: parsed.educationEntries || [],
        education: parsed.education || [],
      },
      message: parsed.skills.length + ' skills, ' +
        (parsed.workHistory?.length || 0) + ' positions, ' +
        (parsed.educationEntries?.length || 0) + ' education entries extracted',
      skillsAdded: parsed.skills.length,
      positionsFound: parsed.workHistory?.length || 0,
      educationFound: parsed.educationEntries?.length || 0,
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}

// GET /api/upload            -> list current user's resumes
// GET /api/upload?id=X       -> download the stored resume file
export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = request.nextUrl.searchParams.get('id');

  if (!id) {
    const resumes = await prisma.resume.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, fileType: true, isBase: true, createdAt: true, fileUrl: true },
    });
    return NextResponse.json({
      resumes: resumes.map((r: { id: string; name: string; fileType: string | null; isBase: boolean; createdAt: Date; fileUrl: string | null }) => ({
        id: r.id,
        name: r.name,
        fileType: r.fileType,
        isBase: r.isBase,
        createdAt: r.createdAt,
        hasFile: !!r.fileUrl?.startsWith('storage://'),
      })),
      persistentStorage: isPersistent(),
    });
  }

  const resume = await prisma.resume.findFirst({ where: { id, userId: user.id } });
  if (!resume) return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
  if (!resume.fileUrl?.startsWith('storage://')) {
    return NextResponse.json({ error: 'No stored file for this resume (uploaded before file storage was enabled). Re-upload to attach the file.' }, { status: 404 });
  }

  const key = resume.fileUrl.slice('storage://'.length);
  try {
    const data = await getFile(key);
    const filename = key.split('/').pop() || 'resume';
    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        'Content-Type': contentTypeFor(filename),
        'Content-Disposition': `attachment; filename="${filename.replace(/"/g, '')}"`,
        'Content-Length': String(data.length),
      },
    });
  } catch {
    return NextResponse.json({ error: 'Stored file missing on disk. Re-upload the resume.' }, { status: 410 });
  }
}

// DELETE /api/upload?id=X  -> delete resume record + stored file
// (The profile page already calls this; the handler previously did not exist.)
export async function DELETE(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const resume = await prisma.resume.findFirst({ where: { id, userId: user.id } });
  if (!resume) return NextResponse.json({ error: 'Resume not found' }, { status: 404 });

  if (resume.fileUrl?.startsWith('storage://')) {
    await deleteFile(resume.fileUrl.slice('storage://'.length));
  }
  await prisma.resume.delete({ where: { id: resume.id } });

  return NextResponse.json({ success: true });
}
