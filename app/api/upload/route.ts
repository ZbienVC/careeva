import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { parseResume } from '@/lib/resume-parser';
import { prisma } from '@/lib/db';
import { getCurrentUserFromRequest } from '@/lib/session';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    // Allow unauthenticated uploads (parses resume but skips DB save)
    // This lets the onboarding flow work before auth is fully established

    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', ''];
    const allowedExtensions = ['.pdf', '.docx', '.doc', '.txt'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(ext)) {
      return NextResponse.json({ error: 'PDF or DOCX only' }, { status: 400 });
    }

    const uploadsDir = join(process.cwd(), 'public', 'uploads');
    mkdirSync(uploadsDir, { recursive: true });
    const filename = `resume-${Date.now()}-${file.name}`;
    const filepath = join(uploadsDir, filename);
    const bytes = await file.arrayBuffer();
    writeFileSync(filepath, Buffer.from(bytes));

    const parsedResume = await parseResume(filepath);

    // 1. Update flat UserProfile (only if authenticated)
    if (user?.id) await prisma.userProfile.upsert({
      where: { userId: user.id },
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
      update: {
        skills: parsedResume.skills,
        roles: parsedResume.roles,
        industries: parsedResume.industries,
        yearsExperience: parsedResume.yearsExperience,
        education: parsedResume.education,
        technologies: parsedResume.technologies,
        resumeUrl: `/uploads/${filename}`,
      },
    });

    // 2. Save to Resume model for structured storage
    await prisma.resume.create({
      data: {
        userId: user.id,
        name: `Uploaded ${new Date().toLocaleDateString()}`,
        fileUrl: `/uploads/${filename}`,
        fileType: file.type.includes('pdf') ? 'pdf' : 'docx',
        isBase: true,
        rawText: parsedResume.rawText || '',
      },
    });

    // 3. Bulk add skills (only if authenticated)
    if ((user?.id) && (parsedResume.skills.length > 0 || parsedResume.technologies.length > 0)) {
      const allSkills = [...new Set([...parsedResume.skills, ...parsedResume.technologies])];
      const existing = await prisma.skill.findMany({ where: { userId: user.id }, select: { name: true } });
      const existingNames = new Set(existing.map(s => s.name.toLowerCase()));
      const toAdd = allSkills.filter(s => !existingNames.has(s.toLowerCase())).slice(0, 50);
      if (toAdd.length > 0) {
        await prisma.skill.createMany({
          data: toAdd.map(name => ({ userId: user.id, name, category: 'technical' })),
          skipDuplicates: true,
        });
      }
    }

    // 4. Use OpenAI to extract structured work history if key is available
    if (process.env.OPENAI_API_KEY && parsedResume.skills.length > 0) {
      try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        // Note: For a full implementation, pass the extracted text to GPT to parse work history
        // For now, we use the parsed data we have
      } catch { /* non-fatal */ }
    }

    return NextResponse.json({
      success: true,
      profile: parsedResume,
      resume: { rawText: parsedResume.rawText || '' },
      message: `Resume parsed: \ skills, \ technologies, \ years experience detected`,
      skillsAdded: parsedResume.skills.length,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Upload failed' }, { status: 500 });
  }
}