import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { parseResume } from '@/lib/resume-parser';
import { prisma } from '@/lib/db';
import { getCurrentUserFromRequest } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Auth is optional — parse for everyone, save to DB only when signed in
    const user = await getCurrentUserFromRequest(request);

    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    // Accept by extension when MIME type is blank (common in some browsers)
    const ext = '.' + (file.name.split('.').pop()?.toLowerCase() || '');
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      '',
    ];
    const allowedExts = ['.pdf', '.docx', '.doc', '.txt'];
    if (!allowedTypes.includes(file.type) && !allowedExts.includes(ext)) {
      return NextResponse.json({ error: 'PDF or DOCX only' }, { status: 400 });
    }

    const uploadsDir = join(process.cwd(), 'public', 'uploads');
    mkdirSync(uploadsDir, { recursive: true });
    const filename = 'resume-' + Date.now() + '-' + file.name;
    const filepath = join(uploadsDir, filename);
    const bytes = await file.arrayBuffer();
    writeFileSync(filepath, Buffer.from(bytes));

    const parsedResume = await parseResume(filepath);

    // Save to DB only if authenticated
    if (user?.id) {
      // 1. Update flat UserProfile
      await prisma.userProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          skills: parsedResume.skills,
          roles: parsedResume.roles,
          industries: parsedResume.industries,
          yearsExperience: parsedResume.yearsExperience,
          education: parsedResume.education,
          technologies: parsedResume.technologies,
          resumeUrl: '/uploads/' + filename,
        },
        update: {
          skills: parsedResume.skills,
          roles: parsedResume.roles,
          industries: parsedResume.industries,
          yearsExperience: parsedResume.yearsExperience,
          education: parsedResume.education,
          technologies: parsedResume.technologies,
          resumeUrl: '/uploads/' + filename,
        },
      });

      // 2. Save Resume record
      await prisma.resume.create({
        data: {
          userId: user.id,
          name: 'Uploaded ' + new Date().toLocaleDateString(),
          fileUrl: '/uploads/' + filename,
          fileType: file.type.includes('pdf') || ext === '.pdf' ? 'pdf' : 'docx',
          isBase: true,
          rawText: parsedResume.rawText || '',
        },
      });

      // 3. Bulk add skills (skip duplicates)
      const allSkills = [...new Set([...parsedResume.skills, ...parsedResume.technologies])];
      if (allSkills.length > 0) {
        const existing = await prisma.skill.findMany({
          where: { userId: user.id },
          select: { name: true },
        });
        const existingNames = new Set(existing.map(s => s.name.toLowerCase()));
        const toAdd = allSkills.filter(s => !existingNames.has(s.toLowerCase())).slice(0, 50);
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
      profile: parsedResume,
      resume: {
        rawText: parsedResume.rawText || '',
        skills: parsedResume.skills,
        technologies: parsedResume.technologies,
        roles: parsedResume.roles,
        yearsExperience: parsedResume.yearsExperience,
      },
      message: parsedResume.skills.length + ' skills, ' + parsedResume.technologies.length + ' technologies, ' + parsedResume.yearsExperience + ' years experience detected',
      skillsAdded: parsedResume.skills.length,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
