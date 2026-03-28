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
    const user = await getCurrentUserFromRequest(request);
    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only PDF and DOCX allowed.' }, { status: 400 });
    }

    const uploadsDir = join(process.cwd(), 'public', 'uploads');
    mkdirSync(uploadsDir, { recursive: true });

    const filename = `resume-${Date.now()}-${file.name}`;
    const filepath = join(uploadsDir, filename);

    const bytes = await file.arrayBuffer();
    writeFileSync(filepath, Buffer.from(bytes));

    const parsedResume = await parseResume(filepath);

    const profile = await prisma.userProfile.upsert({
      where: { userId: user.id },
      update: {
        skills: parsedResume.skills,
        roles: parsedResume.roles,
        industries: parsedResume.industries,
        yearsExperience: parsedResume.yearsExperience,
        education: parsedResume.education,
        technologies: parsedResume.technologies,
        resumeUrl: `/uploads/${filename}`,
      },
      create: {
        userId: user.id,
        skills: parsedResume.skills,
        roles: parsedResume.roles,
        industries: parsedResume.industries,
        yearsExperience: parsedResume.yearsExperience,
        education: parsedResume.education,
        technologies: parsedResume.technologies,
        resumeUrl: `/uploads/${filename}`,
      },
    });

    return NextResponse.json({ success: true, data: parsedResume, profile }, { status: 200 });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Upload failed' }, { status: 500 });
  }
}
